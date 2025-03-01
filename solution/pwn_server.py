import http.server
import logging

PORT = 1111


class RequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Log only GET requests
        logging.info(f"GET request: {self.path}")

        # Respond to the GET request
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'pwn')


if __name__ == '__main__':
    http.server.HTTPServer(('0.0.0.0', PORT), RequestHandler).serve_forever()
