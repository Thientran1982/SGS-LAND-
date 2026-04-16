import { Router, Request, Response } from 'express';
import { interactionRepository } from '../repositories/interactionRepository';

export function createInteractionRoutes(authenticateToken: any, getBroadcast?: () => any) {
  const router = Router();

  router.get('/threads', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const threads = await interactionRepository.getInboxThreads(user.tenantId, user.id, user.role);
      res.json(threads);
    } catch (error) {
      console.error('Error fetching inbox threads:', error);
      res.status(500).json({ error: 'Failed to fetch inbox threads' });
    }
  });

  router.put('/threads/:leadId/read', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      await interactionRepository.markThreadAsRead(user.tenantId, String(req.params.leadId));
      res.json({ message: 'Thread marked as read' });
    } catch (error) {
      console.error('Error marking thread as read:', error);
      res.status(500).json({ error: 'Failed to mark thread as read' });
    }
  });

  router.put('/threads/:leadId/ai-mode', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { status } = req.body;
      if (!['AI_ACTIVE', 'HUMAN_TAKEOVER'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be AI_ACTIVE or HUMAN_TAKEOVER' });
      }
      const leadId = String(req.params.leadId);
      await interactionRepository.updateThreadAiMode(user.tenantId, leadId, status);
      // Broadcast real-time mode change to:
      // 1. Customer's live chat widget (joined via join_livechat_room)
      // 2. All agents in the tenant (joined via tenant:tenantId room)
      const io = getBroadcast?.();
      if (io) {
        io.to(leadId).emit('ai_mode_changed', { leadId, status });
        io.to(`tenant:${user.tenantId}`).emit('ai_mode_changed', { leadId, status });
      }
      res.json({ leadId, status });
    } catch (error) {
      console.error('Error updating thread AI mode:', error);
      res.status(500).json({ error: 'Failed to update AI mode' });
    }
  });

  router.delete('/threads/:leadId', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'ADMIN' && user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Only admins and team leads can delete conversations' });
      }
      const deleted = await interactionRepository.deleteConversation(user.tenantId, String(req.params.leadId));
      if (!deleted) return res.status(404).json({ error: 'Conversation not found' });
      res.json({ message: 'Conversation deleted' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const since = req.query.since as string;
      const stats = await interactionRepository.getInteractionStats(user.tenantId, since);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching interaction stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return router;
}
