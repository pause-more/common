export async function routeAttendanceRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetOwnAttendance,
    handleAttendanceCheckIn,
    handleAttendanceCheckOut,
    handleAttendanceSpecial,
    handleGetAdminAttendanceToday,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/attendance/my") return await handleGetOwnAttendance(url, env);
  if (request.method === "POST" && path === "/api/attendance/check-in") return await handleAttendanceCheckIn(request, env);
  if (request.method === "POST" && path === "/api/attendance/check-out") return await handleAttendanceCheckOut(request, env);
  if (request.method === "POST" && path === "/api/attendance/special") return await handleAttendanceSpecial(request, env);
  if (request.method === "GET" && path === "/api/attendance/admin/today") return await handleGetAdminAttendanceToday(url, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
