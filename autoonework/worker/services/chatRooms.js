import { normalizeDepartmentName, normalizeLoginId } from "../shared/utils.js";
import {
  canAccessChatRoom,
  getChatMessages,
  getChatRoomById,
  getChatRoomDisplayTitle,
  getChatRoomList,
  getChatRoomUnreadCount,
  getVisibleChatMemberIds,
  hasChatAdminMember,
  buildChatInviteMessageText,
  buildChatMessageSnippet,
  getChatMessageVisibilityCutoff,
  isChatMessageVisibleToUser,
  isCompanyChatRoomExcludedEmployee,
  normalizeChatAttachments,
  normalizeChatMemberIds,
  normalizeChatMemberNames,
  normalizeChatMessageText,
  normalizeChatPoll,
  normalizeChatReadMap,
  normalizeChatRoomAvatarData,
  normalizeChatRoomTitle,
  normalizeChatRoomLastMessageText,
  normalizeChatUnreadMap,
  normalizeStoredChatMessage,
  normalizeStoredChatRoom,
  isChatAdminEmployee,
  setChatMessages,
  setChatRoomList
} from "../storage/chat.js";
import { requireKv } from "../storage/bindings.js";
import { ensureEmployeeSeed, getPrimaryEmployeeByIdForEnv, getPrimaryEmployeeListForEnv, normalizeRole, sanitizeEmployee } from "./employees.js";

export function createEmployeeMap(employees) {
  const map = {};
  (Array.isArray(employees) ? employees : []).forEach(function (employee) {
    const normalizedId = normalizeLoginId(employee && employee.id || "");
    if (!normalizedId) return;
    map[normalizedId] = sanitizeEmployee(employee);
  });
  return map;
}

export async function buildChatRoomSummary(env, room, currentUserId, employeeMap, options) {
  const normalizedRoom = normalizeStoredChatRoom(room);
  const normalizedUserId = normalizeLoginId(currentUserId || "");
  const sourceOptions = options && typeof options === "object" ? options : {};
  const visibleMemberIds = getVisibleChatMemberIds(normalizedRoom, employeeMap);
  const displayTitle = getChatRoomDisplayTitle(normalizedRoom, normalizedUserId, employeeMap);
  const unreadCount = getChatRoomUnreadCount(normalizedRoom, normalizedUserId);
  const visibleAfter = getChatMessageVisibilityCutoff(normalizedRoom, normalizedUserId);
  const providedLatestMessage = sourceOptions.latestVisibleMessage && isChatMessageVisibleToUser(normalizedRoom, sourceOptions.latestVisibleMessage, normalizedUserId)
    ? normalizeStoredChatMessage(sourceOptions.latestVisibleMessage)
    : null;
  const latestVisibleMessage = providedLatestMessage || await getLatestVisibleChatMessage(env, normalizedRoom, normalizedUserId);
  const startedHistory = hasStartedChatHistory(normalizedRoom);
  const keepsIntroPreview = normalizedRoom.type === "department" || normalizedRoom.id === "chat_company_all";
  const fallbackLastMessageText = !latestVisibleMessage && startedHistory && (normalizedRoom.type === "direct" || (normalizedRoom.type === "group" && !keepsIntroPreview))
    ? ""
    : normalizedRoom.lastMessageText || "";
  const lastMessageAt = latestVisibleMessage
    ? String(latestVisibleMessage.createdAt || normalizedRoom.lastMessageAt || normalizedRoom.updatedAt || normalizedRoom.createdAt || "")
    : String(normalizedRoom.lastMessageAt || normalizedRoom.updatedAt || normalizedRoom.createdAt || "");
  const hasVisibleHistory = !visibleAfter || !lastMessageAt || lastMessageAt > visibleAfter;

  return {
    id: normalizedRoom.id,
    type: normalizedRoom.type,
    title: displayTitle,
    customTitle: normalizedRoom.title || "",
    department: normalizedRoom.department || "",
    memberIds: visibleMemberIds,
    updatedAt: latestVisibleMessage ? String(latestVisibleMessage.createdAt || normalizedRoom.updatedAt || normalizedRoom.createdAt || "") : normalizedRoom.updatedAt || normalizedRoom.createdAt || "",
    lastMessageText: hasVisibleHistory ? normalizeChatRoomLastMessageText(latestVisibleMessage ? getChatMessageSummaryText(latestVisibleMessage) : fallbackLastMessageText) : "",
    lastMessageAt: hasVisibleHistory ? lastMessageAt : "",
    lastSenderId: hasVisibleHistory ? (latestVisibleMessage ? normalizeLoginId(latestVisibleMessage.senderId || "") : normalizedRoom.lastSenderId || "") : "",
    lastSenderName: hasVisibleHistory ? (latestVisibleMessage ? String(latestVisibleMessage.senderName || "").trim() : normalizedRoom.lastSenderName || "") : "",
    hasHistory: startedHistory,
    lastReadBy: normalizeChatReadMap(normalizedRoom.lastReadBy || {}),
    unreadBy: normalizeChatUnreadMap(normalizedRoom.unreadBy || {}),
    hiddenBy: normalizeChatReadMap(normalizedRoom.hiddenBy || {}),
    messageVisibleAfterBy: normalizeChatReadMap(normalizedRoom.messageVisibleAfterBy || {}),
    avatarData: normalizeChatRoomAvatarData(normalizedRoom.avatarData || ""),
    unreadCount: unreadCount
  };
}

function hasStartedChatHistory(room) {
  if (!room) return false;
  if (room.hasHistory === true) return true;
  if (normalizeLoginId(room.lastSenderId || "") && normalizeLoginId(room.lastSenderId || "") !== "system") return true;
  const text = String(room.lastMessageText || "").trim();
  return !!text && text !== "채팅방이 개설되었습니다.";
}

async function getLatestVisibleChatMessage(env, room, userId) {
  if (!env || !room || !room.id) return null;
  const messages = await getChatMessages(env, room.id);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || !isChatMessageVisibleToUser(room, message, userId)) continue;
    if (isChatIntroMessage(message)) continue;
    return message;
  }
  return null;
}

function isChatIntroMessage(message) {
  const messageId = String(message && message.id || "");
  const text = String(message && message.text || "").trim();
  return messageId.indexOf("chat_intro_") === 0 || text === "채팅방이 개설되었습니다.";
}

function isDeletedChatMessage(message) {
  return !!String(message && message.deletedAt || "").trim();
}

function getChatMessageSummaryText(message) {
  if (!message) return "";
  if (isDeletedChatMessage(message)) return "삭제된 메시지입니다.";
  const poll = normalizeChatPoll(message.poll);
  if (poll) return "투표: " + poll.title;
  return buildChatMessageSnippet(message.text || (normalizeChatAttachments(message.attachmentsData).length ? "사진" : ""));
}

