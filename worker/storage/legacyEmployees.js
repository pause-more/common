export async function getEmployeeList(env) {
  const raw = await env.MAIL_KV.get("auth:employees");
  const parsed = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) return [];
  const normalized = normalizeStoredEmployeeList(parsed);
  if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
    await env.MAIL_KV.put("auth:employees", JSON.stringify(normalized));
  }
  return normalized;
}

export async function setEmployeeList(env, employees) {
  const previousItems = await getEmployeeList(env);
  const normalized = (Array.isArray(employees) ? employees : []).map(function (employee) {
    const previous = previousItems.find(function (item) { return item && item.id === employee.id; }) || {};
    return {
      id: normalizeLoginId(employee && employee.id || ""),
      name: String(employee && employee.name || "").trim(),
      email: normalizeEmail(employee && employee.email || ""),
      birthDate: normalizeBirthDate(employee && employee.birthDate || ""),
      hireDate: normalizeHireDate(employee && employee.hireDate || ""),
      department: normalizeDepartmentName(employee && employee.department || ""),
      position: normalizeEmployeeText(employee && employee.position || previous.position || ""),
      jobGrade: normalizeEmployeeText(employee && employee.jobGrade || previous.jobGrade || ""),
      mobilePhone: normalizeEmployeePhone(employee && employee.mobilePhone || previous.mobilePhone || ""),
      directPhone: normalizeEmployeePhone(employee && employee.directPhone || previous.directPhone || ""),
      employeeNumber: normalizeEmployeeNumber(employee && employee.employeeNumber || previous.employeeNumber || ""),
      workHours: normalizeWorkHours(employee && (employee.workHours || employee.workTime) || previous.workHours || previous.workTime || ""),
      workSchedule: normalizeEmployeeWorkSchedule(
        employee && employee.workSchedule !== undefined
          ? employee.workSchedule
          : (previous.workSchedule !== undefined ? previous.workSchedule : getDefaultDepartmentWorkSchedule(employee && employee.department || previous.department || ""))
      ),
      extraVacationDays: normalizeExtraVacationDays(
        employee && employee.extraVacationDays !== undefined ? employee.extraVacationDays : (previous.extraVacationDays || 0)
      ),
      passwordHash: String(employee && employee.passwordHash || previous.passwordHash || "").trim(),
      role: normalizeRole(employee && employee.role || previous.role || "staff"),
      isTempPassword: employee && employee.isTempPassword === true,
      createdAt: employee && employee.createdAt || previous.createdAt || new Date().toISOString(),
      updatedAt: employee && employee.updatedAt || new Date().toISOString()
    };
  }).filter(function (employee) {
    return !!(employee && employee.id);
  });
  await env.MAIL_KV.put("auth:employees", JSON.stringify(normalized));
}

export async function getEmployeeById(env, id) {
  const normalizedId = normalizeLoginId(id || "");
  if (!normalizedId) return null;
  const employees = await getEmployeeList(env);
  return employees.find(function (employee) { return employee.id === normalizedId; }) || null;
}

export async function generateEmployeeNumber(env) {
  if (!env) {
    return getCurrentEmployeeNumberPrefix() + "0000";
  }
  const employees = await getEmployeeList(env);
  const currentPrefix = getCurrentEmployeeNumberPrefix();
  const maxSequence = employees.reduce(function (max, employee) {
    const employeeNumber = normalizeEmployeeNumber(employee && employee.employeeNumber || "");
    if (employeeNumber.slice(0, 2) !== currentPrefix) return max;
    const sequence = Number(employeeNumber.slice(2) || 0);
    return sequence > max ? sequence : max;
  }, 0);
  return currentPrefix + String(maxSequence + 1).padStart(4, "0");
}

function normalizeStoredEmployeeList(list) {
  const employees = Array.isArray(list) ? list.slice() : [];
  const currentPrefix = getCurrentEmployeeNumberPrefix();
  let maxSequence = employees.reduce(function (max, employee) {
    const reservedNumber = getReservedEmployeeNumber(employee);
    const employeeNumber = reservedNumber || normalizeEmployeeNumber(employee && employee.employeeNumber || "");
    if (employeeNumber.slice(0, 2) !== currentPrefix) return max;
    const sequence = Number(employeeNumber.slice(2) || 0);
    return sequence > max ? sequence : max;
  }, 0);

  return employees.map(function (employee) {
    const next = Object.assign({}, employee || {});
    next.position = normalizeEmployeeText(next.position || "");
    next.jobGrade = normalizeEmployeeText(next.jobGrade || "");
    next.mobilePhone = normalizeEmployeePhone(next.mobilePhone || "");
    next.directPhone = normalizeEmployeePhone(next.directPhone || "");
    next.employeeNumber = getReservedEmployeeNumber(next) || normalizeEmployeeNumber(next.employeeNumber || "");
    next.workSchedule = resolveEmployeeWorkSchedule(next);
    if (!next.employeeNumber) {
      maxSequence += 1;
      next.employeeNumber = currentPrefix + String(maxSequence).padStart(4, "0");
    }
    return next;
  });
}

function getReservedEmployeeNumber(employee) {
  const id = normalizeLoginId(employee && employee.id || "");
  const name = String(employee && employee.name || "").trim();
  const role = normalizeRole(employee && employee.role || "");
  const department = normalizeDepartmentName(employee && employee.department || "");
  if (id === "admin" || name === "관리자") return "260000";
  if (role === "ceo" || department === "대표") return "260001";
  if (id === "jinzero" || name === "박진영") return "260002";
  return "";
}

function getCurrentEmployeeNumberPrefix() {
  return String(new Date().getFullYear()).slice(2, 4);
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

function normalizeEmployeeWorkSchedule(value) {
  const source = value && typeof value === "object" ? value : {};
  const next = {};
  ["mon", "tue", "wed", "thu", "fri"].forEach(function (key) {
    const normalized = normalizeWorkHours(source[key] || "");
    if (normalized) next[key] = normalized;
  });
  return next;
}

function resolveEmployeeWorkSchedule(employee) {
  const schedule = normalizeEmployeeWorkSchedule(employee && employee.workSchedule || {});
  if (Object.keys(schedule).length) return schedule;
  return getDefaultDepartmentWorkSchedule(employee && employee.department || "");
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
