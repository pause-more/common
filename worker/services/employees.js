import {
  getGroupwareDbDepartmentList,
  getGroupwareDbEmployeeById,
  getGroupwareDbEmployeeList,
  hasGroupwareDb
} from "../storage/employees.js";
import { hashPassword } from "./auth.js";
import { getEmployeeTempPasswordFlags } from "../storage/employeeTempPasswords.js";
import { generateEmployeeNumber, getEmployeeById, getEmployeeList, setEmployeeList } from "../storage/legacyEmployees.js";
import { ensureDepartmentSeed, getDepartmentList } from "../storage/legacyDepartments.js";
import { ensureBoardSeed } from "../storage/boardPosts.js";
import { getDefaultDepartmentWorkSchedule, normalizeEmployeeWorkSchedule, normalizeWorkHours, resolveEmployeeWorkSchedule } from "../storage/attendance.js";
import { normalizeDepartmentName, normalizeLoginId } from "../shared/utils.js";

let employeeSeedCheckedAt = 0;
let employeeSeedPromise = null;
const EMPLOYEE_SEED_CACHE_MS = 5 * 60 * 1000;

export async function getPrimaryEmployeeList(context) {
  const { env, legacyEmployeeList } = context;
  if (hasGroupwareDb(env)) {
    const items = await getGroupwareDbEmployeeList(env);
    if (items.length) return items;
  }
  return await legacyEmployeeList(env);
}

export async function getPrimaryDepartmentList(context) {
  const { env, legacyDepartmentList } = context;
  if (hasGroupwareDb(env)) {
    const items = await getGroupwareDbDepartmentList(env);
    if (items.length) return items;
  }
  return await legacyDepartmentList(env);
}

export async function getPrimaryEmployeeById(context) {
  const { env, id, legacyEmployeeById } = context;
  if (hasGroupwareDb(env)) {
    const employee = await getGroupwareDbEmployeeById(env, id);
    if (employee) return employee;
  }
  return await legacyEmployeeById(env, id);
}

export async function generatePrimaryEmployeeNumber(context) {
  const {
    env,
    legacyEmployeeList,
    normalizeEmployeeNumber,
    currentEmployeeNumberPrefix
  } = context;
  const employees = await getPrimaryEmployeeList({ env, legacyEmployeeList });
  const currentPrefix = currentEmployeeNumberPrefix();
  const maxSequence = employees.reduce(function (max, employee) {
    const employeeNumber = normalizeEmployeeNumber(employee && employee.employeeNumber || "");
    if (employeeNumber.slice(0, 2) !== currentPrefix) return max;
    const sequence = Number(employeeNumber.slice(2) || 0);
    return sequence > max ? sequence : max;
  }, 0);
  return currentPrefix + String(maxSequence + 1).padStart(4, "0");
}

export async function getPrimaryEmployeeListForEnv(env) {
  return await getPrimaryEmployeeList({
    env: env,
    legacyEmployeeList: getEmployeeList
  });
}

export async function getPrimaryDepartmentListForEnv(env) {
  return await getPrimaryDepartmentList({
    env: env,
    legacyDepartmentList: getDepartmentList
  });
}

export async function getPrimaryEmployeeByIdForEnv(env, id) {
  return await getPrimaryEmployeeById({
    env: env,
    id: id,
    legacyEmployeeById: getEmployeeById
  });
}

export async function generatePrimaryEmployeeNumberForEnv(env) {
  return await generatePrimaryEmployeeNumber({
    env: env,
    legacyEmployeeList: getEmployeeList,
    normalizeEmployeeNumber: normalizeEmployeeNumber,
    currentEmployeeNumberPrefix: getCurrentEmployeeNumberPrefix
  });
}

export async function ensureEmployeeSeed(env) {
  const nowMs = Date.now();
  if (employeeSeedPromise && nowMs - employeeSeedCheckedAt < EMPLOYEE_SEED_CACHE_MS) {
    return await employeeSeedPromise;
  }
  employeeSeedCheckedAt = nowMs;
  employeeSeedPromise = ensureEmployeeSeedUncached(env).catch(function (error) {
    employeeSeedCheckedAt = 0;
    employeeSeedPromise = null;
    throw error;
  });
  return await employeeSeedPromise;
}

