export async function getNotificationList(env, userId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId) return [];
  const raw = await env.MAIL_KV.get(getNotificationListKey(normalizedUserId));
  const items = raw ? JSON.parse(raw) : [];
  return Array.isArray(items) ? items : [];
}

export function isChatNotificationItem(item) {
  return String(item && item.type || "").trim().toLowerCase() === "chat_message";
}

export function getGlobalNotificationList(items) {
  return Array.isArray(items) ? items : [];
}

export async function setNotificationList(env, userId, items) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId) return;
  const nextItems = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, 100);
  await env.MAIL_KV.put(getNotificationListKey(normalizedUserId), JSON.stringify(nextItems));
}

export async function markApprovalDocumentNotificationsRead(env, userId, documentId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  const normalizedDocumentId = normalizeApprovalDocumentId(documentId || "");
  if (!normalizedUserId || !normalizedDocumentId) return;
  const now = new Date().toISOString();
  const encodedId = encodeURIComponent(normalizedDocumentId);
  const items = await getNotificationList(env, normalizedUserId);
  let changed = false;
  const nextItems = items.map(function (item) {
    if (!item || item.read === true) return item;
    const type = String(item.type || "").trim().toLowerCase();
    if (type !== "approval_pending" && type !== "approval_reference") return item;
    const docId = String(item.docId || "").trim();
    const link = String(item.link || "");
    const matchesDocument = docId === normalizedDocumentId || link.indexOf("id=" + encodedId) > -1 || link.indexOf("approvalId=" + encodedId) > -1;
    if (!matchesDocument) return item;
    changed = true;
    return {
      ...item,
      read: true,
      readAt: item.readAt || now
    };
  });
  if (changed) await setNotificationList(env, normalizedUserId, nextItems);
}

export async function createUserNotification(env, payload) {
  const userId = normalizeLoginId(payload && payload.userId || "");
  if (!userId) return null;
  const now = new Date().toISOString();
  const items = await getNotificationList(env, userId);
  const nextItem = {
    id: "notification_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    userId: userId,
    type: String(payload && payload.type || "general").trim().toLowerCase(),
    actorName: String(payload && payload.actorName || "").trim(),
    actionLabel: String(payload && payload.actionLabel || "").trim(),
    menuLabel: String(payload && payload.menuLabel || "").trim(),
    docLabel: String(payload && payload.docLabel || "").trim(),
    docId: String(payload && payload.docId || "").trim(),
    title: String(payload && payload.title || "알림").trim() || "알림",
    body: String(payload && payload.body || "").trim(),
    link: String(payload && payload.link || "").trim(),
    read: false,
    readAt: "",
    createdAt: now
  };
  items.unshift(nextItem);
  await setNotificationList(env, userId, items);
  return nextItem;
}

function getNotificationListKey(userId) {
  return "notifications:user:" + normalizeLoginId(userId || "");
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeApprovalDocumentId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
}
