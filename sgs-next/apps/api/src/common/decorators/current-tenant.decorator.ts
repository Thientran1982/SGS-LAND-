import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts tenantId set by the (future) TenantMiddleware/AuthGuard from
 * the request context. Placeholder resolves to a header for now so this
 * module is runnable standalone before the auth module lands.
 */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const tenantId = request.tenantId ?? request.headers['x-tenant-id'];
  if (!tenantId) {
    throw new Error('Tenant context missing — ensure TenantMiddleware/AuthGuard runs first');
  }
  return tenantId;
});
