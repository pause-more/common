import { normalizeEmail } from "../shared/utils.js";

export function textToHtml(text) {
  const safe = escapeHtml(String(text || ""));
  if (!safe) return "";
  return "<p>" + safe.replace(/\r\n|\r|\n/g, "</p><p>") + "</p>";
}

export function extractAddressParts(value) {
  const raw = String(value || "").trim();
  if (!raw) return { name: "", email: "" };

  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? normalizeEmail(emailMatch[0]) : "";

  if (!email) {
    return { name: raw.replace(/"/g, "").trim(), email: "" };
  }

  let name = raw
    .replace(emailMatch[0], " ")
    .replace(/[<>"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizeEmail(name) === email) {
    name = "";
  }

  return { name: name, email: email };
}

export function resolveInboundAddressParts(candidates) {
  const list = Array.isArray(candidates) ? candidates : [candidates];

  for (let i = 0; i < list.length; i++) {
    const parts = extractAddressParts(list[i]);
    if (parts.email) return parts;
  }

  return { name: "", email: "" };
}

export function extractHeaderValue(headersRaw, headerName) {
  const raw = String(headersRaw || "");
  const name = String(headerName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!raw || !name) return "";

  const match = raw.match(new RegExp("^" + name + "\\s*:\\s*(.+)$", "im"));
  return match ? String(match[1] || "").trim() : "";
}

export function normalizeInboundOwnerEmail(parsedTo) {
  const email = normalizeEmail(parsedTo);
  const parts = email.split("@");
  if (parts.length !== 2) return "";

  const localPart = parts[0];
  const domain = parts[1];

  if (domain === "mail.autonecar.kr") return localPart + "@autonecar.kr";
  if (domain === "autonecar.kr") return email;
  return "";
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
