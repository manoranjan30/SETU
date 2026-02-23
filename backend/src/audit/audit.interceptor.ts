import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import {
    ROUTE_MODULE_MAP,
    HTTP_METHOD_ACTION_MAP,
    AUDIT_SKIP_ROUTES,
} from './audit-module-map';
import { AUDITABLE_KEY, AuditableMeta } from './auditable.decorator';

/**
 * AuditInterceptor — Layer 1 (and Layer 2) of the Audit System
 * =============================================================
 * This global interceptor automatically captures ALL mutating HTTP requests
 * (POST, PUT, PATCH, DELETE) and logs them to the audit_logs table.
 *
 * Layer 1 (Automatic): Derives module/action from route path + HTTP method.
 * Layer 2 (Semantic): If @Auditable() is present on the controller method,
 *                     uses the declared module/action instead of derived values.
 *
 * This means ANY new module added to the platform is automatically audited
 * without any changes to this file — just update audit-module-map.ts.
 *
 * KEY BEHAVIORS:
 * - Read-only requests (GET) are NEVER logged.
 * - Audit logs are written AFTER the response succeeds (no false-positives).
 * - Errors in the interceptor itself NEVER break the main request flow.
 * - Log entries include: userId, module, action, recordId, projectId, ipAddress.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
    private readonly logger = new Logger('AuditInterceptor');

    constructor(
        private readonly reflector: Reflector,
        private readonly auditService: AuditService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, user, ip, headers } = request;

        // 1. Only log mutating requests
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return next.handle();
        }

        // 2. Normalise the URL path (strip query string)
        const path = url.split('?')[0];

        // 3. Skip explicitly ignored routes
        const shouldSkip = AUDIT_SKIP_ROUTES.some(skip => path.startsWith(skip));
        if (shouldSkip) return next.handle();

        // 4. Require authenticated user — skip if no user context
        if (!user?.id) return next.handle();

        return next.handle().pipe(
            tap({
                next: (responseData) => {
                    // Fire-and-forget — never await, never block the response
                    this.captureLog(
                        context,
                        request,
                        path,
                        method,
                        user,
                        ip,
                        headers,
                        responseData,
                    ).catch(err =>
                        this.logger.error('Audit write failed (non-blocking)', err?.message),
                    );
                },
                // Errors are NOT logged here — a failed action shouldn't create an audit entry
            }),
        );
    }

    private async captureLog(
        context: ExecutionContext,
        request: any,
        path: string,
        method: string,
        user: any,
        ip: string,
        headers: any,
        responseData: any,
    ): Promise<void> {
        try {
            // --- Resolve Module & Action ---

            // Check for @Auditable() decorator first (Layer 2)
            const auditMeta = this.reflector.getAllAndOverride<AuditableMeta>(
                AUDITABLE_KEY,
                [context.getHandler(), context.getClass()],
            );

            let module: string;
            let action: string;
            let recordId: number | undefined;

            if (auditMeta) {
                // Layer 2: Use decorator-defined values (precise, semantic)
                module = auditMeta.module;
                action = auditMeta.action;
                const paramKey = auditMeta.recordIdParam || 'id';
                recordId = request.params?.[paramKey]
                    ? parseInt(request.params[paramKey])
                    : responseData?.id;
            } else {
                // Layer 1: Derive from route path + HTTP method (automatic)
                module = this.resolveModule(path);
                action = this.resolveAction(method, path);

                // Try to get recordId from common patterns
                recordId =
                    request.params?.id
                        ? parseInt(request.params.id)
                        : responseData?.id;
            }

            // If module is unknown, still log with 'UNKNOWN' to catch gaps
            if (!module) module = 'UNKNOWN';

            // --- Resolve Project Context ---
            const projectId: number | undefined =
                request.params?.projectId
                    ? parseInt(request.params.projectId)
                    : request.projectContext?.projectId
                    ?? responseData?.projectId
                    ?? undefined;

            // --- Resolve Client IP (respects reverse proxies) ---
            const clientIp: string =
                headers['x-forwarded-for']?.split(',')[0]?.trim() || ip;

            // --- Build Details (lightweight summary) ---
            const details = this.buildDetails(method, path, request.body, responseData);

            // --- Write Log ---
            await this.auditService.log(
                user.id,
                module,
                action,
                recordId,
                projectId,
                details,
                clientIp,
            );
        } catch (error) {
            // Swallow all errors — audit failure must NEVER affect the user
            this.logger.error('AuditInterceptor.captureLog error:', error?.message);
        }
    }

    /**
     * Resolve the module name from the URL path using the ROUTE_MODULE_MAP registry.
     * Sorts prefixes by length (descending) to ensure most-specific match wins.
     */
    private resolveModule(path: string): string {
        const sortedPrefixes = Object.keys(ROUTE_MODULE_MAP).sort(
            (a, b) => b.length - a.length,
        );

        for (const prefix of sortedPrefixes) {
            if (path.includes(prefix)) {
                return ROUTE_MODULE_MAP[prefix];
            }
        }

        return 'UNKNOWN';
    }

    /**
     * Derive a human-readable action name from HTTP method and URL path segments.
     * e.g. DELETE /projects/1/wbs/5 → 'DELETE'
     *      POST   /projects/1/wbs   → 'CREATE'
     *      POST   /quality/approvals/status → 'UPDATE_STATUS'
     */
    private resolveAction(method: string, path: string): string {
        const baseVerb = HTTP_METHOD_ACTION_MAP[method] ?? method;

        // Enrich with path-based context clues
        const pathLower = path.toLowerCase();
        if (pathLower.includes('/status')) return `${baseVerb}_STATUS`;
        if (pathLower.includes('/approve')) return `${baseVerb}_APPROVED`;
        if (pathLower.includes('/reject')) return `${baseVerb}_REJECTED`;
        if (pathLower.includes('/assign')) return 'ASSIGN';
        if (pathLower.includes('/clone')) return 'CLONE';
        if (pathLower.includes('/import')) return 'IMPORT';
        if (pathLower.includes('/export')) return 'EXPORT';
        if (pathLower.includes('/distribute')) return `DISTRIBUTE`;
        if (pathLower.includes('/undistribute')) return `UNDISTRIBUTE`;

        return baseVerb;
    }

    /**
     * Build a lightweight details summary for the log entry.
     * Sanitises sensitive fields to avoid storing passwords etc. in audit logs.
     */
    private buildDetails(
        method: string,
        path: string,
        body: any,
        responseData: any,
    ): Record<string, any> | undefined {
        const details: Record<string, any> = {};

        // Remove sensitive fields from body snapshot
        if (body && typeof body === 'object') {
            const sanitised = { ...body };
            delete sanitised.password;
            delete sanitised.passwordHash;
            delete sanitised.token;
            delete sanitised.secret;

            // Only include body for create/update actions (POST/PATCH/PUT)
            if (['POST', 'PATCH', 'PUT'].includes(method)) {
                // Limit to avoid huge jsonb payloads — only key identifiers
                details.requestSummary = Object.fromEntries(
                    Object.entries(sanitised)
                        .filter(([, v]) => typeof v !== 'object' || v === null)
                        .slice(0, 10), // Max 10 scalar fields
                );
            }
        }

        // Record the response status (e.g., was a record created?)
        if (responseData?.id) details.resultId = responseData.id;
        if (responseData?.status) details.resultStatus = responseData.status;

        return Object.keys(details).length > 0 ? details : undefined;
    }
}
