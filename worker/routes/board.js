export async function routeBoardRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetBoardNews,
    handleSaveBoardNews,
    handleDeleteBoardNews,
    handleGetBoardResources,
    handleSaveBoardResources,
    handleDeleteBoardResources,
    handleGetTeamboardPosts,
    handleSaveTeamboardPost,
    handleDeleteTeamboardPost,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/board/news") return await handleGetBoardNews(env);
  if (request.method === "POST" && path === "/api/board/news/save") return await handleSaveBoardNews(request, env);
  if (request.method === "POST" && path === "/api/board/news/delete") return await handleDeleteBoardNews(request, env);
  if (request.method === "GET" && path === "/api/board/resources") return await handleGetBoardResources(env);
  if (request.method === "POST" && path === "/api/board/resources/save") return await handleSaveBoardResources(request, env);
  if (request.method === "POST" && path === "/api/board/resources/delete") return await handleDeleteBoardResources(request, env);
  if (request.method === "GET" && path === "/api/board/teamboard") return await handleGetTeamboardPosts(url, env);
  if (request.method === "POST" && path === "/api/board/teamboard/save") return await handleSaveTeamboardPost(request, env);
  if (request.method === "POST" && path === "/api/board/teamboard/delete") return await handleDeleteTeamboardPost(request, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
