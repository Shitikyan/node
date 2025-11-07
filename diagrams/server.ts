import { serve } from "bun";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";

const PORT = 8000;
const PUBLIC_DIR = import.meta.dir;

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // Default to index file
    if (pathname === '/') {
      pathname = '/UNIVERSAL_DIAGRAM_VIEWER.html';
    }

    // Construct file path
    const filePath = join(PUBLIC_DIR, pathname);

    // Check if file exists
    if (!existsSync(filePath)) {
      return new Response('404 Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Check if it's a directory
    if (statSync(filePath).isDirectory()) {
      return new Response('403 Forbidden - Directory listing not allowed', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    try {
      // Read file
      const content = readFileSync(filePath);

      // Determine MIME type
      const ext = extname(filePath);
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

      // Return response with aggressive no-cache headers
      return new Response(content, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
        },
      });
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return new Response('500 Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
});

console.log(`🚀 Server running at http://localhost:${PORT}/`);
console.log(`📁 Serving files from: ${PUBLIC_DIR}`);
console.log(`🔄 No-cache headers enabled for all responses`);
