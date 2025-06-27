import { NextRequest, NextResponse } from 'next/server';
import { getSharedMessage } from '@/app/lib/db';

/**
 * Validates and returns a properly formatted base URL with fallback chain
 */
function getValidatedBaseUrl(request: NextRequest): string {
  // Priority order: NEXT_PUBLIC_BASE_URL -> VERCEL_URL -> request host
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  
  if (!baseUrl && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }
  
  if (!baseUrl) {
    const { protocol, host } = request.nextUrl;
    baseUrl = `${protocol}//${host}`;
  }
  
  // Validate URL format and remove trailing slash
  try {
    const url = new URL(baseUrl);
    return url.origin;
  } catch (error) {
    // Fallback to localhost for development if all else fails
    console.error('Invalid base URL configuration:', error);
    return 'http://localhost:3000';
  }
}

/**
 * Builds and validates the shared page URL
 */
function buildSharedPageUrl(baseUrl: string, token: string): string {
  // Basic token validation (alphanumeric and common URL-safe characters)
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    throw new Error('Invalid token format');
  }
  
  return `${baseUrl}/messages/shared/${encodeURIComponent(token)}`;
}

// Utility to convert markdown-like SQL blocks to HTML
function renderMessageContentToHtml(content: string): string {
  // Replace ```sql ... ``` blocks with <pre><code class="sql">...</code></pre>
  let html = content
    .replace(/```sql[\s\S]*?```/g, (match) => {
      const sql = match.replace(/```sql/, '').replace(/```/, '').trim();
      return `<pre class="embed-sql"><code>${sql.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });
  // Bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

// GET /api/messages/[id]/embed?token=SHARE_TOKEN
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return new NextResponse('Missing token', { status: 400 });
    }

    // Build base URL with proper fallback chain and validation
    const baseUrl = getValidatedBaseUrl(request);
    let sharedPageUrl: string;
    
    try {
      sharedPageUrl = buildSharedPageUrl(baseUrl, token);
    } catch (error) {
      return new NextResponse('Invalid token format', { status: 400 });
    }

    console.log('sharedPageUrl', sharedPageUrl);
    const result = await getSharedMessage(token);
    const message = result?.message;
    
    if (!message) {
      return new NextResponse('Message not found', { status: 404 });
    }

    // Minimal HTML for embedding
    return new NextResponse(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Embedded Message</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 8px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .embed-container {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            padding: 24px;
            max-width: 600px;
            width: 100%;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .embed-message-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .embed-message-label {
            font-weight: 600;
            color: #2d3748;
          }
          .embed-link {
            text-decoration: none;
            padding: 1px 4px;
            border-radius: 2px;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 1px;
            white-space: nowrap;
          }
          .embed-link::after {
            content: "↗";
            font-size: 0.5rem;
          }
          .embed-link:hover {
            color: black;
          }
          .embed-content {
            line-height: 1.6;
            color: #4a5568;
          }
          .embed-content strong {
            color: #2d3748;
            font-weight: 600;
          }
          .embed-sql {
            background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
            color: #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-top: 16px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
            overflow-x: auto;
            border: 1px solid #4a5568;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            position: relative;
          }
          .embed-sql::before {
            content: "SQL";
            position: absolute;
            top: 8px;
            right: 12px;
            font-size: 0.75rem;
            color: #a0aec0;
            font-weight: 600;
          }
          .embed-sql code {
            color: #e2e8f0;
            font-size: 0.875rem;
            line-height: 1.5;
          }
          @media (max-width: 640px) {
            body { padding: 4px; }
            .embed-container { padding: 16px; margin: 0; }
            .embed-message-header { flex-direction: column; align-items: flex-start; gap: 4px; }
            .embed-link { font-size: 0.5625rem; }
          }
        </style>
      </head>
      <body>
        <div class="embed-container">
          <div class="embed-content">
            <div class="embed-message-header">
              <div class="embed-message-label"><strong>Message:
              <a href="${sharedPageUrl}" target="_blank" class="embed-link">View in Query Craft</a>
              </strong></div>
            </div>
            <div>${message.content ? renderMessageContentToHtml(message.content) : ''}</div>
          </div>
        </div>
      </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    // Use proper logging instead of console.log
    if (process.env.NODE_ENV === 'development') {
      console.error('Error serving embed:', error);
    }
    
    // Return appropriate error response based on error type
    if (error instanceof Error) {
      if (error.message.includes('Invalid token')) {
        return new NextResponse('Invalid token format', { status: 400 });
      }
      if (error.message.includes('not found')) {
        return new NextResponse('Resource not found', { status: 404 });
      }
    }
    
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}