export async function ensureChatRoomIntroMessage(env, roomId) {
  const room = await getChatRoomById(env, roomId);
  if (!room) return null;
  const messages = await getChatMessages(env, roomId);
  if (messages.length) return room;

  const now = new Date().toISOString();
  const introText = "채팅방이 개설되었습니다.";
  const introMessage = normalizeStoredChatMessage({
    id: "chat_intro_" + String(roomId || "").replace(/[^0-9A-Za-z_-]/g, "_"),
    roomId: roomId,
    text: introText,
    senderId: "system",
    senderName: "오토원",
    senderDepartment: "",
    attachmentsData: [],
    createdAt: now
  });
  if (introMessage) await setChatMessages(env, roomId, [introMessage]);

  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== roomId) return item;
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    normalizeChatMemberIds(item.memberIds || []).forEach(function (memberId) {
      lastReadBy[memberId] = now;
      unreadBy[memberId] = 0;
    });
    return normalizeStoredChatRoom(Object.assign({}, item, {
      updatedAt: now,
      lastMessageText: introText,
      lastMessageAt: now,
      lastSenderId: "system",
      lastSenderName: "오토원",
      hasHistory: item.hasHistory === true,
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      messageVisibleAfterBy: normalizeChatReadMap(item.messageVisibleAfterBy || {})
    }));
  }).filter(Boolean);
  await setChatRoomList(env, nextRooms);
  return await getChatRoomById(env, roomId);
}

export async function getChatContacts(env, userId) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  userId = normalizeLoginId(userId || "");
  if (!userId) throw chatServiceError("userId is required", 400);

  const employees = await getPrimaryEmployeeListForEnv(env);
  const currentEmployee = employees.find(function (employee) {
    return normalizeLoginId(employee && employee.id || "") === userId;
  });
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const contacts = employees
    .filter(function (employee) {
      return employee && normalizeLoginId(employee.id || "") !== userId && !isChatAdminEmployee(employee);
    })
    .sort(function (a, b) {
      var sameDepartmentA = String(a.department || "") === String(currentEmployee.department || "") ? 0 : 1;
      var sameDepartmentB = String(b.department || "") === String(currentEmployee.department || "") ? 0 : 1;
      if (sameDepartmentA !== sameDepartmentB) return sameDepartmentA - sameDepartmentB;
      if (String(a.department || "") !== String(b.department || "")) return String(a.department || "").localeCompare(String(b.department || ""), "ko");
      return String(a.name || "").localeCompare(String(b.name || ""), "ko");
    })
    .map(function (employee) { return sanitizeEmployee(employee); });

  return {
    me: sanitizeEmployee(currentEmployee),
    items: contacts
  };
}

export async function getChatRoomSummaries(env, userId) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  userId = normalizeLoginId(userId || "");
  if (!userId) throw chatServiceError("userId is required", 400);

  const employees = await getPrimaryEmployeeListForEnv(env);
  const currentEmployee = employees.find(function (employee) {
    return normalizeLoginId(employee && employee.id || "") === userId;
  });
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  if (!isChatAdminEmployee(currentEmployee) && currentEmployee.department) {
    await ensureDepartmentChatRoom(env, currentEmployee.department);
  }
  if (!isChatAdminEmployee(currentEmployee)) {
    await ensureCompanyChatRoom(env);
  }

  const employeeMap = createEmployeeMap(employees);
  const allRooms = await getChatRoomList(env);
  const directRoomGroups = {};
  allRooms.forEach(function (room) {
    if (!room || room.type !== "direct") return;
    const memberKey = normalizeChatMemberIds(room.memberIds || []).sort().join("__");
    if (!memberKey) return;
    if (!directRoomGroups[memberKey]) directRoomGroups[memberKey] = [];
    directRoomGroups[memberKey].push(room);
  });
  for (const memberKey of Object.keys(directRoomGroups)) {
    if (directRoomGroups[memberKey].length > 1) await resolveCanonicalDirectChatRoom(env, directRoomGroups[memberKey][0]);
  }

  const rooms = (await getChatRoomList(env)).filter(function (room) {
    if (room && room.type === "direct" && hasChatAdminMember(room, employeeMap)) return false;
    return canAccessChatRoom(room, currentEmployee);
  });
  const dedupedRooms = [];
  const directRoomIndex = {};
  rooms.forEach(function (room) {
    if (!room || room.type !== "direct") {
      dedupedRooms.push(room);
      return;
    }
    const memberKey = normalizeChatMemberIds(room.memberIds || []).sort().join("__");
    const existingIndex = Object.prototype.hasOwnProperty.call(directRoomIndex, memberKey) ? directRoomIndex[memberKey] : -1;
    if (existingIndex === -1) {
      directRoomIndex[memberKey] = dedupedRooms.length;
      dedupedRooms.push(room);
      return;
    }
    const existingRoom = dedupedRooms[existingIndex];
    const existingStamp = String(existingRoom.createdAt || existingRoom.updatedAt || existingRoom.lastMessageAt || "");
    const currentStamp = String(room.createdAt || room.updatedAt || room.lastMessageAt || "");
    if (!existingStamp || currentStamp < existingStamp) {
      dedupedRooms[existingIndex] = room;
    }
  });
  const items = (await Promise.all(dedupedRooms.map(async function (room) {
    const isCompanyRoom = String(room && room.id || "").trim() === "chat_company_all";
    if ((room.type === "direct" || (room.type === "group" && !isCompanyRoom)) && !hasStartedChatHistory(room)) return null;
    if (room.type === "direct" || (room.type === "group" && !isCompanyRoom)) {
      const latestVisibleMessage = await getLatestVisibleChatMessage(env, room, userId);
      if (!latestVisibleMessage) return null;
      return await buildChatRoomSummary(env, room, userId, employeeMap, { latestVisibleMessage: latestVisibleMessage });
    }
    return await buildChatRoomSummary(env, room, userId, employeeMap);
  }))).filter(Boolean);

  items.sort(function (a, b) {
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });

  return { items: items };
}

export async function getChatMessageList(env, userId, roomId) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  userId = normalizeLoginId(userId || "");
  roomId = String(roomId || "").trim();
  if (!userId || !roomId) throw chatServiceError("userId와 roomId가 필요합니다.", 400);

  const employees = await getPrimaryEmployeeListForEnv(env);
  const currentEmployee = employees.find(function (employee) {
    return normalizeLoginId(employee && employee.id || "") === userId;
  });
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);

  const employeeMap = createEmployeeMap(employees);
  if (effectiveRoom.type === "direct" && hasChatAdminMember(effectiveRoom, employeeMap)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const messages = (await getChatMessages(env, effectiveRoom.id)).filter(function (message) {
    return isChatMessageVisibleToUser(effectiveRoom, message, userId);
  });

  return {
    room: await buildChatRoomSummary(env, effectiveRoom, userId, employeeMap),
    items: messages.map(function (message) {
      return {
        id: message.id,
        roomId: message.roomId,
        text: String(message.text || ""),
        senderId: normalizeLoginId(message.senderId || ""),
        senderName: String(message.senderName || "").trim(),
        senderDepartment: String(message.senderDepartment || "").trim(),
        attachmentsData: normalizeChatAttachments(message.attachmentsData),
        poll: normalizeChatPoll(message.poll),
        deletedAt: String(message.deletedAt || ""),
        deletedBy: normalizeLoginId(message.deletedBy || ""),
        mine: normalizeLoginId(message.senderId || "") === userId,
        createdAt: String(message.createdAt || "")
      };
    })
  };
}

