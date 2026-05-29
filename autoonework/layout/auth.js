var AUTH_API_BASE = getGroupwareApiBase("/api/auth");
var ATTENDANCE_API_BASE = getGroupwareApiBase("/api/attendance");
var API = window.GroupwareApi;
var AUTH_SESSION_KEYS = ["isLogin", "userId", "userName", "userRole", "userEmail", "userDepartment", "mustChangePassword"];
var REMEMBER_USER_ID_KEY = "rememberedUserId";
var AUTH_CACHE_TTL = 15000;
var SYSTEM_ACCOUNT_IDS = ["admin", "work", "test"];
var authCache = {
  employees: null,
  employeesAt: 0,
  departments: null,
  departmentsAt: 0
};

var AuthStore = {
  loginWithCredentials: async function (id, password) {
    var data = await API.post(
      AUTH_API_BASE + "/login",
      {
        id: normalizeLoginId(id),
        password: String(password || "").trim()
      },
      { successRequired: false }
    );

    if (!data.success || !data.employee) {
      return { success: false, message: data.message || "로그인에 실패했습니다." };
    }

    applySession(data.employee, data.mustChangePassword === true);

    return {
      success: true,
      mustChangePassword: data.mustChangePassword === true,
      redirectUrl: data.mustChangePassword
      ? "./passwordChange.html"
      : "./index.html"
    };
  },

  getEmployees: async function (options) {
    options = options || {};
    var user = this.getCurrentUser();
    var requesterRole = resolveRequesterRole(user);
    var useCache = options.cache !== false;
    var shouldMergeAttendance = options.mergeAttendance !== false;
    var now = Date.now();
    if (useCache && authCache.employees && now - authCache.employeesAt < AUTH_CACHE_TTL) {
      var cachedEmployees = cloneAuthItems(authCache.employees);
      return filterSystemEmployees(shouldMergeAttendance ? await mergeAttendanceEmployees(cachedEmployees, requesterRole) : cachedEmployees);
    }

    var data = await API.get(AUTH_API_BASE + "/employees", { requesterRole: requesterRole }, { errorMessage: "직원 목록을 불러오지 못했습니다." });
    var employees = Array.isArray(data.items) ? data.items : [];
    authCache.employees = cloneAuthItems(employees);
    authCache.employeesAt = Date.now();
    return filterSystemEmployees(shouldMergeAttendance ? await mergeAttendanceEmployees(cloneAuthItems(employees), requesterRole) : cloneAuthItems(employees));
  },

  getOwnProfile: async function () {
    var user = this.getCurrentUser();
    if (!user || !user.id) throw new Error("로그인 정보가 없습니다.");

    var data = await API.get(AUTH_API_BASE + "/profile", { userId: user.id }, { errorMessage: "직원 정보를 불러오지 못했습니다." });
    if (!data.item) throw new Error(data.message || "직원 정보를 불러오지 못했습니다.");
    return data.item;
  },

  createEmployee: async function (payload) {
    var result = await postAuthJson("/employees", payload);
    clearAuthEmployeesCache();
    return result;
  },

  getDepartments: async function () {
    var user = this.getCurrentUser();
    var now = Date.now();
    if (authCache.departments && now - authCache.departmentsAt < AUTH_CACHE_TTL) {
      return authCache.departments.slice();
    }

    var data = await API.get(AUTH_API_BASE + "/departments", { requesterRole: resolveRequesterRole(user) }, { errorMessage: "부서 목록을 불러오지 못했습니다." });
    authCache.departments = Array.isArray(data.items) ? data.items.slice() : [];
    authCache.departmentsAt = Date.now();
    return authCache.departments.slice();
  },

  createDepartment: async function (name) {
    var result = await postAuthJson("/departments", { name: name });
    clearAuthDepartmentsCache();
    return result;
  },

  updateDepartment: async function (name, nextName) {
    var result = await postAuthJson("/departments/update", { name: name, nextName: nextName });
    clearAuthDepartmentsCache();
    clearAuthEmployeesCache();
    return result;
  },

  deleteDepartment: async function (name) {
    var result = await postAuthJson("/departments/delete", { name: name });
    clearAuthDepartmentsCache();
    clearAuthEmployeesCache();
    return result;
  },

  deleteEmployee: async function (id) {
    var result = await postAuthJson("/employees/delete", { id: id });
    clearAuthEmployeesCache();
    return result;
  },

  resetEmployeePassword: async function (id, password) {
    return await postAuthJson("/employees/reset-password", { id: id, password: password });
  },

  updateEmployeeBirthDate: async function (id, birthDate) {
    var result = await postAuthJson("/employees/update-birthdate", { id: id, birthDate: birthDate });
    clearAuthEmployeesCache();
    return result;
  },

  updateEmployeeHireDate: async function (id, hireDate) {
    var result = await postAuthJson("/employees/update-hire-date", { id: id, hireDate: hireDate });
    clearAuthEmployeesCache();
    return result;
  },

  updateEmployeeDepartment: async function (id, department) {
    var result = await postAuthJson("/employees/update-department", { id: id, department: department });
    clearAuthEmployeesCache();
    return result;
  },

  updateEmployeeProfile: async function (payload) {
    var result = await postAuthJson("/employees/update-profile", payload);
    clearAuthEmployeesCache();
    return result;
  },

  updateEmployeeSignature: async function (payload) {
    var result = await postAuthJson("/employees/update-signature", payload);
    clearAuthEmployeesCache();
    return result;
  },

  updateOwnProfile: async function (payload) {
    return await postAuthJson("/profile/update", payload);
  },

  changeOwnPassword: async function (userId, nextPassword) {
    var data = await API.post(
      AUTH_API_BASE + "/change-password",
      {
        userId: normalizeLoginId(userId),
        password: String(nextPassword || "").trim()
      },
      { errorMessage: "비밀번호를 변경하지 못했습니다." }
    );

    if (!data.item) throw new Error(data.message || "비밀번호를 변경하지 못했습니다.");

    updateSessionAfterPasswordChange(data.item);
    return data.item;
  },

  findPassword: async function (id, name, birthDate) {
    return await API.post(
      AUTH_API_BASE + "/find-password",
      {
        id: normalizeLoginId(id),
        name: String(name || "").trim(),
        birthDate: String(birthDate || "").trim()
      },
      { errorMessage: "임시 비밀번호를 발급하지 못했습니다." }
    );
  },

  logout: function () {
    AUTH_SESSION_KEYS.forEach(function (key) { localStorage.removeItem(key); });
  },

  getCurrentUser: function () {
    var userId = normalizeLoginId(localStorage.getItem("userId") || "");
    if (!userId) return null;

    return {
      id: userId,
      name: String(localStorage.getItem("userName") || "").trim(),
      role: normalizeRole(localStorage.getItem("userRole") || "staff"),
      email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
      department: String(localStorage.getItem("userDepartment") || "").trim(),
      mustChangePassword: String(localStorage.getItem("mustChangePassword") || "false") === "true"
    };
  },

  isAdmin: function () {
    var user = this.getCurrentUser();
    return isAdminUser(user);
  },

  isRepresentative: function () {
    var user = this.getCurrentUser();
    return isRepresentativeUser(user);
  },

  isExecutive: function () {
    var user = this.getCurrentUser();
    return isExecutiveUser(user);
  },

  canManageContent: function () {
    return this.isExecutive();
  },

  canAccessAdminPages: function () {
    return this.isAdmin() || this.isRepresentative();
  },

  canManageCompanyWideCalendar: function () {
    return this.isExecutive();
  },

  canReadAllTeamCalendars: function () {
    return this.isExecutive();
  },

  getRequesterRole: function () {
    return resolveRequesterRole(this.getCurrentUser());
  },

  isSystemAccount: function (value) {
    return isSystemAccountId(value);
  },

  isCurrentUserSystemAccount: function () {
    var user = this.getCurrentUser();
    return isSystemAccountId(user && user.id);
  }
};

