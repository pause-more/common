import { requireKv } from "../storage/bindings.js";
import {
  getSharedCalendarEvents,
  sanitizeCalendarEvent,
  setSharedCalendarEvents
} from "../storage/calendarEvents.js";
import { normalizeLoginId } from "../shared/utils.js";
import { getWorkHoursForDate } from "../storage/attendance.js";
import { isChatAdminEmployee } from "../storage/chat.js";
import { createNotificationsForUsers } from "./notifications.js";
import { getPrimaryEmployeeByIdForEnv, getPrimaryEmployeeListForEnv } from "./employees.js";

const CALENDAR_REMINDER_SENT_KEY = "calendar:reminderSent";
const CALENDAR_REMINDER_GRACE_MS = 5 * 60 * 1000;
const CALENDAR_REMINDER_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

export async function getSharedCalendarEventList(env) {
  requireKv(env);
  return { items: await getSharedCalendarEvents(env) };
}

export async function saveSharedCalendarEvent(env, body) {
  requireKv(env);

  const requesterId = normalizeLoginId(body.requesterId || body.createdById || "");
  if (!requesterId) throw calendarServiceError("로그인 정보가 없습니다.", 400);

  const requester = await getPrimaryEmployeeByIdForEnv(env, requesterId);
  if (!requester) throw calendarServiceError("사용자 정보를 확인할 수 없습니다.", 403);

  const items = await getSharedCalendarEvents(env);
  const now = new Date().toISOString();
  const item = sanitizeCalendarEvent({
    id: body.id || "",
    title: body.title || "",
    startDate: body.startDate || "",
    endDate: body.endDate || body.startDate || "",
    allDay: body.allDay === true,
    startTime: body.startTime || "",
    endTime: body.endTime || "",
    location: body.location || "",
    visibility: body.visibility || "",
    memo: body.memo || "",
    alert: body.alert || "",
    labelColor: body.labelColor || "",
    requesterId: body.requesterId || "",
    requesterName: body.requesterName || "",
    createdById: body.createdById || body.requesterId || "",
    createdByName: body.createdByName || body.requesterName || "",
    department: body.department || requester.department || "",
    calendarScope: body.calendarScope || body.scope || "",
    createdAt: body.createdAt || now,
    updatedAt: now
  });

  if (!item.title) throw calendarServiceError("일정명을 입력해주세요.", 400);
  if (!item.startDate) throw calendarServiceError("시작일을 선택해주세요.", 400);
  if (item.endDate && item.endDate < item.startDate) throw calendarServiceError("종료일은 시작일보다 빠를 수 없습니다.", 400);
  if (!item.allDay && (!item.startTime || !item.endTime)) throw calendarServiceError("시간을 입력하거나 종일을 선택해주세요.", 400);
  if (!item.allDay && item.startDate === item.endDate && item.endTime < item.startTime) {
    throw calendarServiceError("종료 시간은 시작 시간보다 빠를 수 없습니다.", 400);
  }

  const index = items.findIndex(function (row) { return row.id === item.id; });
  const isNewEvent = index < 0;
  if (index > -1) {
    const existing = items[index];
    if (existing.createdById && existing.createdById !== requesterId && requester.role !== "admin") {
      throw calendarServiceError("작성자 또는 관리자만 수정할 수 있습니다.", 403);
    }
    item.createdById = existing.createdById || item.createdById;
    item.createdByName = existing.createdByName || item.createdByName;
    item.department = item.department || existing.department || requester.department || "";
    item.calendarScope = item.calendarScope || existing.calendarScope || "";
    item.visibility = item.visibility || existing.visibility || "shared";
    item.createdAt = items[index].createdAt || item.createdAt;
    items[index] = item;
  } else {
    items.push(item);
  }

  await setSharedCalendarEvents(env, items);
  if (isNewEvent) await createSharedCalendarEventNotifications(env, item);
  return { item: item, items: items };
}

