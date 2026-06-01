export async function routeMailRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleInboundMail,
    handleGetList,
    handleGetAll,
    handleCounts,
    handleReadMail,
    handleReadDraft,
    handleAttachment,
    handleSaveDraft,
    handleDeleteDraft,
    handleDeleteMail,
    handleRestore,
    handleReadState,
    handleStarState,
    handleTrash,
    handleMove,
    handleSpam,
    handleDebug,
    jsonResponse
  } = handlers;

  if (request.method === "POST" && path === "/api/mail/inbound") return await handleInboundMail(request, env);

  if (request.method === "GET" && path === "/api/mail/inbox") return await handleGetList(url, env, "inbox_list", true);
  if (request.method === "GET" && path === "/api/mail/sent") return await handleGetList(url, env, "sent_list");
  if (request.method === "GET" && path === "/api/mail/trash") return await handleGetList(url, env, "trash_list");
  if (request.method === "GET" && path === "/api/mail/draft") return await handleGetList(url, env, "draft_list");
  if (request.method === "GET" && path === "/api/mail/spam") return await handleGetList(url, env, "spam_list");
  if (request.method === "GET" && path === "/api/mail/all") return await handleGetAll(url, env);
  if (request.method === "GET" && path === "/api/mail/my1") return await handleGetList(url, env, "my1_list");
  if (request.method === "GET" && path === "/api/mail/my2") return await handleGetList(url, env, "my2_list");
  if (request.method === "GET" && path === "/api/mail/my3") return await handleGetList(url, env, "my3_list");
  if (request.method === "GET" && path === "/api/mail/counts") return await handleCounts(url, env);

  if (request.method === "GET" && path === "/api/mail/read") return await handleReadMail(url, env);
  if (request.method === "GET" && path === "/api/mail/draft/read") return await handleReadDraft(url, env);
  if (request.method === "GET" && path === "/api/mail/attachment") return await handleAttachment(url, env);

  if (request.method === "POST" && path === "/api/mail/draft/save") return await handleSaveDraft(request, env);
  if (request.method === "POST" && path === "/api/mail/draft/delete") return await handleDeleteDraft(request, env);

  if (request.method === "POST" && path === "/api/mail/delete") return await handleDeleteMail(request, env);
  if (request.method === "POST" && path === "/api/mail/restore") return await handleRestore(request, env);
  if (request.method === "POST" && path === "/api/mail/read-state") return await handleReadState(request, env);
  if (request.method === "POST" && path === "/api/mail/star-state") return await handleStarState(request, env);
  if (request.method === "POST" && path === "/api/mail/trash") return await handleTrash(request, env);
  if (request.method === "POST" && path === "/api/mail/move") return await handleMove(request, env);
  if (request.method === "POST" && path === "/api/mail/spam") return await handleSpam(request, env);

  if (request.method === "GET" && path === "/api/mail/debug") return await handleDebug(env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