function cloneAuthItems(items) {
  return (Array.isArray(items) ? items : []).map(function (item) {
    return Object.assign({}, item);
  });
}

function filterSystemEmployees(items) {
  return (Array.isArray(items) ? items : []).filter(function (item) {
    return !isSystemAccountId(item && item.id);
  });
}

function clearAuthEmployeesCache() {
  authCache.employees = null;
  authCache.employeesAt = 0;
}

function clearAuthDepartmentsCache() {
  authCache.departments = null;
  authCache.departmentsAt = 0;
}

async function login() {
  var id = document.getElementById("userId").value.trim();
  var pw = document.getElementById("userPw").value.trim();
  var msg = document.getElementById("loginMsg");
  var rememberUserId = document.getElementById("rememberUserId");

  msg.style.display = "none";

  if (!id || !pw) {
    msg.innerHTML = '<i class="xi-error"></i>아이디와 비밀번호를 입력해주세요.';
    msg.style.display = "block";
    return;
  }

  try {
    var result = await AuthStore.loginWithCredentials(id, pw);
    if (!result.success) {
      msg.innerHTML = '<i class="xi-error"></i>아이디 또는 비밀번호가 일치하지 않습니다. 다시 입력해주세요.';
      msg.style.display = "block";
      return;
    }

    updateRememberedUserId(id, !!(rememberUserId && rememberUserId.checked));

    if (result.mustChangePassword) {
      alert("임시 비밀번호로 로그인했습니다. 비밀번호를 변경해주세요.");
    }

    window.location.href = result.redirectUrl;
  } catch (error) {
    msg.innerHTML = '<i class="xi-error"></i>' + escapeHtml(error.message || "로그인 중 오류가 발생했습니다.");
    msg.style.display = "block";
  }
}

