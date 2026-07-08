import { applyDecorators, Header } from '@nestjs/common';

export function MobileCacheHeaders() {
  return applyDecorators(
    Header('Cache-Control', 'no-store, no-cache, must-revalidate, private'),
    Header('Pragma', 'no-cache'),
    Header('Expires', '0'),
    Header('Vary', 'Authorization'),
  );
}
