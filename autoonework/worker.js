import { routeAuthRequest } from "./worker/routes/auth.js";
import { routeAttendanceRequest } from "./worker/routes/attendance.js";
import { routeApprovalRequest } from "./worker/routes/approval.js";
import { routeBoardRequest } from "./worker/routes/board.js";
import { routeCalendarRequest } from "./worker/routes/calendar.js";
import { routeChatRequest } from "./worker/routes/chat.js";
import { routeCloudRequest } from "./worker/routes/cloud.js";
import { routeMailRequest } from "./worker/routes/mail.js";
import { routeNotificationsRequest } from "./worker/routes/notifications.js";
import { buildAttachmentResponse } from "./worker/services/attachments.js";
import { upsertVacationApprovalCalendarEvent } from "./worker/services/approvalCalendar.js";
import { hashPassword, isSha256Hex, upgradeGroupwareDbEmployeePassword, upgradeLegacyEmployeePassword, verifyEmployeePassword } from "./worker/services/auth.js";
import { deleteSharedCalendarEvent, getSharedCalendarEventList, saveSharedCalendarEvent, sendDueCalendarReminders } from "./worker/services/calendar.js";
import {
  canJoinChatRoom,
  deleteChatMessage,
  getChatContacts,
  getChatAttachmentFile,
  getCanonicalChatRoomId,
  getChatMessageList,
  getChatRoomSummaries,
  getOrCreateDirectChatRoom,
  getOrCreateGroupChatRoom,
  inviteChatRoomMembers,
  leaveChatRoom,
  markChatRoomRead,
  saveChatMessage,
  updateChatRoomInfo,
  voteChatPoll
} from "./worker/services/chatRooms.js";
import {
  buildServerEmployee,
  ensureAdminRequester,
  ensureEmployeeSeed,
  generatePrimaryEmployeeNumberForEnv,
  getPrimaryDepartmentListForEnv,
  getPrimaryEmployeeByIdForEnv,
  getPrimaryEmployeeListForEnv,
  isEmployeeTempPassword,
  normalizeBirthDate,
  normalizeEmployeeNumber,
  normalizeEmployeePhone,
  normalizeEmployeeText,
  normalizeExtraVacationDays,
  normalizeHireDate,
  normalizeRole,
  sanitizeEmployee
} from "./worker/services/employees.js";
import { bytesToBase64, extractHeaderValue, formatBytes, normalizeInboundOwnerEmail, resolveInboundAddressParts, textToHtml } from "./worker/services/inboundMail.js";
import { ensureInboxSeed } from "./worker/services/mailSeed.js";
import { createApprovalDecisionNotification, createApprovalSubmittedNotifications, createNotificationsForUsers, createTeamboardPostNotifications } from "./worker/services/notifications.js";
import { deleteWebPushSubscription, getVapidPublicKey, saveWebPushSubscription, sendChatPushNotifications } from "./worker/services/webPush.js";
import { corsHeaders, jsonResponse } from "./worker/shared/http.js";
import { getAttendanceRecords, setAttendanceRecords, normalizeAttendanceSpecialType, isLateAttendance, getWorkHoursForDate, parseWorkStartMinutes, getKoreaMinutes, getKoreaWeekdayKey, formatAttendanceDateKey, normalizeEmployeeWorkSchedule, resolveEmployeeWorkSchedule, getDefaultDepartmentWorkSchedule, normalizeWorkHours } from "./worker/storage/attendance.js";
import { getApprovalDocumentList, setApprovalDocumentList, upsertApprovalDocumentSummary, toApprovalListItem, enrichApprovalPersonDepartments, buildApprovalDepartments, sanitizeApprovalDocument, normalizeApprovalStatus, normalizeApprovalDocTypeServer, normalizeApprovalDocNo, normalizeApprovalDocumentId, buildApprovalDocumentId, findApprovalDocumentIdByDocNo, buildApprovalServerDocNo, buildApprovalServerDocNoPrefix, normalizeApprovalStringList, normalizeApprovalPersonList, normalizeApprovalSignatureList, normalizeApprovalAttachments } from "./worker/storage/approvalDocuments.js";
import { requireCloudStorage, requireGroupwareDb, requireKv } from "./worker/storage/bindings.js";
import {
  ensureBoardSeed,
  getBoardNews,
  getBoardResources,
  getTeamboardPosts,
  sanitizeBoardNewsPost,
  sanitizeBoardResourceItem,
  sanitizeTeamboardPost,
  setBoardNews,
  setBoardResources,
  setTeamboardPosts
} from "./worker/storage/boardPosts.js";
import {
  isHiddenSelectableEmployee
} from "./worker/storage/chat.js";
import {
  buildCloudObjectKey,
  dataUrlToUint8Array,
  deleteCloudFileById,
  getCloudFileById,
  getCloudFilesByOwner,
  getDefaultCloudQuotaBytes,
  sanitizeCloudFileItem,
  sumCloudFileBytes,
  upsertCloudFile
} from "./worker/storage/cloudFiles.js";
import {
  findGroupwareDepartmentIdByName,
  getGroupwareDbEmployeeById,
  hasGroupwareDb,
  updateGroupwareDbEmployee
} from "./worker/storage/employees.js";
import { setEmployeeTempPasswordFlag } from "./worker/storage/employeeTempPasswords.js";
import { setDepartmentList } from "./worker/storage/legacyDepartments.js";
import { getEmployeeById, getEmployeeList, setEmployeeList } from "./worker/storage/legacyEmployees.js";
import { getList, setList } from "./worker/storage/kv.js";
import { deleteDraftItem, deleteMailItem, getDraftItem, getMailItem, setDraftItem, setMailItem } from "./worker/storage/mail.js";
import { canUserViewMail, filterListForUser, listKeyByFolder, removeMailFromAllLists, toDraftListItem, toListItem, updateStarStateInList, updateUnreadStateInList } from "./worker/storage/mailLists.js";
import { normalizeEmail, splitEmails, stripHtml, normalizeLoginId, normalizeDepartmentName, padAttendanceValue } from "./worker/shared/utils.js";
import {
  getGlobalNotificationList,
  getNotificationList,
  isChatNotificationItem,
  markApprovalDocumentNotificationsRead,
  setNotificationList
} from "./worker/storage/notifications.js";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    return await routeWorkerRequest(request, env, url);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDueCalendarReminders(env));
  }
};

async function routeWorkerRequest(request, env, url) {
  const path = url.pathname;

  if (request.method === "GET" && path === "/") return jsonResponse({ success: true, message: "Mail API is running" });
  if (request.method === "POST" && path === "/") return await handleSendMail(request, env);

  if (path.indexOf("/api/auth/") === 0) return await routeAuthRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/attendance/") === 0) return await routeAttendanceRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/approval/") === 0) return await routeApprovalRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/push/") === 0) return await routePushRequest(request, env, path);
  if (path.indexOf("/api/notifications") === 0) return await routeNotificationsRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/chat/") === 0) return await routeChatRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/calendar/") === 0) return await routeCalendarRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/board/") === 0) return await routeBoardRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/cloud/") === 0) return await routeCloudRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });
  if (path.indexOf("/api/mail/") === 0) return await routeMailRequest({ request, env, url, path, handlers: ROUTE_HANDLERS });

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}

async function routePushRequest(request, env, path) {
  if (request.method === "GET" && path === "/api/push/vapid-key") {
    return jsonResponse({ success: true, enabled: false, publicKey: getVapidPublicKey(env) });
  }
  if (request.method === "POST" && path === "/api/push/subscribe") {
    try {
      const result = await saveWebPushSubscription(env, await request.json());
      return jsonResponse({ success: true, enabled: false, userId: result.userId });
    } catch (e) {
      return jsonResponse({ success: false, message: e.message }, e.status || 500);
    }
  }
  if (request.method === "POST" && path === "/api/push/unsubscribe") {
    try {
      const result = await deleteWebPushSubscription(env, await request.json());
      return jsonResponse({ success: true, userId: result.userId });
    } catch (e) {
      return jsonResponse({ success: false, message: e.message }, e.status || 500);
    }
  }
  return jsonResponse({ success: false, message: "Not Found" }, 404);
}

const ROUTE_HANDLERS = {
  handleAuthLogin,
  handleGetEmployees,
  handleGetDepartments,
  handleCreateEmployee,
  handleCreateDepartment,
  handleUpdateDepartment,
  handleDeleteDepartment,
  handleDeleteEmployeeAccount,
  handleResetEmployeeAccountPassword,
  handleUpdateEmployeeBirthDate,
  handleUpdateEmployeeHireDate,
  handleUpdateEmployeeDepartment,
  handleUpdateEmployeeWorkHours,
  handleUpdateEmployeeProfile,
  handleUpdateEmployeeSignature,
  handleUpdateEmployeeExtraVacationDays,
  handleChangeOwnPassword,
  handleFindPassword,
  handleGetOwnProfile,
  handleUpdateOwnProfile,
  handleGroupwareDbTest,
  handleGetOwnAttendance,
  handleAttendanceCheckIn,
  handleAttendanceCheckOut,
  handleAttendanceSpecial,
  handleGetAdminAttendanceToday,
  handleSaveApprovalDocument,
  handleApprovalDocumentDecision,
  handleDeleteApprovalDocument,
  handleGetApprovalEmployees,
  handleGetApprovalDocuments,
  handleReadApprovalDocument,
  handleApprovalAttachment,
  handleGetNotifications,
  handleGetNotificationCount,
  handleReadNotifications,
  handleReadAllNotifications,
  handleDeleteAllNotifications,
  handleGetSharedCalendar,
  handleGetSharedCalendarBirthdays,
  handleSaveSharedCalendarEvent,
  handleDeleteSharedCalendarEvent,
  handleGetBoardNews,
  handleSaveBoardNews,
  handleDeleteBoardNews,
  handleGetBoardResources,
  handleSaveBoardResources,
  handleDeleteBoardResources,
  handleGetTeamboardPosts,
  handleSaveTeamboardPost,
  handleDeleteTeamboardPost,
  handleGetCloudFiles,
  handleSaveCloudFiles,
  handleDeleteCloudFile,
  handleReadCloudFile,
  handleGetChatContacts,
  handleGetChatRooms,
  handleChatWebSocket,
  handleChatUserWebSocket,
  handleGetOrCreateDirectChatRoom,
  handleGetOrCreateGroupChatRoom,
  handleUpdateChatRoomInfo,
  handleInviteChatRoomMembers,
  handleGetChatMessages,
  handleSendChatMessage,
  handleVoteChatPoll,
  handleDeleteChatMessage,
  handleChatAttachment,
  handleMarkChatRoomRead,
  handleLeaveChatRoom,
  handleInboundMail,
  handleGetList,
  handleGetAll,
  handleCounts,
  handleReadMail,
  handleReadDraft,
  handleAttachment,
  handleSaveDraft,
  handleDeleteDraft,
  handleDeleteMail,
  handleRestore,
  handleReadState,
  handleStarState,
  handleTrash,
  handleMove,
  handleSpam,
  handleDebug,
  jsonResponse
};

const MAILBOX_QUOTA_BYTES = 500 * 1024 * 1024;
const MAILBOX_LIST_KEYS = ["inbox_list", "sent_list", "my1_list", "my2_list", "my3_list", "spam_list", "trash_list"];

function getMailboxQuotaBytes() {
  return MAILBOX_QUOTA_BYTES;
}

function getJsonByteSize(value) {
  return new TextEncoder().encode(JSON.stringify(value || {})).length;
}

async function getMailboxUsedBytes(env, userEmail, excludeIds) {
  const normalizedEmail = normalizeEmail(userEmail || "");
  if (!normalizedEmail) return 0;

  const excludes = new Set((Array.isArray(excludeIds) ? excludeIds : []).map(function (id) {
    return String(id || "");
  }).filter(Boolean));
  const seen = new Set();
  let total = 0;

  for (const key of MAILBOX_LIST_KEYS) {
    const rows = filterListForUser(await getList(env, key), key, normalizedEmail);
    for (const row of rows) {
      const id = String(row && row.id || "");
      if (!id || seen.has(id) || excludes.has(id)) continue;
      seen.add(id);
      const item = await getMailItem(env, id);
      total += getJsonByteSize(item || row);
    }
  }

  const drafts = filterListForUser(await getList(env, "draft_list"), "draft_list", normalizedEmail);
  for (const row of drafts) {
    const id = String(row && row.id || "");
    if (!id || seen.has("draft:" + id) || excludes.has(id)) continue;
    seen.add("draft:" + id);
    const item = await getDraftItem(env, id);
    total += getJsonByteSize(item || row);
  }

  return total;
}

async function assertMailboxQuota(env, userEmail, nextItem, excludeIds) {
  const normalizedEmail = normalizeEmail(userEmail || "");
  if (!normalizedEmail) return;

  const quotaBytes = getMailboxQuotaBytes();
  const usedBytes = await getMailboxUsedBytes(env, normalizedEmail, excludeIds);
  const nextUsedBytes = usedBytes + getJsonByteSize(nextItem);
  if (nextUsedBytes > quotaBytes) {
    const error = new Error("메일함 용량 500MB를 초과했습니다. 불필요한 메일을 삭제한 뒤 다시 시도해주세요.");
    error.status = 400;
    error.quotaBytes = quotaBytes;
    error.usedBytes = usedBytes;
    error.nextUsedBytes = nextUsedBytes;
    throw error;
  }
}

