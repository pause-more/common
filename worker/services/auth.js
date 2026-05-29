import { hasGroupwareDb } from "../storage/employees.js";
import { getEmployeeList, setEmployeeList } from "../storage/legacyEmployees.js";
import { normalizeLoginId } from "../shared/utils.js";

export function isSha256Hex(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || "").trim());
}

export async function verifyEmployeePassword(employee, password) {
  const plainPassword = String(password || "").trim();
  if (!plainPassword) return false;

  if (employee && employee.passwordHash) {
    if (isSha256Hex(employee.passwordHash)) {
      return employee.passwordHash === await hashPassword(plainPassword);
    }
    return String(employee.passwordHash || "") === plainPassword;
  }

  return String(employee && employee.password || "") === plainPassword;
}

export async function upgradeGroupwareDbEmployeePassword(env, employeeId, password) {
  if (!hasGroupwareDb(env)) return;
  const normalizedId = normalizeLoginId(employeeId || "");
  if (!normalizedId) return;
  const passwordHash = await hashPassword(password);
  await env.GROUPWARE_DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE lower(login_id) = ?"
  ).bind(passwordHash, normalizedId).run();
}

export async function upgradeLegacyEmployeePassword(env, employeeId, password) {
  const normalizedId = normalizeLoginId(employeeId || "");
  if (!normalizedId) return;

  const passwordHash = await hashPassword(password);
  const employees = (await getEmployeeList(env)).map(function (employee) {
    if (employee.id !== normalizedId) return employee;

    return {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      birthDate: employee.birthDate || "",
      hireDate: employee.hireDate || "",
      department: employee.department || "",
      passwordHash: passwordHash,
      role: employee.role,
      isTempPassword: employee.isTempPassword === true,
      createdAt: employee.createdAt,
      updatedAt: new Date().toISOString()
    };
  });

  await setEmployeeList(env, employees);
}

export async function hashPassword(password) {
  const value = String(password || "");
  const bytes = new TextEncoder().encode("autonecar.mail.auth::" + value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.prototype.map.call(bytes, function (byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}
