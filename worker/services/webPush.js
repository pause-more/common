import { normalizeLoginId } from "../shared/utils.js";
import { getPushSubscriptions, removePushSubscription, upsertPushSubscription } from "../storage/pushSubscriptions.js";

const PUSH_TTL_SECONDS = 60 * 60 * 24;
const PUSH_SUBJECT = "mailto:system@autonecar.kr";
const WEB_PUSH_ENABLED = false;

export function getVapidPublicKey(env) {
  if (!WEB_PUSH_ENABLED) return "";
  return String(env && env.VAPID_PUBLIC_KEY || "").trim();
}

export async function saveWebPushSubscription(env, body) {
  const userId = normalizeLoginId(body && body.userId || "");
  const subscription = body && body.subscription;
  if (!userId || !subscription) throw pushError("userId와 subscription이 필요합니다.", 400);
  if (!WEB_PUSH_ENABLED) return { userId: userId, disabled: true };
  await upsertPushSubscription(env, userId, subscription);
  return { userId: userId };
}

export async function deleteWebPushSubscription(env, body) {
  const userId = normalizeLoginId(body && body.userId || "");
  const endpoint = String(body && body.endpoint || "").trim();
  if (!userId || !endpoint) throw pushError("userId와 endpoint가 필요합니다.", 400);
  await removePushSubscription(env, userId, endpoint);
  return { userId: userId };
}

export async function sendChatPushNotifications(env, chatResult, senderUserId) {
  if (!WEB_PUSH_ENABLED) return;
  if (!isWebPushConfigured(env)) return;
  const room = chatResult && chatResult.room;
  const message = chatResult && chatResult.item;
  if (!room || !message) return;
  const senderId = normalizeLoginId(senderUserId || message.senderId || "");
  const memberIds = (Array.isArray(room.memberIds) ? room.memberIds : []).map(normalizeLoginId).filter(Boolean);
  const recipientIds = memberIds.filter(function (memberId) {
    return memberId && memberId !== senderId;
  });
  if (!recipientIds.length) return;

  const payload = JSON.stringify({
    type: "chat-message",
    title: buildChatPushTitle(message, room),
    body: buildChatPushBody(message),
    url: "/chat.html?roomId=" + encodeURIComponent(message.roomId || room.id || ""),
    roomId: message.roomId || room.id || "",
    messageId: message.id || ""
  });

  await Promise.all(recipientIds.map(async function (recipientId) {
    const subscriptions = await getPushSubscriptions(env, recipientId);
    await Promise.all(subscriptions.map(async function (subscription) {
      const result = await sendWebPush(env, subscription, payload);
      if (result && (result.status === 404 || result.status === 410)) {
        await removePushSubscription(env, recipientId, subscription.endpoint);
      }
    }));
  }));
}

export async function sendUserNotificationPush(env, userId, notification) {
  if (!WEB_PUSH_ENABLED) return;
  if (!isWebPushConfigured(env)) return;
  const recipientId = normalizeLoginId(userId || "");
  if (!recipientId) return;

  const payload = JSON.stringify({
    type: String(notification && notification.type || "system-notification").trim().toLowerCase(),
    title: String(notification && notification.title || "새 알림").trim() || "새 알림",
    body: String(notification && notification.body || "").trim(),
    url: String(notification && notification.link || "/index.html").trim() || "/index.html",
    tag: String(notification && notification.id ? "notification-" + notification.id : "autone-work-notification").trim(),
    notificationId: String(notification && notification.id || "").trim(),
    menuLabel: String(notification && notification.menuLabel || "").trim(),
    actionLabel: String(notification && notification.actionLabel || "").trim()
  });

  const subscriptions = await getPushSubscriptions(env, recipientId);
  await Promise.all(subscriptions.map(async function (subscription) {
    const result = await sendWebPush(env, subscription, payload);
    if (result && (result.status === 404 || result.status === 410)) {
      await removePushSubscription(env, recipientId, subscription.endpoint);
    }
  }));
}

