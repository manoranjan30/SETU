import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableMeta {
  module: string;
  action: string;
  /** Optional: name of the route param or body field to use as recordId */
  recordIdParam?: string;
}

/**
 * @Auditable() Decorator — Layer 2 of the Audit System
 * ======================================================
 * Attach this to any controller method to give the AuditInterceptor
 * rich, semantic, business-meaningful metadata about what this endpoint does.
 *
 * WITHOUT this decorator: AuditInterceptor still logs using the HTTP method
 * and route prefix (coarse-grained, automatic). Called "Layer 1".
 *
 * WITH this decorator: AuditInterceptor uses your declared module/action
 * names for precise, human-readable audit entries. Called "Layer 2".
 *
 * @param module   - The business domain (e.g., 'WBS', 'QUALITY', 'SCHEDULE')
 * @param action   - The specific action (e.g., 'DELETE_NODE', 'RAISE_RFI', 'APPROVE')
 * @param recordIdParam - Optional. Which route param or body key gives the Record ID.
 *                        Defaults to 'id' if not set.
 *
 * @example
 * ```ts
 * @Delete(':id')
 * @Auditable('WBS', 'DELETE_NODE', 'id')
 * async remove(@Param('id') id: string) { ... }
 *
 * @Post()
 * @Auditable('QUALITY', 'RAISE_RFI')
 * async raiseRfi(@Body() dto: CreateRfiDto) { ... }
 * ```
 */
export const Auditable = (
  module: string,
  action: string,
  recordIdParam?: string,
) =>
  SetMetadata(AUDITABLE_KEY, {
    module,
    action,
    recordIdParam,
  } as AuditableMeta);
