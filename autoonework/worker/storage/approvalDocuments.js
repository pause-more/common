import { normalizeEmail, normalizeDepartmentName, normalizeLoginId, padAttendanceValue } from "../shared/utils.js";

export async function getApprovalDocumentList(env) {
  const raw = await env.MAIL_KV.get("approval:documents");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export async function setApprovalDocumentList(env, documents) {
  await env.MAIL_KV.put("approval:documents", JSON.stringify(Array.isArray(documents) ? documents : []));
}

export async function upsertApprovalDocumentSummary(env, item) {
  const list = await getApprovalDocumentList(env);
  const summary = toApprovalListItem(item);
  const index = list.findIndex(function (row) { return row.id === summary.id; });
  if (index > -1) {
    list[index] = summary;
  } else {
    list.unshift(summary);
  }
  await setApprovalDocumentList(env, list);
}

export function toApprovalListItem(item) {
  return {
    id: item.id || "",
    docNo: item.docNo || "",
    docType: item.docType || "",
    title: item.title || "",
    status: normalizeApprovalStatus(item.status || "draft"),
    authorId: item.authorId || "",
    authorName: item.authorName || "",
    authorEmail: item.authorEmail || "",
    department: item.department || "",
    firstApprover: item.firstApprover || "미지정",
    approvers: normalizeApprovalPersonList(item.approvers),
    approverIds: normalizeApprovalStringList(item.approverIds),
    approverDepartments: normalizeApprovalStringList(item.approverDepartments),
    approverSignatureImages: normalizeApprovalSignatureList(item.approverSignatureImages),
    referenceUser: item.referenceUser || "미지정",
    referenceUsers: normalizeApprovalPersonList(item.referenceUsers),
    referenceUserIds: normalizeApprovalStringList(item.referenceUserIds),
    referenceUserDepartments: normalizeApprovalStringList(item.referenceUserDepartments),
    fileNames: normalizeApprovalStringList(item.fileNames),
    attachmentCount: Array.isArray(item.attachmentsData) ? item.attachmentsData.length : normalizeApprovalStringList(item.fileNames).length,
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    submittedAt: item.submittedAt || "",
    decidedAt: item.decidedAt || "",
    decisionById: item.decisionById || "",
    decisionByName: item.decisionByName || "",
    decisionReason: item.decisionReason || "",
    approvedAt: item.approvedAt || "",
    rejectedAt: item.rejectedAt || ""
  };
}

export function enrichApprovalPersonDepartments(item, employees) {
  const next = Object.assign({}, item || {});
  next.approverDepartments = buildApprovalDepartments(next.approvers, next.approverIds, next.approverDepartments, employees);
  next.referenceUserDepartments = buildApprovalDepartments(next.referenceUsers, next.referenceUserIds, next.referenceUserDepartments, employees);
  return next;
}

export function buildApprovalDepartments(names, ids, savedDepartments, employees) {
  const personNames = normalizeApprovalPersonList(names);
  const personIds = normalizeApprovalStringList(ids);
  const departments = normalizeApprovalStringList(savedDepartments);
  const employeeList = Array.isArray(employees) ? employees : [];
  return personNames.map(function (name, index) {
    if (departments[index]) return departments[index];
    const id = personIds[index] || "";
    const matched = employeeList.find(function (employee) {
      return (id && employee.id === id) || (name && String(employee.name || "").trim() === name);
    });
    return matched ? normalizeDepartmentName(matched.department || "") : "";
  });
}

export function sanitizeApprovalDocument(item) {
  return {
    id: item.id || "",
    docNo: item.docNo || "",
    docType: normalizeApprovalDocTypeServer(item.docType || ""),
    title: String(item.title || "").trim(),
    proposalContent: String(item.proposalContent || ""),
    body: String(item.body || ""),
    writeDate: String(item.writeDate || ""),
    department: normalizeDepartmentName(item.department || ""),
    authorId: normalizeLoginId(item.authorId || ""),
    authorName: String(item.authorName || "").trim(),
    authorEmail: normalizeEmail(item.authorEmail || ""),
    status: normalizeApprovalStatus(item.status || "draft"),
    paymentRequestDate: String(item.paymentRequestDate || ""),
    assetUser: String(item.assetUser || ""),
    assetName: String(item.assetName || ""),
    expenseItems: Array.isArray(item.expenseItems) ? item.expenseItems : [],
    resolutionItems: Array.isArray(item.resolutionItems) ? item.resolutionItems : [],
    assetItems: Array.isArray(item.assetItems) ? item.assetItems : [],
    certificateInfo: item.certificateInfo && typeof item.certificateInfo === "object" ? item.certificateInfo : {},
    tripInfo: item.tripInfo && typeof item.tripInfo === "object" ? item.tripInfo : {},
    vacationInfo: item.vacationInfo && typeof item.vacationInfo === "object" ? item.vacationInfo : {},
    firstApprover: String(item.firstApprover || "미지정").trim() || "미지정",
    approvers: normalizeApprovalPersonList(item.approvers),
    approverIds: normalizeApprovalStringList(item.approverIds),
    approverDepartments: normalizeApprovalStringList(item.approverDepartments),
    approverSignatureImages: normalizeApprovalSignatureList(item.approverSignatureImages),
    referenceUser: String(item.referenceUser || "미지정").trim() || "미지정",
    referenceUsers: normalizeApprovalPersonList(item.referenceUsers),
    referenceUserIds: normalizeApprovalStringList(item.referenceUserIds),
    referenceUserDepartments: normalizeApprovalStringList(item.referenceUserDepartments),
    fileNames: normalizeApprovalStringList(item.fileNames),
    attachmentsData: normalizeApprovalAttachments(item.attachmentsData),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
    submittedAt: item.submittedAt || "",
    decidedAt: item.decidedAt || "",
    decisionById: item.decisionById || "",
    decisionByName: item.decisionByName || "",
    decisionReason: item.decisionReason || "",
    approvedAt: item.approvedAt || "",
    rejectedAt: item.rejectedAt || ""
  };
}

export function normalizeApprovalStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "pending" || status === "approved" || status === "rejected") return status;
  return "draft";
}