export async function getChatAttachmentFile(env, userId, roomId, messageId, index) {
  requireKv(env);

  userId = normalizeLoginId(userId || "");
  roomId = String(roomId || "").trim();
  messageId = String(messageId || "").trim();
  index = Math.floor(Number(index || 0));
  if (!userId || !roomId || !messageId) throw chatServiceError("userId, roomId와 id가 필요합니다.", 400);
  if (index < 0) throw chatServiceError("invalid index", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);

  const messages = await getChatMessages(env, effectiveRoom.id);
  const message = messages.find(function (item) { return item.id === messageId; });
  if (!message || !isChatMessageVisibleToUser(effectiveRoom, message, userId)) throw chatServiceError("message not found", 404);

  const attachmentsData = normalizeChatAttachments(message.attachmentsData);
  const file = attachmentsData[index];
  if (!file) throw chatServiceError("attachment not found", 404);

  return { file: file, index: index };
}

export async function canJoinChatRoom(env, userId, roomId) {
  userId = normalizeLoginId(userId || "");
  roomId = String(roomId || "").trim();
  if (!userId || !roomId) return false;

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  const room = await getChatRoomById(env, roomId);
  return !!(currentEmployee && room && canAccessChatRoom(room, currentEmployee));
}

export async function getOrCreateDirectChatRoom(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const targetUserId = normalizeLoginId(body.targetUserId || "");

  if (!userId || !targetUserId) {
    throw chatServiceError("userId와 targetUserId가 필요합니다.", 400);
  }
  if (userId === targetUserId) {
    throw chatServiceError("본인과의 대화방은 만들 수 없습니다.", 400);
  }

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  const targetEmployee = await getPrimaryEmployeeByIdForEnv(env, targetUserId);
  if (!currentEmployee || !targetEmployee) {
    throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);
  }
  if (isChatAdminEmployee(targetEmployee)) {
    throw chatServiceError("대화 상대를 찾을 수 없습니다.", 404);
  }

  const room = await ensureDirectChatRoom(env, currentEmployee, targetEmployee);
  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  return {
    item: await buildChatRoomSummary(env, room, userId, employeeMap)
  };
}

export async function getOrCreateGroupChatRoom(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const targetUserIds = normalizeChatMemberIds(body.targetUserIds || body.memberIds || []);
  const title = normalizeChatRoomTitle(body.title || "");
  const avatarData = normalizeChatRoomAvatarData(body.avatarData || "");

  if (!userId || !targetUserIds.length) {
    throw chatServiceError("userId와 targetUserIds가 필요합니다.", 400);
  }

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) {
    throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);
  }

  const memberIds = normalizeChatMemberIds([userId].concat(targetUserIds)).filter(function (memberId) {
    return memberId !== "admin";
  });
  if (memberIds.length < 3) {
    throw chatServiceError("그룹 채팅은 본인을 포함해 3명 이상이어야 합니다.", 400);
  }

  const employees = await getPrimaryEmployeeListForEnv(env);
  const employeeMap = createEmployeeMap(employees);
  const members = memberIds.map(function (memberId) {
    return employeeMap[memberId] || null;
  }).filter(Boolean).filter(function (employee) {
    return !isChatAdminEmployee(employee);
  });
  if (members.length !== memberIds.length) {
    throw chatServiceError("대화 상대를 찾을 수 없습니다.", 404);
  }

  const room = await ensureGroupChatRoom(env, currentEmployee, members, { title: title, avatarData: avatarData });
  return {
    item: await buildChatRoomSummary(env, room, userId, employeeMap)
  };
}

