import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { logBackendError } from '../routes/errorLogRoutes';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  details: string[];
  constructor(message: string, details: string[] = []) {
    super(message, 400);
    this.details = details;
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    logger.warn(`[${req.method}] ${req.path} - ${err.statusCode}: ${err.message}`);
    const response: any = { error: err.message };
    if (err instanceof ValidationError && err.details.length > 0) {
      response.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  logger.error(`[${req.method}] ${req.path} - Unhandled error:`, err);

  // Persist unhandled backend errors to error_logs table
  const user = (req as any).user;
  logBackendError({
    tenantId: user?.tenantId,
    message: err.message || 'Unknown backend error',
    stack: err.stack,
    path: `${req.method} ${req.path}`,
    severity: 'critical',
    metadata: {
      method: req.method,
      query: req.query,
      statusCode: 500,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    error: 'Internal server error',
    ...(isDev && { message: err.message, stack: err.stack }),
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
