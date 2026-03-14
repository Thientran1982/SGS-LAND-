import { Router, Request, Response } from 'express';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { auditRepository } from '../repositories/auditRepository';
import { emailService } from '../services/emailService';

export function createEnterpriseRoutes(authenticateToken: any) {
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
      res.json(updated);
    } catch (error) {
      console.error('Error updating enterprise config:', error);
      res.status(500).json({ error: 'Failed to update enterprise config' });
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

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
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
      res.json({
        webhookSecretConfigured: !!process.env.ZALO_OA_SECRET,
        appIdConfigured: !!process.env.ZALO_APP_ID,
        webhookUrl: `${process.env.PUBLIC_URL || ''}/api/webhooks/zalo`,
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

      const { appId, oaId, oaName, appSecret } = req.body;

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
      });

      console.log(`[Zalo] Tenant ${user.tenantId} connected OA: ${oaName} (${oaId})`);
      res.json({ success: true, webhookUrl, zalo: zaloConfig });
    } catch (error: any) {
      console.error('Zalo connect error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect Zalo OA' });
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
      res.json({
        appSecretConfigured: !!process.env.FB_APP_SECRET,
        verifyTokenConfigured: !!process.env.FB_VERIFY_TOKEN,
        webhookUrl: `${process.env.PUBLIC_URL || ''}/api/webhooks/facebook`,
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
      });

      console.log(`[Facebook] Tenant ${user.tenantId} disconnected page: ${pageId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Facebook disconnect error:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect Facebook Page' });
    }
  });

  return router;
}
