export function buildAttachmentResponse(file, options) {
  const settings = options || {};
  const index = Math.max(0, Number(settings.index || 0));
  const fallbackFilename = String(settings.fallbackFilename || ("attachment_" + (index + 1))).trim();
  const disposition = normalizeDisposition(settings.disposition || "attachment");
  const binary = Uint8Array.from(atob(String(file && file.content || "")), function (ch) {
    return ch.charCodeAt(0);
  });
  const filename = String(file && file.filename || file && file.name || fallbackFilename).replace(/"/g, "");
  const type = file && file.type ? String(file.type) : "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", type);
  headers.set("Content-Disposition", disposition + '; filename="' + filename + '"');
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(binary, { status: 200, headers: headers });
}

function normalizeDisposition(value) {
  return String(value || "").trim() === "inline" ? "inline" : "attachment";
}