export async function ensureDirectChatRoom(env, employeeA, employeeB) {
  const firstId = normalizeLoginId(employeeA && employeeA.id || "");
  const secondId = normalizeLoginId(employeeB && employeeB.id || "");
  const memberIds = [firstId, secondId].sort();
  const rooms = await getChatRoomList(env);
  const existingRooms = rooms.filter(function (room) {
    const roomMemberIds = normalizeChatMemberIds(room.memberIds || []).sort();
    return room.type === "direct"
      && JSON.stringify(roomMemberIds) === JSON.stringify(memberIds);
  }).sort(function (a, b) {
    return String(a.createdAt || a.updatedAt || a.lastMessageAt || "").localeCompare(String(b.createdAt || b.updatedAt || b.lastMessageAt || ""));
  });
  const existing = existingRooms[0] || null;
  if (existing) {
    const currentUserId = firstId;
    const hiddenBy = normalizeChatReadMap(existing.hiddenBy || {});
    const lastReadBy = normalizeChatReadMap(existing.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(existing.unreadBy || {});
    const messageVisibleAfterBy = normalizeChatReadMap(existing.messageVisibleAfterBy || {});
    const hiddenAt = String(hiddenBy[currentUserId] || "");
    let shouldUpdate = false;
    if (hiddenAt) {
      delete hiddenBy[currentUserId];
      if (!messageVisibleAfterBy[currentUserId] || messageVisibleAfterBy[currentUserId] < hiddenAt) {
        messageVisibleAfterBy[currentUserId] = hiddenAt;
      }
      lastReadBy[currentUserId] = new Date().toISOString();
      unreadBy[currentUserId] = 0;
      shouldUpdate = true;
    }
    if (shouldUpdate) {
      const nextRooms = rooms.map(function (room) {
        if (room.id !== existing.id) return room;
        return normalizeStoredChatRoom(Object.assign({}, room, {
          hiddenBy: hiddenBy,
          lastReadBy: lastReadBy,
          unreadBy: unreadBy,
          messageVisibleAfterBy: messageVisibleAfterBy,
          updatedAt: new Date().toISOString()
        }));
      });
      await setChatRoomList(env, nextRooms);
      return await resolveCanonicalDirectChatRoom(env, await ensureChatRoomIntroMessage(env, existing.id));
    }
    return await resolveCanonicalDirectChatRoom(env, await ensureChatRoomIntroMessage(env, existing.id));
  }

  const now = new Date().toISOString();
  const roomId = "chat_direct_" + memberIds.join("__");
  const room = normalizeStoredChatRoom({
    id: roomId,
    type: "direct",
    title: "",
    department: "",
    memberIds: memberIds,
    memberNames: {
      [firstId]: String(employeeA && employeeA.name || firstId).trim(),
      [secondId]: String(employeeB && employeeB.name || secondId).trim()
    },
    createdBy: firstId,
    createdAt: now,
    updatedAt: now,
    lastMessageText: "",
    lastMessageAt: "",
    lastSenderId: "",
    lastSenderName: "",
    hasHistory: false,
    lastReadBy: {
      [firstId]: now,
      [secondId]: now
    },
    unreadBy: {
      [firstId]: 0,
      [secondId]: 0
    },
    hiddenBy: {},
    messageVisibleAfterBy: {
      [firstId]: now,
      [secondId]: now
    },
    avatarData: ""
  });

  rooms.push(room);
  await setChatRoomList(env, rooms);
  return await ensureChatRoomIntroMessage(env, room.id);
}

export async function resolveCanonicalDirectChatRoom(env, room) {
  if (!room || room.type !== "direct") return room;

  const memberIds = normalizeChatMemberIds(room.memberIds || []).sort();
  if (memberIds.length !== 2) return room;

  const rooms = await getChatRoomList(env);
  const directRooms = rooms
    .filter(function (item) {
      const itemMemberIds = normalizeChatMemberIds(item.memberIds || []).sort();
      return item && item.type === "direct" && JSON.stringify(itemMemberIds) === JSON.stringify(memberIds);
    })
    .sort(function (a, b) {
      return String(a.createdAt || a.updatedAt || a.lastMessageAt || "").localeCompare(String(b.createdAt || b.updatedAt || b.lastMessageAt || ""));
    });

  const canonicalRoom = directRooms[0] || room;
  if (!canonicalRoom || !canonicalRoom.id) return room;
  if (directRooms.length <= 1) return canonicalRoom;

  const mergedMessages = [];
  const seenMessageIds = {};
  for (const directRoom of directRooms) {
    const messages = await getChatMessages(env, directRoom.id);
    messages.forEach(function (message) {
      const messageId = String(message && message.id || "");
      if (!messageId || seenMessageIds[messageId]) return;
      seenMessageIds[messageId] = true;
      mergedMessages.push(Object.assign({}, message, { roomId: canonicalRoom.id }));
    });
  }
  mergedMessages.sort(function (a, b) {
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  });
  await setChatMessages(env, canonicalRoom.id, mergedMessages);

  const lastMessage = mergedMessages.length ? mergedMessages[mergedMessages.length - 1] : null;
  const combinedHiddenBy = {};
  const combinedReadBy = {};
  const combinedUnreadBy = {};
  const combinedVisibleAfterBy = {};
  directRooms.forEach(function (directRoom) {
    const hiddenBy = normalizeChatReadMap(directRoom.hiddenBy || {});
    const lastReadBy = normalizeChatReadMap(directRoom.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(directRoom.unreadBy || {});
    const visibleAfterBy = normalizeChatReadMap(directRoom.messageVisibleAfterBy || {});
    Object.keys(hiddenBy).forEach(function (memberId) {
      if (!combinedHiddenBy[memberId] || combinedHiddenBy[memberId] < hiddenBy[memberId]) combinedHiddenBy[memberId] = hiddenBy[memberId];
    });
    Object.keys(lastReadBy).forEach(function (memberId) {
      if (!combinedReadBy[memberId] || combinedReadBy[memberId] < lastReadBy[memberId]) combinedReadBy[memberId] = lastReadBy[memberId];
    });
    Object.keys(unreadBy).forEach(function (memberId) {
      combinedUnreadBy[memberId] = Math.max(Number(combinedUnreadBy[memberId] || 0), Number(unreadBy[memberId] || 0));
    });
    Object.keys(visibleAfterBy).forEach(function (memberId) {
      if (!combinedVisibleAfterBy[memberId] || combinedVisibleAfterBy[memberId] < visibleAfterBy[memberId]) {
        combinedVisibleAfterBy[memberId] = visibleAfterBy[memberId];
      }
    });
  });

  const now = new Date().toISOString();
  const duplicateRoomIds = {};
  directRooms.forEach(function (directRoom) {
    if (directRoom.id !== canonicalRoom.id) duplicateRoomIds[directRoom.id] = true;
  });
  const nextRooms = rooms.map(function (item) {
    if (item.id !== canonicalRoom.id) return item;
    return normalizeStoredChatRoom(Object.assign({}, canonicalRoom, {
      updatedAt: lastMessage ? String(lastMessage.createdAt || now) : String(canonicalRoom.updatedAt || canonicalRoom.createdAt || now),
      lastMessageText: lastMessage ? String(lastMessage.text || "") : String(canonicalRoom.lastMessageText || ""),
      lastMessageAt: lastMessage ? String(lastMessage.createdAt || "") : String(canonicalRoom.lastMessageAt || ""),
      lastSenderId: lastMessage ? normalizeLoginId(lastMessage.senderId || "") : String(canonicalRoom.lastSenderId || ""),
      lastSenderName: lastMessage ? String(lastMessage.senderName || "").trim() : String(canonicalRoom.lastSenderName || ""),
      hasHistory: canonicalRoom.hasHistory === true || directRooms.some(function (directRoom) { return directRoom.hasHistory === true; }) || mergedMessages.some(function (message) { return String(message && message.senderId || "") !== "system"; }),
      lastReadBy: Object.assign({}, canonicalRoom.lastReadBy || {}, combinedReadBy),
      unreadBy: Object.assign({}, canonicalRoom.unreadBy || {}, combinedUnreadBy),
      hiddenBy: Object.assign({}, canonicalRoom.hiddenBy || {}, combinedHiddenBy),
      messageVisibleAfterBy: Object.assign({}, canonicalRoom.messageVisibleAfterBy || {}, combinedVisibleAfterBy)
    }));
  }).filter(function (item) {
    return item && !duplicateRoomIds[item.id];
  });
  await setChatRoomList(env, nextRooms);

  return await getChatRoomById(env, canonicalRoom.id);
}

export async function getCanonicalChatRoomId(env, userId, roomId) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  userId = normalizeLoginId(userId || "");
  roomId = String(roomId || "").trim();
  if (!userId || !roomId) throw chatServiceError("userId와 roomId가 필요합니다.", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }

  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);
  return effectiveRoom && effectiveRoom.id ? effectiveRoom.id : roomId;
}

