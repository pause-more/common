export async function ensureDepartmentSeed(env, employees) {
  const departments = await getDepartmentList(env);
  if (departments.length) return departments;
  const seeded = (Array.isArray(employees) ? employees : []).map(function (employee) {
    return normalizeDepartmentName(employee && employee.department || "");
  }).filter(Boolean);
  const unique = Array.from(new Set(seeded));
  await setDepartmentList(env, unique);
  return unique;
}

export async function getDepartmentList(env) {
  const raw = await env.MAIL_KV.get("auth:departments");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.map(normalizeDepartmentName).filter(Boolean) : [];
}

export async function setDepartmentList(env, departments) {
  const unique = Array.from(new Set((Array.isArray(departments) ? departments : []).map(normalizeDepartmentName).filter(Boolean)));
  await env.MAIL_KV.put("auth:departments", JSON.stringify(unique));
}

function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
