export async function getChatRoomList(env) {
  const raw = await env.MAIL_KV.get(getChatRoomListKey());
  const items = raw ? JSON.parse(raw) : [];
  return Array.isArray(items) ? items.map(normalizeStoredChatRoom).filter(Boolean) : [];
}

export async function setChatRoomList(env, items) {
  const nextItems = (Array.isArray(items) ? items : []).map(normalizeStoredChatRoom).filter(Boolean);
  await env.MAIL_KV.put(getChatRoomListKey(), JSON.stringify(nextItems));
}

export async function getChatRoomById(env, roomId) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return null;
  const rooms = await getChatRoomList(env);
  return rooms.find(function (room) { return room.id === normalizedRoomId; }) || null;
}

export async function getChatMessages(env, roomId) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return [];
  const raw = await env.MAIL_KV.get(getChatMessagesKey(normalizedRoomId));
  const items = raw ? JSON.parse(raw) : [];
  return dedupeChatIntroMessages(Array.isArray(items) ? items.map(normalizeStoredChatMessage).filter(Boolean) : []);
}

export async function setChatMessages(env, roomId, items) {
  const normalizedRoomId = String(roomId || "").trim();
  if (!normalizedRoomId) return;
  const nextItems = dedupeChatIntroMessages((Array.isArray(items) ? items : []).map(normalizeStoredChatMessage).filter(Boolean)).slice(-300);
  await env.MAIL_KV.put(getChatMessagesKey(normalizedRoomId), JSON.stringify(nextItems));
}

export function normalizeStoredChatRoom(room) {
  if (!room || !room.id) return null;
  return {
    id: String(room.id || "").trim(),
    type: normalizeChatRoomType(room.type || "direct"),
    title: String(room.title || "").trim(),
    department: String(room.department || "").trim(),
    memberIds: normalizeChatMemberIds(room.memberIds || []),
    memberNames: normalizeChatMemberNames(room.memberNames || {}),
    createdBy: normalizeLoginId(room.createdBy || ""),
    createdAt: String(room.createdAt || ""),
    updatedAt: String(room.updatedAt || room.createdAt || ""),
    lastMessageText: String(room.lastMessageText || "").trim(),
    lastMessageAt: String(room.lastMessageAt || room.updatedAt || ""),
    lastSenderId: normalizeLoginId(room.lastSenderId || ""),
    lastSenderName: String(room.lastSenderName || "").trim(),
    hasHistory: room.hasHistory === true,
    lastReadBy: normalizeChatReadMap(room.lastReadBy || {}),
    unreadBy: normalizeChatUnreadMap(room.unreadBy || {}),
    hiddenBy: normalizeChatReadMap(room.hiddenBy || {}),
    messageVisibleAfterBy: normalizeChatReadMap(room.messageVisibleAfterBy || {}),
    avatarData: normalizeChatRoomAvatarData(room.avatarData || "")
  };
}

export function normalizeStoredChatMessage(message) {
  if (!message || !message.id) return null;
  return {
    id: String(message.id || "").trim(),
    roomId: String(message.roomId || "").trim(),
    text: normalizeChatMessageText(message.text || ""),
    senderId: normalizeLoginId(message.senderId || ""),
    senderName: String(message.senderName || "").trim(),
    senderDepartment: String(message.senderDepartment || "").trim(),
    attachmentsData: normalizeChatAttachments(message.attachmentsData),
    poll: normalizeChatPoll(message.poll),
    deletedAt: String(message.deletedAt || "").trim(),
    deletedBy: normalizeLoginId(message.deletedBy || ""),
    deletedFor: normalizeChatReadMap(message.deletedFor || {}),
    createdAt: String(message.createdAt || "")
  };
}

