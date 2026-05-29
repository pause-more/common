import { normalizeApprovalDocumentId } from "../storage/approvalDocuments.js";
import {
  getSharedCalendarEvents,
  normalizeCalendarDate,
  sanitizeCalendarEvent,
  setSharedCalendarEvents
} from "../storage/calendarEvents.js";

export async function upsertVacationApprovalCalendarEvent(env, item) {
  const vacation = item && item.vacationInfo && typeof item.vacationInfo === "object" ? item.vacationInfo : {};
  const startDate = normalizeCalendarDate(vacation.startDate || "");
  const endDate = normalizeCalendarDate(vacation.endDate || startDate);
  if (!item || !item.id || !item.authorId || !startDate) return;

  const items = await getSharedCalendarEvents(env);
  const eventId = buildApprovalVacationCalendarEventId(item.id);
  const eventTitle = buildApprovalVacationCalendarTitle(item, vacation);
  const memoParts = [];
  if (vacation.type) memoParts.push("휴가 유형: " + String(vacation.type).trim());
  if (vacation.daysText) memoParts.push("사용 일수: " + String(vacation.daysText).trim().replace(/[()]/g, ""));
  const now = new Date().toISOString();
  const nextItem = sanitizeCalendarEvent({
    id: eventId,
    title: eventTitle,
    startDate: startDate,
    endDate: endDate || startDate,
    allDay: true,
    startTime: "",
    endTime: "",
    location: "",
    visibility: "shared",
    alert: "none",
    labelColor: "#0373ef",
    memo: memoParts.filter(Boolean).join("\n"),
    createdById: item.authorId,
    createdByName: item.authorName || "",
    requesterId: item.authorId,
    requesterName: item.authorName || "",
    department: item.department || "",
    calendarScope: "team",
    createdAt: now,
    updatedAt: now
  });

  const index = items.findIndex(function (row) { return row.id === eventId; });
  if (index > -1) {
    nextItem.createdAt = items[index].createdAt || nextItem.createdAt;
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }
  await setSharedCalendarEvents(env, items);
}

function buildApprovalVacationCalendarEventId(documentId) {
  return "approval_vacation_" + normalizeApprovalDocumentId(documentId || "");
}

function buildApprovalVacationCalendarTitle(item, vacation) {
  const authorName = String(item && item.authorName || "").trim();
  const vacationType = String(vacation && vacation.type || "").trim();
  return [authorName, vacationType || "휴가"].filter(Boolean).join(" ");
}
