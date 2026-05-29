import { normalizeApprovalStringList } from "../storage/approvalDocuments.js";
import { createUserNotification } from "../storage/notifications.js";
import { normalizeDepartmentName, normalizeLoginId } from "../shared/utils.js";
import { isChatAdminEmployee } from "../storage/chat.js";
import { sendUserNotificationPush } from "./webPush.js";

export async function createNotificationsForUsers(env, userIds, payload) {
  const targets = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map(function (item) {
    return normalizeLoginId(item);
  }).filter(Boolean)));
  for (const userId of targets) {
    const notification = await createUserNotification(env, {
      ...payload,
      userId: userId
    });
    if (notification) {
      await sendUserNotificationPush(env, userId, notification);
    }
  }
}

export async function createApprovalSubmittedNotifications(env, item) {
  const authorId = normalizeLoginId(item && item.authorId || "");
  const authorName = String(item && item.authorName || authorId || "직원").trim() || "직원";
  const docType = String(item && item.docType || "결재 문서").trim() || "결재 문서";
  const title = String(item && item.title || docType).trim() || docType;
  const link = "/approval/detail.html?id=" + encodeURIComponent(String(item && item.id || "")) + "&from=pending";
  const approverIds = normalizeApprovalStringList(item && item.approverIds).filter(function (userId) {
    return userId !== authorId;
  });
  const referenceUserIds = normalizeApprovalStringList(item && item.referenceUserIds).filter(function (userId) {
    return userId !== authorId;
  });

  await createNotificationsForUsers(env, approverIds, {
    type: "approval_pending",
    actorName: authorName,
    actionLabel: "새 결재문서",
    menuLabel: "전자결재",
    docLabel: docType,
    docId: String(item && item.id || ""),
    title: "새 전자결재 문서 알림",
    body: "1개의 " + docType + " 문서가 결재 대기함에 도착했습니다.",
    link: link
  });

  await createNotificationsForUsers(env, referenceUserIds, {
    type: "approval_reference",
    actorName: authorName,
    actionLabel: "참조 문서",
    menuLabel: "전자결재",
    docLabel: docType,
    docId: String(item && item.id || ""),
    title: "[" + docType + "] 참조 문서 도착",
    body: authorName + "님이 1개의 참조 문서를 공유하였습니다.",
    link: link
  });
}

export async function createTeamboardPostNotifications(context, post) {
  const { env, getPrimaryEmployeeList } = context;
  const authorId = normalizeLoginId(post && post.authorId || "");
  const authorName = String(post && post.authorName || authorId || "팀원").trim() || "팀원";
  const department = normalizeDepartmentName(post && post.department || "");
  if (!authorId || !department) return;
  const employees = await getPrimaryEmployeeList(env);
  const targetIds = employees.filter(function (employee) {
    return normalizeLoginId(employee && employee.id || "") !== authorId &&
      normalizeDepartmentName(employee && employee.department || "") === department &&
      !isChatAdminEmployee(employee);
  }).map(function (employee) {
    return normalizeLoginId(employee && employee.id || "");
  });
  await createNotificationsForUsers(env, targetIds, {
    type: "teamboard_post",
    actorName: authorName,
    actionLabel: "새 팀 글",
    menuLabel: "팀 보드",
    docLabel: department,
    docId: String(post && post.id || ""),
    title: authorName + "님이 팀 보드에 새 글을 작성했습니다.",
    body: "팀 보드 · " + String(post && post.title || "").trim(),
    link: "/board/teamboard.html?postId=" + encodeURIComponent(String(post && post.id || ""))
  });
}

export async function createApprovalDecisionNotification(env, item, decision) {
  const authorId = normalizeLoginId(item && item.authorId || "");
  if (!authorId) return;
  const docType = String(item && item.docType || "결재 문서").trim() || "결재 문서";
  const title = String(item && item.title || docType).trim() || docType;
  const decisionText = String(decision || "").trim().toLowerCase() === "approved" ? "승인" : "반려";
  const link = "/approval/detail.html?id=" + encodeURIComponent(String(item && item.id || "")) + "&from=dashboard";
  const notification = await createUserNotification(env, {
    userId: authorId,
    type: decisionText === "승인" ? "approval_approved" : "approval_rejected",
    actorName: String(item && item.decisionByName || "").trim(),
    actionLabel: decisionText === "승인" ? "승인 완료" : "반려",
    menuLabel: "전자결재",
    docLabel: docType,
    docId: String(item && item.id || ""),
    title: decisionText === "승인" ? "[" + docType + "] 승인 완료 알림" : "[" + docType + "] 반려 알림",
    body: decisionText === "승인" ? "상신한 기안에 대한 승인이 완료되었습니다." : "상신한 기안이 반려되었습니다. 반려 사유를 확인하세요.",
    link: link
  });
  if (notification) {
    await sendUserNotificationPush(env, authorId, notification);
  }
}
