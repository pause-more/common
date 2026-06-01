export function hasGroupwareDb(env) {
  return !!(env && env.GROUPWARE_DB);
}

export async function getGroupwareDbEmployeeList(env) {
  if (!hasGroupwareDb(env)) return [];
  const result = await env.GROUPWARE_DB.prepare(
    "SELECT u.id, u.employee_id, u.login_id, u.password_hash, u.name, u.email, u.phone, u.position, u.role, u.status, u.created_at, u.updated_at, u.birth_date, u.hire_date, u.job_grade, u.mobile_phone, u.direct_phone, u.work_hours, u.extra_vacation_days, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id ORDER BY u.id"
  ).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return rows.map(mapGroupwareDbEmployeeRow).filter(function (item) { return !!item; });
}

export async function getGroupwareDbEmployeeById(env, id) {
  if (!hasGroupwareDb(env)) return null;
  const normalizedId = normalizeLoginId(id || "");
  if (!normalizedId) return null;
  const result = await env.GROUPWARE_DB.prepare(
    "SELECT u.id, u.employee_id, u.login_id, u.password_hash, u.name, u.email, u.phone, u.position, u.role, u.status, u.created_at, u.updated_at, u.birth_date, u.hire_date, u.job_grade, u.mobile_phone, u.direct_phone, u.work_hours, u.extra_vacation_days, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE lower(u.login_id) = ? LIMIT 1"
  ).bind(normalizedId).first();
  return result ? mapGroupwareDbEmployeeRow(result) : null;
}

export async function getGroupwareDbDepartmentList(env) {
  if (!hasGroupwareDb(env)) return [];
  const result = await env.GROUPWARE_DB.prepare(
    "SELECT name FROM departments ORDER BY id"
  ).all();
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return rows.map(function (row) { return normalizeDepartmentName(row && row.name || ""); }).filter(Boolean);
}

export async function findGroupwareDepartmentIdByName(env, name) {
  if (!hasGroupwareDb(env)) return null;
  const normalizedName = normalizeDepartmentName(name || "");
  if (!normalizedName) return null;
  const row = await env.GROUPWARE_DB.prepare(
    "SELECT id FROM departments WHERE name = ? LIMIT 1"
  ).bind(normalizedName).first();
  return row && row.id ? Number(row.id) : null;
}

export async function updateGroupwareDbEmployee(env, loginId, fields) {
  if (!hasGroupwareDb(env)) return null;
  const normalizedId = normalizeLoginId(loginId || "");
  if (!normalizedId) return null;

  const entries = Object.entries(fields || {}).filter(function (entry) {
    return entry[0] && entry[1] !== undefined;
  });
  if (!entries.length) {
    return await getGroupwareDbEmployeeById(env, normalizedId);
  }

  const assignments = [];
  const values = [];
  entries.forEach(function (entry) {
    if (entry[1] === "CURRENT_TIMESTAMP") {
      assignments.push(entry[0] + " = CURRENT_TIMESTAMP");
    } else {
      assignments.push(entry[0] + " = ?");
      values.push(entry[1]);
    }
  });
  values.push(normalizedId);

  const statement = env.GROUPWARE_DB.prepare(
    "UPDATE users SET " + assignments.join(", ") + " WHERE lower(login_id) = ?"
  );
  await statement.bind(...values).run();

  return await getGroupwareDbEmployeeById(env, normalizedId);
}

function mapGroupwareDbEmployeeRow(row) {
  if (!row) return null;
  const loginId = normalizeLoginId(row.login_id || "");
  if (!loginId) return null;
  const department = normalizeDepartmentName(row.department_name || "");
  return {
    id: loginId,
    name: String(row.name || "").trim(),
    email: normalizeEmail(row.email || (loginId + "@autonecar.kr")),
    birthDate: normalizeBirthDate(row.birth_date || ""),
    hireDate: normalizeHireDate(row.hire_date || ""),
    department: department,
    position: normalizeEmployeeText(row.position || ""),
    jobGrade: normalizeEmployeeText(row.job_grade || ""),
    mobilePhone: normalizeEmployeePhone(row.mobile_phone || row.phone || ""),
    directPhone: normalizeEmployeePhone(row.direct_phone || ""),
    employeeNumber: normalizeEmployeeNumber(row.employee_id || ""),
    workHours: normalizeWorkHours(row.work_hours || ""),
    workSchedule: getDefaultDepartmentWorkSchedule(department),
    extraVacationDays: normalizeExtraVacationDays(row.extra_vacation_days || 0),
    passwordHash: String(row.password_hash || "").trim(),
    role: normalizeRole(row.role || "staff"),
    status: String(row.status || "").trim().toLowerCase() || "active",
    isTempPassword: false,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || ""),
    source: "d1"
  };
}

function normalizeEmail(value) {
  return String(value || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/^<|>$/g, "")
    .replace(/^.*<([^>]+)>.*$/, "$1")
    .trim()
    .toLowerCase();
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "ceo") return "ceo";
  return "staff";
}

function normalizeBirthDate(value) {
  const normalized = String(value || "").replace(/[^0-9]/g, "").trim();
  return /^[0-9]{8}$/.test(normalized) ? normalized : "";
}

function normalizeHireDate(value) {
  const normalized = String(value || "").replace(/[^0-9]/g, "").trim();
  return /^[0-9]{8}$/.test(normalized) ? normalized : "";
}

function normalizeWorkHours(value) {
  const text = String(value || "").trim().replace(/\s*~\s*/g, " - ").replace(/\s*-\s*/g, " - ");
  const matched = text.match(/^([0-2][0-9]:[0-5][0-9])\s-\s([0-2][0-9]:[0-5][0-9])$/);
  if (!matched) return "";
  return matched[1] + " - " + matched[2];
}

function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEmployeeText(value) {
  return String(value || "").trim();
}

function normalizeEmployeePhone(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
  return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
}

function normalizeEmployeeNumber(value) {
  return String(value || "").replace(/[^0-9A-Za-z]/g, "").trim().toUpperCase();
}

function getDefaultDepartmentWorkSchedule(department) {
  const normalizedDepartment = normalizeDepartmentName(department || "");
  if (normalizedDepartment !== "영업1팀" && normalizedDepartment !== "영업2팀") return {};
  return {
    mon: "09:00 - 18:00",
    tue: "09:00 - 19:00",
    wed: "09:00 - 18:00",
    thu: "09:00 - 19:00",
    fri: "09:00 - 18:00"
  };
}

function normalizeExtraVacationDays(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 10) / 10;
}