export class ChatRoomDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      return jsonResponse({ success: false, message: "WebSocket upgrade required" }, 426);
    }

    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const roomId = String(url.searchParams.get("roomId") || "").trim();
    if (!userId || !roomId) {
      return jsonResponse({ success: false, message: "userId와 roomId가 필요합니다." }, 400);
    }

    if (!await canJoinChatRoom(this.env, userId, roomId)) {
      return jsonResponse({ success: false, message: "채팅방을 찾을 수 없습니다." }, 404);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const session = { socket: server, userId: userId, roomId: roomId };

    server.accept();
    this.sessions.add(session);
    this.sendJson(server, { type: "ready", roomId: roomId, userId: userId });

    server.addEventListener("message", async (event) => {
      await this.handleSocketMessage(session, event.data);
    });
    server.addEventListener("close", () => {
      this.sessions.delete(session);
    });
    server.addEventListener("error", () => {
      this.sessions.delete(session);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSocketMessage(session, rawData) {
    let payload = null;
    try {
      payload = JSON.parse(String(rawData || ""));
    } catch (error) {
      this.sendJson(session.socket, { type: "error", message: "메시지 형식이 올바르지 않습니다." });
      return;
    }

    if (!payload) return;

    if (payload.type === "read") {
      try {
        const result = await markChatRoomRead(this.env, session.userId, session.roomId);
        this.broadcast({
          type: "read",
          userId: session.userId,
          roomId: session.roomId,
          readAt: result.readAt,
          room: result.room
        });
        await broadcastChatUserEvent(this.env, result && result.room && result.room.memberIds, {
          type: "chat_read",
          roomId: session.roomId,
          readAt: result.readAt,
          readerUserId: session.userId,
          room: result.room || null
        });
      } catch (error) {
        this.sendJson(session.socket, { type: "error", message: error.message || "읽음 처리에 실패했습니다." });
      }
      return;
    }

    if (payload.type !== "message") return;

    try {
      const result = await saveChatMessage(this.env, {
        userId: session.userId,
        roomId: session.roomId,
        text: payload.text || "",
        attachmentsData: payload.attachmentsData,
        poll: payload.poll
      });
      this.broadcast({
        type: "message",
        item: result.item,
        room: result.room
      });
      await broadcastChatUserEvent(this.env, result && result.room && result.room.memberIds, {
        type: "chat_message",
        roomId: String(result && result.item && result.item.roomId || result && result.room && result.room.id || ""),
        message: result && result.item ? result.item : null,
        room: result && result.room ? result.room : null
      });
      await sendChatPushNotifications(this.env, result, session.userId);
    } catch (error) {
      this.sendJson(session.socket, { type: "error", message: error.message || "메시지를 보내지 못했습니다." });
    }
  }

  broadcast(payload) {
    this.sessions.forEach((session) => {
      this.sendJson(session.socket, payload);
    });
  }

  sendJson(socket, payload) {
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      // Closed sockets are pruned by close/error handlers.
    }
  }
}

export class ChatUserDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() === "websocket") {
      const userId = normalizeLoginId(url.searchParams.get("userId") || "");
      if (!userId) {
        return jsonResponse({ success: false, message: "userId가 필요합니다." }, 400);
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const session = { socket: server, userId: userId };
      server.accept();
      this.sessions.add(session);
      this.sendJson(server, { type: "ready", userId: userId });
      server.addEventListener("close", () => {
        this.sessions.delete(session);
      });
      server.addEventListener("error", () => {
        this.sessions.delete(session);
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, message: "Not Found" }, 404);
    }

    try {
      const body = await request.json();
      const payload = body && typeof body === "object" ? body.payload : null;
      if (!payload || typeof payload !== "object") {
        return jsonResponse({ success: false, message: "payload가 필요합니다." }, 400);
      }
      this.broadcast(payload);
      return jsonResponse({ success: true });
    } catch (error) {
      return jsonResponse({ success: false, message: error.message }, 500);
    }
  }

  broadcast(payload) {
    this.sessions.forEach((session) => {
      this.sendJson(session.socket, payload);
    });
  }

  sendJson(socket, payload) {
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {}
  }
}

async function broadcastChatUserEvent(env, userIds, payload) {
  if (!env.CHAT_USERS) return;
  const targets = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map(function (userId) {
    return normalizeLoginId(userId || "");
  }).filter(Boolean)));
  await Promise.all(targets.map(async function (userId) {
    const id = env.CHAT_USERS.idFromName(userId);
    const stub = env.CHAT_USERS.get(id);
    await stub.fetch("https://chat-user.internal/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: Object.assign({ userId: userId }, payload || {}) })
    });
  }));
}

async function handleSendMail(request, env) {
  try {
    requireKv(env);

    const body = await request.json();
    const toRaw = body.to ? String(body.to).trim() : "";
    const subject = body.subject ? String(body.subject).trim() : "";
    const content = body.content ? String(body.content) : "";
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const fromEmailRaw = body.fromEmail ? String(body.fromEmail).trim().toLowerCase() : "";
    const fromNameRaw = body.fromName ? String(body.fromName).trim() : "";

    if (!toRaw || !subject) return jsonResponse({ success: false, message: "to, subject are required" }, 400);
    if (!env.SENDGRID_API_KEY) return jsonResponse({ success: false, message: "SENDGRID_API_KEY is missing" }, 500);
    if (!fromEmailRaw || fromEmailRaw.indexOf("@") === -1) return jsonResponse({ success: false, message: "valid fromEmail is required" }, 400);

    const allowedDomain = "autonecar.kr";
    const fromDomain = fromEmailRaw.split("@")[1] || "";
    if (fromDomain !== allowedDomain) return jsonResponse({ success: false, message: "발신 메일 도메인이 올바르지 않습니다." }, 400);

    const toList = splitEmails(toRaw);
    if (!toList.length) return jsonResponse({ success: false, message: "유효한 받는사람 메일 주소가 없습니다." }, 400);

    const attachmentsData = attachments
      .filter(function (item) { return item && item.filename && item.content; })
      .map(function (item) {
        return {
          filename: String(item.filename || "파일"),
          type: item.type ? String(item.type) : "application/octet-stream",
          content: String(item.content),
          disposition: "attachment",
          sizeBytes: Number(item.sizeBytes || 0),
          sizeLabel: item.sizeLabel ? String(item.sizeLabel) : ""
        };
      });

    const sendgridPayload = {
      personalizations: [{ to: toList.map(function (email) { return { email: email }; }) }],
      from: { email: fromEmailRaw, name: fromNameRaw || fromEmailRaw.split("@")[0] || "groupware" },
      reply_to: { email: fromEmailRaw, name: fromNameRaw || fromEmailRaw.split("@")[0] || "groupware" },
      subject: subject,
      content: [{ type: "text/html", value: content || "<p></p>" }]
    };

    if (attachmentsData.length > 0) {
      sendgridPayload.attachments = attachmentsData.map(function (item) {
        return {
          filename: item.filename,
          type: item.type,
          content: item.content,
          disposition: "attachment"
        };
      });
    }

    const attachmentsMeta = attachmentsData.map(function (item) {
      return {
        filename: item.filename,
        type: item.type,
        sizeBytes: item.sizeBytes,
        sizeLabel: item.sizeLabel
      };
    });

    const id = "sent_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const item = {
      id: id,
      folder: "sent",
      to: toList.join(","),
      from: fromEmailRaw,
      from_name: fromNameRaw || fromEmailRaw.split("@")[0] || "groupware",
      subject: subject,
      body: content || "<p></p>",
      snippet: stripHtml(content || "<p></p>").slice(0, 120),
      date: new Date().toISOString(),
      unread: false,
      starred: false,
      attachmentCount: attachmentsData.length,
      attachmentsMeta: attachmentsMeta,
      attachmentsData: attachmentsData
    };

    await assertMailboxQuota(env, fromEmailRaw, item);

    const sendgridRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.SENDGRID_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sendgridPayload)
    });

    const sendgridText = await sendgridRes.text();
    if (!sendgridRes.ok) {
      return jsonResponse({
        success: false,
        message: "SendGrid error",
        status: sendgridRes.status,
        detail: sendgridText
      }, 500);
    }

    await setMailItem(env, item);

    const sentList = await getList(env, "sent_list");
    sentList.unshift(toListItem(item));
    await setList(env, "sent_list", sentList);

    return jsonResponse({
      success: true,
      message: "Mail sent",
      id: id,
      recipients: toList,
      attachmentCount: attachmentsData.length,
      attachmentsMeta: attachmentsMeta
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message, quotaBytes: e.quotaBytes, usedBytes: e.usedBytes, nextUsedBytes: e.nextUsedBytes }, e.status || 500);
  }
}