function logout() {
  AuthStore.logout();
  emitAuthSessionChanged("");
  window.location.href = "/login.html";
}

document.addEventListener("DOMContentLoaded", function () {
  var userId = document.getElementById("userId");
  var userPw = document.getElementById("userPw");
  var rememberUserId = document.getElementById("rememberUserId");

  applyRememberedUserId();

  function handleEnterLogin(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      login();
    }
  }

  if (userId) userId.addEventListener("keydown", handleEnterLogin);
  if (userPw) userPw.addEventListener("keydown", handleEnterLogin);
  if (rememberUserId) {
    rememberUserId.addEventListener("change", function () {
      if (!rememberUserId.checked) {
        localStorage.removeItem(REMEMBER_USER_ID_KEY);
      } else if (userId && userId.value.trim()) {
        localStorage.setItem(REMEMBER_USER_ID_KEY, normalizeLoginId(userId.value));
      }
    });
  }

  if (userId) {
    try {
      userId.focus({ preventScroll: true });
    } catch (error) {
      userId.focus();
    }
  }
});

function applyRememberedUserId() {
  var userId = document.getElementById("userId");
  var rememberUserId = document.getElementById("rememberUserId");
  var savedId = normalizeLoginId(localStorage.getItem(REMEMBER_USER_ID_KEY) || "");

  if (!userId || !rememberUserId || !savedId) return;

  userId.value = savedId;
  rememberUserId.checked = true;
}

function updateRememberedUserId(id, enabled) {
  if (!enabled) {
    localStorage.removeItem(REMEMBER_USER_ID_KEY);
    return;
  }

  localStorage.setItem(REMEMBER_USER_ID_KEY, normalizeLoginId(id));
}

function handleFindPassword() {
  window.location.href = "./findPassword.html";
}

async function postAuthJson(path, payload) {
  var user = AuthStore.getCurrentUser();
  var requestBody = Object.assign({}, payload || {}, {
    requesterId: user && user.id || "",
    requesterRole: resolveRequesterRole(user)
  });

  var data = await API.post(AUTH_API_BASE + path, requestBody, { errorMessage: "요청 처리 중 오류가 발생했습니다." });
  return data.item || data;
}

