import { Request, Response, NextFunction } from 'express';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(val: string): boolean {
  return UUID_REGEX.test(val);
}

function sanitizeString(val: string): string {
  return val
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

const SENSITIVE_KEYS = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'secret', 'token', 'apiKey', 'api_key', 'privateKey', 'private_key',
]);

function sanitizeObject(obj: any, parentKey?: string): any {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      const isSensitive = SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(parentKey ?? '');
      Object.defineProperty(sanitized, sanitizedKey, {
        value: isSensitive ? value : sanitizeObject(value, key),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return sanitized;
  }
  return obj;
}

export function validateUUIDParam(paramName = 'id') {
  return (req: Request, res: Response, next: NextFunction) => {
    const val = String(req.params[paramName] ?? '');
    if (val && !isValidUUID(val)) {
      return res.status(400).json({ error: `Invalid ${paramName} format. Must be a valid UUID.` });
    }
    next();
  };
}

export function validateBody(schema: Record<string, FieldValidator>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const body = req.body || {};

    for (const [field, validator] of Object.entries(schema)) {
      const value = body[field];

      if (validator.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (validator.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      } else if (validator.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
      } else if (validator.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field} must be a boolean`);
      } else if (validator.type === 'email' && typeof value === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`${field} must be a valid email address`);
        }
      } else if (validator.type === 'uuid' && typeof value === 'string') {
        if (!isValidUUID(value)) {
          errors.push(`${field} must be a valid UUID`);
        }
      } else if (validator.type === 'enum' && validator.values) {
        if (!validator.values.includes(value)) {
          errors.push(`${field} must be one of: ${validator.values.join(', ')}`);
        }
      }

      if (validator.type === 'string' && typeof value === 'string') {
        if (validator.minLength && value.length < validator.minLength) {
          errors.push(`${field} must be at least ${validator.minLength} characters`);
        }
        if (validator.maxLength && value.length > validator.maxLength) {
          errors.push(`${field} must be at most ${validator.maxLength} characters`);
        }
      }

      if (validator.type === 'number' && typeof value === 'number') {
        if (validator.min !== undefined && value < validator.min) {
          errors.push(`${field} must be at least ${validator.min}`);
        }
        if (validator.max !== undefined && value > validator.max) {
          errors.push(`${field} must be at most ${validator.max}`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
}

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

interface FieldValidator {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid' | 'enum' | 'object' | 'array';
  values?: any[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export const schemas = {
  login: {
    email: { required: true, type: 'email' as const },
    password: { required: true, type: 'string' as const, minLength: 1 },
  },
  register: {
    email: { required: true, type: 'email' as const },
    password: { required: true, type: 'string' as const, minLength: 8 },
    name: { required: false, type: 'string' as const, maxLength: 200 },
  },
  createLead: {
    name: { required: true, type: 'string' as const, minLength: 1, maxLength: 200 },
    phone: { required: false, type: 'string' as const, maxLength: 20 },
    email: { required: false, type: 'email' as const },
  },
  updateLead: {
    name: { required: false, type: 'string' as const, maxLength: 200 },
    phone: { required: false, type: 'string' as const, maxLength: 20 },
    email: { required: false, type: 'email' as const },
  },
  createListing: {
    title: { required: true, type: 'string' as const, minLength: 1, maxLength: 500 },
    price: { required: false, type: 'number' as const, min: 0 },
  },
  createProposal: {
    leadId: { required: true, type: 'uuid' as const },
    listingId: { required: true, type: 'uuid' as const },
    basePrice: { required: true, type: 'number' as const, min: 1 },
    finalPrice: { required: true, type: 'number' as const, min: 1 },
  },
  createContract: {
    leadId: { required: true, type: 'uuid' as const },
    listingId: { required: true, type: 'uuid' as const },
    type: { required: true, type: 'enum' as const, values: ['DEPOSIT', 'SALE', 'LEASE', 'SERVICE'] },
  },
  sendInteraction: {
    content: { required: true, type: 'string' as const, minLength: 1 },
  },
  aiProcessMessage: {
    userMessage: { required: true, type: 'string' as const, minLength: 1 },
  },
  aiScoreLead: {
    leadData: { required: true, type: 'object' as const },
  },
  aiValuation: {
    address: { required: true, type: 'string' as const, minLength: 1 },
    area: { required: true, type: 'number' as const, min: 0 },
    // Optional advanced inputs (Kfl, Kdir, Kmf, Kfurn, Kage)
    roadWidth:    { required: false, type: 'number' as const, min: 0 },
    floorLevel:   { required: false, type: 'number' as const, min: 0 },
    frontageWidth:{ required: false, type: 'number' as const, min: 0 },
    monthlyRent:  { required: false, type: 'number' as const, min: 0 },
    buildingAge:  { required: false, type: 'number' as const, min: 0 },
  },
};

export { isValidUUID };
