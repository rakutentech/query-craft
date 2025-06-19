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
    request.nextUrl.pathname.startsWith('/static') ||
    request.nextUrl.pathname === '/api/health'
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
    // Allow access /embed route without authentication
    if (request.nextUrl.pathname.startsWith('/api/messages/') && request.nextUrl.pathname.endsWith('/embed')) {
      const searchParams = request.nextUrl.searchParams;
      const tokenParam = searchParams.get('token');
      if (tokenParam) {
        // If token is provided, allow access to embed route
        return NextResponse.next();
      }
    }
    // For other API routes, check if token is present
    // If token is not present, return unauthorized
    if (!token?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Check session for protected pages
  if (!token?.sub) {
    const url = new URL('/auth/signin', process.env.NEXTAUTH_URL || request.url);
    url.searchParams.set('callbackUrl', process.env.NEXTAUTH_URL || request.url);
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