export async function sendDueCalendarReminders(env, referenceDate = new Date()) {
  requireKv(env);

  const items = await getSharedCalendarEvents(env);
  const nowMs = referenceDate.getTime();
  const sentMap = await getCalendarReminderSentMap(env);
  let sentMapChanged = pruneCalendarReminderSentMap(sentMap, nowMs);

  for (const item of items) {
    const reminder = getCalendarReminderSchedule(item);
    if (!reminder) continue;

    const reminderMs = reminder.eventStartMs - reminder.offsetMinutes * 60 * 1000;
    if (reminderMs > nowMs || reminderMs < nowMs - CALENDAR_REMINDER_GRACE_MS) continue;

    const sentKey = getCalendarReminderSentKey(item, reminder);
    if (sentMap[sentKey]) continue;

    await createCalendarReminderNotifications(env, item);
    sentMap[sentKey] = new Date(nowMs).toISOString();
    sentMapChanged = true;
  }

  if (sentMapChanged) await setCalendarReminderSentMap(env, sentMap);
}

async function createSharedCalendarEventNotifications(env, item) {
  const scope = String(item && item.calendarScope || "").trim().toLowerCase();
  if (scope !== "team" && scope !== "wide") return;

  const authorId = normalizeLoginId(item && item.createdById || item.requesterId || "");
  const department = String(item && item.department || "").replace(/\s+/g, " ").trim();
  const employees = await getPrimaryEmployeeListForEnv(env);
  const targetIds = employees.filter(function (employee) {
    const employeeId = normalizeLoginId(employee && employee.id || "");
    if (!employeeId || employeeId === authorId || isChatAdminEmployee(employee)) return false;
    if (scope === "team") {
      return String(employee && employee.department || "").replace(/\s+/g, " ").trim() === department;
    }
    return true;
  }).map(function (employee) {
    return normalizeLoginId(employee && employee.id || "");
  });
  if (!targetIds.length) return;

  const isTeam = scope === "team";
  const employeesById = {};
  employees.forEach(function (employee) {
    const employeeId = normalizeLoginId(employee && employee.id || "");
    if (!employeeId) return;
    employeesById[employeeId] = employee;
  });

  for (const targetId of targetIds) {
    const targetEmployee = employeesById[targetId] || null;
    await createNotificationsForUsers(env, [targetId], buildCalendarNotificationPayload(item, targetEmployee, isTeam));
  }
}

async function createCalendarReminderNotifications(env, item) {
  const scope = String(item && item.calendarScope || "").trim().toLowerCase();
  if (scope !== "team" && scope !== "wide") return;

  const authorId = normalizeLoginId(item && item.createdById || item.requesterId || "");
  const department = String(item && item.department || "").replace(/\s+/g, " ").trim();
  const employees = await getPrimaryEmployeeListForEnv(env);
  const targetIds = employees.filter(function (employee) {
    const employeeId = normalizeLoginId(employee && employee.id || "");
    if (!employeeId || isChatAdminEmployee(employee)) return false;
    if (scope === "team") {
      return String(employee && employee.department || "").replace(/\s+/g, " ").trim() === department;
    }
    return true;
  }).map(function (employee) {
    return normalizeLoginId(employee && employee.id || "");
  });
  if (authorId) targetIds.push(authorId);
  if (!targetIds.length) return;

  const isTeam = scope === "team";
  const employeesById = {};
  employees.forEach(function (employee) {
    const employeeId = normalizeLoginId(employee && employee.id || "");
    if (!employeeId) return;
    employeesById[employeeId] = employee;
  });

  for (const targetId of targetIds) {
    const targetEmployee = employeesById[targetId] || null;
    await createNotificationsForUsers(env, [targetId], buildCalendarReminderNotificationPayload(item, targetEmployee, isTeam));
  }
}

function buildCalendarNotificationPayload(item, employee, isTeam) {
  const title = String(item && item.title || "").trim();
  const dateText = formatCalendarNotificationDateText(item);
  const timeText = formatCalendarNotificationTimeText(item, employee);
  return {
    type: isTeam ? "calendar_team_event" : "calendar_wide_event",
    actorName: String(item && item.createdByName || "").trim(),
    actionLabel: "새 일정",
    menuLabel: isTeam ? "팀/부서 캘린더" : "전사 일정",
    docLabel: title,
    docId: String(item && item.id || ""),
    title: "새로운 일정 알림",
    body: [title, [dateText, timeText].filter(Boolean).join(" ")].filter(Boolean).join("\n"),
    link: isTeam ? "/calendar/team.html" : "/calendar/company-wide.html"
  };
}