export async function ensureGroupChatRoom(env, currentEmployee, members, options) {
  options = options || {};
  const memberIds = normalizeChatMemberIds((Array.isArray(members) ? members : []).map(function (employee) {
    return employee && employee.id;
  })).sort();
  const currentUserId = normalizeLoginId(currentEmployee && currentEmployee.id || "");
  const roomId = "chat_group_" + memberIds.join("__");
  const rooms = await getChatRoomList(env);
  const existing = rooms.find(function (room) { return room.id === roomId; });
  if (existing) {
    const hiddenBy = normalizeChatReadMap(existing.hiddenBy || {});
    const nextTitle = normalizeChatRoomTitle(options.title || existing.title || "");
    const nextAvatarData = normalizeChatRoomAvatarData(options.avatarData || existing.avatarData || "");
    let shouldUpdate = nextTitle !== existing.title || nextAvatarData !== existing.avatarData;
    memberIds.forEach(function (memberId) {
      if (!hiddenBy[memberId]) return;
      delete hiddenBy[memberId];
      shouldUpdate = true;
    });
    if (shouldUpdate) {
      const nextRooms = rooms.map(function (room) {
        if (room.id !== existing.id) return room;
        return Object.assign({}, room, {
          title: nextTitle,
          avatarData: nextAvatarData,
          hiddenBy: hiddenBy,
          messageVisibleAfterBy: normalizeChatReadMap(existing.messageVisibleAfterBy || {}),
          updatedAt: new Date().toISOString()
        });
      });
      await setChatRoomList(env, nextRooms);
      return await getChatRoomById(env, existing.id);
    }
    return existing;
  }

  const now = new Date().toISOString();
  const memberNames = {};
  (Array.isArray(members) ? members : []).forEach(function (employee) {
    const memberId = normalizeLoginId(employee && employee.id || "");
    if (!memberId) return;
    memberNames[memberId] = String(employee && employee.name || memberId).trim();
  });
  const readBy = {};
  const unreadBy = {};
  memberIds.forEach(function (memberId) {
    readBy[memberId] = now;
    unreadBy[memberId] = 0;
  });

  const room = normalizeStoredChatRoom({
    id: roomId,
    type: "group",
    title: normalizeChatRoomTitle(options.title || ""),
    department: "",
    memberIds: memberIds,
    memberNames: memberNames,
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    lastMessageText: "",
    lastMessageAt: "",
    lastSenderId: "",
    lastSenderName: "",
    hasHistory: false,
    lastReadBy: readBy,
    unreadBy: unreadBy,
    hiddenBy: {},
    messageVisibleAfterBy: {},
    avatarData: normalizeChatRoomAvatarData(options.avatarData || "")
  });

  rooms.push(room);
  await setChatRoomList(env, rooms);
  return await ensureChatRoomIntroMessage(env, room.id);
}

export async function ensureDepartmentChatRoom(env, department) {
  const normalizedDepartment = normalizeDepartmentName(department || "");
  if (!normalizedDepartment) return null;

  const rooms = await getChatRoomList(env);
  const employees = await getPrimaryEmployeeListForEnv(env);
  const members = employees.filter(function (employee) {
    return String(employee.department || "") === normalizedDepartment && !isChatAdminEmployee(employee);
  });
  const memberIds = normalizeChatMemberIds(members.map(function (employee) { return employee.id; })).sort();
  const memberNames = {};
  members.forEach(function (employee) {
    memberNames[employee.id] = employee.name || employee.id;
  });

  const existing = rooms.find(function (room) {
    return room.type === "department" && String(room.department || "") === normalizedDepartment;
  });
  if (existing) {
    const existingMemberIds = normalizeChatMemberIds(existing.memberIds || []).sort();
    const nextMemberIds = normalizeChatMemberIds(memberIds).sort();
    if (JSON.stringify(existingMemberIds) === JSON.stringify(nextMemberIds)) {
      return await ensureChatRoomIntroMessage(env, existing.id);
    }
    const nextRooms = rooms.map(function (room) {
      if (room.id !== existing.id) return room;
      return normalizeStoredChatRoom(Object.assign({}, room, {
        memberIds: nextMemberIds,
        memberNames: Object.assign({}, room.memberNames || {}, memberNames),
        updatedAt: room.updatedAt || new Date().toISOString(),
        messageVisibleAfterBy: normalizeChatReadMap(existing.messageVisibleAfterBy || {})
      }));
    }).filter(Boolean);
    await setChatRoomList(env, nextRooms);
    return await ensureChatRoomIntroMessage(env, existing.id);
  }

  const now = new Date().toISOString();

  const room = normalizeStoredChatRoom({
    id: "chat_department_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    type: "department",
    title: normalizedDepartment + " 채팅방",
    department: normalizedDepartment,
    memberIds: memberIds,
    memberNames: memberNames,
    createdBy: members[0] && members[0].id || "admin",
    createdAt: now,
    updatedAt: now,
    lastMessageText: "",
    lastMessageAt: "",
    lastSenderId: "",
    lastSenderName: "",
    hasHistory: false,
    lastReadBy: {},
    unreadBy: {},
    hiddenBy: {},
    messageVisibleAfterBy: {},
    avatarData: ""
  });

  rooms.push(room);
  await setChatRoomList(env, rooms);
  return await ensureChatRoomIntroMessage(env, room.id);
}

export async function ensureCompanyChatRoom(env) {
  const roomId = "chat_company_all";
  const rooms = await getChatRoomList(env);
  const employees = (await getPrimaryEmployeeListForEnv(env)).filter(function (employee) {
    return employee && employee.id && !isChatAdminEmployee(employee) && !isCompanyChatRoomExcludedEmployee(employee);
  });
  const memberIds = normalizeChatMemberIds(employees.map(function (employee) { return employee.id; })).sort();
  const memberNames = {};
  employees.forEach(function (employee) {
    const memberId = normalizeLoginId(employee && employee.id || "");
    if (!memberId) return;
    memberNames[memberId] = String(employee && employee.name || memberId).trim();
  });

  const existing = rooms.find(function (room) { return room.id === roomId; });
  if (existing) {
    const existingMemberIds = normalizeChatMemberIds(existing.memberIds || []).sort();
    if (JSON.stringify(existingMemberIds) === JSON.stringify(memberIds)) {
      return await ensureChatRoomIntroMessage(env, roomId);
    }
    const nextRooms = rooms.map(function (room) {
      if (room.id !== roomId) return room;
      return normalizeStoredChatRoom(Object.assign({}, room, {
        type: "group",
        title: "전직원 채팅방",
        memberIds: memberIds,
        memberNames: Object.assign({}, room.memberNames || {}, memberNames),
        updatedAt: room.updatedAt || new Date().toISOString(),
        messageVisibleAfterBy: normalizeChatReadMap(existing.messageVisibleAfterBy || {})
      }));
    }).filter(Boolean);
    await setChatRoomList(env, nextRooms);
    return await ensureChatRoomIntroMessage(env, roomId);
  }

  const now = new Date().toISOString();
  const readBy = {};
  const unreadBy = {};
  memberIds.forEach(function (memberId) {
    readBy[memberId] = now;
    unreadBy[memberId] = 0;
  });

  const room = normalizeStoredChatRoom({
    id: roomId,
    type: "group",
    title: "전직원 채팅방",
    department: "",
    memberIds: memberIds,
    memberNames: memberNames,
    createdBy: memberIds[0] || "system",
    createdAt: now,
    updatedAt: now,
    lastMessageText: "",
    lastMessageAt: "",
    lastSenderId: "",
    lastSenderName: "",
    hasHistory: false,
    lastReadBy: readBy,
    unreadBy: unreadBy,
    hiddenBy: {},
    messageVisibleAfterBy: {},
    avatarData: ""
  });

  rooms.push(room);
  await setChatRoomList(env, rooms);
  return await ensureChatRoomIntroMessage(env, room.id);
}

