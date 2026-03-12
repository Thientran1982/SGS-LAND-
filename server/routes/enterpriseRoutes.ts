import { Router, Request, Response } from 'express';
import { enterpriseConfigRepository } from '../repositories/enterpriseConfigRepository';
import { auditRepository } from '../repositories/auditRepository';
import { emailService } from '../services/emailService';

export function createEnterpriseRoutes(authenticateToken: any) {
  const router = Router();

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

  return router;
}
