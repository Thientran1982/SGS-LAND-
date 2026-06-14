import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// L2 FIX: X-Request-ID middleware
// Assigns a unique request ID to every incoming request.
// - Reuses the ID from the client header if it looks like a valid UUID (for tracing from frontend)
// - Generates a new UUID otherwise
// - Attaches the ID to req object and echoes it back in X-Request-ID response header
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientId = req.headers['x-request-id'];
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const id = (typeof clientId === 'string' && UUID_PATTERN.test(clientId))
    ? clientId
    : randomUUID();

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