async function ensureEmployeeSeedUncached(env) {
  const employees = await getPrimaryEmployeeListForEnv(env);
  if (employees.length) {
    await ensureDepartmentSeed(env, employees);
    await ensureBoardSeed(env);
    return employees;
  }

  const seeded = [
    await buildServerEmployee({ id: "admin", name: "관리자", password: "1234", role: "admin", isTempPassword: false, birthDate: "", hireDate: "", department: "", employeeNumber: "260000" }, env),
    await buildServerEmployee({ id: "jinzero", name: "박진영", password: "1234", role: "staff", isTempPassword: false, birthDate: "", hireDate: "", department: "영업팀", employeeNumber: "260002" }, env)
  ];

  await setEmployeeList(env, seeded);
  await ensureDepartmentSeed(env, seeded);
  await ensureBoardSeed(env);
  return seeded;
}

export function sanitizeEmployee(employee) {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    birthDate: employee.birthDate || "",
    hireDate: employee.hireDate || "",
    department: employee.department || "",
    position: employee.position || "",
    jobGrade: employee.jobGrade || "",
    mobilePhone: employee.mobilePhone || "",
    directPhone: employee.directPhone || "",
    employeeNumber: employee.employeeNumber || "",
    workHours: employee.workHours || employee.workTime || "",
    workSchedule: resolveEmployeeWorkSchedule(employee),
    extraVacationDays: normalizeExtraVacationDays(employee && employee.extraVacationDays || 0),
    role: employee.role,
    isTempPassword: employee.isTempPassword === true,
    createdAt: employee.createdAt || "",
    updatedAt: employee.updatedAt || ""
  };
}

export function normalizeEmployeeText(value) {
  return String(value || "").trim();
}

export function normalizeEmployeePhone(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
}

export function normalizeEmployeeNumber(value) {
  return String(value || "").replace(/[^0-9A-Za-z]/g, "").trim().toUpperCase();
}

export function getCurrentEmployeeNumberPrefix() {
  return String(new Date().getFullYear()).slice(2, 4);
}

export function normalizeExtraVacationDays(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 10) / 10;
}

export function ensureAdminRequester(payload) {
  const requesterRole = normalizeRole(payload && payload.requesterRole || "");
  if (requesterRole !== "admin") throw new Error("관리자만 접근할 수 있습니다.");
}

export function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "ceo") return "ceo";
  return "staff";
}

export function normalizeBirthDate(value) {
  const normalized = String(value || "").replace(/[^0-9]/g, "").trim();
  return /^[0-9]{8}$/.test(normalized) ? normalized : "";
}

export function normalizeHireDate(value) {
  const normalized = String(value || "").replace(/[^0-9]/g, "").trim();
  return /^[0-9]{8}$/.test(normalized) ? normalized : "";
}

export async function isEmployeeTempPassword(env, employee) {
  if (!employee) return false;
  if (normalizeRole(employee.role || "") === "admin") return false;
  const id = normalizeLoginId(employee.id || "");
  if (!id) return false;

  try {
    const flags = await getEmployeeTempPasswordFlags(env);
    if (Object.prototype.hasOwnProperty.call(flags, id)) return flags[id] === true;
  } catch (error) {}

  if (employee.isTempPassword === true) return true;
  if (employee.source === "d1") {
    const tempPasswordHash = await hashPassword("1234");
    return String(employee.passwordHash || "") === tempPasswordHash;
  }
  return false;
}

export async function buildServerEmployee(employee, env) {
  const now = new Date().toISOString();
  const id = normalizeLoginId(employee && employee.id);
  const employeeNumber = normalizeEmployeeNumber(employee && employee.employeeNumber || "") || await generateEmployeeNumber(env);
  return {
    id: id,
    name: String(employee && employee.name || "").trim(),
    email: id + "@autonecar.kr",
    birthDate: normalizeBirthDate(employee && employee.birthDate || ""),
    hireDate: normalizeHireDate(employee && employee.hireDate || ""),
    department: normalizeDepartmentName(employee && employee.department || ""),
    position: normalizeEmployeeText(employee && employee.position || ""),
    jobGrade: normalizeEmployeeText(employee && employee.jobGrade || ""),
    mobilePhone: normalizeEmployeePhone(employee && employee.mobilePhone || ""),
    directPhone: normalizeEmployeePhone(employee && employee.directPhone || ""),
    employeeNumber: employeeNumber,
    workHours: normalizeWorkHours(employee && (employee.workHours || employee.workTime) || ""),
    workSchedule: normalizeEmployeeWorkSchedule(employee && employee.workSchedule || getDefaultDepartmentWorkSchedule(employee && employee.department || "")),
    extraVacationDays: normalizeExtraVacationDays(employee && employee.extraVacationDays || 0),
    passwordHash: await hashPassword(String(employee && employee.password || "").trim()),
    role: normalizeRole(employee && employee.role || "staff"),
    isTempPassword: employee && employee.isTempPassword === true,
    createdAt: employee && employee.createdAt || now,
    updatedAt: now
  };
}