export async function saveChatMessage(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  const targetUserId = normalizeLoginId(body.targetUserId || "");
  const text = normalizeChatMessageText(body.text || "");
  const attachmentsData = normalizeChatAttachments(body.attachmentsData);
  const poll = normalizeChatPoll(body.poll);

  if (!userId) throw new Error("userId가 필요합니다.");
  if (!text && !attachmentsData.length && !poll) throw new Error("메시지를 입력해주세요.");

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw new Error("직원 계정을 찾을 수 없습니다.");

  let room = null;
  if (roomId) {
    room = await getChatRoomById(env, roomId);
    if (!room || !canAccessChatRoom(room, currentEmployee)) {
      throw new Error("채팅방을 찾을 수 없습니다.");
    }
    const roomEmployeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
    if (room.type === "direct" && hasChatAdminMember(room, roomEmployeeMap)) {
      throw new Error("채팅방을 찾을 수 없습니다.");
    }
    room = await resolveCanonicalDirectChatRoom(env, room);
  } else if (targetUserId) {
    const targetEmployee = await getPrimaryEmployeeByIdForEnv(env, targetUserId);
    if (!targetEmployee) throw new Error("대화 상대를 찾을 수 없습니다.");
    if (isChatAdminEmployee(targetEmployee)) throw new Error("대화 상대를 찾을 수 없습니다.");
    room = await ensureDirectChatRoom(env, currentEmployee, targetEmployee);
  } else {
    throw new Error("roomId 또는 targetUserId가 필요합니다.");
  }

  const now = new Date().toISOString();
  const message = {
    id: "chat_message_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    roomId: room.id,
    text: text,
    senderId: currentEmployee.id,
    senderName: currentEmployee.name || currentEmployee.id,
    senderDepartment: currentEmployee.department || "",
    attachmentsData: attachmentsData,
    poll: poll,
    createdAt: now
  };

  const messages = await getChatMessages(env, room.id);
  messages.push(message);
  await setChatMessages(env, room.id, messages);

  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== room.id) return item;
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    lastReadBy[currentEmployee.id] = now;
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    const hiddenBy = normalizeChatReadMap(item.hiddenBy || {});
    const messageVisibleAfterBy = normalizeChatReadMap(item.messageVisibleAfterBy || {});
    normalizeChatMemberIds(item.memberIds || []).forEach(function (memberId) {
      unreadBy[memberId] = memberId === currentEmployee.id ? 0 : Math.max(0, Number(unreadBy[memberId] || 0)) + 1;
    });
    return {
      id: item.id,
      type: item.type,
      title: item.title || "",
      department: item.department || "",
      memberIds: normalizeChatMemberIds(item.memberIds || []),
      memberNames: normalizeChatMemberNames(item.memberNames || {}),
      createdBy: item.createdBy || "",
      createdAt: item.createdAt || now,
      updatedAt: now,
      lastMessageText: poll ? "투표: " + poll.title : (text || (attachmentsData.length ? "사진" : "")),
      lastMessageAt: now,
      lastSenderId: currentEmployee.id,
      lastSenderName: currentEmployee.name || currentEmployee.id,
      hasHistory: true,
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      hiddenBy: hiddenBy,
      messageVisibleAfterBy: messageVisibleAfterBy,
      avatarData: normalizeChatRoomAvatarData(item.avatarData || "")
    };
  });
  await setChatRoomList(env, nextRooms);

  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  const nextRoom = nextRooms.find(function (item) { return item.id === room.id; }) || await getChatRoomById(env, room.id);
  const roomSummary = await buildChatRoomSummary(env, nextRoom, userId, employeeMap, { latestVisibleMessage: message });

  return {
    item: {
      id: message.id,
      roomId: message.roomId,
      text: message.text,
      senderId: message.senderId,
      senderName: message.senderName,
      senderDepartment: message.senderDepartment,
      attachmentsData: message.attachmentsData,
      poll: message.poll,
      deletedAt: String(message.deletedAt || ""),
      deletedBy: normalizeLoginId(message.deletedBy || ""),
      mine: true,
      createdAt: message.createdAt
    },
    room: roomSummary
  };
}

export async function markChatRoomRead(env, userId, roomId) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  userId = normalizeLoginId(userId || "");
  roomId = String(roomId || "").trim();
  if (!userId || !roomId) throw new Error("userId와 roomId가 필요합니다.");

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw new Error("직원 계정을 찾을 수 없습니다.");

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw new Error("채팅방을 찾을 수 없습니다.");
  }
  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);
  if (effectiveRoom.type === "direct" && hasChatAdminMember(effectiveRoom, employeeMap)) {
    throw new Error("채팅방을 찾을 수 없습니다.");
  }

  const rooms = await getChatRoomList(env);
  const messages = (await getChatMessages(env, effectiveRoom.id)).filter(function (message) {
    return isChatMessageVisibleToUser(effectiveRoom, message, userId);
  });
  const readAt = messages.length ? String(messages[messages.length - 1].createdAt || new Date().toISOString()) : new Date().toISOString();
  const nextRooms = rooms.map(function (item) {
    if (item.id !== effectiveRoom.id) return item;
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    lastReadBy[userId] = readAt;
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    unreadBy[userId] = 0;
    return {
      id: item.id,
      type: item.type,
      title: item.title || "",
      department: item.department || "",
      memberIds: normalizeChatMemberIds(item.memberIds || []),
      memberNames: normalizeChatMemberNames(item.memberNames || {}),
      createdBy: item.createdBy || "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      lastMessageText: item.lastMessageText || "",
      lastMessageAt: item.lastMessageAt || "",
      lastSenderId: item.lastSenderId || "",
      lastSenderName: item.lastSenderName || "",
      hasHistory: item.hasHistory === true,
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      hiddenBy: normalizeChatReadMap(item.hiddenBy || {}),
      messageVisibleAfterBy: normalizeChatReadMap(item.messageVisibleAfterBy || {}),
      avatarData: normalizeChatRoomAvatarData(item.avatarData || "")
    };
  });
  await setChatRoomList(env, nextRooms);

  const nextRoom = nextRooms.find(function (item) { return item.id === effectiveRoom.id; }) || effectiveRoom;
  return {
    roomId: effectiveRoom.id,
    readAt: readAt,
    room: await buildChatRoomSummary(env, nextRoom, userId, employeeMap)
  };
}

export async function voteChatPoll(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  const messageId = String(body.messageId || "").trim();
  const selectedOptionIds = Array.from(new Set((Array.isArray(body.optionIds) ? body.optionIds : []).map(function (item) {
    return String(item || "").trim();
  }).filter(Boolean)));
  if (!userId || !roomId || !messageId) throw chatServiceError("userId, roomId와 messageId가 필요합니다.", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);
  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);

  const messages = await getChatMessages(env, roomId);
  const targetIndex = messages.findIndex(function (message) {
    return String(message && message.id || "") === messageId;
  });
  if (targetIndex < 0) throw chatServiceError("투표 메시지를 찾을 수 없습니다.", 404);

  const target = normalizeStoredChatMessage(messages[targetIndex]);
  const poll = normalizeChatPoll(target.poll);
  if (!poll) throw chatServiceError("투표 메시지가 아닙니다.", 400);
  const optionIdSet = new Set(poll.options.map(function (option) { return option.id; }));
  const nextSelected = selectedOptionIds.filter(function (optionId) {
    return optionIdSet.has(optionId);
  });
  if (!poll.multiple && nextSelected.length > 1) nextSelected.splice(1);

  const votes = poll.votes || {};
  poll.options.forEach(function (option) {
    const optionId = option.id;
    votes[optionId] = (Array.isArray(votes[optionId]) ? votes[optionId] : []).filter(function (voterId) {
      return normalizeLoginId(voterId) !== userId;
    });
    if (nextSelected.indexOf(optionId) > -1) votes[optionId].push(userId);
  });
  target.poll = normalizeChatPoll(Object.assign({}, poll, { votes: votes }));
  messages[targetIndex] = target;
  await setChatMessages(env, roomId, messages);

  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  return {
    item: {
      id: target.id,
      roomId: target.roomId,
      text: String(target.text || ""),
      senderId: normalizeLoginId(target.senderId || ""),
      senderName: String(target.senderName || "").trim(),
      senderDepartment: String(target.senderDepartment || "").trim(),
      attachmentsData: normalizeChatAttachments(target.attachmentsData),
      poll: normalizeChatPoll(target.poll),
      deletedAt: String(target.deletedAt || ""),
      deletedBy: normalizeLoginId(target.deletedBy || ""),
      mine: normalizeLoginId(target.senderId || "") === userId,
      createdAt: String(target.createdAt || "")
    },
    room: await buildChatRoomSummary(env, room, userId, employeeMap)
  };
}

