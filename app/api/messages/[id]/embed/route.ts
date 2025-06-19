import { NextRequest, NextResponse } from 'next/server';
import { getSharedMessage } from '@/app/lib/db';

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
          body { font-family: Inter, Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0; }
          .embed-container { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 1.5em; margin: 1em; max-width: 600px; }
          .embed-sql { background: #222; color: #fff; border-radius: 4px; padding: 0.75em; margin-top: 1em; font-family: monospace; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="embed-container">
          <div><strong>Message:</strong></div>
          <div>${message.content ? renderMessageContentToHtml(message.content) : ''}</div>
        </div>
      </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error serving embed:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