export function normalizeApprovalDocTypeServer(value) {
  const normalized = String(value || "").trim();
  if (normalized === "연차휴가 계획서") return "휴가원";
  return normalized || "지출품의서";
}

export function normalizeApprovalDocNo(value) {
  const normalized = String(value || "").trim();
  return /^[0-9]{12}-[0-9]{6}$/.test(normalized) ? normalized : "";
}

export function normalizeApprovalDocumentId(value) {
  return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
}

export function buildApprovalDocumentId(docNo) {
  return "approval_" + String(docNo || Date.now()).replace(/[^0-9A-Za-z_-]/g, "_");
}

export function findApprovalDocumentIdByDocNo(documents, docNo) {
  const found = (Array.isArray(documents) ? documents : []).find(function (item) {
    return item && item.docNo === docNo;
  });
  return found && found.id ? found.id : "";
}

export function buildApprovalServerDocNo(documents) {
  const prefix = buildApprovalServerDocNoPrefix(new Date());
  const maxNumber = (Array.isArray(documents) ? documents : []).reduce(function (max, item) {
    const match = String(item && item.docNo || "").match(new RegExp("^" + prefix + "-([0-9]{6})$"));
    return match ? Math.max(max, Number(match[1] || 0)) : max;
  }, 0);
  return prefix + "-" + String(maxNumber + 1).padStart(6, "0");
}

export function buildApprovalServerDocNoPrefix(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return String(kst.getUTCFullYear()) + padAttendanceValue(kst.getUTCMonth() + 1) + padAttendanceValue(kst.getUTCDate()) + padAttendanceValue(kst.getUTCHours()) + padAttendanceValue(kst.getUTCMinutes());
}

export function normalizeApprovalStringList(value) {
  if (Array.isArray(value)) return value.map(function (item) {
    if (item && typeof item === "object") return String(item.id || item.name || "").trim();
    return String(item || "").trim();
  }).filter(Boolean);
  return String(value || "").split(",").map(function (item) { return item.trim(); }).filter(Boolean);
}

export function normalizeApprovalPersonList(value) {
  return normalizeApprovalStringList(value);
}

export function normalizeApprovalSignatureList(value) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return list.map(function (item) {
    const signature = String(item || "").trim();
    return /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=\s]+$/.test(signature) ? signature : "";
  });
}

export function normalizeApprovalAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map(function (item) {
    if (!item || typeof item !== "object") return null;
    const filename = String(item.filename || item.name || "").trim();
    const content = String(item.content || "").trim();
    if (!filename && !content) return null;
    return {
      filename: filename || "첨부파일",
      type: String(item.type || "application/octet-stream").trim() || "application/octet-stream",
      sizeBytes: Number(item.sizeBytes || item.size || 0) || 0,
      content: content
    };
  }).filter(Boolean);
}