function buildCalendarReminderNotificationPayload(item, employee, isTeam) {
  const title = String(item && item.title || "").trim();
  const dateText = formatCalendarNotificationDateText(item);
  const timeText = formatCalendarNotificationTimeText(item, employee);
  const alertLabel = getCalendarReminderTitleLabel(item && item.alert);
  return {
    type: isTeam ? "calendar_team_reminder" : "calendar_wide_reminder",
    actorName: String(item && item.createdByName || "").trim(),
    actionLabel: "일정 알림",
    menuLabel: isTeam ? "팀/부서 캘린더" : "전사 일정",
    docLabel: title,
    docId: String(item && item.id || ""),
    title: "캘린더 일정" + (alertLabel ? " " + alertLabel : "") + " 알림",
    body: [title, [dateText, timeText].filter(Boolean).join(" ")].filter(Boolean).join("\n"),
    link: isTeam ? "/calendar/team.html" : "/calendar/company-wide.html"
  };
}

function formatCalendarNotificationDateText(item) {
  const startDate = String(item && item.startDate || "").trim();
  const endDate = String(item && item.endDate || startDate || "").trim();
  if (!startDate) return "";
  if (startDate === endDate) return formatCalendarRelativeDateLabel(startDate) + ",";
  return formatCalendarRelativeDateLabel(startDate) + ", ~ " + formatCalendarRelativeDateLabel(endDate);
}

function formatCalendarNotificationTimeText(item, employee) {
  const allDay = item && item.allDay === true;
  const dateKey = String(item && item.startDate || "").trim();
  const workHours = getWorkHoursForDate(employee || {}, dateKey || new Date());
  const fallbackHours = "09:00 - 18:00";
  const range = allDay ? (normalizeCalendarNotificationRange(workHours || fallbackHours)) : normalizeCalendarNotificationRange(String(item && item.startTime || "") + " - " + String(item && item.endTime || ""));
  return range || "";
}

function normalizeCalendarNotificationRange(value) {
  const text = String(value || "").trim().replace(/\s*~\s*/g, " - ").replace(/\s*-\s*/g, " - ");
  const matched = text.match(/^([0-2]?\d:[0-5]\d)\s-\s([0-2]?\d:[0-5]\d)$/);
  if (!matched) return "";
  return formatCalendarTimeRangeLabel(matched[1], matched[2]);
}

