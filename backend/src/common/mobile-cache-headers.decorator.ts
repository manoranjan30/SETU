import { applyDecorators, Header } from '@nestjs/common';

export function MobileCacheHeaders() {
  return applyDecorators(
    Header('Cache-Control', 'private, max-age=60, stale-while-revalidate=120'),
    Header('Vary', 'Authorization'),
  );
}
