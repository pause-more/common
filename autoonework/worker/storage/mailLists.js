import { getList, setList } from "./kv.js";
import { stripHtml, splitEmails, normalizeEmail } from "../shared/utils.js";

export async function removeMailFromAllLists(env, ids) {
  for (const key of ["inbox_list", "sent_list", "my1_list", "my2_list", "my3_list", "trash_list", "spam_list"]) {
    let list = await getList(env, key);
    list = list.filter(function (row) { return ids.indexOf(String(row.id)) === -1; });
    await setList(env, key, list);
  }
}

export async function updateUnreadStateInList(env, key, ids, unread) {
  let list = await getList(env, key);
  let changed = false;
  list = list.map(function (row) {
    if (ids.indexOf(String(row.id)) > -1) {
      row.unread = unread;
      changed = true;
    }
    return row;
  });
  if (changed) await setList(env, key, list);
}

export async function updateStarStateInList(env, key, id, starred) {
  let list = await getList(env, key);
  let changed = false;
  list = list.map(function (row) {
    if (String(row.id) === String(id)) {
      row.starred = starred;
      changed = true;
    }
    return row;
  });
  if (changed) await setList(env, key, list);
}

export function listKeyByFolder(folder) {
  if (folder === "inbox") return "inbox_list";
  if (folder === "sent") return "sent_list";
  if (folder === "trash") return "trash_list";
  if (folder === "draft") return "draft_list";
  if (folder === "spam") return "spam_list";
  if (folder === "my1") return "my1_list";
  if (folder === "my2") return "my2_list";
  if (folder === "my3") return "my3_list";
  return folder + "_list";
}

export function toListItem(item) {
  return {
    id: item.id,
    to: item.to || "",
    from: item.from || "",
    from_name: item.from_name || "",
    subject: item.subject || "",
    snippet: item.snippet || stripHtml(item.body || "").slice(0, 120),
    date: item.date || new Date().toISOString(),
    unread: !!item.unread,
    starred: !!item.starred,
    folder: item.folder || "inbox",
    attachmentCount: Number(item.attachmentCount || 0),
    attachmentsMeta: Array.isArray(item.attachmentsMeta) ? item.attachmentsMeta : []
  };
}

export function toDraftListItem(item) {
  return {
    id: item.id,
    receiver: item.receiver || item.to || "",
    to: item.to || item.receiver || "",
    subject: item.subject || "",
    snippet: item.snippet || stripHtml(item.body || "").slice(0, 120),
    body: item.body || "",
    date: item.updated_at || item.date || new Date().toISOString(),
    folder: "draft",
    updated_at: item.updated_at || item.date || new Date().toISOString(),
    saved_by: item.saved_by || "manual",
    owner_email: item.owner_email || ""
  };
}

export function filterListForUser(list, key, userEmail) {
  if (!userEmail) return list.slice();

  return list.filter(function (row) {
    if (key === "sent_list") return normalizeEmail(row.from || "") === userEmail;
    if (key === "draft_list") return normalizeEmail(row.owner_email || row.from || "") === userEmail;
    if (key === "inbox_list" || key === "spam_list" || key === "trash_list" || key === "my1_list" || key === "my2_list" || key === "my3_list") {
      return splitEmails(row.to || "").indexOf(userEmail) > -1 || normalizeEmail(row.original_to || "") === userEmail;
    }
    return canUserViewMail(row, userEmail);
  });
}

export function canUserViewMail(row, userEmail) {
  if (!userEmail) return true;
  const from = normalizeEmail(row.from || "");
  const ownerEmail = normalizeEmail(row.owner_email || "");
  const toList = splitEmails(row.to || "");
  return from === userEmail || ownerEmail === userEmail || toList.indexOf(userEmail) > -1;
}
