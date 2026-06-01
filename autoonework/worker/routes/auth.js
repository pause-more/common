export async function routeAuthRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleAuthLogin,
    handleGetEmployees,
    handleGetDepartments,
    handleCreateEmployee,
    handleCreateDepartment,
    handleUpdateDepartment,
    handleDeleteDepartment,
    handleDeleteEmployeeAccount,
    handleResetEmployeeAccountPassword,
    handleUpdateEmployeeBirthDate,
    handleUpdateEmployeeHireDate,
    handleUpdateEmployeeDepartment,
    handleUpdateEmployeeWorkHours,
    handleUpdateEmployeeProfile,
    handleUpdateEmployeeSignature,
    handleUpdateEmployeeExtraVacationDays,
    handleChangeOwnPassword,
    handleFindPassword,
    handleGetOwnProfile,
    handleUpdateOwnProfile,
    handleGroupwareDbTest,
    jsonResponse
  } = handlers;

  if (request.method === "POST" && path === "/api/auth/login") return await handleAuthLogin(request, env);
  if (request.method === "GET" && path === "/api/auth/employees") return await handleGetEmployees(url, env);
  if (request.method === "GET" && path === "/api/auth/departments") return await handleGetDepartments(url, env);
  if (request.method === "POST" && path === "/api/auth/employees") return await handleCreateEmployee(request, env);
  if (request.method === "POST" && path === "/api/auth/departments") return await handleCreateDepartment(request, env);
  if (request.method === "POST" && path === "/api/auth/departments/update") return await handleUpdateDepartment(request, env);
  if (request.method === "POST" && path === "/api/auth/departments/delete") return await handleDeleteDepartment(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/delete") return await handleDeleteEmployeeAccount(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/reset-password") return await handleResetEmployeeAccountPassword(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-birthdate") return await handleUpdateEmployeeBirthDate(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-hire-date") return await handleUpdateEmployeeHireDate(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-department") return await handleUpdateEmployeeDepartment(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-work-hours") return await handleUpdateEmployeeWorkHours(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-profile") return await handleUpdateEmployeeProfile(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-signature") return await handleUpdateEmployeeSignature(request, env);
  if (request.method === "POST" && path === "/api/auth/employees/update-extra-vacation-days") return await handleUpdateEmployeeExtraVacationDays(request, env);
  if (request.method === "POST" && path === "/api/auth/change-password") return await handleChangeOwnPassword(request, env);
  if (request.method === "POST" && path === "/api/auth/find-password") return await handleFindPassword(request, env);
  if (request.method === "GET" && path === "/api/auth/profile") return await handleGetOwnProfile(url, env);
  if (request.method === "POST" && path === "/api/auth/profile/update") return await handleUpdateOwnProfile(request, env);
  if (request.method === "GET" && path === "/api/auth/db-test") return await handleGroupwareDbTest(env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
