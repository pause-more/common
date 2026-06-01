import { normalizeLoginId } from "../shared/utils.js";

export async function getPushSubscriptions(env, userId) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId || !env || !env.MAIL_KV) return [];
  const raw = await env.MAIL_KV.get(getPushSubscriptionKey(normalizedUserId));
  const items = raw ? JSON.parse(raw) : [];
  return Array.isArray(items) ? items.map(normalizePushSubscription).filter(Boolean) : [];
}

export async function setPushSubscriptions(env, userId, items) {
  const normalizedUserId = normalizeLoginId(userId || "");
  if (!normalizedUserId || !env || !env.MAIL_KV) return;
  const nextItems = (Array.isArray(items) ? items : []).map(normalizePushSubscription).filter(Boolean);
  await env.MAIL_KV.put(getPushSubscriptionKey(normalizedUserId), JSON.stringify(nextItems.slice(-10)));
}

export async function upsertPushSubscription(env, userId, subscription) {
  const normalizedUserId = normalizeLoginId(userId || "");
  const normalizedSubscription = normalizePushSubscription(subscription);
  if (!normalizedUserId || !normalizedSubscription) return [];
  const currentItems = await getPushSubscriptions(env, normalizedUserId);
  const nextItems = currentItems.filter(function (item) {
    return item.endpoint !== normalizedSubscription.endpoint;
  });
  nextItems.push(normalizedSubscription);
  await setPushSubscriptions(env, normalizedUserId, nextItems);
  return nextItems;
}

export async function removePushSubscription(env, userId, endpoint) {
  const normalizedUserId = normalizeLoginId(userId || "");
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedUserId || !normalizedEndpoint) return [];
  const currentItems = await getPushSubscriptions(env, normalizedUserId);
  const nextItems = currentItems.filter(function (item) {
    return item.endpoint !== normalizedEndpoint;
  });
  await setPushSubscriptions(env, normalizedUserId, nextItems);
  return nextItems;
}

function normalizePushSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") return null;
  const endpoint = String(subscription.endpoint || "").trim();
  const keys = subscription.keys && typeof subscription.keys === "object" ? subscription.keys : {};
  const p256dh = String(keys.p256dh || "").trim();
  const auth = String(keys.auth || "").trim();
  if (!endpoint || !p256dh || !auth) return null;
  return {
    endpoint: endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: {
      p256dh: p256dh,
      auth: auth
    },
    updatedAt: new Date().toISOString()
  };
}

function getPushSubscriptionKey(userId) {
  return "push:subscriptions:" + normalizeLoginId(userId || "");
}
