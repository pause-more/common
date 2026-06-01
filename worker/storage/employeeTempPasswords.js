import { requireKv } from "./bindings.js";

const TEMP_PASSWORD_FLAG_KEY = "auth:temp-password-flags";

export async function getEmployeeTempPasswordFlags(env) {
  requireKv(env);
  const raw = await env.MAIL_KV.get(TEMP_PASSWORD_FLAG_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  return parsed && typeof parsed === "object" ? parsed : {};
}

export async function setEmployeeTempPasswordFlag(env, employeeId, value) {
  const id = normalizeLoginId(employeeId || "");
  if (!id) return;
  const flags = await getEmployeeTempPasswordFlags(env);
  flags[id] = value === true;
  await env.MAIL_KV.put(TEMP_PASSWORD_FLAG_KEY, JSON.stringify(flags));
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}
