export async function routeApprovalRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleSaveApprovalDocument,
    handleApprovalDocumentDecision,
    handleDeleteApprovalDocument,
    handleGetApprovalEmployees,
    handleGetApprovalDocuments,
    handleReadApprovalDocument,
    handleApprovalAttachment,
    jsonResponse
  } = handlers;

  if (request.method === "POST" && path === "/api/approval/documents/save") return await handleSaveApprovalDocument(request, env);
  if (request.method === "POST" && path === "/api/approval/documents/decision") return await handleApprovalDocumentDecision(request, env);
  if (request.method === "POST" && path === "/api/approval/documents/delete") return await handleDeleteApprovalDocument(request, env);
  if (request.method === "GET" && path === "/api/approval/employees") return await handleGetApprovalEmployees(url, env);
  if (request.method === "GET" && path === "/api/approval/documents") return await handleGetApprovalDocuments(url, env);
  if (request.method === "GET" && path === "/api/approval/documents/read") return await handleReadApprovalDocument(url, env);
  if (request.method === "GET" && path === "/api/approval/attachment") return await handleApprovalAttachment(url, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