export function normalizeChatPoll(value) {
  const source = value && typeof value === "object" ? value : {};
  const title = String(source.title || "").replace(/\r\n|\r/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  const options = (Array.isArray(source.options) ? source.options : []).map(function (item, index) {
    const option = item && typeof item === "object" ? item : { text: item };
    const text = String(option.text || "").replace(/\r\n|\r/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!text) return null;
    return {
      id: String(option.id || "option_" + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "option_" + (index + 1),
      text: text
    };
  }).filter(Boolean).slice(0, 20);
  if (!title || options.length < 2) return null;
  return {
    title: title,
    options: options,
    anonymous: source.anonymous === true,
    multiple: source.multiple === true,
    allowAdd: source.allowAdd === true,
    autoClose: source.autoClose === true,
    deadline: String(source.deadline || "").trim().slice(0, 30),
    votes: normalizeChatPollVotes(source.votes, options)
  };
}

export function normalizeChatPollVotes(value, options) {
  const optionIds = new Set((Array.isArray(options) ? options : []).map(function (option) {
    return String(option && option.id || "").trim();
  }).filter(Boolean));
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  Object.keys(source).forEach(function (key) {
    const optionId = String(key || "").trim();
    if (!optionIds.has(optionId)) return;
    const userIds = Array.from(new Set((Array.isArray(source[key]) ? source[key] : []).map(normalizeLoginId).filter(Boolean)));
    next[optionId] = userIds.slice(0, 200);
  });
  optionIds.forEach(function (optionId) {
    if (!next[optionId]) next[optionId] = [];
  });
  return next;
}

export function normalizeChatAttachments(value) {
  return (Array.isArray(value) ? value : []).map(function (item) {
    const filename = String(item && (item.filename || item.name) || "").trim().slice(0, 180);
    const content = String(item && item.content || "").trim();
    if (!filename || !content) return null;
    return {
      filename: filename,
      type: String(item && item.type || "application/octet-stream").trim().slice(0, 120),
      size: Number(item && item.size || 0),
      content: content
    };
  }).filter(Boolean).slice(0, 5);
}

export function normalizeChatMemberIds(value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(function (item) {
    return normalizeLoginId(item);
  }).filter(Boolean)));
}

export function normalizeChatMemberNames(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  Object.keys(source).forEach(function (key) {
    const normalizedKey = normalizeLoginId(key);
    const normalizedValue = String(source[key] || "").trim();
    if (!normalizedKey || !normalizedValue) return;
    next[normalizedKey] = normalizedValue;
  });
  return next;
}

export function normalizeChatReadMap(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  Object.keys(source).forEach(function (key) {
    const normalizedKey = normalizeLoginId(key);
    const normalizedValue = String(source[key] || "").trim();
    if (!normalizedKey || !normalizedValue) return;
    next[normalizedKey] = normalizedValue;
  });
  return next;
}

export function normalizeChatUnreadMap(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  Object.keys(source).forEach(function (key) {
    const normalizedKey = normalizeLoginId(key);
    const normalizedValue = Math.max(0, Math.floor(Number(source[key] || 0)));
    if (!normalizedKey || !Number.isFinite(normalizedValue)) return;
    next[normalizedKey] = normalizedValue;
  });
  return next;
}

export function normalizeChatMessageText(value) {
  return String(value || "").replace(/\r\n|\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
}

export function normalizeChatRoomTitle(value) {
  return String(value || "").replace(/\r\n|\r/g, " ").replace(/\s+/g, " ").trim().slice(0, 30);
}

export function normalizeChatRoomAvatarData(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (!/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(source)) return "";
  return source.length > 280000 ? "" : source;
}

function getChatRoomListKey() {
  return "chat:rooms";
}

function getChatMessagesKey(roomId) {
  return "chat:messages:" + String(roomId || "").trim();
}

function dedupeChatIntroMessages(items) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalMessages = normalizedItems.filter(function (message) {
    return !isChatIntroMessage(message);
  });
  const firstNormalMessageAt = normalMessages.reduce(function (earliest, message) {
    const createdAt = String(message && message.createdAt || "");
    if (!createdAt) return earliest;
    return !earliest || createdAt < earliest ? createdAt : earliest;
  }, "");
  let introMessageId = "";
  normalizedItems.forEach(function (message) {
    if (!isChatIntroMessage(message)) return true;
    const createdAt = String(message && message.createdAt || "");
    if (firstNormalMessageAt && createdAt && createdAt > firstNormalMessageAt) return false;
    if (!introMessageId) {
      introMessageId = String(message && message.id || "");
      return true;
    }
    const currentIntro = normalizedItems.find(function (item) { return String(item && item.id || "") === introMessageId; });
    if (createdAt && currentIntro && String(currentIntro.createdAt || "") && createdAt < String(currentIntro.createdAt || "")) {
      introMessageId = String(message && message.id || "");
    }
    return true;
  });
  return normalizedItems.filter(function (message) {
    if (!isChatIntroMessage(message)) return true;
    if (!introMessageId) return false;
    return String(message && message.id || "") === introMessageId;
  });
}

