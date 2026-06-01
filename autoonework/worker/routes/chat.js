export async function routeChatRequest(context) {
  const { request, env, url, path, handlers } = context;
  const {
    handleGetChatContacts,
    handleGetChatRooms,
    handleChatWebSocket,
    handleChatUserWebSocket,
    handleGetOrCreateDirectChatRoom,
    handleGetOrCreateGroupChatRoom,
    handleUpdateChatRoomInfo,
    handleInviteChatRoomMembers,
    handleGetChatMessages,
    handleSendChatMessage,
    handleVoteChatPoll,
    handleDeleteChatMessage,
    handleChatAttachment,
    handleMarkChatRoomRead,
    handleLeaveChatRoom,
    jsonResponse
  } = handlers;

  if (request.method === "GET" && path === "/api/chat/contacts") return await handleGetChatContacts(url, env);
  if (request.method === "GET" && path === "/api/chat/rooms") return await handleGetChatRooms(url, env);
  if (request.method === "GET" && path === "/api/chat/ws") return await handleChatWebSocket(request, url, env);
  if (request.method === "GET" && path === "/api/chat/user-ws") return await handleChatUserWebSocket(request, url, env);
  if (request.method === "POST" && path === "/api/chat/rooms/direct") return await handleGetOrCreateDirectChatRoom(request, env);
  if (request.method === "POST" && path === "/api/chat/rooms/group") return await handleGetOrCreateGroupChatRoom(request, env);
  if (request.method === "POST" && path === "/api/chat/rooms/update") return await handleUpdateChatRoomInfo(request, env);
  if (request.method === "POST" && path === "/api/chat/rooms/invite") return await handleInviteChatRoomMembers(request, env);
  if (request.method === "GET" && path === "/api/chat/messages") return await handleGetChatMessages(url, env);
  if (request.method === "POST" && path === "/api/chat/messages/send") return await handleSendChatMessage(request, env);
  if (request.method === "POST" && path === "/api/chat/messages/poll-vote") return await handleVoteChatPoll(request, env);
  if (request.method === "POST" && path === "/api/chat/messages/delete") return await handleDeleteChatMessage(request, env);
  if (request.method === "GET" && path === "/api/chat/attachment") return await handleChatAttachment(url, env);
  if (request.method === "POST" && path === "/api/chat/rooms/read") return await handleMarkChatRoomRead(request, env);
  if (request.method === "POST" && path === "/api/chat/rooms/leave") return await handleLeaveChatRoom(request, env);

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}
