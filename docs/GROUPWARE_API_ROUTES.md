# Worker API 라우트 인벤토리

이 문서는 `worker.js`의 라우팅 조건을 기준으로 자동 생성한 API 목록이다.

재생성:

```bash
node scripts/generate-api-routes.mjs
```

## 요약

- 총 라우트: 93
- GET: 39
- POST: 54
- OPTIONS: CORS preflight 공통 처리

## 모듈화 후보

| Area | Routes | Suggested module |
| --- | ---: | --- |
| root | 2 | `worker/index.js` |
| approval | 7 | `worker/routes/approval.js` |
| attendance | 5 | `worker/routes/attendance.js` |
| auth | 20 | `worker/routes/auth.js` |
| board/news | 3 | `worker/routes/board-news.js` |
| board/resources | 3 | `worker/routes/board-resources.js` |
| board/teamboard | 3 | `worker/routes/board-teamboard.js` |
| calendar | 4 | `worker/routes/calendar.js` |
| chat | 13 | `worker/routes/chat.js` |
| cloud | 4 | `worker/routes/cloud.js` |
| mail | 24 | `worker/routes/mail.js` |
| notifications | 5 | `worker/routes/notifications.js` |

## 라우트 목록

| Area | Method | Path | Handler | Source | Line |
| --- | --- | --- | --- | --- | --- |
| root | GET | `/` | `jsonResponse` | `worker.js` | 117 |
| root | POST | `/` | `handleSendMail` | `worker.js` | 118 |
| approval | POST | `/api/approval/documents/save` | `handleSaveApprovalDocument` | `worker/routes/approval.js` | 14 |
| approval | POST | `/api/approval/documents/decision` | `handleApprovalDocumentDecision` | `worker/routes/approval.js` | 15 |
| approval | POST | `/api/approval/documents/delete` | `handleDeleteApprovalDocument` | `worker/routes/approval.js` | 16 |
| approval | GET | `/api/approval/employees` | `handleGetApprovalEmployees` | `worker/routes/approval.js` | 17 |
| approval | GET | `/api/approval/documents` | `handleGetApprovalDocuments` | `worker/routes/approval.js` | 18 |
| approval | GET | `/api/approval/documents/read` | `handleReadApprovalDocument` | `worker/routes/approval.js` | 19 |
| approval | GET | `/api/approval/attachment` | `handleApprovalAttachment` | `worker/routes/approval.js` | 20 |
| attendance | GET | `/api/attendance/my` | `handleGetOwnAttendance` | `worker/routes/attendance.js` | 12 |
| attendance | POST | `/api/attendance/check-in` | `handleAttendanceCheckIn` | `worker/routes/attendance.js` | 13 |
| attendance | POST | `/api/attendance/check-out` | `handleAttendanceCheckOut` | `worker/routes/attendance.js` | 14 |
| attendance | POST | `/api/attendance/special` | `handleAttendanceSpecial` | `worker/routes/attendance.js` | 15 |
| attendance | GET | `/api/attendance/admin/today` | `handleGetAdminAttendanceToday` | `worker/routes/attendance.js` | 16 |
| auth | POST | `/api/auth/login` | `handleAuthLogin` | `worker/routes/auth.js` | 27 |
| auth | GET | `/api/auth/employees` | `handleGetEmployees` | `worker/routes/auth.js` | 28 |
| auth | GET | `/api/auth/departments` | `handleGetDepartments` | `worker/routes/auth.js` | 29 |
| auth | POST | `/api/auth/employees` | `handleCreateEmployee` | `worker/routes/auth.js` | 30 |
| auth | POST | `/api/auth/departments` | `handleCreateDepartment` | `worker/routes/auth.js` | 31 |
| auth | POST | `/api/auth/departments/update` | `handleUpdateDepartment` | `worker/routes/auth.js` | 32 |
| auth | POST | `/api/auth/departments/delete` | `handleDeleteDepartment` | `worker/routes/auth.js` | 33 |
| auth | POST | `/api/auth/employees/delete` | `handleDeleteEmployeeAccount` | `worker/routes/auth.js` | 34 |
| auth | POST | `/api/auth/employees/reset-password` | `handleResetEmployeeAccountPassword` | `worker/routes/auth.js` | 35 |
| auth | POST | `/api/auth/employees/update-birthdate` | `handleUpdateEmployeeBirthDate` | `worker/routes/auth.js` | 36 |
| auth | POST | `/api/auth/employees/update-hire-date` | `handleUpdateEmployeeHireDate` | `worker/routes/auth.js` | 37 |
| auth | POST | `/api/auth/employees/update-department` | `handleUpdateEmployeeDepartment` | `worker/routes/auth.js` | 38 |
| auth | POST | `/api/auth/employees/update-work-hours` | `handleUpdateEmployeeWorkHours` | `worker/routes/auth.js` | 39 |
| auth | POST | `/api/auth/employees/update-profile` | `handleUpdateEmployeeProfile` | `worker/routes/auth.js` | 40 |
| auth | POST | `/api/auth/employees/update-extra-vacation-days` | `handleUpdateEmployeeExtraVacationDays` | `worker/routes/auth.js` | 41 |
| auth | POST | `/api/auth/change-password` | `handleChangeOwnPassword` | `worker/routes/auth.js` | 42 |
| auth | POST | `/api/auth/find-password` | `handleFindPassword` | `worker/routes/auth.js` | 43 |
| auth | GET | `/api/auth/profile` | `handleGetOwnProfile` | `worker/routes/auth.js` | 44 |
| auth | POST | `/api/auth/profile/update` | `handleUpdateOwnProfile` | `worker/routes/auth.js` | 45 |
| auth | GET | `/api/auth/db-test` | `handleGroupwareDbTest` | `worker/routes/auth.js` | 46 |
| board/news | GET | `/api/board/news` | `handleGetBoardNews` | `worker/routes/board.js` | 16 |
| board/news | POST | `/api/board/news/save` | `handleSaveBoardNews` | `worker/routes/board.js` | 17 |
| board/news | POST | `/api/board/news/delete` | `handleDeleteBoardNews` | `worker/routes/board.js` | 18 |
| board/resources | GET | `/api/board/resources` | `handleGetBoardResources` | `worker/routes/board.js` | 19 |
| board/resources | POST | `/api/board/resources/save` | `handleSaveBoardResources` | `worker/routes/board.js` | 20 |
| board/resources | POST | `/api/board/resources/delete` | `handleDeleteBoardResources` | `worker/routes/board.js` | 21 |
| board/teamboard | GET | `/api/board/teamboard` | `handleGetTeamboardPosts` | `worker/routes/board.js` | 22 |
| board/teamboard | POST | `/api/board/teamboard/save` | `handleSaveTeamboardPost` | `worker/routes/board.js` | 23 |
| board/teamboard | POST | `/api/board/teamboard/delete` | `handleDeleteTeamboardPost` | `worker/routes/board.js` | 24 |
| calendar | GET | `/api/calendar/shared` | `handleGetSharedCalendar` | `worker/routes/calendar.js` | 11 |
| calendar | GET | `/api/calendar/shared/birthdays` | `handleGetSharedCalendarBirthdays` | `worker/routes/calendar.js` | 12 |
| calendar | POST | `/api/calendar/shared/save` | `handleSaveSharedCalendarEvent` | `worker/routes/calendar.js` | 13 |
| calendar | POST | `/api/calendar/shared/delete` | `handleDeleteSharedCalendarEvent` | `worker/routes/calendar.js` | 14 |
| chat | GET | `/api/chat/contacts` | `handleGetChatContacts` | `worker/routes/chat.js` | 20 |
| chat | GET | `/api/chat/rooms` | `handleGetChatRooms` | `worker/routes/chat.js` | 21 |
| chat | GET | `/api/chat/ws` | `handleChatWebSocket` | `worker/routes/chat.js` | 22 |
| chat | POST | `/api/chat/rooms/direct` | `handleGetOrCreateDirectChatRoom` | `worker/routes/chat.js` | 23 |
| chat | POST | `/api/chat/rooms/group` | `handleGetOrCreateGroupChatRoom` | `worker/routes/chat.js` | 24 |
| chat | POST | `/api/chat/rooms/update` | `handleUpdateChatRoomInfo` | `worker/routes/chat.js` | 25 |
| chat | POST | `/api/chat/rooms/invite` | `handleInviteChatRoomMembers` | `worker/routes/chat.js` | 26 |
| chat | GET | `/api/chat/messages` | `handleGetChatMessages` | `worker/routes/chat.js` | 27 |
| chat | POST | `/api/chat/messages/send` | `handleSendChatMessage` | `worker/routes/chat.js` | 28 |
| chat | POST | `/api/chat/messages/delete` | `handleDeleteChatMessage` | `worker/routes/chat.js` | 29 |
| chat | GET | `/api/chat/attachment` | `handleChatAttachment` | `worker/routes/chat.js` | 30 |
| chat | POST | `/api/chat/rooms/read` | `handleMarkChatRoomRead` | `worker/routes/chat.js` | 31 |
| chat | POST | `/api/chat/rooms/leave` | `handleLeaveChatRoom` | `worker/routes/chat.js` | 32 |
| cloud | GET | `/api/cloud/files` | `handleGetCloudFiles` | `worker/routes/cloud.js` | 11 |
| cloud | POST | `/api/cloud/files/save` | `handleSaveCloudFiles` | `worker/routes/cloud.js` | 12 |
| cloud | POST | `/api/cloud/files/delete` | `handleDeleteCloudFile` | `worker/routes/cloud.js` | 13 |
| cloud | GET | `/api/cloud/file` | `handleReadCloudFile` | `worker/routes/cloud.js` | 14 |
| mail | POST | `/api/mail/inbound` | `handleInboundMail` | `worker/routes/mail.js` | 24 |
| mail | GET | `/api/mail/inbox` | `handleGetList` | `worker/routes/mail.js` | 26 |
| mail | GET | `/api/mail/sent` | `handleGetList` | `worker/routes/mail.js` | 27 |
| mail | GET | `/api/mail/trash` | `handleGetList` | `worker/routes/mail.js` | 28 |
| mail | GET | `/api/mail/draft` | `handleGetList` | `worker/routes/mail.js` | 29 |
| mail | GET | `/api/mail/spam` | `handleGetList` | `worker/routes/mail.js` | 30 |
| mail | GET | `/api/mail/all` | `handleGetAll` | `worker/routes/mail.js` | 31 |
| mail | GET | `/api/mail/my1` | `handleGetList` | `worker/routes/mail.js` | 32 |
| mail | GET | `/api/mail/my2` | `handleGetList` | `worker/routes/mail.js` | 33 |
| mail | GET | `/api/mail/my3` | `handleGetList` | `worker/routes/mail.js` | 34 |
| mail | GET | `/api/mail/counts` | `handleCounts` | `worker/routes/mail.js` | 35 |
| mail | GET | `/api/mail/read` | `handleReadMail` | `worker/routes/mail.js` | 37 |
| mail | GET | `/api/mail/draft/read` | `handleReadDraft` | `worker/routes/mail.js` | 38 |
| mail | GET | `/api/mail/attachment` | `handleAttachment` | `worker/routes/mail.js` | 39 |
| mail | POST | `/api/mail/draft/save` | `handleSaveDraft` | `worker/routes/mail.js` | 41 |
| mail | POST | `/api/mail/draft/delete` | `handleDeleteDraft` | `worker/routes/mail.js` | 42 |
| mail | POST | `/api/mail/delete` | `handleDeleteMail` | `worker/routes/mail.js` | 44 |
| mail | POST | `/api/mail/restore` | `handleRestore` | `worker/routes/mail.js` | 45 |
| mail | POST | `/api/mail/read-state` | `handleReadState` | `worker/routes/mail.js` | 46 |
| mail | POST | `/api/mail/star-state` | `handleStarState` | `worker/routes/mail.js` | 47 |
| mail | POST | `/api/mail/trash` | `handleTrash` | `worker/routes/mail.js` | 48 |
| mail | POST | `/api/mail/move` | `handleMove` | `worker/routes/mail.js` | 49 |
| mail | POST | `/api/mail/spam` | `handleSpam` | `worker/routes/mail.js` | 50 |
| mail | GET | `/api/mail/debug` | `handleDebug` | `worker/routes/mail.js` | 52 |
| notifications | GET | `/api/notifications` | `handleGetNotifications` | `worker/routes/notifications.js` | 12 |
| notifications | GET | `/api/notifications/count` | `handleGetNotificationCount` | `worker/routes/notifications.js` | 13 |
| notifications | POST | `/api/notifications/read` | `handleReadNotifications` | `worker/routes/notifications.js` | 14 |
| notifications | POST | `/api/notifications/read-all` | `handleReadAllNotifications` | `worker/routes/notifications.js` | 15 |
| notifications | POST | `/api/notifications/delete-all` | `handleDeleteAllNotifications` | `worker/routes/notifications.js` | 16 |
