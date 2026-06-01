export async function routeCloudRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetCloudFiles,
    handleSaveCloudFiles,
    handleDeleteCloudFile,
    handleReadCloudFile,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/cloud/files") return await handleGetCloudFiles(url, env);
  if (request.method === "POST" && path === "/api/cloud/files/save") return await handleSaveCloudFiles(request, env);
  if (request.method === "POST" && path === "/api/cloud/files/delete") return await handleDeleteCloudFile(request, env);
  if (request.method === "GET" && path === "/api/cloud/file") return await handleReadCloudFile(url, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