async function sendWebPush(env, subscription, payload) {
  const endpoint = String(subscription && subscription.endpoint || "").trim();
  const receiverPublicKey = String(subscription && subscription.keys && subscription.keys.p256dh || "").trim();
  const receiverAuthSecret = String(subscription && subscription.keys && subscription.keys.auth || "").trim();
  if (!endpoint || !receiverPublicKey || !receiverAuthSecret) return null;

  const encrypted = await encryptPushPayload(receiverPublicKey, receiverAuthSecret, payload);
  const authorization = await buildVapidAuthorization(env, endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": String(PUSH_TTL_SECONDS),
      "Urgency": "normal"
    },
    body: encrypted
  });
  return { status: response.status };
}

async function encryptPushPayload(receiverPublicKey, receiverAuthSecret, payload) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const receiverKey = await crypto.subtle.importKey("raw", base64UrlToBytes(receiverPublicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, serverKeys.privateKey, 256));
  const authSecret = base64UrlToBytes(receiverAuthSecret);

  const prkKey = await hmac(authSecret, sharedSecret);
  const keyInfo = concatBytes(textBytes("WebPush: info\0"), base64UrlToBytes(receiverPublicKey), serverPublicKey);
  const ikm = await hmac(prkKey, keyInfo);
  const prk = await hmac(salt, ikm);
  const cek = await hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = await hkdfExpand(prk, "Content-Encoding: nonce\0", 12);

  const plaintext = concatBytes(textBytes(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concatBytes(salt, recordSize, new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function buildVapidAuthorization(env, endpoint) {
  const publicKey = getVapidPublicKey(env);
  const privateKey = String(env && env.VAPID_PRIVATE_KEY || "").trim();
  const publicBytes = base64UrlToBytes(publicKey);
  const x = bytesToBase64Url(publicBytes.slice(1, 33));
  const y = bytesToBase64Url(publicBytes.slice(33, 65));
  const aud = new URL(endpoint).origin;
  const header = bytesToBase64Url(textBytes(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToBase64Url(textBytes(JSON.stringify({
    aud: aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: PUSH_SUBJECT
  })));
  const signingInput = header + "." + claims;
  const key = await crypto.subtle.importKey("jwk", {
    kty: "EC",
    crv: "P-256",
    x: x,
    y: y,
    d: privateKey,
    ext: true
  }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, textBytes(signingInput)));
  return "vapid t=" + signingInput + "." + bytesToBase64Url(signature) + ", k=" + publicKey;
}

function isWebPushConfigured(env) {
  return !!(getVapidPublicKey(env) && String(env && env.VAPID_PRIVATE_KEY || "").trim());
}

function buildChatPushTitle(message, room) {
  const sender = String(message && (message.senderName || message.senderId) || "").trim();
  const roomTitle = String(room && room.title || "").trim();
  if (sender && roomTitle && sender !== roomTitle) return sender + " · " + roomTitle;
  return sender || roomTitle || "새 채팅 메시지";
}

function buildChatPushBody(message) {
  const text = String(message && message.text || "").trim();
  if (text) return text.length > 120 ? text.slice(0, 117) + "..." : text;
  const pollTitle = String(message && message.poll && message.poll.title || "").trim();
  if (pollTitle) return "투표: " + pollTitle;
  const count = Array.isArray(message && message.attachmentsData) ? message.attachmentsData.length : 0;
  return count ? "첨부파일 " + count + "개" : "새 메시지가 도착했습니다.";
}

async function hmac(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, dataBytes));
}

async function hkdfExpand(prk, info, length) {
  const okm = await hmac(prk, concatBytes(textBytes(info), new Uint8Array([1])));
  return okm.slice(0, length);
}

function concatBytes() {
  const arrays = Array.prototype.slice.call(arguments);
  const totalLength = arrays.reduce(function (sum, item) { return sum + item.length; }, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach(function (item) {
    output.set(item, offset);
    offset += item.length;
  });
  return output;
}

function textBytes(value) {
  return new TextEncoder().encode(String(value || ""));
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < source.length; index += 1) {
    binary += String.fromCharCode(source[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pushError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
