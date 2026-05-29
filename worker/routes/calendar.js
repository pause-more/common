export async function routeCalendarRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetSharedCalendar,
    handleGetSharedCalendarBirthdays,
    handleSaveSharedCalendarEvent,
    handleDeleteSharedCalendarEvent,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/calendar/shared") return await handleGetSharedCalendar(env);
  if (request.method === "GET" && path === "/api/calendar/shared/birthdays") return await handleGetSharedCalendarBirthdays(url, env);
  if (request.method === "POST" && path === "/api/calendar/shared/save") return await handleSaveSharedCalendarEvent(request, env);
  if (request.method === "POST" && path === "/api/calendar/shared/delete") return await handleDeleteSharedCalendarEvent(request, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