export async function updateChatRoomInfo(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  if (!userId || !roomId) throw chatServiceError("userId와 roomId가 필요합니다.", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee) || room.type !== "group") {
    throw chatServiceError("수정할 수 있는 채팅방을 찾을 수 없습니다.", 404);
  }

  const nextTitle = normalizeChatRoomTitle(body.title || "");
  const nextAvatarData = normalizeChatRoomAvatarData(body.avatarData || "");
  const now = new Date().toISOString();
  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== roomId) return item;
    return Object.assign({}, item, {
      title: nextTitle,
      avatarData: nextAvatarData,
      messageVisibleAfterBy: normalizeChatReadMap(item.messageVisibleAfterBy || {}),
      updatedAt: now
    });
  });
  await setChatRoomList(env, nextRooms);

  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  const nextRoom = await getChatRoomById(env, roomId);
  return {
    item: await buildChatRoomSummary(env, nextRoom, userId, employeeMap)
  };
}

export async function inviteChatRoomMembers(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  const targetUserIds = normalizeChatMemberIds(body.targetUserIds || body.memberIds || []);
  if (!userId || !roomId || !targetUserIds.length) {
    throw chatServiceError("userId, roomId, targetUserIds가 필요합니다.", 400);
  }

  const employees = await getPrimaryEmployeeListForEnv(env);
  const employeeMap = createEmployeeMap(employees);
  const currentEmployee = employeeMap[userId] || null;
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  if (room.type === "department" || room.id === "chat_company_all") {
    throw chatServiceError("이 채팅방에는 멤버를 초대할 수 없습니다.", 400);
  }

  const currentMemberIds = normalizeChatMemberIds(room.memberIds || []);
  const inviteIds = targetUserIds.filter(function (memberId) {
    const employee = employeeMap[memberId];
    return employee && !isChatAdminEmployee(employee) && currentMemberIds.indexOf(memberId) === -1;
  });
  if (!inviteIds.length) throw chatServiceError("초대할 멤버가 없습니다.", 400);

  const now = new Date().toISOString();
  const inviteNames = inviteIds.map(function (memberId) {
    const employee = employeeMap[memberId];
    return String(employee && employee.name || memberId).trim();
  }).filter(Boolean);
  const inviteText = buildChatInviteMessageText(inviteNames);
  const message = normalizeStoredChatMessage({
    id: "chat_invite_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    roomId: roomId,
    text: inviteText,
    senderId: "system",
    senderName: "오토원",
    senderDepartment: "",
    attachmentsData: [],
    createdAt: now
  });

  const messages = await getChatMessages(env, roomId);
  messages.push(message);
  await setChatMessages(env, roomId, messages);

  const inviteMemberNames = {};
  inviteIds.forEach(function (memberId) {
    const employee = employeeMap[memberId];
    inviteMemberNames[memberId] = String(employee && employee.name || memberId).trim();
  });
  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== roomId) return item;
    const nextMemberIds = normalizeChatMemberIds(currentMemberIds.concat(inviteIds));
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    const hiddenBy = normalizeChatReadMap(item.hiddenBy || {});
    nextMemberIds.forEach(function (memberId) {
      delete hiddenBy[memberId];
      if (inviteIds.indexOf(memberId) > -1 || memberId === userId) {
        lastReadBy[memberId] = now;
        unreadBy[memberId] = 0;
      } else {
        unreadBy[memberId] = Math.max(0, Number(unreadBy[memberId] || 0)) + 1;
      }
    });
    return normalizeStoredChatRoom(Object.assign({}, item, {
      type: "group",
      memberIds: nextMemberIds,
      memberNames: Object.assign({}, item.memberNames || {}, inviteMemberNames),
      updatedAt: now,
      lastMessageText: inviteText,
      lastMessageAt: now,
      lastSenderId: "system",
      lastSenderName: "오토원",
      hasHistory: item.hasHistory === true,
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      hiddenBy: hiddenBy,
      messageVisibleAfterBy: normalizeChatReadMap(item.messageVisibleAfterBy || {})
    }));
  }).filter(Boolean);
  await setChatRoomList(env, nextRooms);

  const nextRoom = await getChatRoomById(env, roomId);
  return {
    item: {
      id: message.id,
      roomId: message.roomId,
      text: message.text,
      senderId: message.senderId,
      senderName: message.senderName,
      senderDepartment: message.senderDepartment,
      attachmentsData: message.attachmentsData,
      poll: normalizeChatPoll(message.poll),
      deletedAt: String(message.deletedAt || ""),
      deletedBy: normalizeLoginId(message.deletedBy || ""),
      mine: false,
      createdAt: message.createdAt
    },
    room: await buildChatRoomSummary(env, nextRoom, userId, employeeMap)
  };
}

