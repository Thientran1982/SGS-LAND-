type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'INFO';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(level: LogLevel, message: string, meta?: any): string {
  const timestamp = formatTimestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}]${metaStr} ${message}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(message: string, meta?: any) {
    if (shouldLog('DEBUG')) console.debug(formatLog('DEBUG', message, meta));
  },

  info(message: string, meta?: any) {
    if (shouldLog('INFO')) console.log(formatLog('INFO', message, meta));
  },

  warn(message: string, meta?: any) {
    if (shouldLog('WARN')) console.warn(formatLog('WARN', message, meta));
  },

  error(message: string, error?: any) {
    if (shouldLog('ERROR')) {
      const meta: any = {};
      if (error instanceof Error) {
        meta.errorMessage = error.message;
        meta.stack = error.stack;
      } else if (error) {
        meta.error = error;
      }
      console.error(formatLog('ERROR', message, Object.keys(meta).length > 0 ? meta : undefined));
    }
  },

  request(method: string, path: string, statusCode: number, durationMs: number, userId?: string) {
    if (shouldLog('INFO')) {
      const meta: any = { method, path, status: statusCode, duration: `${durationMs}ms` };
      if (userId) meta.userId = userId;
      console.log(formatLog('INFO', `${method} ${path} ${statusCode} ${durationMs}ms`, meta));
    }
  },

  audit(action: string, userId: string, details?: any) {
    const meta: any = { action, userId, type: 'AUDIT' };
    if (details) meta.details = details;
    console.log(formatLog('INFO', `AUDIT: ${action} by ${userId}`, meta));
  },
};

export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args: any[]) {
    const duration = Date.now() - start;
    const userId = req.user?.id;
    if (!req.path.startsWith('/@') && !req.path.startsWith('/node_modules') && !req.path.includes('__vite')) {
      logger.request(req.method, req.path, res.statusCode, duration, userId);
    }
    originalEnd.apply(res, args);
  };

  next();
}
