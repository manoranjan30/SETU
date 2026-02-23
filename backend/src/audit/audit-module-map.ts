/**
 * AUDIT MODULE REGISTRY
 * =====================
 * Central map that translates HTTP route prefixes → Audit module names.
 *
 * HOW TO ADD A NEW MODULE:
 * 1. Add one line: '/your-route-prefix': { module: 'YOUR_MODULE_NAME' }
 * 2. Done. The AuditInterceptor picks it up automatically.
 *
 * The interceptor scans the route path and finds the first matching prefix.
 * Longer/more-specific prefixes are matched first (the array is sorted by length desc).
 */
export const ROUTE_MODULE_MAP: Record<string, string> = {
    // Core Platform Modules
    '/wbs': 'WBS',
    '/quality': 'QUALITY',
    '/planning': 'SCHEDULE',
    '/micro-schedule': 'MICRO_SCHEDULE',
    '/boq': 'BOQ',
    '/eps': 'EPS',
    '/projects': 'TEAM',

    // Resources & Labor
    '/resources': 'RESOURCES',
    '/labor': 'LABOR',
    '/progress': 'PROGRESS',

    // Compliance & Safety
    '/ehs': 'EHS',
    '/design': 'DESIGN',
    '/workdoc': 'WORKDOC',

    // System & Admin
    '/users': 'AUTH',
    '/roles': 'AUTH',
    '/permissions': 'AUTH',
    '/audit': 'AUDIT',
    '/calendars': 'SYSTEM',
    '/template-builder': 'SYSTEM',
};

/**
 * Maps HTTP Method → default action verb.
 * Used when no @Auditable() decorator is present.
 */
export const HTTP_METHOD_ACTION_MAP: Record<string, string> = {
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
};

/**
 * Routes that are READ-ONLY and should NOT be logged.
 * GET requests are never logged by default (read-only).
 * Add specific POST routes here if they are read-only (e.g., search endpoints).
 */
export const AUDIT_SKIP_ROUTES: string[] = [
    '/auth/login',   // Login is separately audited with richer detail
    '/auth/profile',
    '/audit',        // Reading audit logs itself should not create more logs
];
