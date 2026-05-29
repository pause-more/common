export function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(value) {
  return String(value || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/^<|>$/g, "")
    .replace(/^.*<([^>]+)>.*$/, "$1")
    .trim()
    .toLowerCase();
}

export function splitEmails(value) {
  return String(value || "")
    .split(",")
    .map(function (item) { return normalizeEmail(item); })
    .filter(Boolean);
}

export function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function padAttendanceValue(value) {
  return String(value).padStart(2, "0");
}
