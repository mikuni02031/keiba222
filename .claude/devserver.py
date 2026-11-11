# 開発用: キャッシュ無効のローカルサーバー (python .claude/devserver.py)
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *a):
        pass


Handler.extensions_map.update({".js": "text/javascript", ".webmanifest": "application/manifest+json"})
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
