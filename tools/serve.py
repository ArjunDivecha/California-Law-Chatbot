#!/usr/bin/env python3
"""Local dev server with no-cache headers for the NER test page."""
import http.server
import os
import socketserver

PORT = 8765
DIR = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


os.chdir(DIR)
with socketserver.TCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    print(f"Serving {DIR} at http://localhost:{PORT}/")
    httpd.serve_forever()
