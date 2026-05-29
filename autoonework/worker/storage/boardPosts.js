export async function getBoardNews(env) {
  const raw = await env.MAIL_KV.get("board:news");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.map(sanitizeBoardNewsPost).filter(function (item) {
    return !!(item && item.id && item.title) && String(item.id || "") !== "news_seed_1";
  }) : [];
}

export async function setBoardNews(env, items) {
  const normalized = (Array.isArray(items) ? items : []).map(sanitizeBoardNewsPost).filter(function (item) {
    return !!(item && item.id && item.title) && String(item.id || "") !== "news_seed_1";
  });
  normalized.sort(function (a, b) {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
  });
  await env.MAIL_KV.put("board:news", JSON.stringify(normalized));
}

export async function getBoardResources(env) {
  const raw = await env.MAIL_KV.get("board:resources");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.map(sanitizeBoardResourceItem).filter(function (item) {
    return !!(item && item.id && item.name && item.dataUrl);
  }) : [];
}

export async function setBoardResources(env, items) {
  const normalized = (Array.isArray(items) ? items : []).map(sanitizeBoardResourceItem).filter(function (item) {
    return !!(item && item.id && item.name && item.dataUrl);
  });
  normalized.sort(function (a, b) {
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  await env.MAIL_KV.put("board:resources", JSON.stringify(normalized));
}

export async function getTeamboardPosts(env) {
  const raw = await env.MAIL_KV.get("board:teamboard");
  const parsed = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.map(sanitizeTeamboardPost).filter(function (item) {
    return !!(item && item.id && item.title && item.department);
  }) : [];
}

export async function setTeamboardPosts(env, items) {
  const normalized = (Array.isArray(items) ? items : []).map(sanitizeTeamboardPost).filter(function (item) {
    return !!(item && item.id && item.title && item.department);
  });
  normalized.sort(function (a, b) {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
  });
  await env.MAIL_KV.put("board:teamboard", JSON.stringify(normalized));
}

export async function ensureBoardSeed(env) {
  const newsRaw = await env.MAIL_KV.get("board:news");
  const newsParsed = newsRaw ? JSON.parse(newsRaw) : [];
  if (!Array.isArray(newsParsed) || !newsParsed.length) {
    await env.MAIL_KV.put("board:news", JSON.stringify([]));
  }

  const resourcesRaw = await env.MAIL_KV.get("board:resources");
  const resourcesParsed = resourcesRaw ? JSON.parse(resourcesRaw) : [];
  if (!Array.isArray(resourcesParsed)) {
    await env.MAIL_KV.put("board:resources", JSON.stringify([]));
  }
}

export function sanitizeBoardNewsPost(item) {
  item = item || {};
  return {
    id: String(item.id || ("news_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_"),
    title: String(item.title || "").trim(),
    body: String(item.body || "").trim(),
    pinned: item.pinned === true,
    attachments: sanitizeBoardAttachments(item.attachments),
    authorId: normalizeLoginId(item.authorId || ""),
    authorName: String(item.authorName || "").trim(),
    authorDepartment: normalizeDepartmentName(item.authorDepartment || ""),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
    views: Number(item.views || 0)
  };
}

export function sanitizeTeamboardPost(item) {
  item = item || {};
  return {
    id: String(item.id || ("teamboard_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_"),
    title: String(item.title || "").trim(),
    body: String(item.body || "").trim(),
    pinned: item.pinned === true,
    attachments: sanitizeBoardAttachments(item.attachments),
    comments: sanitizeTeamboardComments(item.comments),
    department: normalizeDepartmentName(item.department || ""),
    authorId: normalizeLoginId(item.authorId || ""),
    authorName: String(item.authorName || "").trim(),
    authorDepartment: normalizeDepartmentName(item.authorDepartment || ""),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
    views: Number(item.views || 0),
    reactions: sanitizeTeamboardReactions(item.reactions)
  };
}

export function sanitizeBoardResourceItem(item) {
  item = item || {};
  return {
    id: String(item.id || ("resource_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_"),
    title: String(item.title || "").trim(),
    name: String(item.name || "").trim(),
    size: Number(item.size || 0),
    type: String(item.type || "").trim(),
    dataUrl: String(item.dataUrl || "").trim(),
    category: normalizeBoardResourceCategory(item.category || ""),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
    authorId: normalizeLoginId(item.authorId || ""),
    authorName: String(item.authorName || "").trim(),
    authorDepartment: normalizeDepartmentName(item.authorDepartment || "")
  };
}

function sanitizeBoardAttachments(items) {
  return (Array.isArray(items) ? items : []).map(function (item) {
    item = item || {};
    if (typeof item === "string") {
      return { name: String(item).trim(), type: "", size: 0, dataUrl: "" };
    }
    return {
      name: String(item.name || "").trim(),
      type: String(item.type || "").trim(),
      size: Number(item.size || 0),
      dataUrl: String(item.dataUrl || "").trim()
    };
  }).filter(function (item) {
    return !!item.name;
  });
}

function sanitizeTeamboardComments(items) {
  return (Array.isArray(items) ? items : []).map(function (item) {
    item = item || {};
    return {
      id: String(item.id || ("comment_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8))).replace(/[^0-9A-Za-z_-]/g, "_"),
      body: String(item.body || "").trim(),
      authorId: normalizeLoginId(item.authorId || ""),
      authorName: String(item.authorName || "").trim(),
      authorDepartment: normalizeDepartmentName(item.authorDepartment || ""),
      createdAt: String(item.createdAt || new Date().toISOString())
    };
  }).filter(function (item) {
    return !!item.body;
  });
}

function sanitizeTeamboardReactions(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = {};
  ["comm_1", "comm_2", "comm_3", "comm_4", "comm_5"].forEach(function (key) {
    const users = Array.isArray(source[key]) ? source[key] : [];
    normalized[key] = Array.from(new Set(users.map(normalizeLoginId).filter(Boolean)));
  });
  return normalized;
}

function normalizeBoardResourceCategory(value) {
  const category = String(value || "").trim();
  if (category === "소개자료" || category === "디자인" || category === "내부 서식" || category === "매뉴얼" || category === "계약자료") {
    return category;
  }
  return category === "기타" ? "기타" : "기타";
}

function normalizeLoginId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDepartmentName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
