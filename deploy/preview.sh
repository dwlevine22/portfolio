#!/usr/bin/env bash
# Preview the site on this Mac at http://localhost:8000 (press Control+C to stop).
# Like the live server, it serves clean addresses: /projects shows projects.html.
# (Security headers and the www redirect only apply on Cloud Run.)
cd "$(dirname "$0")/../public" || exit 1
echo "Previewing at http://localhost:8000  (Control+C to stop)"
exec python3 -I -c '
import http.server, os
class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path != "/" and not os.path.splitext(path)[1] and os.path.isfile("." + path.rstrip("/") + ".html"):
            self.path = path.rstrip("/") + ".html"
        return super().send_head()
    def send_error(self, code, message=None, explain=None):
        if code == 404 and os.path.isfile("404.html"):
            body = open("404.html", "rb").read()
            self.send_response(404); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
        else:
            super().send_error(code, message, explain)
http.server.ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
'
