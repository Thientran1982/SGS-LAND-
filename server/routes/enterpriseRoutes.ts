import { Router, Request, Response } from 'express';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { auditRepository } from '../repositories/auditRepository';
import { emailService } from '../services/emailService';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';

export function createEnterpriseRoutes(authenticateToken: any, io?: any) {
  const router = Router();

  // -----------------------------------------------------------------------
  // Config (generic)
  // -----------------------------------------------------------------------

  router.get('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can view enterprise config' });
      }
      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      res.json(config);
    } catch (error) {
      console.error('Error fetching enterprise config:', error);
      res.status(500).json({ error: 'Failed to fetch enterprise config' });
    }
  });

  router.put('/config', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update enterprise config' });
      }
      const updated = await enterpriseConfigRepository.upsertConfig(user.tenantId, req.body);

      const changedSections = Object.keys(req.body);
      if (changedSections.length > 0) {
        const actionMap: Record<string, string> = {
          email: 'EMAIL_CONFIG_UPDATED',
          sso: 'SSO_CONFIG_UPDATED',
        };
        const action = changedSections.length === 1 && actionMap[changedSections[0]]
          ? actionMap[changedSections[0]]
          : 'ENTERPRISE_CONFIG_UPDATED';
        await auditRepository.log(user.tenantId, {
          actorId: user.id,
          action,
          entityType: 'enterprise_config',
          entityId: user.tenantId,
          details: `Cập nhật cấu hình: ${changedSections.join(', ')}`,
          ipAddress: req.ip,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error('Error updating enterprise config:', error);
      res.status(500).json({ error: 'Failed to update enterprise config' });
    }
  });

  // -----------------------------------------------------------------------
  // Theme config
  // -----------------------------------------------------------------------

  const THEME_DEFAULTS = {
    primaryColor: '#4F46E5',
    fontFamily: 'Inter',
    fontScale: 'default',
    bgApp: '',
    bgSidebar: '',
    bgSurface: '',
  };

  function mergeThemeDefaults(raw: any): typeof THEME_DEFAULTS {
    return {
      primaryColor: (typeof raw?.primaryColor === 'string' && /^#[a-fA-F0-9]{6}$/.test(raw.primaryColor)) ? raw.primaryColor : THEME_DEFAULTS.primaryColor,
      fontFamily: (['Inter','Be Vietnam Pro','Plus Jakarta Sans','Roboto','Open Sans'].includes(raw?.fontFamily)) ? raw.fontFamily : THEME_DEFAULTS.fontFamily,
      fontScale: (['compact','default','large'].includes(raw?.fontScale)) ? raw.fontScale : THEME_DEFAULTS.fontScale,
      bgApp: (typeof raw?.bgApp === 'string' && (/^#[a-fA-F0-9]{6}$/.test(raw.bgApp) || raw.bgApp === '')) ? raw.bgApp : '',
      bgSidebar: (typeof raw?.bgSidebar === 'string' && (/^#[a-fA-F0-9]{6}$/.test(raw.bgSidebar) || raw.bgSidebar === '')) ? raw.bgSidebar : '',
      bgSurface: (typeof raw?.bgSurface === 'string' && (/^#[a-fA-F0-9]{6}$/.test(raw.bgSurface) || raw.bgSurface === '')) ? raw.bgSurface : '',
    };
  }

  router.get('/theme', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const raw = await enterpriseConfigRepository.getThemeConfig(user.tenantId);
      res.json(mergeThemeDefaults(raw));
    } catch (error) {
      console.error('Error fetching theme config:', error);
      res.status(500).json({ error: 'Failed to fetch theme config' });
    }
  });

  router.put('/theme', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update theme config' });
      }
      const validated = mergeThemeDefaults(req.body);
      const config = await enterpriseConfigRepository.saveThemeConfig(user.tenantId, validated);
      const result = mergeThemeDefaults(config);
      io?.to(`tenant:${user.tenantId}`).emit('theme_updated', result);
      res.json(result);
    } catch (error) {
      console.error('Error saving theme config:', error);
      res.status(500).json({ error: 'Failed to save theme config' });
    }
  });

  router.delete('/theme', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can reset theme config' });
      }
      await enterpriseConfigRepository.saveThemeConfig(user.tenantId, {});
      io?.to(`tenant:${user.tenantId}`).emit('theme_updated', THEME_DEFAULTS);
      res.json(THEME_DEFAULTS);
    } catch (error) {
      console.error('Error resetting theme config:', error);
      res.status(500).json({ error: 'Failed to reset theme config' });
    }
  });

  // -----------------------------------------------------------------------
  // Audit logs
  // -----------------------------------------------------------------------

  router.get('/audit-logs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can view audit logs' });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.max(1, Math.min(parseInt(req.query.pageSize as string) || 50, 200));
      const filters: any = {};
      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.since) filters.since = req.query.since;
      if (req.query.actorId) filters.actorId = req.query.actorId;

      const result = await auditRepository.findLogs(user.tenantId, { page, pageSize }, filters);
      res.json(result);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // -----------------------------------------------------------------------
  // Email / SMTP
  // -----------------------------------------------------------------------

  router.post('/verify-sso', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can verify SSO configuration' });
      }

      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const sso = config?.sso;

      if (!sso?.enabled) {
        return res.status(400).json({ error: 'SSO is not enabled. Enable SSO and save the configuration first.' });
      }
      if (!sso?.issuerUrl) {
        return res.status(400).json({ error: 'Issuer URL is required to verify OIDC configuration.' });
      }
      if (!sso?.clientId) {
        return res.status(400).json({ error: 'Client ID is required to verify OIDC configuration.' });
      }

      const discoveryUrl = `${sso.issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(discoveryUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          return res.status(400).json({ error: `OIDC discovery endpoint returned HTTP ${response.status}. Verify the Issuer URL is correct.` });
        }

        const metadata = await response.json();
        if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) {
          return res.status(400).json({ error: 'OIDC discovery response is missing required fields (issuer, authorization_endpoint, token_endpoint).' });
        }

        return res.json({
          success: true,
          message: 'OIDC configuration verified successfully',
          metadata: {
            issuer: metadata.issuer,
            authorizationEndpoint: metadata.authorization_endpoint,
            tokenEndpoint: metadata.token_endpoint,
            userinfoEndpoint: metadata.userinfo_endpoint,
            jwksUri: metadata.jwks_uri,
            supportedScopes: metadata.scopes_supported,
          },
        });
      } catch (fetchError: any) {
        clearTimeout(timeout);
        if (fetchError.name === 'AbortError') {
          return res.status(400).json({ error: 'Connection to OIDC discovery endpoint timed out after 8 seconds. Check that the Issuer URL is reachable.' });
        }
        return res.status(400).json({ error: `Failed to reach OIDC discovery endpoint: ${fetchError.message}` });
      }
    } catch (error: any) {
      console.error('SSO verify error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify SSO configuration' });
    }
  });

  router.post('/test-smtp', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can test SMTP' });
      }
      const result = await emailService.testSmtpConnection(user.tenantId);
      if (result.success) {
        res.json({ message: 'SMTP connection successful' });
      } else {
        res.status(400).json({ error: result.error || 'SMTP connection failed' });
      }
    } catch (error: any) {
      console.error('SMTP test error:', error);
      res.status(500).json({ error: error.message || 'Failed to test SMTP connection' });
    }
  });

  router.post('/send-test-email', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can send test emails' });
      }
      const { to } = req.body;
      const recipient = to || user.email;
      const result = await emailService.sendEmail(user.tenantId, {
        to: recipient,
        subject: 'SGS LAND - Test Email',
        html: '<div style="font-family: Arial, sans-serif; padding: 20px;"><h2 style="color: #4F46E5;">SMTP Test Successful!</h2><p>Your email configuration is working correctly.</p><p style="color: #94A3B8; font-size: 12px;">Sent from SGS LAND Enterprise Platform</p></div>',
        text: 'SMTP Test Successful! Your email configuration is working correctly.',
      });
      if (result.success) {
        res.json({ message: `Test email sent to ${recipient}` });
      } else {
        res.status(400).json({ error: result.error || 'Failed to send test email' });
      }
    } catch (error: any) {
      console.error('Send test email error:', error);
      res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
  });

  // -----------------------------------------------------------------------
  // Zalo OA
  // -----------------------------------------------------------------------

  /**
   * GET /api/enterprise/zalo/status
   * Returns whether ZALO_OA_SECRET env var is configured (no secret value exposed)
   */
  router.get('/zalo/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const baseUrl = process.env.PUBLIC_URL
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`);
      res.json({
        webhookSecretConfigured: !!process.env.ZALO_OA_SECRET,
        appIdConfigured: !!process.env.ZALO_APP_ID,
        webhookUrl: `${baseUrl}/api/webhooks/zalo`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/enterprise/zalo/connect
   * Saves Zalo OA credentials (App ID, OA ID, App Secret) to enterprise config.
   * In a full integration, this would exchange an OAuth code for tokens via Zalo API.
   */
  router.post('/zalo/connect', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can connect Zalo OA' });
      }

      const { appId, oaId, oaName, appSecret, accessToken } = req.body;

      if (!appId || !oaId || !oaName) {
        return res.status(400).json({ error: 'appId, oaId và oaName là bắt buộc' });
      }

      const webhookUrl = `${process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/api/webhooks/zalo`;

      const zaloConfig = {
        enabled: true,
        appId,
        oaId,
        oaName,
        appSecret: appSecret || undefined,
        accessToken: accessToken || undefined,
        webhookUrl,
        connectedAt: new Date().toISOString(),
      };

      await enterpriseConfigRepository.upsertConfig(user.tenantId, { zalo: zaloConfig });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'ZALO_OA_CONNECTED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Zalo OA kết nối: ${oaName} (${oaId})`,
        ipAddress: req.ip,
      });

      console.log(`[Zalo] Tenant ${user.tenantId} connected OA: ${oaName} (${oaId})`);
      res.json({ success: true, webhookUrl, zalo: zaloConfig });
    } catch (error: any) {
      console.error('Zalo connect error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect Zalo OA' });
    }
  });

  /**
   * PATCH /api/enterprise/zalo/token
   * Update only the OA Access Token (and optional Refresh Token) without reconnecting.
   * Useful when the token expires and admin needs to refresh it.
   */
  router.patch('/zalo/token', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update Zalo token' });
      }

      const { accessToken, refreshToken } = req.body;
      if (!accessToken) {
        return res.status(400).json({ error: 'accessToken là bắt buộc' });
      }

      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      if (!config.zalo?.enabled) {
        return res.status(400).json({ error: 'Zalo OA chưa được kết nối' });
      }

      const updatedZalo = {
        ...config.zalo,
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
      };

      await enterpriseConfigRepository.upsertConfig(user.tenantId, { zalo: updatedZalo });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'ZALO_OA_CONNECTED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: 'Cập nhật Zalo OA Access Token',
        ipAddress: req.ip,
      });

      console.log(`[Zalo] Tenant ${user.tenantId} updated OA access token`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Zalo token update error:', error);
      res.status(500).json({ error: error.message || 'Failed to update Zalo token' });
    }
  });

  /**
   * POST /api/enterprise/zalo/disconnect
   * Removes Zalo OA connection from enterprise config.
   */
  router.post('/zalo/disconnect', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can disconnect Zalo OA' });
      }

      const disconnected = { enabled: false, appId: '', oaId: '', oaName: '', webhookUrl: '', appSecret: '' };
      await enterpriseConfigRepository.upsertConfig(user.tenantId, { zalo: disconnected });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'ZALO_OA_DISCONNECTED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: 'Zalo OA đã ngắt kết nối',
        ipAddress: req.ip,
      });

      console.log(`[Zalo] Tenant ${user.tenantId} disconnected Zalo OA`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Zalo disconnect error:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect Zalo OA' });
    }
  });

  // -----------------------------------------------------------------------
  // Facebook Pages
  // -----------------------------------------------------------------------

  /**
   * GET /api/enterprise/facebook/status
   * Returns whether FB_APP_SECRET and FB_VERIFY_TOKEN env vars are configured.
   */
  router.get('/facebook/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
      const baseUrl = process.env.PUBLIC_URL
        || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : `${req.protocol}://${req.get('host')}`);
      res.json({
        appSecretConfigured: !!process.env.FB_APP_SECRET,
        verifyTokenConfigured: !!process.env.FB_VERIFY_TOKEN,
        webhookUrl: `${baseUrl}/api/webhooks/facebook`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/enterprise/facebook/connect
   * Adds a Facebook Page entry to enterprise config.
   */
  router.post('/facebook/connect', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can connect Facebook Pages' });
      }

      const { name, pageId, pageUrl, accessToken } = req.body;

      if (!name || !pageId) {
        return res.status(400).json({ error: 'name và pageId là bắt buộc' });
      }

      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const pages: any[] = config.facebookPages || [];

      if (pages.find((p: any) => p.id === pageId)) {
        return res.status(409).json({ error: `Page ID ${pageId} đã được kết nối` });
      }

      const newPage = {
        id: pageId,
        name,
        pageUrl: pageUrl || `https://facebook.com/${pageId}`,
        accessToken: accessToken || '',
        connectedAt: new Date().toISOString(),
        connectedBy: user.email || user.id,
      };
      pages.push(newPage);

      await enterpriseConfigRepository.upsertConfig(user.tenantId, { facebookPages: pages });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'FACEBOOK_PAGE_CONNECTED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Facebook Page kết nối: ${name} (${pageId})`,
        ipAddress: req.ip,
      });

      console.log(`[Facebook] Tenant ${user.tenantId} connected page: ${name} (${pageId})`);
      res.status(201).json({ success: true, page: newPage });
    } catch (error: any) {
      console.error('Facebook connect error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect Facebook Page' });
    }
  });

  /**
   * DELETE /api/enterprise/facebook/disconnect/:pageId
   * Removes a Facebook Page from enterprise config.
   */
  router.delete('/facebook/disconnect/:pageId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can disconnect Facebook Pages' });
      }

      const { pageId } = req.params;
      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const pages = (config.facebookPages || []).filter((p: any) => p.id !== pageId);

      await enterpriseConfigRepository.upsertConfig(user.tenantId, { facebookPages: pages });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'FACEBOOK_PAGE_DISCONNECTED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Facebook Page ngắt kết nối: ${pageId}`,
        ipAddress: req.ip,
      });

      console.log(`[Facebook] Tenant ${user.tenantId} disconnected page: ${pageId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Facebook disconnect error:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect Facebook Page' });
    }
  });

  // -----------------------------------------------------------------------
  // Domain Management
  // -----------------------------------------------------------------------

  router.post('/domains', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins can manage domains' });

      const { domain } = req.body;
      if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Domain name is required' });

      const normalized = domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      if (!normalized.includes('.') || normalized.length < 4 || !/^[a-z0-9.-]+$/.test(normalized)) {
        return res.status(400).json({ error: 'Invalid domain format. Use a valid domain like "example.com".' });
      }

      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const domains: any[] = config.domains || [];

      if (domains.find((d: any) => d.domain === normalized)) {
        return res.status(409).json({ error: `Domain "${normalized}" is already registered.` });
      }

      const verificationToken = `sgs-verify=${randomBytes(16).toString('hex')}`;
      const newDomain = {
        domain: normalized,
        verified: false,
        verificationTxtRecord: verificationToken,
        addedAt: new Date().toISOString(),
      };

      domains.push(newDomain);
      await enterpriseConfigRepository.upsertConfig(user.tenantId, { domains });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DOMAIN_ADDED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Domain thêm mới: ${normalized}`,
        ipAddress: req.ip,
      });

      res.status(201).json(newDomain);
    } catch (error: any) {
      console.error('Add domain error:', error);
      res.status(500).json({ error: error.message || 'Failed to add domain' });
    }
  });

  router.delete('/domains/:domain', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins can manage domains' });

      const domainName = decodeURIComponent(String(req.params.domain));
      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const domains = (config.domains || []).filter((d: any) => d.domain !== domainName);

      if (domains.length === (config.domains || []).length) {
        return res.status(404).json({ error: `Domain "${domainName}" not found.` });
      }

      await enterpriseConfigRepository.upsertConfig(user.tenantId, { domains });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DOMAIN_REMOVED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Domain xóa: ${domainName}`,
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Remove domain error:', error);
      res.status(500).json({ error: error.message || 'Failed to remove domain' });
    }
  });

  router.post('/domains/:domain/verify', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Only admins can verify domains' });

      const domainName = decodeURIComponent(String(req.params.domain));
      const config = await enterpriseConfigRepository.getConfig(user.tenantId);
      const domainEntry = (config.domains || []).find((d: any) => d.domain === domainName);

      if (!domainEntry) return res.status(404).json({ error: `Domain "${domainName}" not found.` });
      if (domainEntry.verified) return res.json({ success: true, message: 'Domain is already verified.' });

      const expectedRecord = domainEntry.verificationTxtRecord;
      if (!expectedRecord) return res.status(400).json({ error: 'No verification record found for this domain. Please remove and re-add the domain.' });

      let txtRecords: string[][] = [];
      try {
        txtRecords = await dns.resolveTxt(domainName);
      } catch (dnsError: any) {
        if (dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA') {
          return res.status(400).json({ error: `Domain "${domainName}" not found or has no DNS records. Please check the domain name.` });
        }
        if (dnsError.code === 'ENODATA' || dnsError.code === 'ESERVFAIL') {
          return res.status(400).json({ error: `No TXT records found for "${domainName}". Ensure you have added the DNS TXT record and wait up to 48 hours for DNS propagation.` });
        }
        return res.status(400).json({ error: `DNS lookup failed: ${dnsError.message}` });
      }

      const flatRecords = txtRecords.map(r => r.join(''));
      const found = flatRecords.some(r => r === expectedRecord || r.includes(expectedRecord));

      if (!found) {
        return res.status(400).json({
          error: `Verification TXT record not found. Add the following TXT record to your DNS:\n\nName: @\nValue: ${expectedRecord}\n\nFound records: ${flatRecords.length > 0 ? flatRecords.join(', ') : 'none'}`,
          expectedRecord,
          foundRecords: flatRecords,
        });
      }

      const updatedDomains = (config.domains || []).map((d: any) =>
        d.domain === domainName ? { ...d, verified: true, verifiedAt: new Date().toISOString() } : d
      );
      await enterpriseConfigRepository.upsertConfig(user.tenantId, { domains: updatedDomains });

      await auditRepository.log(user.tenantId, {
        actorId: user.id,
        action: 'DOMAIN_VERIFIED',
        entityType: 'enterprise_config',
        entityId: user.tenantId,
        details: `Domain xác minh thành công: ${domainName}`,
        ipAddress: req.ip,
      });

      res.json({ success: true, message: `Domain "${domainName}" verified successfully.` });
    } catch (error: any) {
      console.error('Verify domain error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify domain' });
    }
  });

  return router;
}
