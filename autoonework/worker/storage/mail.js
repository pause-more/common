import { requireKv } from "./bindings.js";

export async function getMailItem(env, id) {
  requireKv(env);
  const normalizedId = normalizeMailId(id || "");
  if (!normalizedId) return null;
  const raw = await env.MAIL_KV.get("mail:" + normalizedId);
  return raw ? JSON.parse(raw) : null;
}

export async function setMailItem(env, item) {
  requireKv(env);
  const normalizedId = normalizeMailId(item && item.id || "");
  if (!normalizedId) return;
  await env.MAIL_KV.put("mail:" + normalizedId, JSON.stringify(item));
}

export async function deleteMailItem(env, id) {
  requireKv(env);
  const normalizedId = normalizeMailId(id || "");
  if (!normalizedId) return;
  await env.MAIL_KV.delete("mail:" + normalizedId);
}

export async function getDraftItem(env, id) {
  requireKv(env);
  const normalizedId = normalizeMailId(id || "");
  if (!normalizedId) return null;
  const raw = await env.MAIL_KV.get("draft:" + normalizedId);
  return raw ? JSON.parse(raw) : null;
}

export async function setDraftItem(env, item) {
  requireKv(env);
  const normalizedId = normalizeMailId(item && item.id || "");
  if (!normalizedId) return;
  await env.MAIL_KV.put("draft:" + normalizedId, JSON.stringify(item));
}

export async function deleteDraftItem(env, id) {
  requireKv(env);
  const normalizedId = normalizeMailId(id || "");
  if (!normalizedId) return;
  await env.MAIL_KV.delete("draft:" + normalizedId);
}

function normalizeMailId(value) {
  return String(value || "").trim();
}
