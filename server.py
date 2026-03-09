#!/usr/bin/env python3
"""Simple HTTP server with no-cache headers for development."""
import http.server
import os
import sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8080))
    with http.server.HTTPServer(('', port), NoCacheHandler) as httpd:
        print(f'Serving on port {port} (no-cache)')
        httpd.serve_forever()