async function handleAuthLogin(request, env) {
  try {
    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const body = await request.json();
    const id = normalizeLoginId(body.id || "");
    const password = String(body.password || "").trim();

    if (!id || !password) {
      return jsonResponse({ success: false, message: "아이디와 비밀번호를 입력해주세요." }, 400);
    }

    const employee = await getPrimaryEmployeeById(env, id);
    if (!employee) {
      return jsonResponse({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." }, 401);
    }

    const isPasswordValid = await verifyEmployeePassword(employee, password);
    if (!isPasswordValid) {
      return jsonResponse({ success: false, message: "아이디 또는 비밀번호가 틀렸습니다." }, 401);
    }

    if (employee.source === "d1" && (!employee.passwordHash || !isSha256Hex(employee.passwordHash))) {
      await upgradeGroupwareDbEmployeePassword(env, employee.id, password);
    } else if (!employee.passwordHash) {
      await upgradeLegacyEmployeePassword(env, employee.id, password);
    }

    const mustChangePassword = await isEmployeeTempPassword(env, employee);

    return jsonResponse({
      success: true,
      employee: sanitizeEmployee(employee),
      mustChangePassword: mustChangePassword
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGroupwareDbTest(env) {
  try {
    if (!env.GROUPWARE_DB) {
      return jsonResponse({ success: false, message: "GROUPWARE_DB binding is missing" }, 500);
    }

    const departmentsResult = await env.GROUPWARE_DB.prepare(
      "SELECT id, name, created_at FROM departments ORDER BY id"
    ).all();

    const usersResult = await env.GROUPWARE_DB.prepare(
      "SELECT id, employee_id, login_id, name, email, department_id, position, role, status FROM users ORDER BY id"
    ).all();

    return jsonResponse({
      success: true,
      departments: Array.isArray(departmentsResult.results) ? departmentsResult.results : [],
      users: Array.isArray(usersResult.results) ? usersResult.results : []
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetEmployees(url, env) {
  try {
    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const requesterRole = normalizeRole(url.searchParams.get("requesterRole") || "");
    if (requesterRole !== "admin") {
      return jsonResponse({ success: false, message: "관리자만 접근할 수 있습니다." }, 403);
    }

    const employees = (await getPrimaryEmployeeList(env)).filter(function (employee) {
      return !isHiddenSelectableEmployee(employee);
    });
    employees.sort(function (a, b) {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

    const signatureMap = await getEmployeeSignatureMap(env);
    return jsonResponse({
      success: true,
      items: employees.map(function (employee) { return sanitizeEmployeeWithSignature(employee, signatureMap); })
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleCreateEmployee(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const name = String(body.name || "").trim();
    const password = String(body.password || "").trim();
    const role = normalizeRole(body.role || "staff");
    const birthDate = normalizeBirthDate(body.birthDate || "");
    const hireDate = normalizeHireDate(body.hireDate || "");
    const department = normalizeDepartmentName(body.department || "");
    const position = normalizeEmployeeText(body.position || "");
    const jobGrade = normalizeEmployeeText(body.jobGrade || "");
    const mobilePhone = normalizeEmployeePhone(body.mobilePhone || "");
    const directPhone = normalizeEmployeePhone(body.directPhone || "");
    const workHours = normalizeWorkHours(body.workHours || "");
    const workSchedule = normalizeEmployeeWorkSchedule(body.workSchedule || getDefaultDepartmentWorkSchedule(department));

    if (!id) return jsonResponse({ success: false, message: "아이디를 입력해주세요." }, 400);
    if (!name) return jsonResponse({ success: false, message: "이름을 입력해주세요." }, 400);
    if (!password) return jsonResponse({ success: false, message: "임시 비밀번호를 입력해주세요." }, 400);
    if (body.birthDate && !birthDate) return jsonResponse({ success: false, message: "생년월일은 YYYYMMDD 8자리로 입력해주세요." }, 400);
    if (body.hireDate && !hireDate) return jsonResponse({ success: false, message: "입사일은 YYYYMMDD 8자리로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const employees = await getPrimaryEmployeeList(env);
    if (employees.some(function (employee) { return employee.id === id; })) {
      return jsonResponse({ success: false, message: "이미 사용 중인 아이디입니다." }, 409);
    }

    if (hasGroupwareDb(env)) {
      const departmentId = department ? await findGroupwareDepartmentIdByName(env, department) : null;
      if (department && !departmentId) {
        return jsonResponse({ success: false, message: "선택한 부서를 찾을 수 없습니다." }, 404);
      }

      const employeeNumber = await generatePrimaryEmployeeNumber(env);
      const passwordHash = await hashPassword(password);
      const email = normalizeEmail(body.email || (id + "@autonecar.kr"));
      const phone = normalizeEmployeePhone(mobilePhone || directPhone || "");

      await env.GROUPWARE_DB.prepare(
        "INSERT INTO users (employee_id, login_id, password_hash, name, email, phone, department_id, position, role, status, birth_date, hire_date, job_grade, mobile_phone, direct_phone, work_hours, extra_vacation_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        employeeNumber,
        id,
        passwordHash,
        name,
        email,
        phone,
        departmentId,
        position,
        role,
        "active",
        birthDate,
        hireDate,
        jobGrade,
        mobilePhone,
        directPhone,
        workHours,
        0
      ).run();

      const createdEmployee = await getGroupwareDbEmployeeById(env, id);
      await setEmployeeTempPasswordFlag(env, id, true);
      if (normalizeEmployeeSignatureImage(body.signatureImage || "")) await setEmployeeSignature(env, id, body.signatureImage || "");
      return jsonResponse({ success: true, item: sanitizeEmployeeWithSignature(createdEmployee, await getEmployeeSignatureMap(env)) });
    }

    const employee = await buildServerEmployee({
      id: id,
      name: name,
      password: password,
      role: role,
      isTempPassword: true,
      birthDate: birthDate,
      hireDate: hireDate,
      department: department,
      position: position,
      jobGrade: jobGrade,
      mobilePhone: mobilePhone,
      directPhone: directPhone,
      workHours: workHours,
      workSchedule: workSchedule
    }, env);

    employees.push(employee);
    await setEmployeeList(env, employees);
    if (normalizeEmployeeSignatureImage(body.signatureImage || "")) await setEmployeeSignature(env, id, body.signatureImage || "");

    return jsonResponse({ success: true, item: sanitizeEmployeeWithSignature(employee, await getEmployeeSignatureMap(env)) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeSignature(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);

    const employee = await getPrimaryEmployeeById(env, id);
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    await setEmployeeSignature(env, id, body.signatureImage || "");
    return jsonResponse({ success: true, item: sanitizeEmployeeWithSignature(employee, await getEmployeeSignatureMap(env)) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleGetDepartments(url, env) {
  try {
    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const requesterRole = normalizeRole(url.searchParams.get("requesterRole") || "");
    if (requesterRole !== "admin") {
      return jsonResponse({ success: false, message: "관리자만 접근할 수 있습니다." }, 403);
    }

    return jsonResponse({ success: true, items: await getPrimaryDepartmentList(env) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleCreateDepartment(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const name = normalizeDepartmentName(body.name || "");
    if (!name) return jsonResponse({ success: false, message: "부서명을 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const departments = await getPrimaryDepartmentList(env);
    if (departments.indexOf(name) > -1) {
      return jsonResponse({ success: false, message: "이미 등록된 부서입니다." }, 409);
    }

    if (hasGroupwareDb(env)) {
      await env.GROUPWARE_DB.prepare(
        "INSERT INTO departments (name) VALUES (?)"
      ).bind(name).run();
      return jsonResponse({ success: true, item: name });
    }

    departments.push(name);
    departments.sort(function (a, b) { return a.localeCompare(b, "ko"); });
    await setDepartmentList(env, departments);
    return jsonResponse({ success: true, item: name });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateDepartment(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const name = normalizeDepartmentName(body.name || "");
    const nextName = normalizeDepartmentName(body.nextName || "");
    if (!name || !nextName) return jsonResponse({ success: false, message: "부서명을 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const departments = await getPrimaryDepartmentList(env);
    if (departments.indexOf(name) === -1) {
      return jsonResponse({ success: false, message: "부서를 찾을 수 없습니다." }, 404);
    }
    if (name !== nextName && departments.indexOf(nextName) > -1) {
      return jsonResponse({ success: false, message: "이미 등록된 부서입니다." }, 409);
    }

    if (hasGroupwareDb(env)) {
      await env.GROUPWARE_DB.prepare(
        "UPDATE departments SET name = ? WHERE name = ?"
      ).bind(nextName, name).run();
      return jsonResponse({ success: true, item: nextName });
    }

    const nextDepartments = departments.map(function (department) {
      return department === name ? nextName : department;
    }).sort(function (a, b) { return a.localeCompare(b, "ko"); });
    await setDepartmentList(env, nextDepartments);

    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (String(employee.department || "") !== name) return employee;
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: nextName,
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
    });
    await setEmployeeList(env, employees);

    return jsonResponse({ success: true, item: nextName });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleDeleteDepartment(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const name = normalizeDepartmentName(body.name || "");
    if (!name) return jsonResponse({ success: false, message: "삭제할 부서를 선택해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const departments = await getPrimaryDepartmentList(env);
    if (departments.indexOf(name) === -1) {
      return jsonResponse({ success: false, message: "부서를 찾을 수 없습니다." }, 404);
    }

    if (hasGroupwareDb(env)) {
      const department = await env.GROUPWARE_DB.prepare(
        "SELECT id FROM departments WHERE name = ? LIMIT 1"
      ).bind(name).first();
      if (!department || !department.id) {
        return jsonResponse({ success: false, message: "부서를 찾을 수 없습니다." }, 404);
      }

      await env.GROUPWARE_DB.prepare(
        "UPDATE users SET department_id = NULL WHERE department_id = ?"
      ).bind(department.id).run();
      await env.GROUPWARE_DB.prepare(
        "DELETE FROM departments WHERE id = ?"
      ).bind(department.id).run();
      return jsonResponse({ success: true });
    }

    await setDepartmentList(env, departments.filter(function (department) {
      return department !== name;
    }));

    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (String(employee.department || "") !== name) return employee;
      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: "",
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
    });
    await setEmployeeList(env, employees);

    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleDeleteEmployeeAccount(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    if (!id) return jsonResponse({ success: false, message: "삭제할 계정을 선택해주세요." }, 400);
    if (id === "admin") return jsonResponse({ success: false, message: "관리자 계정은 삭제할 수 없습니다." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    if (hasGroupwareDb(env)) {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) {
        return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      }

      await env.GROUPWARE_DB.prepare(
        "DELETE FROM users WHERE lower(login_id) = ?"
      ).bind(id).run();
      return jsonResponse({ success: true });
    }

    const employees = await getEmployeeList(env);
    const nextEmployees = employees.filter(function (employee) { return employee.id !== id; });
    if (nextEmployees.length === employees.length) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, nextEmployees);
    return jsonResponse({ success: true });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleResetEmployeeAccountPassword(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const password = String(body.password || "").trim();
    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (!password) return jsonResponse({ success: false, message: "임시 비밀번호를 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const passwordHash = await hashPassword(password);

    if (hasGroupwareDb(env)) {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) {
        return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      }

      await env.GROUPWARE_DB.prepare(
        "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE lower(login_id) = ?"
      ).bind(passwordHash, id).run();

      const updatedEmployee = await getGroupwareDbEmployeeById(env, id);
      await setEmployeeTempPasswordFlag(env, id, true);
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        passwordHash: passwordHash,
        role: employee.role,
        isTempPassword: true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeBirthDate(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const birthDate = normalizeBirthDate(body.birthDate || "");

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (!birthDate) return jsonResponse({ success: false, message: "생년월일은 YYYYMMDD 8자리로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    } else {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
        birth_date: birthDate,
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: birthDate,
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        workHours: employee.workHours || employee.workTime || "",
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeHireDate(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const hireDate = normalizeHireDate(body.hireDate || "");

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (!hireDate) return jsonResponse({ success: false, message: "입사일은 YYYYMMDD 8자리로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    } else {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
        hire_date: hireDate,
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: hireDate,
        department: employee.department || "",
        workHours: employee.workHours || employee.workTime || "",
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeDepartment(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const department = normalizeDepartmentName(body.department || "");

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (!department) return jsonResponse({ success: false, message: "부서를 선택해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const departments = await getPrimaryDepartmentList(env);
    if (departments.indexOf(department) === -1) {
      return jsonResponse({ success: false, message: "등록되지 않은 부서입니다." }, 400);
    }

    if (hasGroupwareDb(env)) {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      const departmentId = await findGroupwareDepartmentIdByName(env, department);
      if (!departmentId) return jsonResponse({ success: false, message: "등록되지 않은 부서입니다." }, 400);
      const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
        department_id: departmentId,
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: department,
        workHours: employee.workHours || employee.workTime || "",
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeWorkHours(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const workHours = normalizeWorkHours(body.workHours || "");

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    } else {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
        work_hours: workHours,
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        workHours: workHours,
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeProfile(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const name = String(body.name || "").trim();
    const role = normalizeRole(body.role || "staff");
    const birthDate = normalizeBirthDate(body.birthDate || "");
    const hireDate = normalizeHireDate(body.hireDate || "");
    const department = normalizeDepartmentName(body.department || "");
    const workHours = normalizeWorkHours(body.workHours || "");
    const position = normalizeEmployeeText(body.position || "");
    const jobGrade = normalizeEmployeeText(body.jobGrade || "");
    const mobilePhone = normalizeEmployeePhone(body.mobilePhone || "");
    const directPhone = normalizeEmployeePhone(body.directPhone || "");
    const workSchedule = normalizeEmployeeWorkSchedule(body.workSchedule || getDefaultDepartmentWorkSchedule(department));

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (body.birthDate && !birthDate) return jsonResponse({ success: false, message: "생년월일은 YYYYMMDD 8자리로 입력해주세요." }, 400);
    if (body.hireDate && !hireDate) return jsonResponse({ success: false, message: "입사일은 YYYYMMDD 8자리로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    if (department) {
      const departments = await getPrimaryDepartmentList(env);
      if (departments.indexOf(department) === -1) {
        return jsonResponse({ success: false, message: "등록되지 않은 부서입니다." }, 400);
      }
    }

    if (hasGroupwareDb(env)) {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (employee) {
        const departmentId = department ? await findGroupwareDepartmentIdByName(env, department) : null;
        if (department && !departmentId) return jsonResponse({ success: false, message: "등록되지 않은 부서입니다." }, 400);
        const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
          name: name || employee.name,
          role: role,
          birth_date: birthDate,
          hire_date: hireDate,
          department_id: departmentId,
          position: position,
          job_grade: jobGrade,
          mobile_phone: mobilePhone,
          direct_phone: directPhone,
          work_hours: workHours,
          phone: mobilePhone || directPhone || "",
          updated_at: "CURRENT_TIMESTAMP"
        });
        return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
      }
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: name || employee.name,
        email: employee.email,
        birthDate: birthDate,
        hireDate: hireDate,
        department: department,
        position: position,
        jobGrade: jobGrade,
        mobilePhone: mobilePhone,
        directPhone: directPhone,
        employeeNumber: employee.employeeNumber || "",
        workHours: workHours,
        workSchedule: workSchedule,
        passwordHash: employee.passwordHash || "",
        role: role || employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleUpdateEmployeeExtraVacationDays(request, env) {
  try {
    const body = await request.json();
    ensureAdminRequester(body);

    const id = normalizeLoginId(body.id || "");
    const deltaDays = normalizeExtraVacationDays(body.deltaDays || 0);

    if (!id) return jsonResponse({ success: false, message: "직원 계정을 선택해주세요." }, 400);
    if (!deltaDays) return jsonResponse({ success: false, message: "추가할 휴가 일수를 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    } else {
      const employee = await getGroupwareDbEmployeeById(env, id);
      if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
      const updatedEmployee = await updateGroupwareDbEmployee(env, id, {
        extra_vacation_days: normalizeExtraVacationDays(Number(employee.extraVacationDays || 0) + deltaDays),
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== id) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        workHours: employee.workHours || employee.workTime || "",
        extraVacationDays: normalizeExtraVacationDays(Number(employee.extraVacationDays || 0) + deltaDays),
        passwordHash: employee.passwordHash || "",
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.message === "관리자만 접근할 수 있습니다." ? 403 : 500);
  }
}

async function handleChangeOwnPassword(request, env) {
  try {
    const body = await request.json();
    const requesterId = normalizeLoginId(body.userId || "");
    const nextPassword = String(body.password || "").trim();

    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    if (!nextPassword) return jsonResponse({ success: false, message: "새 비밀번호를 입력해주세요." }, 400);
    if (nextPassword.length < 4) return jsonResponse({ success: false, message: "비밀번호는 4자 이상으로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const currentEmployee = await getPrimaryEmployeeById(env, requesterId);
    if (!currentEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    const passwordHash = await hashPassword(nextPassword);
    if (hasGroupwareDb(env)) {
      const updatedEmployee = await updateGroupwareDbEmployee(env, requesterId, {
        password_hash: passwordHash,
        updated_at: "CURRENT_TIMESTAMP"
      });
      await setEmployeeTempPasswordFlag(env, requesterId, false);
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== requesterId) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: employee.birthDate || "",
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        position: employee.position || "",
        jobGrade: employee.jobGrade || "",
        mobilePhone: employee.mobilePhone || "",
        directPhone: employee.directPhone || "",
        employeeNumber: employee.employeeNumber || "",
        passwordHash: passwordHash,
        workHours: employee.workHours || employee.workTime || "",
        workSchedule: resolveEmployeeWorkSchedule(employee),
        extraVacationDays: normalizeExtraVacationDays(employee && employee.extraVacationDays || 0),
        role: employee.role,
        isTempPassword: false,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleFindPassword(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const id = normalizeLoginId(body.id || "");
    const name = String(body.name || "").trim();
    const birthDate = normalizeBirthDate(body.birthDate || "");

    if (!id || !name || !birthDate) {
      return jsonResponse({ success: false, message: "아이디, 이름, 생년월일을 모두 입력해주세요." }, 400);
    }

    const employee = await getEmployeeById(env, id);
    if (!employee || String(employee.name || "").trim() !== name || String(employee.birthDate || "") !== birthDate) {
      return jsonResponse({ success: false, message: "입력한 정보와 일치하는 계정을 찾을 수 없습니다." }, 404);
    }

    const passwordHash = await hashPassword("1234");
    const employees = (await getEmployeeList(env)).map(function (item) {
      if (item.id !== id) return item;
      return {
        id: item.id,
        name: item.name,
        email: item.email,
        birthDate: item.birthDate || "",
        hireDate: item.hireDate || "",
        department: item.department || "",
        passwordHash: passwordHash,
        role: item.role,
        isTempPassword: true,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString()
      };
    });

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, message: "임시 비밀번호가 재설정되었습니다.", tempPassword: "1234" });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetOwnProfile(url, env) {
  try {
    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const employee = await getPrimaryEmployeeById(env, userId);
    if (!employee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    return jsonResponse({ success: true, item: sanitizeEmployee(employee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleUpdateOwnProfile(request, env) {
  try {
    const body = await request.json();
    const requesterId = normalizeLoginId(body.userId || body.requesterId || "");
    const birthDate = normalizeBirthDate(body.birthDate || "");
    const mobilePhone = normalizeEmployeePhone(body.mobilePhone || "");

    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    if (body.birthDate && !birthDate) return jsonResponse({ success: false, message: "생년월일은 YYYYMMDD 8자리로 입력해주세요." }, 400);

    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const currentEmployee = await getPrimaryEmployeeById(env, requesterId);
    if (!currentEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    if (hasGroupwareDb(env)) {
      const updatedEmployee = await updateGroupwareDbEmployee(env, requesterId, {
        birth_date: birthDate,
        mobile_phone: mobilePhone,
        phone: mobilePhone,
        updated_at: "CURRENT_TIMESTAMP"
      });
      return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
    }

    let updatedEmployee = null;
    const employees = (await getEmployeeList(env)).map(function (employee) {
      if (employee.id !== requesterId) return employee;
      updatedEmployee = {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        birthDate: birthDate,
        hireDate: employee.hireDate || "",
        department: employee.department || "",
        position: employee.position || "",
        jobGrade: employee.jobGrade || "",
        mobilePhone: mobilePhone,
        directPhone: employee.directPhone || "",
        employeeNumber: employee.employeeNumber || "",
        passwordHash: employee.passwordHash || "",
        workHours: employee.workHours || employee.workTime || "",
        workSchedule: resolveEmployeeWorkSchedule(employee),
        extraVacationDays: normalizeExtraVacationDays(employee && employee.extraVacationDays || 0),
        role: employee.role,
        isTempPassword: employee.isTempPassword === true,
        createdAt: employee.createdAt,
        updatedAt: new Date().toISOString()
      };
      return updatedEmployee;
    });

    if (!updatedEmployee) {
      return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    }

    await setEmployeeList(env, employees);
    return jsonResponse({ success: true, item: sanitizeEmployee(updatedEmployee) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetOwnAttendance(url, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const userEmail = normalizeEmail(url.searchParams.get("userEmail") || "");
    const userName = String(url.searchParams.get("userName") || "").trim();
    if (!userId && !userEmail && !userName) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const resolved = await resolveAttendanceEmployee(env, { userId, userEmail, userName });
    const employee = resolved.employee;
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    const records = await getAttendanceRecords(env, resolved.userId);
    return jsonResponse({ success: true, userId: resolved.userId, items: records });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function resolveAttendanceEmployee(env, candidate) {
  const requestedId = normalizeLoginId(candidate && candidate.userId || "");
  const requestedEmail = normalizeEmail(candidate && candidate.userEmail || "");
  const requestedName = String(candidate && candidate.userName || "").trim();

  if (requestedId) {
    const byId = await getPrimaryEmployeeById(env, requestedId);
    if (byId) return { employee: byId, userId: normalizeLoginId(byId.id || requestedId) };
  }

  const employees = await getPrimaryEmployeeList(env);
  let employee = null;
  if (requestedEmail) {
    employee = employees.find(function (item) {
      return normalizeEmail(item && item.email || "") === requestedEmail;
    }) || null;
  }
  if (!employee && requestedName) {
    const matches = employees.filter(function (item) {
      return String(item && item.name || "").trim() === requestedName;
    });
    employee = matches.length === 1 ? matches[0] : null;
  }

  return {
    employee: employee,
    userId: normalizeLoginId(employee && employee.id || requestedId)
  };
}

async function handleGetChatContacts(url, env) {
  try {
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const result = await getChatContacts(env, userId);
    return jsonResponse({ success: true, me: result.me, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetChatRooms(url, env) {
  try {
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const result = await getChatRoomSummaries(env, userId);
    return jsonResponse({ success: true, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetOrCreateDirectChatRoom(request, env) {
  try {
    const body = await request.json();
    const result = await getOrCreateDirectChatRoom(env, body);
    await broadcastChatUserEvent(env, result && result.item && result.item.memberIds, {
      type: "chat_room_sync",
      roomId: result && result.item && result.item.id || ""
    });
    return jsonResponse({ success: true, item: result.item });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetOrCreateGroupChatRoom(request, env) {
  try {
    const body = await request.json();
    const result = await getOrCreateGroupChatRoom(env, body);
    await broadcastChatUserEvent(env, result && result.item && result.item.memberIds, {
      type: "chat_room_sync",
      roomId: result && result.item && result.item.id || ""
    });
    return jsonResponse({ success: true, item: result.item });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleUpdateChatRoomInfo(request, env) {
  try {
    const body = await request.json();
    const result = await updateChatRoomInfo(env, body);
    await broadcastChatUserEvent(env, result && result.item && result.item.memberIds, {
      type: "chat_room_sync",
      roomId: result && result.item && result.item.id || ""
    });
    return jsonResponse({ success: true, item: result.item });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleInviteChatRoomMembers(request, env) {
  try {
    const body = await request.json();
    const result = await inviteChatRoomMembers(env, body);
    const inviteTargets = Array.from(new Set([]
      .concat(result && result.room && result.room.memberIds || [])
      .concat(body && (body.targetUserIds || body.memberIds) || [])
    ));
    await broadcastChatUserEvent(env, inviteTargets, {
      type: "chat_room_sync",
      roomId: result && result.room && result.room.id || result && result.item && result.item.roomId || ""
    });
    return jsonResponse({ success: true, item: result.item, room: result.room });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetChatMessages(url, env) {
  try {
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const roomId = String(url.searchParams.get("roomId") || "").trim();
    const result = await getChatMessageList(env, userId, roomId);
    return jsonResponse({ success: true, room: result.room, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleChatWebSocket(request, url, env) {
  try {
    if (!env.CHAT_ROOMS) {
      return jsonResponse({ success: false, message: "CHAT_ROOMS binding is missing" }, 500);
    }
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      return jsonResponse({ success: false, message: "WebSocket upgrade required" }, 426);
    }

    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const roomId = String(url.searchParams.get("roomId") || "").trim();
    if (!roomId) return jsonResponse({ success: false, message: "roomId가 필요합니다." }, 400);

    let effectiveRoomId = roomId;
    if (userId) {
      effectiveRoomId = await getCanonicalChatRoomId(env, userId, roomId);
    }

    const id = env.CHAT_ROOMS.idFromName(effectiveRoomId);
    const stub = env.CHAT_ROOMS.get(id);
    if (effectiveRoomId === roomId) return await stub.fetch(request);

    const effectiveUrl = new URL(request.url);
    effectiveUrl.searchParams.set("roomId", effectiveRoomId);
    return await stub.fetch(new Request(effectiveUrl.toString(), request));
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleChatUserWebSocket(request, url, env) {
  try {
    if (!env.CHAT_USERS) {
      return jsonResponse({ success: false, message: "CHAT_USERS binding is missing" }, 500);
    }
    const upgradeHeader = request.headers.get("Upgrade") || "";
    if (upgradeHeader.toLowerCase() !== "websocket") {
      return jsonResponse({ success: false, message: "WebSocket upgrade required" }, 426);
    }
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "userId가 필요합니다." }, 400);
    const id = env.CHAT_USERS.idFromName(userId);
    const stub = env.CHAT_USERS.get(id);
    return await stub.fetch(request);
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSendChatMessage(request, env) {
  try {
    const body = await request.json();
    const result = await saveChatMessage(env, body);
    const senderUserId = normalizeLoginId(body.userId || "");
    const roomMemberIds = Array.isArray(result && result.room && result.room.memberIds)
      ? result.room.memberIds
      : [];
    const recipientIds = Array.from(new Set(roomMemberIds.map(normalizeLoginId).filter(function (memberId) {
      return memberId && memberId !== senderUserId;
    })));
    if (recipientIds.length) {
      const item = result && result.item ? result.item : {};
      const room = result && result.room ? result.room : {};
      const text = String(item.text || "").trim();
      const attachmentCount = Array.isArray(item.attachmentsData) ? item.attachmentsData.length : 0;
      const pollTitle = String(item && item.poll && item.poll.title || "").trim();
      await createNotificationsForUsers(env, recipientIds, {
        type: "chat_message",
        actorName: String(item.senderName || senderUserId || "대화 상대").trim() || "대화 상대",
        actionLabel: "새 메시지",
        menuLabel: "채팅",
        docLabel: String(room.customTitle || room.title || "").trim(),
        title: String(item.senderName || senderUserId || "대화 상대").trim() + "님이 메시지를 보냈습니다.",
        body: pollTitle ? "투표: " + pollTitle : (text || (attachmentCount ? "첨부파일 " + attachmentCount + "개" : "새 채팅 메시지")),
        link: "/chat.html?roomId=" + encodeURIComponent(String(item.roomId || room.id || ""))
      });
    }
    await broadcastChatUserEvent(env, roomMemberIds, {
      type: "chat_message",
      roomId: String(result && result.item && result.item.roomId || result && result.room && result.room.id || ""),
      message: result && result.item ? result.item : null,
      room: result && result.room ? result.room : null
    });
    return jsonResponse({ success: true, item: result.item, room: result.room });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleVoteChatPoll(request, env) {
  try {
    const body = await request.json();
    const result = await voteChatPoll(env, body);
    await broadcastChatUserEvent(env, result && result.room && result.room.memberIds, {
      type: "chat_message",
      roomId: String(result && result.item && result.item.roomId || result && result.room && result.room.id || ""),
      message: result && result.item ? result.item : null,
      room: result && result.room ? result.room : null
    });
    return jsonResponse({ success: true, item: result.item, room: result.room });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleDeleteChatMessage(request, env) {
  try {
    const body = await request.json();
    const result = await deleteChatMessage(env, body);
    const deletingUserId = normalizeLoginId(body && body.userId || "");
    if (result && result.deleteMode === "everyone" && result.item) {
      const recipientIds = (Array.isArray(result.memberIds) ? result.memberIds : []).filter(function (memberId) {
        return normalizeLoginId(memberId || "") && normalizeLoginId(memberId || "") !== deletingUserId;
      });
      await Promise.all(recipientIds.map(function (memberId) {
        return broadcastChatUserEvent(env, [memberId], {
          type: "chat_message",
          roomId: String(result && result.item && result.item.roomId || result && result.room && result.room.id || ""),
          message: result.item,
          room: result && result.roomsByUserId && result.roomsByUserId[memberId] ? result.roomsByUserId[memberId] : result.room || null
        });
      }));
    }
    await broadcastChatUserEvent(env, [deletingUserId], {
      type: "chat_message_delete",
      roomId: String(result && result.room && result.room.id || body && body.roomId || ""),
      deletedId: result && result.deletedId || "",
      room: result && result.room ? result.room : null
    });
    return jsonResponse({ success: true, deletedId: result.deletedId, deleteMode: result.deleteMode, deleteForMe: result.deleteForMe, item: result.item, room: result.room });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleMarkChatRoomRead(request, env) {
  try {
    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    const roomId = String(body.roomId || "").trim();
    const result = await markChatRoomRead(env, userId, roomId);
    await broadcastChatUserEvent(env, result && result.room && result.room.memberIds, {
      type: "chat_read",
      roomId: roomId,
      readAt: result.readAt,
      readerUserId: userId,
      room: result.room || null
    });
    return jsonResponse({ success: true, roomId: roomId, readAt: result.readAt, room: result.room });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleLeaveChatRoom(request, env) {
  try {
    const body = await request.json();
    const result = await leaveChatRoom(env, body);
    await broadcastChatUserEvent(env, [body && body.userId], {
      type: "chat_room_sync",
      roomId: result.roomId || ""
    });
    return jsonResponse({ success: true, roomId: result.roomId, leftAt: result.leftAt });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleAttendanceCheckIn(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    const userEmail = normalizeEmail(body.userEmail || "");
    const userName = String(body.userName || "").trim();

    if (!userId && !userEmail && !userName) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const resolved = await resolveAttendanceEmployee(env, { userId, userEmail, userName });
    const employee = resolved.employee;
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    const canonicalUserId = resolved.userId;

    const records = await getAttendanceRecords(env, canonicalUserId);
    const now = new Date();
    const todayKey = formatAttendanceDateKey(now);
    let record = records.find(function (item) {
      return item && item.date === todayKey;
    }) || null;

    if (record && record.checkIn) {
      return jsonResponse({ success: false, message: "이미 출근 처리되었습니다." }, 400);
    }

    if (!record) {
      record = {
        date: todayKey,
        checkIn: now.toISOString(),
        checkOut: "",
        userId: canonicalUserId,
        userName: userName || employee.name || canonicalUserId,
        specials: {}
      };
      records.push(record);
    } else {
      record.checkIn = now.toISOString();
      record.userId = canonicalUserId;
      record.userName = record.userName || userName || employee.name || canonicalUserId;
      record.specials = record.specials && typeof record.specials === "object" ? record.specials : {};
    }

    record.specials = record.specials && typeof record.specials === "object" ? record.specials : {};
    record.specials.late = isLateAttendance(now, employee);

    await setAttendanceRecords(env, canonicalUserId, records);
    return jsonResponse({ success: true, userId: canonicalUserId, item: record, items: records });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleAttendanceCheckOut(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    const userEmail = normalizeEmail(body.userEmail || "");
    const userName = String(body.userName || "").trim();
    if (!userId && !userEmail && !userName) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const resolved = await resolveAttendanceEmployee(env, { userId, userEmail, userName });
    const employee = resolved.employee;
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    const canonicalUserId = resolved.userId;

    const records = await getAttendanceRecords(env, canonicalUserId);
    const now = new Date();
    const todayKey = formatAttendanceDateKey(now);
    const record = records.find(function (item) {
      return item && item.date === todayKey;
    }) || null;

    if (!record || !record.checkIn) {
      return jsonResponse({ success: false, message: "먼저 출근 처리를 해주세요." }, 400);
    }
    if (record.checkOut) {
      return jsonResponse({ success: false, message: "이미 퇴근 처리되었습니다." }, 400);
    }

    record.checkOut = now.toISOString();
    record.userId = canonicalUserId;
    await setAttendanceRecords(env, canonicalUserId, records);
    return jsonResponse({ success: true, userId: canonicalUserId, item: record, items: records });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleAttendanceSpecial(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    const userEmail = normalizeEmail(body.userEmail || "");
    const userName = String(body.userName || "").trim();
    const type = normalizeAttendanceSpecialType(body.type || "");
    const value = body.value === true;
    if (!userId && !userEmail && !userName) return jsonResponse({ success: false, message: "userId is required" }, 400);
    if (!type) return jsonResponse({ success: false, message: "특이사항 종류가 올바르지 않습니다." }, 400);

    const resolved = await resolveAttendanceEmployee(env, { userId, userEmail, userName });
    const employee = resolved.employee;
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);
    const canonicalUserId = resolved.userId;

    const records = await getAttendanceRecords(env, canonicalUserId);
    const now = new Date();
    const todayKey = formatAttendanceDateKey(now);
    let record = records.find(function (item) {
      return item && item.date === todayKey;
    }) || null;

    if (!record) {
      record = {
        date: todayKey,
        checkIn: "",
        checkOut: "",
        userId: canonicalUserId,
        userName: employee.name || canonicalUserId,
        specials: {}
      };
      records.push(record);
    }

    record.userId = canonicalUserId;
    record.specials = record.specials && typeof record.specials === "object" ? record.specials : {};
    record.specials[type] = value;
    record.updatedAt = now.toISOString();

    await setAttendanceRecords(env, canonicalUserId, records);
    return jsonResponse({ success: true, userId: canonicalUserId, item: record, items: records });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetAdminAttendanceToday(url, env) {
  try {
    requireKv(env);

    const requesterRole = normalizeRole(url.searchParams.get("requesterRole") || "");
    if (requesterRole !== "admin") {
      return jsonResponse({ success: false, message: "관리자만 접근할 수 있습니다." }, 403);
    }

    const todayKey = formatAttendanceDateKey(new Date());
    const employees = (await getPrimaryEmployeeList(env)).filter(function (employee) {
      return !isHiddenSelectableEmployee(employee);
    });
    employees.sort(function (a, b) {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

    const rows = [];
    for (const employee of employees) {
      const records = await getAttendanceRecords(env, employee.id);
      const record = records.find(function (item) {
        return item && item.date === todayKey;
      }) || null;
      rows.push({
        id: employee.id || "-",
        name: employee.name || "-",
        checkIn: record && record.checkIn ? record.checkIn : "",
        checkOut: record && record.checkOut ? record.checkOut : ""
      });
    }

    return jsonResponse({ success: true, items: rows, date: todayKey });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveApprovalDocument(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const requesterId = normalizeLoginId(body.requesterId || body.authorId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const employee = await getPrimaryEmployeeById(env, requesterId);
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    const status = normalizeApprovalStatus(body.status || "draft");
    const documents = await getApprovalDocumentList(env);
    const now = new Date().toISOString();
    const requestedId = normalizeApprovalDocumentId(body.id || "");
    const requestedDocNo = normalizeApprovalDocNo(body.docNo || "");
    const docNoOwner = requestedDocNo ? documents.find(function (item) { return item.docNo === requestedDocNo; }) || null : null;
    const shouldReuseDocNo = requestedId || !docNoOwner || docNoOwner.authorId === requesterId || employee.role === "admin";
    const docNo = shouldReuseDocNo && requestedDocNo ? requestedDocNo : buildApprovalServerDocNo(documents);
    const id = requestedId || (shouldReuseDocNo ? findApprovalDocumentIdByDocNo(documents, docNo) : "") || buildApprovalDocumentId(docNo);
    const existingSummary = documents.find(function (item) { return item.id === id; }) || null;
    const existingRaw = existingSummary ? await env.MAIL_KV.get("approval:document:" + id) : "";
    const existing = existingRaw ? JSON.parse(existingRaw) : {};

    if (existing.authorId && existing.authorId !== requesterId && employee.role !== "admin") {
      return jsonResponse({ success: false, message: "문서를 수정할 권한이 없습니다." }, 403);
    }

    const signatureMap = await getEmployeeSignatureMap(env);
    const item = sanitizeApprovalDocument({
      id: id,
      docNo: docNo,
      docType: normalizeApprovalDocTypeServer(body.docType || existing.docType || ""),
      title: String(body.title || "").trim(),
      proposalContent: String(body.proposalContent || ""),
      body: String(body.body || ""),
      writeDate: String(body.writeDate || existing.writeDate || "").trim(),
      department: normalizeDepartmentName(body.department || employee.department || existing.department || ""),
      authorId: requesterId,
      authorName: String(body.authorName || employee.name || existing.authorName || "").trim(),
      authorEmail: normalizeEmail(body.authorEmail || employee.email || existing.authorEmail || ""),
      status: status,
      paymentRequestDate: String(body.paymentRequestDate || ""),
      assetUser: String(body.assetUser || ""),
      assetName: String(body.assetName || ""),
      expenseItems: Array.isArray(body.expenseItems) ? body.expenseItems : [],
      resolutionItems: Array.isArray(body.resolutionItems) ? body.resolutionItems : [],
      assetItems: Array.isArray(body.assetItems) ? body.assetItems : [],
      certificateInfo: body.certificateInfo && typeof body.certificateInfo === "object" ? body.certificateInfo : {},
      tripInfo: body.tripInfo && typeof body.tripInfo === "object" ? body.tripInfo : {},
      vacationInfo: body.vacationInfo && typeof body.vacationInfo === "object" ? body.vacationInfo : {},
      firstApprover: String(body.firstApprover || "미지정").trim() || "미지정",
      approvers: normalizeApprovalPersonList(body.approvers),
      approverIds: normalizeApprovalStringList(body.approverIds),
      approverDepartments: normalizeApprovalStringList(body.approverDepartments),
      approverSignatureImages: buildApprovalSignatureImages(body.approvers, body.approverIds, body.approverSignatureImages, signatureMap),
      referenceUser: String(body.referenceUser || "미지정").trim() || "미지정",
      referenceUsers: normalizeApprovalPersonList(body.referenceUsers),
      referenceUserIds: normalizeApprovalStringList(body.referenceUserIds),
      referenceUserDepartments: normalizeApprovalStringList(body.referenceUserDepartments),
      fileNames: normalizeApprovalStringList(body.fileNames),
      attachmentsData: normalizeApprovalAttachments(body.attachmentsData),
      createdAt: existing.createdAt || now,
      updatedAt: now,
      submittedAt: status === "pending" ? (existing.submittedAt || now) : (existing.submittedAt || "")
    });

    await env.MAIL_KV.put("approval:document:" + id, JSON.stringify(item));
    await upsertApprovalDocumentSummary(env, item);
    if (item.status === "pending" && existing.status !== "pending") {
      await createApprovalSubmittedNotifications(env, item);
    }

    return jsonResponse({ success: true, item: toApprovalListItem(item) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetApprovalEmployees(url, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const requesterId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    const signatureMap = await getEmployeeSignatureMap(env);
    const employees = (await getPrimaryEmployeeList(env)).filter(function (employee) {
      return !isHiddenSelectableEmployee(employee);
    });
    employees.sort(function (a, b) {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

    return jsonResponse({
      success: true,
      items: employees.map(function (employee) {
        return {
          id: employee.id || "",
          name: employee.name || "",
          email: employee.email || "",
          department: employee.department || "",
          position: employee.position || "",
          jobGrade: employee.jobGrade || "",
          role: employee.role || "staff",
          signatureImage: signatureMap[normalizeLoginId(employee.id || "")] || ""
        };
      })
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetApprovalDocuments(url, env) {
  try {
    requireKv(env);
    const requesterId = normalizeLoginId(url.searchParams.get("userId") || "");
    const requesterRole = normalizeRole(url.searchParams.get("requesterRole") || "");
    const box = String(url.searchParams.get("box") || "all").trim().toLowerCase();
    const requesterEmployee = requesterId ? await getEmployeeById(env, requesterId) : null;
    const requesterName = requesterEmployee && requesterEmployee.name ? String(requesterEmployee.name).trim() : "";
    let documents = await getApprovalDocumentList(env);

    documents = documents.filter(function (item) {
      if (requesterRole === "admin") return true;
      if (!requesterId) return false;
      if (box === "draft") return item.authorId === requesterId;
      return item.authorId === requesterId || normalizeApprovalStringList(item.approverIds).indexOf(requesterId) > -1 || normalizeApprovalStringList(item.referenceUserIds).indexOf(requesterId) > -1 || (requesterName && normalizeApprovalStringList(item.approvers).indexOf(requesterName) > -1) || (requesterName && normalizeApprovalStringList(item.referenceUsers).indexOf(requesterName) > -1);
    });

    if (box === "draft") documents = documents.filter(function (item) { return item.status === "draft"; });
    if (box === "pending" || box === "waiting") documents = documents.filter(function (item) { return item.status === "pending"; });
    if (box === "completed" || box === "approved") documents = documents.filter(function (item) { return item.status === "approved"; });
    if (box === "rejected") documents = documents.filter(function (item) { return item.status === "rejected"; });

    documents.sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });

    return jsonResponse({ success: true, items: documents });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleApprovalDocumentDecision(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const id = normalizeApprovalDocumentId(body.id || "");
    const requesterId = normalizeLoginId(body.requesterId || "");
    const requesterRole = normalizeRole(body.requesterRole || "");
    const decision = String(body.decision || "").trim().toLowerCase();
    const reason = String(body.reason || "").trim();

    if (!id) return jsonResponse({ success: false, message: "문서를 선택해주세요." }, 400);
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    if (decision !== "approved" && decision !== "rejected") return jsonResponse({ success: false, message: "결재 처리 상태가 올바르지 않습니다." }, 400);

    const employee = await getPrimaryEmployeeById(env, requesterId);
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    const raw = await env.MAIL_KV.get("approval:document:" + id);
    if (!raw) return jsonResponse({ success: false, message: "문서를 찾을 수 없습니다." }, 404);

    const item = JSON.parse(raw);
    if (item.status !== "pending") return jsonResponse({ success: false, message: "결재대기 문서만 처리할 수 있습니다." }, 400);

    const approverIds = normalizeApprovalStringList(item.approverIds);
    const approverNames = normalizeApprovalStringList(item.approvers);
    const isApprover = approverIds.indexOf(requesterId) > -1 || approverNames.indexOf(String(employee.name || "").trim()) > -1;
    if (requesterRole !== "admin" && !isApprover) {
      return jsonResponse({ success: false, message: "결재 처리 권한이 없습니다." }, 403);
    }

    const now = new Date().toISOString();
    const updated = sanitizeApprovalDocument({
      ...item,
      status: decision,
      decisionReason: decision === "rejected" ? reason : "",
      decidedAt: now,
      decisionById: requesterId,
      decisionByName: employee.name || requesterId,
      updatedAt: now,
      approvedAt: decision === "approved" ? now : (item.approvedAt || ""),
      rejectedAt: decision === "rejected" ? now : (item.rejectedAt || "")
    });

    await env.MAIL_KV.put("approval:document:" + id, JSON.stringify(updated));
    await upsertApprovalDocumentSummary(env, updated);
    if (decision === "approved" && updated.docType === "휴가원") {
      await upsertVacationApprovalCalendarEvent(env, updated);
    }
    await createApprovalDecisionNotification(env, updated, decision);

    return jsonResponse({ success: true, item: toApprovalListItem(updated) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteApprovalDocument(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);

    const body = await request.json();
    const id = normalizeApprovalDocumentId(body.id || "");
    const requesterId = normalizeLoginId(body.requesterId || "");
    const requesterRole = normalizeRole(body.requesterRole || "");

    if (!id) return jsonResponse({ success: false, message: "문서를 선택해주세요." }, 400);
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const employee = await getPrimaryEmployeeById(env, requesterId);
    if (!employee) return jsonResponse({ success: false, message: "직원 계정을 찾을 수 없습니다." }, 404);

    const raw = await env.MAIL_KV.get("approval:document:" + id);
    if (!raw) return jsonResponse({ success: false, message: "문서를 찾을 수 없습니다." }, 404);

    const item = JSON.parse(raw);
    const isAdmin = requesterRole === "admin" || employee.role === "admin";
    const isAuthor = item.authorId === requesterId;

    if (!isAdmin && !isAuthor) {
      return jsonResponse({ success: false, message: "문서를 삭제할 권한이 없습니다." }, 403);
    }
    if (!isAdmin && item.status === "approved") {
      return jsonResponse({ success: false, message: "결재 완료된 문서는 작성자도 삭제할 수 없습니다." }, 400);
    }

    await env.MAIL_KV.delete("approval:document:" + id);
    const documents = await getApprovalDocumentList(env);
    await setApprovalDocumentList(env, documents.filter(function (row) {
      return row && row.id !== id;
    }));

    return jsonResponse({ success: true, id: id });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadApprovalDocument(url, env) {
  try {
    requireKv(env);
    const id = normalizeApprovalDocumentId(url.searchParams.get("id") || "");
    const requesterId = normalizeLoginId(url.searchParams.get("userId") || "");
    const requesterRole = normalizeRole(url.searchParams.get("requesterRole") || "");
    const requesterEmployee = requesterId ? await getEmployeeById(env, requesterId) : null;
    const requesterName = requesterEmployee && requesterEmployee.name ? String(requesterEmployee.name).trim() : "";
    if (!id) return jsonResponse({ success: false, message: "문서를 선택해주세요." }, 400);

    const raw = await env.MAIL_KV.get("approval:document:" + id);
    if (!raw) return jsonResponse({ success: false, message: "문서를 찾을 수 없습니다." }, 404);

    const item = JSON.parse(raw);
    if (requesterRole !== "admin" && (!requesterId || (item.status === "draft" && item.authorId !== requesterId))) {
      return jsonResponse({ success: false, message: "문서를 조회할 권한이 없습니다." }, 403);
    }

    if (requesterRole !== "admin" && item.status !== "draft" && item.authorId !== requesterId && normalizeApprovalStringList(item.approverIds).indexOf(requesterId) === -1 && normalizeApprovalStringList(item.referenceUserIds).indexOf(requesterId) === -1 && (!requesterName || normalizeApprovalStringList(item.approvers).indexOf(requesterName) === -1) && (!requesterName || normalizeApprovalStringList(item.referenceUsers).indexOf(requesterName) === -1)) {
      return jsonResponse({ success: false, message: "문서를 조회할 권한이 없습니다." }, 403);
    }

    const employees = await getEmployeeList(env);
    const signatureMap = await getEmployeeSignatureMap(env);
    if (requesterId) await markApprovalDocumentNotificationsRead(env, requesterId, id);
    return jsonResponse({ success: true, item: enrichApprovalPersonSignatures(enrichApprovalPersonDepartments(item, employees), signatureMap) });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetNotifications(url, env) {
  try {
    requireKv(env);
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const items = await getNotificationList(env, userId);
    return jsonResponse({ success: true, items: items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetNotificationCount(url, env) {
  try {
    requireKv(env);
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const items = await getNotificationList(env, userId);
    const unreadCount = items.filter(function (item) {
      return item && item.read !== true;
    }).length;
    return jsonResponse({ success: true, unreadCount: unreadCount, totalCount: items.length });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadNotifications(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    const ids = normalizeApprovalStringList(body.ids);
    if (!userId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    if (!ids.length) return jsonResponse({ success: false, message: "읽음 처리할 알림이 없습니다." }, 400);

    const items = await getNotificationList(env, userId);
    const nextItems = items.map(function (item) {
      if (!item || ids.indexOf(String(item.id || "")) === -1) return item;
      return {
        ...item,
        read: true,
        readAt: item.readAt || new Date().toISOString()
      };
    });
    await setNotificationList(env, userId, nextItems);
    return jsonResponse({ success: true, items: nextItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadAllNotifications(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    if (!userId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const now = new Date().toISOString();
    const items = await getNotificationList(env, userId);
    const nextItems = items.map(function (item) {
      return item ? {
        ...item,
        read: true,
        readAt: item.readAt || now
      } : item;
    });
    await setNotificationList(env, userId, nextItems);
    return jsonResponse({ success: true, items: nextItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteAllNotifications(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const userId = normalizeLoginId(body.userId || "");
    if (!userId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const items = await getNotificationList(env, userId);
    await setNotificationList(env, userId, []);
    return jsonResponse({ success: true, items: [] });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleApprovalAttachment(url, env) {
  try {
    requireKv(env);
    const id = normalizeApprovalDocumentId(url.searchParams.get("id") || "");
    const index = parseInt(url.searchParams.get("index") || "0", 10);
    if (!id) return jsonResponse({ success: false, message: "문서를 선택해주세요." }, 400);
    if (index < 0) return jsonResponse({ success: false, message: "첨부파일 번호가 올바르지 않습니다." }, 400);

    const raw = await env.MAIL_KV.get("approval:document:" + id);
    if (!raw) return jsonResponse({ success: false, message: "문서를 찾을 수 없습니다." }, 404);

    const item = JSON.parse(raw);
    const attachmentsData = Array.isArray(item.attachmentsData) ? item.attachmentsData : [];
    const file = attachmentsData[index];
    if (!file || !file.content) return jsonResponse({ success: false, message: "첨부파일을 찾을 수 없습니다." }, 404);

    const disposition = String(url.searchParams.get("disposition") || "attachment").trim() === "inline" ? "inline" : "attachment";
    return buildAttachmentResponse(file, {
      index: index,
      fallbackFilename: "approval_attachment_" + (index + 1),
      disposition: disposition
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetSharedCalendar(env) {
  try {
    const result = await getSharedCalendarEventList(env);
    return jsonResponse({ success: true, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetSharedCalendarBirthdays(url, env) {
  try {
    if (!hasGroupwareDb(env)) {
      requireKv(env);
      await ensureEmployeeSeed(env);
    }

    const requesterId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);

    const employees = (await getPrimaryEmployeeList(env)).filter(function (employee) {
      return !isHiddenSelectableEmployee(employee);
    });
    employees.sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    });

    return jsonResponse({
      success: true,
      items: employees.filter(function (employee) {
        return !!(employee && employee.name && normalizeBirthDate(employee.birthDate || ""));
      }).map(function (employee) {
        return {
          id: employee.id || "",
          name: employee.name || "",
          birthDate: normalizeBirthDate(employee.birthDate || ""),
          department: employee.department || "",
          position: employee.position || "",
          jobGrade: employee.jobGrade || "",
          phone: employee.phone || "",
          mobilePhone: employee.mobilePhone || "",
          directPhone: employee.directPhone || ""
        };
      })
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveSharedCalendarEvent(request, env) {
  try {
    const body = await request.json();
    const result = await saveSharedCalendarEvent(env, body);
    return jsonResponse({ success: true, item: result.item, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleDeleteSharedCalendarEvent(request, env) {
  try {
    const body = await request.json();
    const result = await deleteSharedCalendarEvent(env, body);
    return jsonResponse({ success: true, items: result.items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleGetBoardNews(env) {
  try {
    requireKv(env);
    await ensureBoardSeed(env);
    const items = await getBoardNews(env);
    return jsonResponse({ success: true, items: items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveBoardNews(request, env) {
  try {
    requireKv(env);
    await ensureBoardSeed(env);
    const body = await request.json();
    const requesterId = normalizeLoginId(body.requesterId || body.createdById || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    if (requester.role !== "admin" && requester.role !== "ceo") {
      return jsonResponse({ success: false, message: "공지사항은 관리자 또는 대표만 작성할 수 있습니다." }, 403);
    }

    const items = await getBoardNews(env);
    const source = body.post || body;
    const now = new Date().toISOString();
    const post = sanitizeBoardNewsPost({
      id: source.id || "",
      title: source.title || "",
      body: source.body || "",
      pinned: source.pinned === true,
      attachments: source.attachments || [],
      authorId: source.authorId || requesterId,
      authorName: source.authorName || requester.name || "",
      authorDepartment: source.authorDepartment || requester.department || "",
      createdAt: source.createdAt || now,
      updatedAt: now,
      views: source.views || 0
    });

    if (!post.title) return jsonResponse({ success: false, message: "제목을 입력해 주세요." }, 400);
    if (!post.body) return jsonResponse({ success: false, message: "내용을 입력해 주세요." }, 400);

    const index = items.findIndex(function (item) { return item.id === post.id; });
    if (index > -1) {
      const existing = items[index];
      post.authorId = existing.authorId || post.authorId;
      post.authorName = existing.authorName || post.authorName;
      post.authorDepartment = existing.authorDepartment || post.authorDepartment;
      post.createdAt = existing.createdAt || post.createdAt;
      post.views = Number(existing.views || post.views || 0);
      items[index] = post;
    } else {
      items.push(post);
    }

    await setBoardNews(env, items);
    return jsonResponse({ success: true, item: post, items: items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteBoardNews(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return jsonResponse({ success: false, message: "삭제할 공지를 선택해 주세요." }, 400);
    const requesterId = normalizeLoginId(body.requesterId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    if (requester.role !== "admin" && requester.role !== "ceo") {
      return jsonResponse({ success: false, message: "공지사항은 관리자 또는 대표만 삭제할 수 있습니다." }, 403);
    }
    const items = await getBoardNews(env);
    const nextItems = items.filter(function (item) { return item && item.id !== id; });
    await setBoardNews(env, nextItems);
    return jsonResponse({ success: true, items: nextItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetBoardResources(env) {
  try {
    requireKv(env);
    const items = await getBoardResources(env);
    return jsonResponse({ success: true, items: items });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveBoardResources(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const requesterId = normalizeLoginId(body.requesterId || body.authorId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    const currentItems = await getBoardResources(env);
    const payloadItems = Array.isArray(body.items) ? body.items : [body.item || body];
    const canCreateResource = requester.role === "admin" || requester.role === "ceo";
    const canSaveResources = payloadItems.every(function (source) {
      const sourceId = String(source && source.id || "").trim();
      if (!sourceId) return canCreateResource;
      const existing = currentItems.find(function (row) { return row.id === sourceId; });
      if (!existing) return canCreateResource;
      return canCreateResource || String(existing.authorId || "") === requesterId;
    });
    if (!canSaveResources) {
      return jsonResponse({ success: false, message: "리소스 센터는 관리자, 대표 또는 작성자만 저장할 수 있습니다." }, 403);
    }
    const now = new Date().toISOString();
    const upserted = [];

    payloadItems.forEach(function (source) {
      const item = sanitizeBoardResourceItem({
        id: source.id || "",
        title: source.title || "",
        name: source.name || "",
        size: source.size || 0,
        type: source.type || "",
        dataUrl: source.dataUrl || "",
        category: source.category || "",
        createdAt: source.createdAt || now,
        updatedAt: now,
        authorId: source.authorId || requesterId,
        authorName: source.authorName || requester.name || "",
        authorDepartment: source.authorDepartment || requester.department || ""
      });
      if (!item.name || !item.dataUrl) return;
      const index = currentItems.findIndex(function (row) { return row.id === item.id; });
      if (index > -1) {
        const existing = currentItems[index];
        item.authorId = existing.authorId || item.authorId;
        item.authorName = existing.authorName || item.authorName;
        item.authorDepartment = existing.authorDepartment || item.authorDepartment;
        item.createdAt = existing.createdAt || item.createdAt;
        currentItems[index] = item;
      } else {
        currentItems.push(item);
      }
      upserted.push(item);
    });

    await setBoardResources(env, currentItems);
    return jsonResponse({ success: true, items: currentItems, saved: upserted });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteBoardResources(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) return jsonResponse({ success: false, message: "삭제할 파일을 선택해 주세요." }, 400);
    const requesterId = normalizeLoginId(body.requesterId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    const items = await getBoardResources(env);
    const target = items.find(function (item) { return item && item.id === id; });
    const canDeleteResource = requester.role === "admin" || requester.role === "ceo" || (target && String(target.authorId || "") === requesterId);
    if (!canDeleteResource) {
      return jsonResponse({ success: false, message: "리소스 센터는 관리자, 대표 또는 작성자만 삭제할 수 있습니다." }, 403);
    }
    const nextItems = items.filter(function (item) { return item && item.id !== id; });
    await setBoardResources(env, nextItems);
    return jsonResponse({ success: true, items: nextItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetTeamboardPosts(url, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "userId is required" }, 400);
    const requester = await getPrimaryEmployeeById(env, userId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    const items = await getTeamboardPosts(env);
    const canReadAll = requester.role === "admin" || requester.role === "ceo";
    const requesterDepartment = normalizeDepartmentName(requester.department || "");
    const visibleItems = items.filter(function (item) {
      return canReadAll || normalizeDepartmentName(item.department || "") === requesterDepartment;
    });
    return jsonResponse({ success: true, items: visibleItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveTeamboardPost(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);
    const body = await request.json();
    const requesterId = normalizeLoginId(body.requesterId || body.authorId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    const requesterDepartment = normalizeDepartmentName(requester.department || "");
    if (requester.role !== "admin" && requester.role !== "ceo" && !requesterDepartment) {
      return jsonResponse({ success: false, message: "팀 보드는 소속 부서가 있는 직원만 작성할 수 있습니다." }, 400);
    }

    const items = await getTeamboardPosts(env);
    const source = body.post || body;
    const existing = String(source.id || "").trim() ? items.find(function (item) { return item.id === String(source.id || "").trim(); }) || null : null;
    const canManageContent = !existing || existing.authorId === requesterId || requester.role === "admin" || requester.role === "ceo";
    const canInteract = existing && normalizeDepartmentName(existing.department || "") === requesterDepartment;
    if (existing && !canManageContent && !canInteract) {
      return jsonResponse({ success: false, message: "같은 부서 팀 글만 확인할 수 있습니다." }, 403);
    }

    const now = new Date().toISOString();
    const post = sanitizeTeamboardPost({
      id: source.id || existing && existing.id || "",
      title: canManageContent ? source.title || "" : existing && existing.title || "",
      body: canManageContent ? source.body || "" : existing && existing.body || "",
      pinned: canManageContent ? source.pinned === true : existing && existing.pinned === true,
      attachments: canManageContent ? source.attachments || [] : existing && existing.attachments || [],
      comments: source.comments || [],
      department: canManageContent ? existing && existing.department || source.department || requesterDepartment : existing && existing.department || requesterDepartment,
      authorId: existing && existing.authorId || requesterId,
      authorName: existing && existing.authorName || requester.name || "",
      authorDepartment: existing && existing.authorDepartment || requesterDepartment,
      createdAt: existing && existing.createdAt || source.createdAt || now,
      updatedAt: now,
      views: source.views || existing && existing.views || 0,
      reactions: source.reactions || existing && existing.reactions || {}
    });

    if (!post.title) return jsonResponse({ success: false, message: "제목을 입력해 주세요." }, 400);
    if (!post.body) return jsonResponse({ success: false, message: "내용을 입력해 주세요." }, 400);
    if (requester.role !== "admin" && requester.role !== "ceo") post.department = requesterDepartment;

    const index = items.findIndex(function (item) { return item.id === post.id; });
    const isNew = index === -1;
    if (index > -1) items[index] = post;
    else items.push(post);

    await setTeamboardPosts(env, items);
    if (isNew) await createTeamboardPostNotifications({ env, getPrimaryEmployeeList }, post);
    const visibleItems = (await getTeamboardPosts(env)).filter(function (item) {
      return requester.role === "admin" || requester.role === "ceo" || normalizeDepartmentName(item.department || "") === requesterDepartment;
    });
    return jsonResponse({ success: true, item: post, items: visibleItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteTeamboardPost(request, env) {
  try {
    requireKv(env);
    await ensureEmployeeSeed(env);
    const body = await request.json();
    const id = String(body.id || "").trim();
    const requesterId = normalizeLoginId(body.requesterId || "");
    if (!id) return jsonResponse({ success: false, message: "삭제할 팀 글을 선택해 주세요." }, 400);
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);
    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);
    const items = await getTeamboardPosts(env);
    const target = items.find(function (item) { return item && item.id === id; });
    if (!target) return jsonResponse({ success: false, message: "팀 글을 찾을 수 없습니다." }, 404);
    if (target.authorId !== requesterId && requester.role !== "admin" && requester.role !== "ceo") {
      return jsonResponse({ success: false, message: "작성자 또는 관리자만 삭제할 수 있습니다." }, 403);
    }
    const nextItems = items.filter(function (item) { return item && item.id !== id; });
    await setTeamboardPosts(env, nextItems);
    const requesterDepartment = normalizeDepartmentName(requester.department || "");
    const visibleItems = nextItems.filter(function (item) {
      return requester.role === "admin" || requester.role === "ceo" || normalizeDepartmentName(item.department || "") === requesterDepartment;
    });
    return jsonResponse({ success: true, items: visibleItems });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetCloudFiles(url, env) {
  try {
    requireGroupwareDb(env);
    requireCloudStorage(env);

    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!userId) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const employee = await getPrimaryEmployeeById(env, userId);
    if (!employee) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);

    const items = await getCloudFilesByOwner(env, userId);
    return jsonResponse({
      success: true,
      items: items,
      quotaBytes: getDefaultCloudQuotaBytes(),
      usedBytes: sumCloudFileBytes(items)
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveCloudFiles(request, env) {
  try {
    requireGroupwareDb(env);
    requireCloudStorage(env);

    const body = await request.json();
    const requesterId = normalizeLoginId(body.requesterId || body.userId || "");
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);

    const payloadItems = Array.isArray(body.items) ? body.items : [body.item || body];
    const currentItems = await getCloudFilesByOwner(env, requesterId);
    const quotaBytes = getDefaultCloudQuotaBytes();
    const currentUsedBytes = sumCloudFileBytes(currentItems);
    let nextUsedBytes = currentUsedBytes;
    const savedItems = [];

    for (const source of payloadItems) {
      const item = sanitizeCloudFileItem({
        id: source && source.id || "",
        title: source && source.title || "",
        name: source && source.name || "",
        size: source && source.size || 0,
        type: source && source.type || "",
        dataUrl: source && source.dataUrl || "",
        createdAt: source && source.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: requesterId,
        ownerName: requester.name || "",
        ownerDepartment: requester.department || ""
      });

      const existing = currentItems.find(function (row) { return row.id === item.id; });
      if (!item.name) continue;
      if (!item.dataUrl && !existing) continue;
      const previousSize = existing ? Number(existing.size || 0) : 0;
      const nextSize = item.dataUrl ? Number(item.size || 0) : previousSize;
      const nextCandidateUsedBytes = nextUsedBytes - previousSize + nextSize;
      if (nextCandidateUsedBytes > quotaBytes) {
        return jsonResponse({ success: false, message: "개인 클라우드 용량 2GB를 초과했습니다." }, 400);
      }

      let objectKey = existing && existing.objectKey ? String(existing.objectKey) : "";
      if (item.dataUrl) {
        const binary = dataUrlToUint8Array(item.dataUrl);
        objectKey = buildCloudObjectKey(requesterId, item.id, item.name);
        await env.GROUPWARE_FILES.put(objectKey, binary, {
          httpMetadata: {
            contentType: item.type || "application/octet-stream"
          }
        });
      }

      await upsertCloudFile(env, {
        id: item.id,
        ownerId: requesterId,
        ownerName: requester.name || "",
        ownerDepartment: requester.department || "",
        title: item.title,
        name: item.name,
        size: nextSize,
        type: item.type || existing && existing.type || "",
        objectKey: objectKey,
        createdAt: existing && existing.createdAt ? existing.createdAt : item.createdAt,
        updatedAt: item.updatedAt
      });

      nextUsedBytes = nextCandidateUsedBytes;
      savedItems.push(item);
    }

    const items = await getCloudFilesByOwner(env, requesterId);
    return jsonResponse({
      success: true,
      items: items,
      saved: savedItems,
      quotaBytes: quotaBytes,
      usedBytes: sumCloudFileBytes(items)
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteCloudFile(request, env) {
  try {
    requireGroupwareDb(env);
    requireCloudStorage(env);

    const body = await request.json();
    const id = String(body.id || "").trim();
    const requesterId = normalizeLoginId(body.requesterId || body.userId || "");
    if (!id) return jsonResponse({ success: false, message: "삭제할 파일을 선택해주세요." }, 400);
    if (!requesterId) return jsonResponse({ success: false, message: "로그인 정보가 없습니다." }, 400);

    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);

    const target = await getCloudFileById(env, id);
    if (!target) return jsonResponse({ success: false, message: "파일을 찾을 수 없습니다." }, 404);
    if (String(target.ownerId || "") !== requesterId && requester.role !== "admin" && requester.role !== "ceo") {
      return jsonResponse({ success: false, message: "본인 파일만 삭제할 수 있습니다." }, 403);
    }

    if (target.objectKey) {
      await env.GROUPWARE_FILES.delete(String(target.objectKey));
    }
    await deleteCloudFileById(env, id);

    const items = await getCloudFilesByOwner(env, requesterId);
    return jsonResponse({
      success: true,
      items: items,
      quotaBytes: getDefaultCloudQuotaBytes(),
      usedBytes: sumCloudFileBytes(items)
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadCloudFile(url, env) {
  try {
    requireGroupwareDb(env);
    requireCloudStorage(env);

    const id = String(url.searchParams.get("id") || "").trim();
    const requesterId = normalizeLoginId(url.searchParams.get("userId") || "");
    if (!id) return jsonResponse({ success: false, message: "id is required" }, 400);
    if (!requesterId) return jsonResponse({ success: false, message: "userId is required" }, 400);

    const requester = await getPrimaryEmployeeById(env, requesterId);
    if (!requester) return jsonResponse({ success: false, message: "사용자 정보를 확인할 수 없습니다." }, 403);

    const item = await getCloudFileById(env, id);
    if (!item) return jsonResponse({ success: false, message: "파일을 찾을 수 없습니다." }, 404);
    if (String(item.ownerId || "") !== requesterId && requester.role !== "admin" && requester.role !== "ceo") {
      return jsonResponse({ success: false, message: "본인 파일만 다운로드할 수 있습니다." }, 403);
    }

    const object = await env.GROUPWARE_FILES.get(String(item.objectKey || ""));
    if (!object) return jsonResponse({ success: false, message: "저장된 파일을 찾을 수 없습니다." }, 404);

    const headers = new Headers();
    headers.set("Content-Type", String(item.type || object.httpMetadata && object.httpMetadata.contentType || "application/octet-stream"));
    headers.set("Content-Disposition", 'attachment; filename="' + String(item.name || "download").replace(/"/g, "") + '"');
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(object.body, { status: 200, headers: headers });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleInboundMail(request, env) {
  try {
    requireKv(env);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.toLowerCase().indexOf("multipart/form-data") === -1 && contentType.toLowerCase().indexOf("application/x-www-form-urlencoded") === -1) {
      return jsonResponse({ success: false, message: "invalid content type" }, 400);
    }

    const form = await request.formData();
    const toRaw = String(form.get("to") || "").trim();
    const fromRaw = String(form.get("from") || "").trim();
    const senderRaw = String(form.get("sender") || "").trim();
    const subject = String(form.get("subject") || "").trim();
    const html = String(form.get("html") || "");
    const text = String(form.get("text") || "");
    const spamScore = String(form.get("spam_score") || "").trim();
    const spamReport = String(form.get("spam_report") || "");
    const envelopeRaw = String(form.get("envelope") || "");
    const charsetsRaw = String(form.get("charsets") || "");
    const headersRaw = String(form.get("headers") || "");

    if (!toRaw || !fromRaw) return jsonResponse({ success: false, message: "to and from are required" }, 400);

    const parsedTo = resolveInboundAddressParts([toRaw, envelopeRaw, extractHeaderValue(headersRaw, "to")]);
    const parsedFrom = resolveInboundAddressParts([fromRaw, senderRaw, extractHeaderValue(headersRaw, "from")]);

    if (!parsedTo.email || !parsedFrom.email) {
      return jsonResponse({ success: false, message: "invalid to/from address" }, 400);
    }

    const ownerEmail = normalizeInboundOwnerEmail(parsedTo.email);
    if (!ownerEmail) {
      return jsonResponse({ success: false, message: "지원하지 않는 수신 주소입니다." }, 400);
    }

    const attachmentFiles = [];
    for (const entry of form.entries()) {
      const key = entry[0];
      const value = entry[1];

      if (key.indexOf("attachment") !== 0) continue;
      if (typeof File !== "undefined" && value instanceof File) {
        const arrayBuffer = await value.arrayBuffer();
        const binary = new Uint8Array(arrayBuffer);
        attachmentFiles.push({
          filename: String(value.name || key || "attachment"),
          type: String(value.type || "application/octet-stream"),
          content: bytesToBase64(binary),
          disposition: "attachment",
          sizeBytes: Number(value.size || 0),
          sizeLabel: formatBytes(Number(value.size || 0))
        });
      }
    }

    const inboxBody = html || textToHtml(text) || "<p></p>";
    const id = "inbox_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const item = {
      id: id,
      folder: "inbox",
      to: ownerEmail,
      original_to: parsedTo.email,
      from: parsedFrom.email,
      from_name: parsedFrom.name || parsedFrom.email.split("@")[0] || "보낸사람",
      subject: subject || "(제목 없음)",
      body: inboxBody,
      text_body: text || "",
      snippet: stripHtml(inboxBody).slice(0, 120),
      date: new Date().toISOString(),
      unread: true,
      starred: false,
      attachmentCount: attachmentFiles.length,
      attachmentsMeta: attachmentFiles.map(function (file) {
        return {
          filename: file.filename,
          type: file.type,
          sizeBytes: file.sizeBytes,
          sizeLabel: file.sizeLabel
        };
      }),
      attachmentsData: attachmentFiles,
      inbound_meta: {
        raw_to: toRaw,
        raw_from: fromRaw,
        raw_sender: senderRaw,
        spam_score: spamScore,
        spam_report: spamReport,
        envelope: envelopeRaw,
        charsets: charsetsRaw,
        headers: headersRaw
      }
    };

    await assertMailboxQuota(env, ownerEmail, item);

    await setMailItem(env, item);

    const inboxList = await getList(env, "inbox_list");
    inboxList.unshift(toListItem(item));
    await setList(env, "inbox_list", inboxList);

    return jsonResponse({
      success: true,
      message: "Inbound mail stored",
      id: id,
      ownerEmail: ownerEmail,
      from: item.from,
      from_name: item.from_name
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message, quotaBytes: e.quotaBytes, usedBytes: e.usedBytes, nextUsedBytes: e.nextUsedBytes }, e.status || 500);
  }
}

async function handleGetList(url, env, key, seedInbox) {
  try {
    requireKv(env);
    if (seedInbox) await ensureInboxSeed(env);

    let page = parseInt(url.searchParams.get("page") || "1", 10);
    let pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const userEmail = normalizeEmail(url.searchParams.get("userEmail") || "");

    if (page < 1) page = 1;
    if (pageSize < 1) pageSize = 20;

    let list = await getList(env, key);
    list = filterListForUser(list, key, userEmail);

    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);

    return jsonResponse({ success: true, items: items, pagination: { page, pageSize, total, totalPages } });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleGetAll(url, env) {
  try {
    requireKv(env);
    await ensureInboxSeed(env);

    const userEmail = normalizeEmail(url.searchParams.get("userEmail") || "");
    let pageSize = parseInt(url.searchParams.get("pageSize") || "200", 10);
    if (pageSize < 1) pageSize = 200;

    const all = []
      .concat(filterListForUser(await getList(env, "inbox_list"), "inbox_list", userEmail))
      .concat(filterListForUser(await getList(env, "sent_list"), "sent_list", userEmail))
      .concat(filterListForUser(await getList(env, "my1_list"), "my1_list", userEmail))
      .concat(filterListForUser(await getList(env, "my2_list"), "my2_list", userEmail))
      .concat(filterListForUser(await getList(env, "my3_list"), "my3_list", userEmail));
    all.sort(function (a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });

    return jsonResponse({
      success: true,
      items: all.slice(0, pageSize),
      pagination: { page: 1, pageSize: pageSize, total: all.length, totalPages: 1 }
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleCounts(url, env) {
  try {
    requireKv(env);
    await ensureInboxSeed(env);

    const userEmail = normalizeEmail(url.searchParams.get("userEmail") || "");
    const inbox = filterListForUser(await getList(env, "inbox_list"), "inbox_list", userEmail);
    const sent = filterListForUser(await getList(env, "sent_list"), "sent_list", userEmail);
    const spam = filterListForUser(await getList(env, "spam_list"), "spam_list", userEmail);
    const trash = filterListForUser(await getList(env, "trash_list"), "trash_list", userEmail);

    return jsonResponse({
      success: true,
      allUnread: inbox.concat(sent).concat(spam).concat(trash).filter(function (item) { return !!item.unread; }).length,
      inboxUnread: inbox.filter(function (item) { return !!item.unread; }).length,
      spamUnread: spam.filter(function (item) { return !!item.unread; }).length,
      trashUnread: trash.filter(function (item) { return !!item.unread; }).length
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadMail(url, env) {
  try {
    requireKv(env);
    const id = url.searchParams.get("id");
    if (!id) return jsonResponse({ success: false, message: "id is required" }, 400);

    const item = await getMailItem(env, id);
    if (!item) return jsonResponse({ success: false, message: "mail not found" }, 404);

    return jsonResponse({ success: true, item: item });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadDraft(url, env) {
  try {
    requireKv(env);
    const id = url.searchParams.get("id");
    const userEmail = normalizeEmail(url.searchParams.get("userEmail") || "");
    if (!id) return jsonResponse({ success: false, message: "id is required" }, 400);

    const item = await getDraftItem(env, id);
    if (!item) return jsonResponse({ success: false, message: "draft not found" }, 404);
    if (userEmail && item.owner_email && normalizeEmail(item.owner_email) !== userEmail) {
      return jsonResponse({ success: false, message: "draft access denied" }, 403);
    }

    return jsonResponse({ success: true, item: item });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSaveDraft(request, env) {
  try {
    requireKv(env);

    const body = await request.json();
    const id = String(body.id || "").trim();
    const receiver = String(body.receiver || "").trim();
    const subject = String(body.subject || "").trim();
    const content = String(body.body || "");
    const savedBy = String(body.savedBy || "manual").trim();
    const ownerEmail = normalizeEmail(body.userEmail || "");

    if (!ownerEmail) return jsonResponse({ success: false, message: "userEmail is required" }, 400);

    const draftId = id || ("draft_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8));
    const now = new Date().toISOString();
    const item = {
      id: draftId,
      folder: "draft",
      receiver: receiver,
      to: receiver,
      from: ownerEmail,
      from_name: ownerEmail.split("@")[0] || "groupware",
      subject: subject,
      body: content,
      snippet: stripHtml(content).slice(0, 120),
      date: now,
      updated_at: now,
      saved_by: savedBy,
      owner_email: ownerEmail
    };

    await assertMailboxQuota(env, ownerEmail, item, [draftId]);

    await setDraftItem(env, item);

    let list = await getList(env, "draft_list");
    let found = false;
    list = list.map(function (row) {
      if (String(row.id) === String(draftId)) {
        found = true;
        return toDraftListItem(item);
      }
      return row;
    });
    if (!found) list.unshift(toDraftListItem(item));

    list.sort(function (a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); });
    await setList(env, "draft_list", list);

    return jsonResponse({ success: true, message: "draft saved", id: draftId, updatedAt: now, savedBy: savedBy });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message, quotaBytes: e.quotaBytes, usedBytes: e.usedBytes, nextUsedBytes: e.nextUsedBytes }, e.status || 500);
  }
}

async function handleDeleteDraft(request, env) {
  try {
    requireKv(env);

    const body = await request.json();
    const ids = normalizeIds(body);
    const userEmail = normalizeEmail(body.userEmail || "");

    if (!ids.length) return jsonResponse({ success: false, message: "ids required" }, 400);
    if (!userEmail) return jsonResponse({ success: false, message: "userEmail is required" }, 400);

    let list = await getList(env, "draft_list");
    const deletableIds = [];

    for (const id of ids) {
      const item = await getDraftItem(env, id);
      if (!item) continue;
      if (normalizeEmail(item.owner_email || "") === userEmail) deletableIds.push(String(id));
    }

    list = list.filter(function (row) { return deletableIds.indexOf(String(row.id)) === -1; });
    await setList(env, "draft_list", list);

    for (const id of deletableIds) await deleteDraftItem(env, id);
    return jsonResponse({ success: true, deleted: deletableIds.length });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDeleteMail(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "id or ids required" }, 400);

    const deletableIds = [];
    for (const id of ids) {
      const item = await getMailItem(env, id);
      if (!item) continue;
      if (userEmail && !canUserViewMail(item, userEmail)) continue;
      deletableIds.push(String(id));
    }

    await removeMailFromAllLists(env, deletableIds);
    for (const id of deletableIds) await deleteMailItem(env, id);
    return jsonResponse({ success: true, deleted: deletableIds.length });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleRestore(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "ids required" }, 400);

    const trashList = await getList(env, "trash_list");
    const remainTrash = [];
    const restoreMap = {};
    let restored = 0;

    for (const row of trashList) {
      if (ids.indexOf(String(row.id)) > -1 && (!userEmail || canUserViewMail(row, userEmail))) {
        const item = await getMailItem(env, row.id);
        if (!item) continue;
        if (userEmail && !canUserViewMail(item, userEmail)) {
          remainTrash.push(row);
          continue;
        }
        const targetFolder = item.originalFolder || "inbox";
        item.folder = targetFolder;
        delete item.originalFolder;
        await setMailItem(env, item);

        if (!restoreMap[targetFolder]) restoreMap[targetFolder] = await getList(env, listKeyByFolder(targetFolder));
        restoreMap[targetFolder].unshift(toListItem(item));
        restored += 1;
      } else {
        remainTrash.push(row);
      }
    }

    await setList(env, "trash_list", remainTrash);
    for (const folder of Object.keys(restoreMap)) await setList(env, listKeyByFolder(folder), restoreMap[folder]);

    return jsonResponse({ success: true, restored: restored });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleReadState(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const unread = typeof body.unread === "boolean" ? body.unread : false;
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "id or ids required" }, 400);

    const allowedIds = [];
    for (const id of ids) {
      const item = await getMailItem(env, id);
      if (!item) continue;
      if (userEmail && !canUserViewMail(item, userEmail)) continue;
      item.unread = unread;
      await setMailItem(env, item);
      allowedIds.push(String(id));
    }

    for (const key of ["inbox_list", "sent_list", "my1_list", "my2_list", "my3_list", "trash_list", "spam_list"]) {
      await updateUnreadStateInList(env, key, allowedIds, unread);
    }

    return jsonResponse({ success: true, ids: allowedIds, unread: unread });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleStarState(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const id = String(body.id || "").trim();
    const starred = typeof body.starred === "boolean" ? body.starred : false;
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!id) return jsonResponse({ success: false, message: "id required" }, 400);

    const item = await getMailItem(env, id);
    if (!item) return jsonResponse({ success: false, message: "mail not found" }, 404);
    if (userEmail && !canUserViewMail(item, userEmail)) {
      return jsonResponse({ success: false, message: "mail access denied" }, 403);
    }
    item.starred = starred;
    await setMailItem(env, item);

    for (const key of ["inbox_list", "sent_list", "my1_list", "my2_list", "my3_list", "trash_list", "spam_list"]) {
      await updateStarStateInList(env, key, id, starred);
    }

    return jsonResponse({ success: true, id: id, starred: starred });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleTrash(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const folder = String(body.folder || "inbox").trim();
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "ids required" }, 400);

    const fromKey = listKeyByFolder(folder);
    const fromList = await getList(env, fromKey);
    const trashList = await getList(env, "trash_list");
    const remainList = [];
    let moved = 0;

    for (const row of fromList) {
      if (ids.indexOf(String(row.id)) > -1) {
        const item = await getMailItem(env, row.id);
        if (!item) continue;
        if (userEmail && !canUserViewMail(item, userEmail)) {
          remainList.push(row);
          continue;
        }
        item.originalFolder = item.folder || folder;
        item.folder = "trash";
        await setMailItem(env, item);
        trashList.unshift(toListItem(item));
        moved += 1;
      } else {
        remainList.push(row);
      }
    }

    await setList(env, fromKey, remainList);
    await setList(env, "trash_list", trashList);
    return jsonResponse({ success: true, moved: moved });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleSpam(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const fromFolder = String(body.fromFolder || "inbox").trim();
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "ids required" }, 400);

    const fromKey = listKeyByFolder(fromFolder);
    const fromList = await getList(env, fromKey);
    const spamList = await getList(env, "spam_list");
    const remainList = [];
    let moved = 0;

    for (const row of fromList) {
      if (ids.indexOf(String(row.id)) > -1) {
        const item = await getMailItem(env, row.id);
        if (!item) continue;
        if (userEmail && !canUserViewMail(item, userEmail)) {
          remainList.push(row);
          continue;
        }
        item.folder = "spam";
        await setMailItem(env, item);
        spamList.unshift(toListItem(item));
        moved += 1;
      } else {
        remainList.push(row);
      }
    }

    await setList(env, fromKey, remainList);
    await setList(env, "spam_list", spamList);
    return jsonResponse({ success: true, moved: moved });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleMove(request, env) {
  try {
    requireKv(env);
    const body = await request.json();
    const ids = normalizeIds(body);
    const fromFolder = String(body.fromFolder || "inbox").trim();
    const toFolder = String(body.toFolder || "inbox").trim();
    const userEmail = normalizeEmail(body.userEmail || "");
    if (!ids.length) return jsonResponse({ success: false, message: "ids required" }, 400);

    const fromKey = listKeyByFolder(fromFolder);
    const toKey = listKeyByFolder(toFolder);
    const fromList = await getList(env, fromKey);
    const toList = await getList(env, toKey);
    const remainList = [];
    let moved = 0;

    for (const row of fromList) {
      if (ids.indexOf(String(row.id)) > -1) {
        const item = await getMailItem(env, row.id);
        if (!item) continue;
        if (userEmail && !canUserViewMail(item, userEmail)) {
          remainList.push(row);
          continue;
        }
        item.folder = toFolder;
        await setMailItem(env, item);
        toList.unshift(toListItem(item));
        moved += 1;
      } else {
        remainList.push(row);
      }
    }

    await setList(env, fromKey, remainList);
    await setList(env, toKey, toList);
    return jsonResponse({ success: true, moved: moved });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

async function handleDebug(env) {
  try {
    requireKv(env);
    return jsonResponse({
      success: true,
      inboxCount: (await getList(env, "inbox_list")).length,
      sentCount: (await getList(env, "sent_list")).length,
      my1Count: (await getList(env, "my1_list")).length,
      my2Count: (await getList(env, "my2_list")).length,
      my3Count: (await getList(env, "my3_list")).length,
      spamCount: (await getList(env, "spam_list")).length,
      trashCount: (await getList(env, "trash_list")).length,
      draftCount: (await getList(env, "draft_list")).length
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}

function normalizeIds(body) {
  if (body.id) return [String(body.id).trim()];
  if (Array.isArray(body.ids)) return body.ids.map(String).map(function (s) { return s.trim(); }).filter(Boolean);
  return [];
}
async function getPrimaryEmployeeList(env) {
  return await getPrimaryEmployeeListForEnv(env);
}

async function getPrimaryDepartmentList(env) {
  return await getPrimaryDepartmentListForEnv(env);
}

async function getPrimaryEmployeeById(env, id) {
  return await getPrimaryEmployeeByIdForEnv(env, id);
}

async function getEmployeeSignatureMap(env) {
  requireKv(env);
  const raw = await env.MAIL_KV.get("auth:employeeSignatures");
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

async function setEmployeeSignature(env, id, signatureImage) {
  requireKv(env);
  const normalizedId = normalizeLoginId(id || "");
  if (!normalizedId) throw new Error("직원 계정을 선택해주세요.");
  const normalizedImage = normalizeEmployeeSignatureImage(signatureImage || "");
  const signatureMap = await getEmployeeSignatureMap(env);
  if (normalizedImage) {
    signatureMap[normalizedId] = normalizedImage;
  } else {
    delete signatureMap[normalizedId];
  }
  await env.MAIL_KV.put("auth:employeeSignatures", JSON.stringify(signatureMap));
}

function sanitizeEmployeeWithSignature(employee, signatureMap) {
  const item = sanitizeEmployee(employee);
  const normalizedId = normalizeLoginId(item && item.id || "");
  item.signatureImage = normalizedId && signatureMap && signatureMap[normalizedId] ? String(signatureMap[normalizedId]) : "";
  return item;
}

function enrichApprovalPersonSignatures(item, signatureMap) {
  const next = Object.assign({}, item || {});
  next.approverSignatureImages = buildApprovalSignatureImages(next.approvers, next.approverIds, next.approverSignatureImages, signatureMap);
  return next;
}

function buildApprovalSignatureImages(names, ids, savedSignatures, signatureMap) {
  const personNames = normalizeApprovalPersonList(names);
  const personIds = normalizeApprovalStringList(ids);
  const signatures = normalizeApprovalSignatureList(savedSignatures);
  const map = signatureMap && typeof signatureMap === "object" ? signatureMap : {};
  return personNames.map(function (name, index) {
    const id = normalizeLoginId(personIds[index] || "");
    return id && map[id] ? String(map[id]) : (signatures[index] || "");
  });
}

function normalizeEmployeeSignatureImage(value) {
  const image = String(value || "").trim();
  if (!image) return "";
  if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    throw new Error("서명 이미지는 JPG 또는 PNG 파일만 등록할 수 있습니다.");
  }
  if (image.length > 1200000) {
    throw new Error("서명 이미지 파일이 너무 큽니다.");
  }
  return image;
}

async function generatePrimaryEmployeeNumber(env) {
  return await generatePrimaryEmployeeNumberForEnv(env);
}

async function handleChatAttachment(url, env) {
  try {
    const userId = normalizeLoginId(url.searchParams.get("userId") || "");
    const roomId = String(url.searchParams.get("roomId") || "").trim();
    const messageId = String(url.searchParams.get("id") || "").trim();
    const index = parseInt(url.searchParams.get("index") || "0", 10);
    const result = await getChatAttachmentFile(env, userId, roomId, messageId, index);

    return buildAttachmentResponse(result.file, {
      index: result.index,
      fallbackFilename: "chat_attachment_" + (result.index + 1),
      disposition: "attachment"
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, e.status || 500);
  }
}

async function handleAttachment(url, env) {
  try {
    requireKv(env);
    const id = url.searchParams.get("id");
    const index = parseInt(url.searchParams.get("index") || "0", 10);
    const disposition = (url.searchParams.get("disposition") || "attachment").trim();

    if (!id) return jsonResponse({ success: false, message: "id is required" }, 400);
    if (index < 0) return jsonResponse({ success: false, message: "invalid index" }, 400);

    const item = await getMailItem(env, id);
    if (!item) return jsonResponse({ success: false, message: "mail not found" }, 404);
    const attachmentsData = Array.isArray(item.attachmentsData) ? item.attachmentsData : [];
    if (!attachmentsData[index]) return jsonResponse({ success: false, message: "attachment not found" }, 404);

    const file = attachmentsData[index];
    return buildAttachmentResponse(file, {
      index: index,
      fallbackFilename: "attachment_" + (index + 1),
      disposition: disposition
    });
  } catch (e) {
    return jsonResponse({ success: false, message: e.message }, 500);
  }
}
