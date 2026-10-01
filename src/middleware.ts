import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api') && !request.nextUrl.pathname.startsWith('/api/attachments/')) {
    const required = process.env.INTERNAL_SECRET;
    if (required) {
      if (request.headers.get('x-internal-secret') !== required) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // Fail closed: Electron and the smoke harness always inject a per-launch
      // secret. Serving production APIs with no secret configured would leave
      // every route unauthenticated.
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 });
    }
  }
  return NextResponse.next();
}
