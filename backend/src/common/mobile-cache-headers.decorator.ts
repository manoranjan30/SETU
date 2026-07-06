import { applyDecorators, Header } from '@nestjs/common';

export function MobileCacheHeaders() {
  return applyDecorators(
    Header('Cache-Control', 'private, max-age=180'),
    Header('Vary', 'Authorization'),
  );
}