function formatCalendarRelativeDateLabel(value) {
  const dateKey = String(value || "").trim();
  if (!dateKey) return "";
  const now = new Date();
  const koreaNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayKey = koreaNow.getUTCFullYear() + "-" + String(koreaNow.getUTCMonth() + 1).padStart(2, "0") + "-" + String(koreaNow.getUTCDate()).padStart(2, "0");
  const tomorrow = new Date(koreaNow.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowKey = tomorrow.getUTCFullYear() + "-" + String(tomorrow.getUTCMonth() + 1).padStart(2, "0") + "-" + String(tomorrow.getUTCDate()).padStart(2, "0");
  if (dateKey === todayKey) return "오늘";
  if (dateKey === tomorrowKey) return "내일";
  return formatCalendarDateLabel(value);
}

function formatCalendarDateLabel(value) {
  const parts = String(value || "").split("-");
  const year = Number(parts[0] || 0);
  const month = Number(parts[1] || 0);
  const day = Number(parts[2] || 0);
  if (!year || !month || !day) return "";
  return year + "년 " + month + "월 " + day + "일";
}

function formatCalendarTimeLabel(value) {
  const parts = parseCalendarTimeParts(value);
  return parts ? formatCalendarTimeParts(parts, true) : "";
}

function formatCalendarTimeRangeLabel(startValue, endValue) {
  const start = parseCalendarTimeParts(startValue);
  const end = parseCalendarTimeParts(endValue);
  if (!start && !end) return "";
  if (start && end) {
    if (start.raw === end.raw) return formatCalendarTimeParts(start, true);
    return formatCalendarTimeParts(start, true) + " ~ " + formatCalendarTimeParts(end, start.period !== end.period);
  }
  return formatCalendarTimeParts(start || end, true);
}

function parseCalendarTimeParts(value) {
  const parts = String(value || "").split(":");
  const hour = Number(parts[0] || 0);
  if (!Number.isFinite(hour)) return null;
  const minute = String(parts[1] || "00").padStart(2, "0");
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;
  return {
    raw: String(hour).padStart(2, "0") + ":" + minute,
    period: period,
    displayHour: String(displayHour).padStart(2, "0"),
    minute: minute
  };
}

function formatCalendarTimeParts(parts, includePeriod) {
  return (includePeriod ? parts.period + " " : "") + parts.displayHour + ":" + parts.minute;
}

async function getCalendarReminderSentMap(env) {
  const raw = await env.MAIL_KV.get(CALENDAR_REMINDER_SENT_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    return {};
  }
}

async function setCalendarReminderSentMap(env, value) {
  await env.MAIL_KV.put(CALENDAR_REMINDER_SENT_KEY, JSON.stringify(value || {}));
}

function pruneCalendarReminderSentMap(sentMap, nowMs) {
  let changed = false;
  Object.keys(sentMap || {}).forEach(function (key) {
    const savedMs = Date.parse(sentMap[key]);
    if (!Number.isFinite(savedMs) || savedMs < nowMs - CALENDAR_REMINDER_RETENTION_MS) {
      delete sentMap[key];
      changed = true;
    }
  });
  return changed;
}

function getCalendarReminderSchedule(item) {
  const offsetMinutes = getCalendarReminderOffsetMinutes(item && item.alert);
  if (offsetMinutes === null) return null;

  const startDate = String(item && item.startDate || "").trim();
  const startTime = item && item.allDay === true ? "09:00" : String(item && item.startTime || "").trim();
  const eventStartMs = parseKoreaDateTimeMs(startDate, startTime);
  if (!Number.isFinite(eventStartMs)) return null;

  return { offsetMinutes: offsetMinutes, eventStartMs: eventStartMs };
}

function getCalendarReminderOffsetMinutes(value) {
  const key = String(value || "none").trim();
  if (key === "at-time") return 0;
  if (key === "10-min") return 10;
  if (key === "30-min") return 30;
  if (key === "1-hour") return 60;
  if (key === "1-day") return 24 * 60;
  return null;
}

function getCalendarReminderTitleLabel(value) {
  const key = String(value || "none").trim();
  if (key === "10-min") return "10분 전";
  if (key === "30-min") return "30분 전";
  if (key === "1-hour") return "1시간 전";
  if (key === "1-day") return "1일 전";
  return "";
}

function getCalendarReminderSentKey(item, reminder) {
  return [
    String(item && item.id || ""),
    String(item && item.updatedAt || ""),
    String(item && item.alert || ""),
    String(item && item.startDate || ""),
    String(item && item.startTime || ""),
    String(reminder && reminder.offsetMinutes)
  ].join(":");
}

function parseKoreaDateTimeMs(dateValue, timeValue) {
  const dateParts = String(dateValue || "").split("-");
  const timeParts = String(timeValue || "").split(":");
  const year = Number(dateParts[0] || 0);
  const month = Number(dateParts[1] || 0);
  const day = Number(dateParts[2] || 0);
  const hour = Number(timeParts[0] || 0);
  const minute = Number(timeParts[1] || 0);
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return NaN;
  return Date.UTC(year, month - 1, day, hour - 9, minute, 0, 0);
}

export async function deleteSharedCalendarEvent(env, body) {
  requireKv(env);

  const id = String(body.id || "").trim();
  if (!id) throw calendarServiceError("일정을 선택해주세요.", 400);

  const requesterId = normalizeLoginId(body.requesterId || "");
  if (!requesterId) throw calendarServiceError("로그인 정보가 없습니다.", 400);

  const requester = await getPrimaryEmployeeByIdForEnv(env, requesterId);
  if (!requester) throw calendarServiceError("사용자 정보를 확인할 수 없습니다.", 403);

  const currentItems = await getSharedCalendarEvents(env);
  const target = currentItems.find(function (item) { return item && item.id === id; });
  if (!target) throw calendarServiceError("일정을 찾을 수 없습니다.", 404);
  if (target.createdById && target.createdById !== requesterId && requester.role !== "admin") {
    throw calendarServiceError("작성자 또는 관리자만 삭제할 수 있습니다.", 403);
  }

  const items = currentItems.filter(function (item) { return item && item.id !== id; });
  await setSharedCalendarEvents(env, items);
  return { items: items };
}

function calendarServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
