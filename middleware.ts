import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Only check session if OAuth is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_OAUTH !== 'true') {
    return NextResponse.next();
  }

  // Skip middleware for auth routes and public assets
  if (
    request.nextUrl.pathname.startsWith('/api/auth') ||
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/static')
  ) {
    return NextResponse.next();
  }

  // Allow access to shared messages without authentication
  if (request.nextUrl.pathname.startsWith('/api/messages/shared/')) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request });

  // Check session for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Check session for protected pages
  if (!token?.sub) {
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/settings',
    '/'
  ]
}; 