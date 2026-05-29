import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8000;
const HOST = "127.0.0.1";
const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const MIME_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json; charset=utf-8"],
    [".png", "image/png"],
    [".svg", "image/svg+xml; charset=utf-8"],
    [".webp", "image/webp"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".gif", "image/gif"],
    [".ico", "image/x-icon"]
]);

function resolveRequestPath(requestUrl) {
    const url = new URL(requestUrl || "/", `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";

    const relativePath = normalize(pathname).replace(/^([/\\])+/, "");
    const absolutePath = resolve(join(ROOT, relativePath));
    const rootWithSeparator = ROOT.endsWith(sep) ? ROOT : ROOT + sep;

    if (absolutePath !== ROOT && !absolutePath.startsWith(rootWithSeparator)) {
        return null;
    }

    return absolutePath;
}

function sendPlain(response, statusCode, message) {
    response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(message);
}

const server = createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method || "")) {
        sendPlain(response, 405, "Method not allowed");
        return;
    }

    const filePath = resolveRequestPath(request.url);
    if (!filePath) {
        sendPlain(response, 403, "Forbidden");
        return;
    }

    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
            sendPlain(response, 404, "File not found");
            return;
        }

        const contentType = MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream";
        response.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": fileStat.size,
            "Cache-Control": "no-cache"
        });

        if (request.method === "HEAD") {
            response.end();
            return;
        }

        createReadStream(filePath).pipe(response);
    } catch (error) {
        if (error && error.code === "ENOENT") {
            sendPlain(response, 404, "File not found");
            return;
        }

        console.error(error);
        sendPlain(response, 500, "Internal server error");
    }
});

server.listen(PORT, HOST, () => {
    console.error(`Serving ${ROOT} at http://${HOST}:${PORT}`);
});