export async function deleteChatMessage(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  const messageId = String(body.messageId || "").trim();
  if (!userId || !roomId || !messageId) throw chatServiceError("userId, roomId, messageId가 필요합니다.", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const employeeMap = createEmployeeMap(await getPrimaryEmployeeListForEnv(env));
  if (room.type === "direct" && hasChatAdminMember(room, employeeMap)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);

  const messages = await getChatMessages(env, effectiveRoom.id);
  const target = messages.find(function (message) { return message.id === messageId; });
  if (!target) throw chatServiceError("메시지를 찾을 수 없습니다.", 404);

  const canDelete = normalizeLoginId(target.senderId || "") === userId || normalizeRole(currentEmployee.role || "") === "admin";
  if (!canDelete) throw chatServiceError("본인이 보낸 메시지만 삭제할 수 있습니다.", 403);

  const now = new Date().toISOString();
  const sentAtMs = Date.parse(String(target.createdAt || ""));
  const deleteForEveryone = !!sentAtMs && Date.now() - sentAtMs <= 60000;
  const targetSenderId = normalizeLoginId(target.senderId || "");
  const targetCreatedAt = String(target.createdAt || "").trim();
  const nextMessages = messages.map(function (message) {
    if (message.id !== messageId) return message;
    if (deleteForEveryone) {
      const deletedFor = normalizeChatReadMap(message.deletedFor || {});
      deletedFor[userId] = now;
      return normalizeStoredChatMessage(Object.assign({}, message, {
        text: "삭제된 메시지입니다.",
        attachmentsData: [],
        poll: null,
        deletedAt: now,
        deletedBy: userId,
        deletedFor: deletedFor
      }));
    }
    const deletedFor = normalizeChatReadMap(message.deletedFor || {});
    deletedFor[userId] = now;
    return normalizeStoredChatMessage(Object.assign({}, message, { deletedFor: deletedFor }));
  });
  await setChatMessages(env, effectiveRoom.id, nextMessages);
  const lastMessage = nextMessages.slice().reverse().find(function (message) { return !isChatIntroMessage(message); }) || null;
  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== effectiveRoom.id) return item;
    const roomLastMessage = deleteForEveryone ? lastMessage : null;
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    if (deleteForEveryone && targetCreatedAt) {
      normalizeChatMemberIds(item.memberIds || []).forEach(function (memberId) {
        if (memberId === targetSenderId) return;
        const lastReadAt = String(lastReadBy[memberId] || "").trim();
        if ((!lastReadAt || targetCreatedAt > lastReadAt) && Number(unreadBy[memberId] || 0) > 0) {
          unreadBy[memberId] = Math.max(0, Number(unreadBy[memberId] || 0) - 1);
        }
      });
    }
    return {
      id: item.id,
      type: item.type,
      title: item.title || "",
      department: item.department || "",
      memberIds: normalizeChatMemberIds(item.memberIds || []),
      memberNames: normalizeChatMemberNames(item.memberNames || {}),
      createdBy: item.createdBy || "",
      createdAt: item.createdAt || now,
      updatedAt: roomLastMessage ? String(roomLastMessage.createdAt || now) : item.updatedAt || now,
      lastMessageText: roomLastMessage ? getChatMessageSummaryText(roomLastMessage) : item.lastMessageText || "",
      lastMessageAt: roomLastMessage ? String(roomLastMessage.createdAt || "") : item.lastMessageAt || "",
      lastSenderId: roomLastMessage ? normalizeLoginId(roomLastMessage.senderId || "") : item.lastSenderId || "",
      lastSenderName: roomLastMessage ? String(roomLastMessage.senderName || "").trim() : item.lastSenderName || "",
      hasHistory: hasStartedChatHistory(item) || normalizeLoginId(target.senderId || "") !== "system" || nextMessages.some(function (message) { return normalizeLoginId(message && message.senderId || "") !== "system"; }),
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      hiddenBy: normalizeChatReadMap(item.hiddenBy || {}),
      messageVisibleAfterBy: normalizeChatReadMap(item.messageVisibleAfterBy || {}),
      avatarData: normalizeChatRoomAvatarData(item.avatarData || "")
    };
  });
  await setChatRoomList(env, nextRooms);

  const nextRoom = await getChatRoomById(env, effectiveRoom.id);
  const nextTarget = nextMessages.find(function (message) { return message.id === messageId; }) || null;
  const memberIds = normalizeChatMemberIds(nextRoom && nextRoom.memberIds || effectiveRoom.memberIds || []);
  const roomsByUserId = {};
  if (nextRoom) {
    for (const memberId of memberIds) {
      roomsByUserId[memberId] = await buildChatRoomSummary(env, nextRoom, memberId, employeeMap);
    }
  }
  return {
    deletedId: messageId,
    deleteMode: deleteForEveryone ? "everyone" : "self",
    deleteForMe: true,
    memberIds: memberIds,
    roomsByUserId: roomsByUserId,
    item: deleteForEveryone && nextTarget ? {
      id: nextTarget.id,
      roomId: nextTarget.roomId,
      text: String(nextTarget.text || ""),
      senderId: normalizeLoginId(nextTarget.senderId || ""),
      senderName: String(nextTarget.senderName || "").trim(),
      senderDepartment: String(nextTarget.senderDepartment || "").trim(),
      attachmentsData: normalizeChatAttachments(nextTarget.attachmentsData),
      poll: normalizeChatPoll(nextTarget.poll),
      deletedAt: String(nextTarget.deletedAt || ""),
      deletedBy: normalizeLoginId(nextTarget.deletedBy || ""),
      mine: normalizeLoginId(nextTarget.senderId || "") === userId,
      createdAt: String(nextTarget.createdAt || "")
    } : null,
    room: roomsByUserId[userId] || (nextRoom ? await buildChatRoomSummary(env, nextRoom, userId, employeeMap) : null)
  };
}

export async function leaveChatRoom(env, body) {
  requireKv(env);
  await ensureEmployeeSeed(env);

  const userId = normalizeLoginId(body.userId || "");
  const roomId = String(body.roomId || "").trim();
  if (!userId || !roomId) throw chatServiceError("userId와 roomId가 필요합니다.", 400);

  const currentEmployee = await getPrimaryEmployeeByIdForEnv(env, userId);
  if (!currentEmployee) throw chatServiceError("직원 계정을 찾을 수 없습니다.", 404);

  const room = await getChatRoomById(env, roomId);
  if (!room || !canAccessChatRoom(room, currentEmployee)) {
    throw chatServiceError("채팅방을 찾을 수 없습니다.", 404);
  }
  const effectiveRoom = await resolveCanonicalDirectChatRoom(env, room);

  const now = new Date().toISOString();
  const rooms = await getChatRoomList(env);
  const nextRooms = rooms.map(function (item) {
    if (item.id !== effectiveRoom.id) return item;
    const hiddenBy = normalizeChatReadMap(item.hiddenBy || {});
    const lastReadBy = normalizeChatReadMap(item.lastReadBy || {});
    const unreadBy = normalizeChatUnreadMap(item.unreadBy || {});
    const messageVisibleAfterBy = normalizeChatReadMap(item.messageVisibleAfterBy || {});
    hiddenBy[userId] = now;
    lastReadBy[userId] = now;
    unreadBy[userId] = 0;
    if (item.type === "direct") {
      messageVisibleAfterBy[userId] = now;
    }
    return {
      id: item.id,
      type: item.type,
      title: item.title || "",
      department: item.department || "",
      memberIds: normalizeChatMemberIds(item.memberIds || []),
      memberNames: normalizeChatMemberNames(item.memberNames || {}),
      createdBy: item.createdBy || "",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      lastMessageText: item.lastMessageText || "",
      lastMessageAt: item.lastMessageAt || "",
      lastSenderId: item.lastSenderId || "",
      lastSenderName: item.lastSenderName || "",
      hasHistory: item.hasHistory === true,
      lastReadBy: lastReadBy,
      unreadBy: unreadBy,
      hiddenBy: hiddenBy,
      messageVisibleAfterBy: messageVisibleAfterBy
    };
  });
  await setChatRoomList(env, nextRooms);
  return { roomId: effectiveRoom.id, leftAt: now };
}

function chatServiceError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
