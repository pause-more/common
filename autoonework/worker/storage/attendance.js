import { normalizeLoginId, padAttendanceValue, normalizeDepartmentName } from "../shared/utils.js";

export async function getAttendanceRecords(env, userId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId) return [];
  const raw = await env.MAIL_KV.get("attendance:" + normalizedUserId);
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export async function setAttendanceRecords(env, userId, records) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId) return;
  const list = Array.isArray(records) ? records.slice() : [];
  list.sort(function (a, b) {
    return String(a.date || "").localeCompare(String(b.date || ""));
  });
  await env.MAIL_KV.put("attendance:" + normalizedUserId, JSON.stringify(list));
}

export function normalizeAttendanceSpecialType(value) {
  const type = String(value || "").trim().toLowerCase();
  if (type === "late" || type === "outside" || type === "early" || type === "trip") return type;
  return "";
}

export function isLateAttendance(date, employee) {
  const startMinutes = parseWorkStartMinutes(getWorkHoursForDate(employee, date)) || 540;
  const checkedMinutes = getKoreaMinutes(date);
  return checkedMinutes > startMinutes;
}

export function getWorkHoursForDate(employee, date) {
  const schedule = resolveEmployeeWorkSchedule(employee);
  const weekdayKey = getKoreaWeekdayKey(date);
  if (weekdayKey && schedule[weekdayKey]) return schedule[weekdayKey];
  return normalizeWorkHours(employee && (employee.workHours || employee.workTime) || "");
}

export function parseWorkStartMinutes(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return 0;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return 0;
  return hour * 60 + minute;
}

export function getKoreaMinutes(date) {
  const source = date instanceof Date ? date : new Date(date);
  const koreaTime = new Date(source.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.getUTCHours() * 60 + koreaTime.getUTCMinutes();
}

export function getKoreaWeekdayKey(date) {
  const source = date instanceof Date ? date : new Date(date);
  const koreaTime = new Date(source.getTime() + 9 * 60 * 60 * 1000);
  const day = koreaTime.getUTCDay();
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return "";
}

export function formatAttendanceDateKey(date) {
  return date.getFullYear() + "-" + padAttendanceValue(date.getMonth() + 1) + "-" + padAttendanceValue(date.getDate());
}

export function normalizeEmployeeWorkSchedule(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  ["mon", "tue", "wed", "thu", "fri"].forEach(function (key) {
    const normalized = normalizeWorkHours(source[key] || "");
    if (normalized) next[key] = normalized;
  });
  return next;
}

export function resolveEmployeeWorkSchedule(employee) {
  const schedule = normalizeEmployeeWorkSchedule(employee && employee.workSchedule || {});
  if (Object.keys(schedule).length) return schedule;
  return getDefaultDepartmentWorkSchedule(employee && employee.department || "");
}

export function getDefaultDepartmentWorkSchedule(department) {
  const normalizedDepartment = normalizeDepartmentName(department || "");
  if (normalizedDepartment !== "영업1팀" && normalizedDepartment !== "영업2팀") return {};
  return {
    mon: "09:00 - 18:00",
    tue: "09:00 - 19:00",
    wed: "09:00 - 18:00",
    thu: "09:00 - 19:00",
    fri: "09:00 - 18:00"
  };
}

export function normalizeWorkHours(value) {
  const text = String(value || "").trim().replace(/\s*~\s*/g, " - ").replace(/\s*-\s*/g, " - ");
  const matched = text.match(/^([0-2][0-9]:[0-5][0-9])\s-\s([0-2][0-9]:[0-5][0-9])$/);
  if (!matched) return "";
  return matched[1] + " - " + matched[2];
}

