// server/routes/twoFactorRoutes.ts
// Admin 2FA (TOTP authenticator app) enrollment & management endpoints.
// Mounted under /api/auth/2fa. The login-time gate lives in the login handler.
import { Router, Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository';
import {
  generateSecret, otpauthUrl, verifyToken, encryptSecret, decryptSecret,
  generateBackupCodes, hashBackupCode,
} from '../utils/totp';
import { writeAuditLog } from '../middleware/auditLog';

export function createTwoFactorRoutes(authenticateToken: any) {
  const router = Router();

  // Step 1: generate a fresh secret + provisioning URL (not yet enabled).
  router.post('/setup', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const secret = generateSecret();
      const backupCodes = generateBackupCodes();
      const backupHashes = backupCodes.map(hashBackupCode);
      await userRepository.setTotpSecret(user.tenantId, user.id, encryptSecret(secret), backupHashes);
      const url = otpauthUrl(secret, user.email || user.id);
      // Secret + backup codes are shown ONCE here for the user to save.
      return res.json({ secret, otpauthUrl: url, backupCodes });
    } catch (e) {
      return res.status(500).json({ error: '2FA setup failed' });
    }
  });

  // Step 2: verify the first code to confirm the app is configured, then enable.
  router.post('/enable', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: 'Token is required' });
      const dbUser = await userRepository.findByIdDirect(user.id, user.tenantId);
      if (!dbUser || !dbUser.totpSecret) return res.status(400).json({ error: 'Run setup first' });
      const secret = decryptSecret(dbUser.totpSecret);
      if (!verifyToken(String(token), secret)) return res.status(400).json({ error: 'Invalid code' });
      await userRepository.enableTotp(user.tenantId, user.id);
      writeAuditLog(user.tenantId, user.id, 'USER_2FA_ENABLED', 'auth', user.id, undefined, req.ip);
      return res.json({ message: '2FA enabled' });
    } catch (e) {
      return res.status(500).json({ error: '2FA enable failed' });
    }
  });

  // Disable 2FA (requires a valid current code to prevent hijacked-session abuse).
  router.post('/disable', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { token } = req.body || {};
      if (!token) return res.status(400).json({ error: 'Token is required' });
      const dbUser = await userRepository.findByIdDirect(user.id, user.tenantId);
      if (!dbUser || !dbUser.totpSecret) return res.status(400).json({ error: '2FA not configured' });
      const secret = decryptSecret(dbUser.totpSecret);
      if (!verifyToken(String(token), secret)) return res.status(400).json({ error: 'Invalid code' });
      await userRepository.disableTotp(user.tenantId, user.id);
      writeAuditLog(user.tenantId, user.id, 'USER_2FA_DISABLED', 'auth', user.id, undefined, req.ip);
      return res.json({ message: '2FA disabled' });
    } catch (e) {
      return res.status(500).json({ error: '2FA disable failed' });
    }
  });

  // Current 2FA status for the logged-in user.
  router.get('/status', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const dbUser = await userRepository.findByIdDirect(user.id, user.tenantId);
      return res.json({ enabled: !!dbUser?.totpEnabled });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch 2FA status' });
    }
  });

  return router;
}
