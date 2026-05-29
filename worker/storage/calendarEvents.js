export async function getSharedCalendarEvents(env) {
  const raw = await env.MAIL_KV.get("calendar:shared");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.map(sanitizeCalendarEvent).filter(function (item) {
    return !!(item && item.id && item.title && item.startDate);
  }) : [];
}

export async function setSharedCalendarEvents(env, items) {
  const normalized = (Array.isArray(items) ? items : []).map(sanitizeCalendarEvent).filter(function (item) {
    return !!(item && item.id && item.title && item.startDate);
  });
  normalized.sort(function (a, b) {
    return String(a.startDate || "").localeCompare(String(b.startDate || "")) || String(a.startTime || "").localeCompare(String(b.startTime || ""));
  });
  await env.MAIL_KV.put("calendar:shared", JSON.stringify(normalized));
}

export function sanitizeCalendarEvent(item) {
  item = item || {};
  const id = String(item.id || ("calendar_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_");
  const startDate = normalizeCalendarDate(item.startDate || "");
  const endDate = normalizeCalendarDate(item.endDate || startDate);
  const allDay = item.allDay === true;
  const visibility = normalizeCalendarVisibility(item.visibility || "");
  const calendarScope = normalizeCalendarScope(item.calendarScope || item.scope || "");
  return {
    id: id,
    title: String(item.title || "").trim(),
    startDate: startDate,
    endDate: endDate || startDate,
    allDay: allDay,
    startTime: allDay ? "" : normalizeCalendarTime(item.startTime || ""),
    endTime: allDay ? "" : normalizeCalendarTime(item.endTime || ""),
    location: String(item.location || "").trim(),
    visibility: visibility,
    memo: String(item.memo || "").trim(),
    alert: String(item.alert || "none").trim(),
    labelColor: normalizeCalendarLabelColor(item.labelColor || ""),
    createdById: normalizeLoginId(item.createdById || ""),
    createdByName: String(item.createdByName || "").trim(),
    requesterId: normalizeLoginId(item.requesterId || ""),
    requesterName: String(item.requesterName || "").trim(),
    department: normalizeDepartmentName(item.department || ""),
    calendarScope: calendarScope,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || ""
  };
}

export function normalizeCalendarDate(value) {
  const normalized = String(value || "").trim();
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(normalized) ? normalized : "";
}

function normalizeCalendarTime(value) {
  const normalized = String(value || "").trim();
  return /^[0-9]{2}:[0-9]{2}$/.test(normalized) ? normalized : "";
}

function normalizeCalendarLabelColor(value) {
  const normalized = String(value || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized) ? normalized : "#d96ca6";
}

function normalizeCalendarVisibility(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "private") return "private";
  if (normalized === "team") return "team";
  if (normalized === "shared") return "shared";
  return "shared";
}

function normalizeCalendarScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "my") return "my";
  if (normalized === "team") return "team";
  if (normalized === "wide" || normalized === "company" || normalized === "company-wide") return "wide";
  return "";
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
