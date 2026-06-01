export async function routeNotificationsRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetNotifications,
    handleGetNotificationCount,
    handleReadNotifications,
    handleReadAllNotifications,
    handleDeleteAllNotifications,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/notifications") return await handleGetNotifications(url, env);
  if (request.method === "GET" && path === "/api/notifications/count") return await handleGetNotificationCount(url, env);
  if (request.method === "POST" && path === "/api/notifications/read") return await handleReadNotifications(request, env);
  if (request.method === "POST" && path === "/api/notifications/read-all") return await handleReadAllNotifications(request, env);
  if (request.method === "POST" && path === "/api/notifications/delete-all") return await handleDeleteAllNotifications(request, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
