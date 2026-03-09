#!/usr/bin/env python3
"""HTTP server with gzip compression and caching for production."""
import gzip
import http.server
import io
import os
import sys

GZIP_TYPES = {
    '.html', '.css', '.js', '.json', '.svg', '.xml', '.txt',
}

CACHE_MAX_AGE = {
    '.html': 'no-cache',
    '.webp': 'public, max-age=31536000, immutable',
    '.png': 'public, max-age=31536000, immutable',
    '.css': 'public, max-age=86400',
    '.js': 'public, max-age=86400',
}

class OptimizedHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        ext = os.path.splitext(self.path.split('?')[0])[1].lower()
        cache = CACHE_MAX_AGE.get(ext, 'no-cache')
        self.send_header('Cache-Control', cache)
        super().end_headers()

    def do_GET(self):
        ext = os.path.splitext(self.path.split('?')[0])[1].lower()
        accept_encoding = self.headers.get('Accept-Encoding', '')

        if ext in GZIP_TYPES and 'gzip' in accept_encoding:
            path = self.translate_path(self.path)
            try:
                with open(path, 'rb') as f:
                    content = f.read()
            except (FileNotFoundError, IsADirectoryError):
                super().do_GET()
                return

            compressed = gzip.compress(content)
            self.send_response(200)
            ctype = self.guess_type(path)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Content-Length', str(len(compressed)))
            self.end_headers()
            self.wfile.write(compressed)
        else:
            super().do_GET()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8080))
    with http.server.HTTPServer(('', port), OptimizedHandler) as httpd:
        print(f'Serving on port {port} (gzip + caching)')
        httpd.serve_forever()
