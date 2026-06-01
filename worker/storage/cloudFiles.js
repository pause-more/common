import { requireGroupwareDb } from "./bindings.js";

export async function getCloudFilesByOwner(env, ownerId) {
  requireGroupwareDb(env);
  const normalizedOwnerId = normalizeLoginId(ownerId || "");
  if (!normalizedOwnerId) return [];
  const result = await env.GROUPWARE_DB.prepare(
    "SELECT id, owner_id, owner_name, owner_department, title, name, size, type, object_key, created_at, updated_at FROM cloud_files WHERE lower(owner_id) = ? ORDER BY updated_at DESC, created_at DESC"
  ).bind(normalizedOwnerId).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return rows.map(sanitizeCloudFileItem).filter(function (item) { return !!item; });
}

export async function getCloudFileById(env, id) {
  requireGroupwareDb(env);
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  const row = await env.GROUPWARE_DB.prepare(
    "SELECT id, owner_id, owner_name, owner_department, title, name, size, type, object_key, created_at, updated_at FROM cloud_files WHERE id = ? LIMIT 1"
  ).bind(normalizedId).first();
  return row ? sanitizeCloudFileItem(row) : null;
}

export async function upsertCloudFile(env, item) {
  requireGroupwareDb(env);
  const normalized = sanitizeCloudFileItem(item);
  await env.GROUPWARE_DB.prepare(
    "INSERT OR REPLACE INTO cloud_files (id, owner_id, owner_name, owner_department, title, name, size, type, object_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    normalized.id,
    normalized.ownerId,
    normalized.ownerName,
    normalized.ownerDepartment,
    normalized.title,
    normalized.name,
    normalized.size,
    normalized.type,
    normalized.objectKey,
    normalized.createdAt,
    normalized.updatedAt
  ).run();
}

export async function deleteCloudFileById(env, id) {
  requireGroupwareDb(env);
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return;
  await env.GROUPWARE_DB.prepare(
    "DELETE FROM cloud_files WHERE id = ?"
  ).bind(normalizedId).run();
}

export function sanitizeCloudFileItem(item) {
  item = item || {};
  const id = String(item.id || ("cloud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_");
  const name = String(item.name || "").trim();
  if (!name) return null;
  return {
    id: id,
    ownerId: normalizeLoginId(item.ownerId || item.owner_id || ""),
    ownerName: String(item.ownerName || item.owner_name || "").trim(),
    ownerDepartment: normalizeDepartmentName(item.ownerDepartment || item.owner_department || ""),
    title: String(item.title || "").trim(),
    name: name,
    size: Number(item.size || 0) || 0,
    type: String(item.type || "").trim(),
    dataUrl: String(item.dataUrl || "").trim(),
    objectKey: String(item.objectKey || item.object_key || "").trim(),
    createdAt: String(item.createdAt || item.created_at || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.updated_at || item.createdAt || item.created_at || new Date().toISOString())
  };
}

export function buildCloudObjectKey(ownerId, fileId, fileName) {
  const normalizedOwnerId = normalizeLoginId(ownerId || "unknown");
  const normalizedFileId = String(fileId || "").replace(/[^0-9A-Za-z_-]/g, "_");
  const safeName = String(fileName || "file").replace(/[^0-9A-Za-z._-]/g, "_");
  return "employee-files/" + normalizedOwnerId + "/" + normalizedFileId + "_" + safeName;
}

export function getDefaultCloudQuotaBytes() {
  return 2 * 1024 * 1024 * 1024;
}

export function sumCloudFileBytes(items) {
  return (Array.isArray(items) ? items : []).reduce(function (total, item) {
    return total + Number(item && item.size || 0);
  }, 0);
}

export function dataUrlToUint8Array(dataUrl) {
  const source = String(dataUrl || "");
  const match = source.match(/^data:.*?;base64,(.+)$/);
  if (!match || !match[1]) {
    throw new Error("파일 데이터 형식이 올바르지 않습니다.");
  }
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