function isChatIntroMessage(message) {
  const messageId = String(message && message.id || "");
  const text = String(message && message.text || "").trim();
  return messageId.indexOf("chat_intro_") === 0 || text === "채팅방이 개설되었습니다.";
}

function normalizeChatRoomType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "department") return "department";
  if (normalized === "group") return "group";
  return "direct";
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

export function canAccessChatRoom(room, employee) {
  if (!room || !employee) return false;
  const employeeId = normalizeLoginId(employee.id || "");
  const hiddenBy = normalizeChatReadMap(room.hiddenBy || {});
  if (room.type === "department") {
    if (employeeId && hiddenBy[employeeId]) return false;
    return String(room.department || "") === String(employee.department || "");
  }
  if (room.type === "group") {
    if (employeeId && hiddenBy[employeeId]) return false;
  }
  if (room.type === "direct" && employeeId && hiddenBy[employeeId]) {
    const hiddenAt = String(hiddenBy[employeeId] || "").trim();
    const lastMessageAt = String(room.lastMessageAt || room.updatedAt || room.createdAt || "").trim();
    if (!hiddenAt || !lastMessageAt || lastMessageAt <= hiddenAt) return false;
  }
  return normalizeChatMemberIds(room.memberIds || []).indexOf(employeeId) > -1;
}

export function getChatRoomDisplayTitle(room, currentUserId, employeeMap) {
  if (room.type === "department") {
    const title = String(room.department || room.title || "부서").trim();
    return title.replace(/\s*채팅방\s*$/, "").trim() || "부서";
  }
  if (room.id === "chat_company_all") return "오토원";
  if (room.type === "group") {
    if (String(room.title || "").trim()) return String(room.title || "").trim();
    const memberNames = {};
    normalizeChatMemberIds(room.memberIds || []).forEach(function (memberId) {
      const employee = employeeMap && employeeMap[memberId];
      memberNames[memberId] = String(employee && employee.name || room.memberNames && room.memberNames[memberId] || memberId).trim();
    });
    return String(buildGroupChatRoomTitle(room.memberIds || [], memberNames, currentUserId) || "그룹 채팅방").trim() || "그룹 채팅방";
  }

  const otherMemberId = normalizeChatMemberIds(room.memberIds || []).find(function (memberId) {
    return memberId !== normalizeLoginId(currentUserId || "");
  }) || "";
  const employee = employeeMap && employeeMap[otherMemberId];
  if (employee && employee.name) return employee.name;
  if (room.memberNames && room.memberNames[otherMemberId]) return room.memberNames[otherMemberId];
  return otherMemberId || "1:1 대화";
}

export function normalizeChatRoomLastMessageText(text) {
  const value = String(text || "").trim();
  if (/^(오토원 전사|.+ 단체) 채팅방입니다\.$/.test(value)) return "채팅방이 개설되었습니다.";
  return value;
}

export function buildGroupChatRoomTitle(memberIds, memberNames, currentUserId) {
  const names = normalizeChatMemberIds(memberIds || []).filter(function (memberId) {
    return memberId !== normalizeLoginId(currentUserId || "");
  }).map(function (memberId) {
    return String(memberNames && memberNames[memberId] || memberId).trim();
  }).filter(Boolean);
  if (!names.length) return "그룹 채팅방";
  const visibleNames = names.slice(0, 3).join(", ");
  return names.length > 3 ? visibleNames + " 외 " + (names.length - 3) + "명" : visibleNames;
}