async function mergeAttendanceEmployees(employees, requesterRole) {
  if (requesterRole !== "admin") return employees;

  try {
    var data = await API.get(ATTENDANCE_API_BASE + "/admin/today", { requesterRole: "admin" }, { errorMessage: "근태 정보를 불러오지 못했습니다." });
    if (!Array.isArray(data.items)) return employees;

    var employeeMap = {};
    employees.forEach(function (employee) {
      var id = normalizeLoginId(employee && employee.id);
      if (id === "admin" || id === "jschoi") employee.role = "admin";
      if (id) employeeMap[id] = employee;
    });

    data.items.forEach(function (item) {
      var id = normalizeLoginId(item && item.id);
      if (!id || employeeMap[id]) return;
      employeeMap[id] = {
        id: id,
        name: item && item.name || id,
        email: id + "@autonecar.kr",
        birthDate: "",
        hireDate: "",
        department: item && item.department || "",
        position: "",
        jobGrade: "",
        mobilePhone: "",
        directPhone: "",
        employeeNumber: "",
        workHours: "",
        workSchedule: {},
        extraVacationDays: 0,
        role: id === "admin" || id === "jschoi" ? "admin" : "staff",
        isTempPassword: false
      };
    });

    return Object.keys(employeeMap).map(function (id) {
      return employeeMap[id];
    });
  } catch (error) {
    return employees;
  }
}

function applySession(employee, mustChangePassword) {
  localStorage.setItem("isLogin", "true");
  localStorage.setItem("userId", employee.id);
  localStorage.setItem("userName", employee.name);
  localStorage.setItem("userRole", employee.role);
  localStorage.setItem("userEmail", employee.email);
  localStorage.setItem("userDepartment", employee.department || "");
  localStorage.setItem("mustChangePassword", mustChangePassword === true || employee.isTempPassword ? "true" : "false");
  emitAuthSessionChanged(employee.id);
}

function updateSessionAfterPasswordChange(employee) {
  localStorage.setItem("userId", employee.id);
  localStorage.setItem("userName", employee.name);
  localStorage.setItem("userRole", employee.role);
  localStorage.setItem("userEmail", employee.email);
  localStorage.setItem("userDepartment", employee.department || "");
  localStorage.setItem("mustChangePassword", "false");
  emitAuthSessionChanged(employee.id);
}

function emitAuthSessionChanged(userId) {
  try {
    window.dispatchEvent(new CustomEvent("auth:updated", {
      detail: { userId: normalizeLoginId(userId || localStorage.getItem("userId") || "") }
    }));
  } catch (error) {}
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function isSystemAccountId(value) {
  return SYSTEM_ACCOUNT_IDS.indexOf(normalizeLoginId(value)) > -1;
}

function normalizeRole(value) {
  var role = String(value || "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "ceo") return "ceo";
  return "staff";
}

function isRepresentativeDepartment(value) {
  return String(value || "").trim() === "대표";
}

function isAdminUser(user) {
  return normalizeRole(user && user.role) === "admin";
}

function isRepresentativeUser(user) {
  var id = normalizeLoginId(user && user.id || "");
  var email = String(user && user.email || "").trim().toLowerCase();
  var name = String(user && user.name || "").trim();
  var role = normalizeRole(user && user.role);
  var department = String(user && user.department || "").trim();
  return id === "jschoi" || id === "ceo" || email === "jschoi@autonecar.kr" || name === "최재성" || role === "ceo" || isRepresentativeDepartment(department);
}

function isExecutiveUser(user) {
  return isAdminUser(user) || isRepresentativeUser(user);
}

function resolveRequesterRole(user) {
  if (isExecutiveUser(user)) {
    return "admin";
  }
  return user && user.role || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

window.AuthStore = AuthStore;
window.login = login;
window.logout = logout;
window.handleFindPassword = handleFindPassword;