export function getVisibleChatMemberIds(room, employeeMap) {
  return normalizeChatMemberIds(room && room.memberIds || []).filter(function (memberId) {
    const employee = employeeMap && employeeMap[memberId];
    if (isChatAdminEmployee(employee || { id: memberId })) return false;
    if (String(room && room.id || "").trim() === "chat_company_all" && isCompanyChatRoomExcludedEmployee(employee || { id: memberId })) {
      return false;
    }
    return true;
  });
}

export function hasChatAdminMember(room, employeeMap) {
  return normalizeChatMemberIds(room && room.memberIds || []).some(function (memberId) {
    const employee = employeeMap && employeeMap[memberId];
    return isChatAdminEmployee(employee || { id: memberId });
  });
}

export function getChatRoomUnreadCount(room, currentUserId) {
  const normalizedUserId = normalizeLoginId(currentUserId || "");
  const unreadMap = normalizeChatUnreadMap(room && room.unreadBy || {});
  return Math.max(0, Number(unreadMap[normalizedUserId] || 0));
}

export function getChatMessageVisibilityCutoff(room, userId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId) return "";
  const visibleAfterMap = normalizeChatReadMap(room && room.messageVisibleAfterBy || {});
  return String(visibleAfterMap[normalizedUserId] || "").trim();
}

export function isChatMessageVisibleToUser(room, message, userId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  const deletedFor = normalizeChatReadMap(message && message.deletedFor || {});
  const deletedBy = normalizeLoginId(message && message.deletedBy || "");
  const senderId = normalizeLoginId(message && message.senderId || "");
  if (normalizedUserId && deletedFor[normalizedUserId] && (deletedBy === normalizedUserId || senderId === normalizedUserId)) return false;
  const cutoff = getChatMessageVisibilityCutoff(room, userId);
  if (!cutoff) return true;
  const createdAt = String(message && message.createdAt || "").trim();
  if (!createdAt) return true;
  return createdAt > cutoff;
}

export function getChatNotificationTargets(room, currentEmployee) {
  const currentUserId = normalizeLoginId(currentEmployee && currentEmployee.id || "");
  if (room.type === "department") {
    return normalizeChatMemberIds(room.memberIds || []).filter(function (memberId) {
      return memberId !== currentUserId && memberId !== "admin";
    });
  }
  return normalizeChatMemberIds(room.memberIds || []).filter(function (memberId) {
    return memberId !== currentUserId && memberId !== "admin";
  });
}

export function isChatAdminEmployee(employee) {
  return isHiddenSelectableEmployee(employee);
}

export function isHiddenSelectableEmployee(employee) {
  const id = normalizeLoginId(employee && employee.id || "");
  const name = String(employee && employee.name || "").trim();
  const email = String(employee && employee.email || "").trim().toLowerCase();
  return id === "admin"
    || id === "work"
    || id === "test"
    || /^test/i.test(id)
    || name === "관리자"
    || name === "홍길동"
    || email === "admin@autone.co.kr"
    || /^test@/i.test(email);
}

export function isCompanyChatRoomExcludedEmployee(employee) {
  return isHiddenSelectableEmployee(employee);
}

export function buildChatMessageSnippet(text) {
  const message = String(text || "").replace(/\s+/g, " ").trim();
  return message.length > 60 ? message.slice(0, 57) + "..." : message;
}

export function buildChatInviteMessageText(names) {
  const inviteNames = (Array.isArray(names) ? names : []).map(function (name) {
    return String(name || "").trim();
  }).filter(Boolean);
  if (!inviteNames.length) return "멤버가 초대되었습니다.";
  if (inviteNames.length === 1) return inviteNames[0] + "님이 초대되었습니다.";
  return inviteNames[0] + "님 외 " + (inviteNames.length - 1) + "명이 초대되었습니다.";
}
