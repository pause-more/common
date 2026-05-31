var API_BASE = getGroupwareApiBase("/api/mail");
var API = window.GroupwareApi;
var REPLY_QUOTED_HTML_KEY = "mailComposeQuotedHtml";
var SHARED_ATTACHMENTS_KEY = "gw-mail-share-attachments";
var currentMailItem = null;

document.addEventListener("DOMContentLoaded", function () {
  bindTopButtons();

  var params = new URLSearchParams(location.search);
  var id = params.get("id");
  var folder = params.get("folder") || "inbox";

  if (!id) return;

  if (folder !== "trash") {
    markAsRead(id, folder);
  }

  API.get(API_BASE + "/read", { id: id }, {
    errorMessage: "메일을 불러오지 못했습니다."
  })
    .then(function (data) {
      if (data.success && data.item) {
        currentMailItem = data.item;
        updateReadMode(folder);
        renderMail(data.item);
        bindStarButton(data.item);
      } else {
        alert("메일을 불러오지 못했습니다.");
      }
    })
    .catch(function (err) {
      console.error(err);
      alert("메일을 불러오는 중 오류가 발생했습니다.");
    });
});

function bindTopButtons() {
  var backBtn = document.querySelector(".backBtn");
  var replyBtn = document.querySelector(".replyBtn");
  var forwardBtn = document.querySelector(".forwardBtn");
  var deleteBtn = document.querySelector(".deleteBtn");
  var printBtn = document.querySelector(".printBtn");

  if (backBtn) backBtn.addEventListener("click", function () { goBackToList(); });
  if (replyBtn) replyBtn.addEventListener("click", function () { handleReplyButton(); });
  if (forwardBtn) forwardBtn.addEventListener("click", function () { handleForwardButton(); });
  if (deleteBtn) deleteBtn.addEventListener("click", function () { handleDeleteButton(); });
  if (printBtn) printBtn.addEventListener("click", function () { handlePrintButton(); });
}

function handlePrintButton() {
  var subject = getTextContent(".readSubject") || "(제목 없음)";
  var date = getTextContent(".readDate") || "-";
  var sender = getTextContent(".readSender") || "-";
  var receiver = getTextContent(".readReceiver") || "-";
  var bodyHtml = normalizeMailHtmlAssets(getInnerHtml(".readBody") || "", getMailAssetBaseOrigin());
  var attachmentHtml = buildPrintableAttachmentsHtml();
  var isDesktopApp = !!(window.groupwareDesktop && window.groupwareDesktop.isDesktopApp);
  var printHtml = buildPrintDocumentHtml({
    subject: subject,
    date: date,
    sender: sender,
    receiver: receiver,
    bodyHtml: bodyHtml,
    attachmentHtml: attachmentHtml
  }, {
    autoPrint: !isDesktopApp
  });

  if (isDesktopApp && window.groupwareDesktop && typeof window.groupwareDesktop.printMailHtml === "function") {
    window.groupwareDesktop.printMailHtml(printHtml).then(function (success) {
      if (!success) {
        alert("인쇄를 시작하지 못했습니다. 다시 시도해주세요.");
      }
    }).catch(function (error) {
      console.error(error);
      alert("인쇄를 시작하지 못했습니다. 다시 시도해주세요.");
    });
    return;
  }

  var printWindow = window.open("", "_blank", "width=960,height=820");

  if (!printWindow) {
    alert("인쇄 창을 열 수 없습니다. 팝업 차단 설정을 확인해주세요.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  printWindow.focus();
}

function getTextContent(selector) {
  var el = document.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

function getInnerHtml(selector) {
  var el = document.querySelector(selector);
  return el ? el.innerHTML : "";
}

function normalizeMailHtmlAssets(html, baseOrigin) {
  var value = String(html || "");
  if (!value) return value;
  var assetBase = String(baseOrigin || getMailAssetBaseOrigin() || location.origin || "").trim();

  var wrap = document.createElement("div");
  wrap.innerHTML = value;

  Array.prototype.slice.call(wrap.querySelectorAll("img, source, video, audio, iframe")).forEach(function (el) {
    ["src", "data-src", "poster"].forEach(function (attr) {
      if (!el.hasAttribute(attr)) return;
      var nextUrl = resolveMailAssetUrl(el.getAttribute(attr), assetBase);
      if (nextUrl) el.setAttribute(attr, nextUrl);
    });

    if (el.hasAttribute("srcset")) {
      el.setAttribute("srcset", normalizeSrcsetValue(el.getAttribute("srcset"), assetBase));
    }
  });

  Array.prototype.slice.call(wrap.querySelectorAll("a[href], link[href]")).forEach(function (el) {
    var nextHref = resolveMailAssetUrl(el.getAttribute("href"), assetBase);
    if (nextHref) el.setAttribute("href", nextHref);
  });

  Array.prototype.slice.call(wrap.querySelectorAll("[style]")).forEach(function (el) {
    var styleText = String(el.getAttribute("style") || "");
    var nextStyle = styleText.replace(/url\((['"]?)([^'")]+)\1\)/g, function (_match, quote, url) {
      return "url(" + resolveMailAssetUrl(url, assetBase) + ")";
    });
    el.setAttribute("style", nextStyle);
  });

  return wrap.innerHTML;
}

function normalizeSrcsetValue(srcset, baseOrigin) {
  return String(srcset || "").split(",").map(function (part) {
    var value = String(part || "").trim();
    if (!value) return "";
    var pieces = value.split(/\s+/);
    pieces[0] = resolveMailAssetUrl(pieces[0], baseOrigin);
    return pieces.join(" ");
  }).filter(Boolean).join(", ");
}

function resolveMailAssetUrl(url, baseOrigin) {
  var raw = String(url || "").trim();
  if (!raw) return raw;
  raw = normalizeRemoteMailAssetUrl(raw);
  if (/^(?:[a-z][a-z0-9+.-]*:|data:|blob:|cid:)/i.test(raw)) return raw;
  if (raw.indexOf("//") === 0) return "https:" + raw;

  var base = String(baseOrigin || getMailAssetBaseOrigin() || location.origin || "").trim();
  try {
    return new URL(raw, base).href;
  } catch (error) {
    return raw;
  }
}

function normalizeRemoteMailAssetUrl(url) {
  return String(url || "").replace(/^http:\/\/([a-z0-9.-]*hometax\.go\.kr)\//i, "https://$1/");
}

function getMailAssetBaseOrigin() {
  if (window.GroupwareConfig && typeof window.GroupwareConfig.getApiOrigin === "function") {
    return window.GroupwareConfig.getApiOrigin();
  }
  if (typeof getGroupwareApiOrigin === "function") {
    return getGroupwareApiOrigin();
  }
  return location.origin || "";
}

function buildPrintableAttachmentsHtml() {
  var attachWrap = document.querySelector(".readAttachments");
  var attachItems = attachWrap ? Array.prototype.slice.call(attachWrap.querySelectorAll(".attachItem")) : [];
  if (!attachItems.length) return "";

  var itemsHtml = attachItems.map(function (item) {
    var fileName = item.querySelector(".attachFileName");
    var fileSize = item.querySelector(".attachSize");
    var parts = [];
    if (fileName && fileName.textContent.trim()) parts.push('<span class="printAttachName">' + escapeHtml(fileName.textContent.trim()) + "</span>");
    if (fileSize && fileSize.textContent.trim()) parts.push('<span class="printAttachSize">' + escapeHtml(fileSize.textContent.trim()) + "</span>");
    return "<li>" + parts.join(" ") + "</li>";
  }).join("");

  return '<div class="printAttachWrap"><h4>첨부파일</h4><ul class="printAttachList">' + itemsHtml + "</ul></div>";
}

function buildPrintDocumentHtml(data, options) {
  var autoPrint = !options || options.autoPrint !== false;
  var baseHref = escapeHtml(getMailAssetBaseOrigin() || location.origin || "");
  var script = autoPrint ? '<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); setTimeout(function () { window.close(); }, 200); }, 120); });<\/script>' : "";
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><base href="' + baseHref + '"><title>' + escapeHtml(data.subject) + '</title><style>body { margin:0; background:#fff; color:#1b1b1b; font-family:"Apple SD Gothic Neo","Malgun Gothic",sans-serif; } .printMail { max-width:900px; margin:0 auto; padding:32px 28px 40px; box-sizing:border-box; } .printHead { border-bottom:1px solid #e5e7eb; padding-bottom:20px; margin-bottom:24px; } .printSubject { margin:0 0 14px; font-size:28px; line-height:1.35; font-weight:600; word-break:keep-all; } .printDate { margin:0 0 18px; font-size:13px; color:#666; } .printMeta { margin:0; } .printMetaRow { display:flex; gap:16px; margin:0 0 10px; font-size:14px; line-height:1.6; } .printMetaRow dt { width:72px; flex:0 0 72px; font-weight:600; } .printMetaRow dd { margin:0; flex:1; word-break:break-all; } .printAttachWrap { margin:0 0 24px; padding:18px 20px; border:1px solid #e5e7eb; border-radius:8px; } .printAttachWrap h4 { margin:0 0 12px; font-size:16px; } .printAttachList { margin:0; padding-left:18px; } .printAttachList li { margin:0 0 8px; font-size:14px; line-height:1.6; } .printAttachList li:last-child { margin-bottom:0; } .printAttachSize { color:#666; font-size:13px; } .printBody { font-size:14px; line-height:1.8; word-break:break-word; } .printBody img { max-width:100%; height:auto; } .printBody table { max-width:100% !important; width:auto !important; } @page { margin:16mm; }</style></head><body><div class="printMail"><div class="printHead"><h1 class="printSubject">' + escapeHtml(data.subject) + '</h1><p class="printDate">' + escapeHtml(data.date) + '</p><dl class="printMeta"><div class="printMetaRow"><dt>보낸사람</dt><dd>' + escapeHtml(data.sender) + '</dd></div><div class="printMetaRow"><dt>받는사람</dt><dd>' + escapeHtml(data.receiver) + '</dd></div></dl></div>' + data.attachmentHtml + '<div class="printBody">' + normalizeMailHtmlAssets(data.bodyHtml, getMailAssetBaseOrigin()) + '</div></div>' + script + '</body></html>';
}

function updateReadMode(folder) {
  var replyBtn = document.querySelector(".replyBtn");
  var forwardBtn = document.querySelector(".forwardBtn");
  var deleteBtn = document.querySelector(".deleteBtn");

  if (folder === "trash") {
    if (replyBtn) { replyBtn.textContent = "복원"; replyBtn.style.display = ""; }
    if (forwardBtn) { forwardBtn.style.display = "none"; }
    if (deleteBtn) { deleteBtn.textContent = "완전삭제"; }
    return;
  }

  if (replyBtn) { replyBtn.textContent = "답장"; replyBtn.style.display = ""; }
  if (forwardBtn) { forwardBtn.textContent = "전달"; forwardBtn.style.display = ""; }
  if (deleteBtn) { deleteBtn.textContent = "삭제"; }
}

function renderMail(mail) {
  var subjectEl = document.querySelector(".readSubject");
  var dateEl = document.querySelector(".readDate");
  var receiverEl = document.querySelector(".readReceiver");
  var senderEl = document.querySelector(".readSender");
  var bodyEl = document.querySelector(".readBody");

  if (subjectEl) subjectEl.innerText = mail.subject || "(제목 없음)";
  if (dateEl) dateEl.innerText = formatDate(mail.date);
  if (receiverEl) receiverEl.innerText = mail.to || "-";
  if (senderEl) senderEl.innerText = buildSenderText(mail);
  if (bodyEl) bodyEl.innerHTML = normalizeMailHtmlAssets(mail.body || "");

  renderAttachments(mail);
}

function renderAttachments(mail) {
  var bodyEl = document.querySelector(".readBody");
  if (!bodyEl) return;

  var existing = document.querySelector(".readAttachments");
  if (!existing) {
    existing = document.createElement("div");
    existing.className = "readAttachments";
    if (bodyEl.parentNode) {
      bodyEl.parentNode.insertBefore(existing, bodyEl);
    }
  }

  var meta = Array.isArray(mail.attachmentsMeta) ? mail.attachmentsMeta : [];
  var count = meta.length > 0 ? meta.length : Number(mail.attachmentCount || 0);

  if (!count) {
    existing.innerHTML = "";
    existing.style.display = "none";
    return;
  }

  //injectAttachmentStyles();

  var html = '';
  html += '<div class="readAttachHeader">';
  html += '<strong class="attachHeaderTitle">첨부파일 ' + count + '개</strong>';
  html += '<button type="button" class="attachAllDownloadBtn">모두저장</button>';
  html += '</div>';
  html += '<ul class="attachList">';

  if (meta.length) {
    meta.forEach(function (file, index) {
      var fileName = file.filename || ('첨부파일' + (index + 1));
      var sizeLabel = file.sizeLabel || (file.sizeBytes ? formatBytes(file.sizeBytes) : '');

      html += '<li class="attachItem" data-index="' + index + '">';
      html += '<button type="button" class="attachNameBtn" data-index="' + index + '">';
      html += buildAttachmentTypeIcon(fileName);
      html += '<span class="attachFileName">' + escapeHtml(fileName) + '</span>';
      if (sizeLabel) html += '<span class="attachSize">' + escapeHtml(sizeLabel) + '</span>';
      html += '</button>';
      html += '</li>';
    });
  } else {
    for (var i = 0; i < count; i++) {
      html += '<li class="attachItem" data-index="' + i + '">';
      html += '<button type="button" class="attachNameBtn" data-index="' + i + '">';
      html += buildAttachmentTypeIcon('file');
      html += '<span class="attachFileName">첨부파일 ' + (i + 1) + '</span>';
      html += '</button>';
      html += '</li>';
    }
  }

  html += '</ul>';
  existing.innerHTML = html;
  existing.style.display = "";

  bindAttachmentEvents(mail, existing);
}

function injectAttachmentStyles() {
  if (document.getElementById("readAttachmentUiStyle")) return;

  var style = document.createElement("style");
  style.id = "readAttachmentUiStyle";
  style.textContent = ""
    + ".readAttachments{margin-top:28px;padding-top:28px;border-top:1px solid #e5e5e5;}"
    + ".readAttachHeader{display:flex;align-items:center;gap:16px;margin-bottom:18px;}"
    + ".attachHeaderTitle{font-size:16px;font-weight:600;color:#1b1b1b;}"
    + ".attachAllDownloadBtn{border:0;background:none;color:#5978a8;font-size:14px;font-weight:500;cursor:pointer;padding:0;}"
    + ".attachList{display:flex;flex-direction:column;gap:18px;margin:0;padding:0;list-style:none;}"
    + ".attachItem{display:flex;align-items:center;}"
    + ".attachNameBtn{display:flex;align-items:center;gap:16px;border:0;background:none;padding:0;cursor:pointer;color:#1b1b1b;min-width:0;}"
    + ".attachTypeIcon{width:34px;height:34px;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;overflow:hidden;}"
    + ".attachTypeIcon img{display:block;width:100%;height:100%;object-fit:contain;}"
    + ".attachTypeIcon--img{background:#ea5b2c;}"
    + ".attachTypeIcon--xls{background:#0f9d58;}"
    + ".attachTypeIcon--pdf{background:#f44336;}"
    + ".attachTypeIcon--html{background:#20a5a8;}"
    + ".attachTypeIcon--file{background:#6b7280;}"
    + ".attachTypeIcon i{color:#fff;font-size:21px;line-height:1;}"
    + ".attachFileName{font-size:18px;font-weight:500;color:#252831;white-space:nowrap;}"
    + ".attachSize{font-size:18px;color:#8b8f99;white-space:nowrap;}"
    + ".attachNameBtn:hover .attachFileName,.attachAllDownloadBtn:hover{opacity:.8;}";
  document.head.appendChild(style);
}

function buildAttachmentTypeIcon(fileName) {
  var ext = getFileExtension(fileName);

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].indexOf(ext) > -1) {
    return '<span class="attachTypeIcon attachTypeIcon--img"><i class="ri-image-2-fill"></i></span>';
  }
  if (["xls", "xlsx", "csv"].indexOf(ext) > -1) {
    return '<span class="attachTypeIcon attachTypeIcon--xls"><i class="ri-file-excel-2-fill"></i></span>';
  }
  if (["pdf"].indexOf(ext) > -1) {
    return '<span class="attachTypeIcon attachTypeIcon--pdf"><i class="ri-file-pdf-2-fill"></i></span>';
  }
  if (["html", "htm"].indexOf(ext) > -1) {
    return '<span class="attachTypeIcon attachTypeIcon--html"><i class="ri-global-line"></i></span>';
  }

  return '<span class="attachTypeIcon attachTypeIcon--file"><img src="//ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/ico-attachment.png" alt=""></span>';
}

function getFileExtension(fileName) {
  var value = String(fileName || "").toLowerCase();
  var index = value.lastIndexOf(".");
  if (index < 0) return "";
  return value.slice(index + 1);
}

function bindAttachmentEvents(mail, wrap) {
  Array.prototype.slice.call(wrap.querySelectorAll(".attachNameBtn")).forEach(function (button) {
    button.addEventListener("click", function () {
      var index = Number(button.getAttribute("data-index") || 0);
      downloadAttachment(index);
    });
  });

  var allBtn = wrap.querySelector(".attachAllDownloadBtn");
  if (allBtn) {
    allBtn.addEventListener("click", function () {
      downloadAllAttachments(mail);
    });
  }
}

function buildAttachmentUrl(index, disposition) {
  var params = new URLSearchParams(location.search);
  var id = params.get("id") || "";
  return API_BASE + "/attachment?id=" + encodeURIComponent(id) + "&index=" + encodeURIComponent(index) + "&disposition=" + encodeURIComponent(disposition || "attachment");
}

function downloadAttachment(index) {
  window.open(buildAttachmentUrl(index, "attachment"), "_blank");
}

async function downloadAllAttachments(mail) {
  var meta = Array.isArray(mail.attachmentsMeta) ? mail.attachmentsMeta : [];
  var count = meta.length > 0 ? meta.length : Number(mail.attachmentCount || 0);
  if (!count) return;

  try {
    await ensureJsZip();
    var zip = new window.JSZip();

    for (var i = 0; i < count; i++) {
      var response = await fetch(buildAttachmentUrl(i, "attachment"));
      if (!response.ok) throw new Error("첨부파일 다운로드 실패");
      var blob = await response.blob();
      var filename = meta[i] && meta[i].filename ? meta[i].filename : ("첨부파일" + (i + 1));
      zip.file(filename, blob);
    }

    var zipBlob = await zip.generateAsync({ type: "blob" });
    triggerBlobDownload(zipBlob, buildZipFilename(mail));
  } catch (error) {
    console.error(error);
    alert("모두저장 중 오류가 발생했습니다.");
  }
}

function buildZipFilename(mail) {
  var base = String(mail && mail.subject || "attachments").replace(/[\\/:*?"<>|]+/g, "_").trim();
  if (!base) base = "attachments";
  return base + ".zip";
}

function triggerBlobDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function ensureJsZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);

  return new Promise(function (resolve, reject) {
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.onload = function () { resolve(window.JSZip); };
    script.onerror = function () { reject(new Error("JSZip 로드 실패")); };
    document.head.appendChild(script);
  });
}

function bindStarButton(mail) {
  var starBtn = document.querySelector(".mailStarBtn");
  if (!starBtn) return;

  renderStarButton(starBtn, !!mail.starred);

  starBtn.addEventListener("click", function (e) {
    e.preventDefault();

    var nextStarred = !mail.starred;

    API.post(API_BASE + "/star-state", {
        id: mail.id,
        starred: nextStarred
      }, {
        errorMessage: "별 상태 저장 실패"
    })
    .then(function (result) {
      if (!result || result.success !== true) {
        throw new Error(result && result.message ? result.message : "별 상태 저장 실패");
      }

      mail.starred = nextStarred;
      renderStarButton(starBtn, mail.starred);
    })
    .catch(function (err) {
      console.error(err);
      alert("별표 저장 중 오류가 발생했습니다.");
    });
  });
}

function renderStarButton(button, starred) {
  if (window.MailCommon && typeof window.MailCommon.updateStarButton === "function") {
    window.MailCommon.updateStarButton(button, starred);
    return;
  }
  button.classList.toggle("active", starred);
  var icon = button.querySelector("i");
  if (icon) icon.className = starred ? "ph-fill ph-star" : "ph ph-star";
}

function buildSenderText(mail) {
  var parsed = normalizeSenderParts(mail);
  if (parsed.name && parsed.email) return parsed.name + " <" + parsed.email + ">";
  return parsed.email || parsed.name || "-";
}

function normalizeSenderParts(mail) {
  var rawName = String(mail && mail.from_name || "").trim();
  var rawFrom = String(mail && mail.from || "").trim();

  var email = extractEmailOnly(rawFrom) || extractEmailOnly(rawName);
  var name = extractDisplayNameOnly(rawName) || extractDisplayNameOnly(rawFrom);

  if (!name && email) {
    name = "";
  }

  return {
    name: name,
    email: email
  };
}

function extractEmailOnly(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";

  var match = raw.match(/<([^>]+)>/);
  if (match && match[1]) {
    return String(match[1]).trim();
  }

  if (raw.indexOf("@") > -1 && raw.indexOf("<") === -1 && raw.indexOf(">") === -1) {
    return raw;
  }

  return "";
}

function extractDisplayNameOnly(value) {
  var raw = String(value || "").trim();
  if (!raw) return "";

  var match = raw.match(/^(.*)<[^>]+>$/);
  if (match && match[1]) {
    return String(match[1]).replace(/"/g, "").trim();
  }

  if (raw.indexOf("@") === -1) {
    return raw;
  }

  return "";
}

function formatDate(dateStr) {
  var d = new Date(dateStr);
  var yyyy = d.getFullYear();
  var mm = String(d.getMonth() + 1).padStart(2, "0");
  var dd = String(d.getDate()).padStart(2, "0");
  var hh = String(d.getHours()).padStart(2, "0");
  var mi = String(d.getMinutes()).padStart(2, "0");
  var days = ["일", "월", "화", "수", "목", "금", "토"];
  var day = days[d.getDay()];
  return yyyy + "-" + mm + "-" + dd + " (" + day + ") " + hh + ":" + mi;
}

function formatBytes(bytes) {
  var value = Number(bytes || 0);
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return Math.round(value / 1024) + " KB";
  return (value / (1024 * 1024)).toFixed(2) + " MB";
}

function goBackToList() {
  var params = new URLSearchParams(location.search);
  var folder = params.get("folder") || "inbox";

  if (folder === "trash") { location.href = "/mail/trash.html"; return; }
  if (folder === "sent") { location.href = "/mail/sent.html"; return; }
  location.href = "/mail/inbox.html";
}

function handleReplyButton() {
  var params = new URLSearchParams(location.search);
  var folder = params.get("folder") || "inbox";
  if (folder === "trash") { restoreMail(); return; }
  buildComposeLink("reply");
}

function handleForwardButton() {
  var params = new URLSearchParams(location.search);
  var folder = params.get("folder") || "inbox";
  if (folder === "trash") return;
  buildComposeLink("forward");
}

async function buildComposeLink(mode) {
  var subject = document.querySelector(".readSubject") ? document.querySelector(".readSubject").innerText.trim() : "";
  var date = document.querySelector(".readDate") ? document.querySelector(".readDate").innerText.trim() : "";
  var receiver = document.querySelector(".readReceiver") ? document.querySelector(".readReceiver").innerText.trim() : "";
  var senderText = document.querySelector(".readSender") ? document.querySelector(".readSender").innerText.trim() : "";
  var bodyHtml = document.querySelector(".readBody") ? document.querySelector(".readBody").innerHTML : "";

  var senderInfo = parseSender(senderText);
  var params = new URLSearchParams();
  params.set("mode", mode);

  if (mode === "reply") {
    params.set("to", senderInfo.email || "");
    params.set("subject", prefixSubject("Re:", subject));
  } else {
    params.set("to", "");
    params.set("subject", prefixSubject("Fwd:", subject));
  }

  try {
    sessionStorage.setItem(REPLY_QUOTED_HTML_KEY, buildQuotedHtml(senderText, receiver, subject, date, bodyHtml));
    if (mode === "forward") {
      storeForwardAttachments(currentMailItem);
    } else {
      sessionStorage.removeItem(SHARED_ATTACHMENTS_KEY);
    }
  } catch (error) {
    console.error("답장 원본 본문 저장 실패:", error);
  }
  location.href = "/mail/compose.html?" + params.toString();
}

function storeForwardAttachments(mail) {
  var items = buildForwardAttachmentPayload(mail);
  if (!items.length) {
    sessionStorage.removeItem(SHARED_ATTACHMENTS_KEY);
    return;
  }
  sessionStorage.setItem(SHARED_ATTACHMENTS_KEY, JSON.stringify(items));
}

function buildForwardAttachmentPayload(mail) {
  var meta = Array.isArray(mail && mail.attachmentsMeta) ? mail.attachmentsMeta : [];
  var count = meta.length > 0 ? meta.length : Number(mail && mail.attachmentCount || 0);
  if (!count) return [];

  var items = [];
  for (var index = 0; index < count; index += 1) {
    var file = meta[index] || {};
    items.push({
      name: String(file.filename || file.name || ("첨부파일" + (index + 1))).trim(),
      type: String(file.type || file.contentType || "application/octet-stream").trim(),
      size: Number(file.sizeBytes || file.size || 0),
      url: buildAttachmentUrl(index, "attachment")
    });
  }
  return items;
}

function prefixSubject(prefix, subject) {
  var value = subject || "";
  if (value.indexOf(prefix) === 0) return value;
  return prefix + " " + value;
}

function buildQuotedHtml(sender, receiver, subject, date, bodyHtml) {
  var html = "";
  html += '<div class="quotedMailBlock">';
  html += '<p></p>';
  html += '<p class="origin_msg">----- Original Message -----</p>';
  html += '<p><strong>From:</strong> ' + escapeHtml(sender || '-') + '</p>';
  html += '<p><strong>To:</strong> ' + escapeHtml(receiver || '-') + '</p>';
  html += '<p><strong>Date:</strong> ' + escapeHtml(date || '-') + '</p>';
  html += '<p><strong>Subject:</strong> ' + escapeHtml(subject || '-') + '</p>';
  html += '<div class="quotedBody">' + normalizeMailHtmlAssets(bodyHtml || '<p></p>') + '</div>';
  html += '</div>';
  return html;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseSender(senderText) {
  var match = senderText.match(/^(.*)<(.+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: "", email: senderText.trim() };
}

function handleDeleteButton() {
  var params = new URLSearchParams(location.search);
  var folder = params.get("folder") || "inbox";

  if (folder === "trash") {
    if (!confirm("이 메일을 완전히 삭제하시겠습니까?")) return;
    deleteMailForever();
    return;
  }

  if (!confirm("삭제하시겠습니까?")) return;
  moveMailToTrash();
}

function moveMailToTrash() {
  var urlParams = new URLSearchParams(location.search);
  var id = urlParams.get("id");
  var folder = urlParams.get("folder") || "inbox";

  API.post(API_BASE + "/trash", { ids: [id], folder: folder }, {
    errorMessage: "삭제 실패"
  })
  .then(function (data) {
    if (data.success) {
      showTrashMoveToast(1);
      goBackToList();
    } else {
      alert(data.message || "삭제 실패");
    }
  })
  .catch(function (err) {
    console.error(err);
    alert("오류 발생");
  });
}

function showTrashMoveToast(count) {
  var amount = Math.max(1, parseInt(count || "1", 10) || 1);
  var message = amount + "개의 메일을 휴지통으로 이동하였습니다.";
  if (window.MailCommon && typeof window.MailCommon.queueToast === "function") {
    window.MailCommon.queueToast(message);
    return;
  }
  if (window.MailCommon && typeof window.MailCommon.showTrashMoveToast === "function") {
    window.MailCommon.showTrashMoveToast(count);
    return;
  }
  alert("휴지통으로 이동되었습니다.");
}

function deleteMailForever() {
  var urlParams = new URLSearchParams(location.search);
  var id = urlParams.get("id");

  API.post(API_BASE + "/delete", { ids: [id] }, {
    errorMessage: "삭제 실패"
  })
  .then(function (data) {
    if (data.success) {
      alert("완전히 삭제되었습니다.");
      location.href = "/mail/trash.html";
    } else {
      alert(data.message || "삭제 실패");
    }
  })
  .catch(function (err) {
    console.error(err);
    alert("오류 발생");
  });
}

function restoreMail() {
  var urlParams = new URLSearchParams(location.search);
  var id = urlParams.get("id");

  API.post(API_BASE + "/restore", { ids: [id] }, {
    errorMessage: "복원 실패"
  })
  .then(function (data) {
    if (data.success) {
      alert("복원되었습니다.");
      location.href = "/mail/inbox.html";
    } else {
      alert(data.message || "복원 실패");
    }
  })
  .catch(function (err) {
    console.error(err);
    alert("오류 발생");
  });
}

function markAsRead(id, folder) {
  API.post(API_BASE + "/read-state", { ids: [id], unread: false, folder: folder || "inbox" }, {
    errorMessage: "읽음 상태 변경 실패"
  }).then(function () {
    if (window.WorkbenchMenuBadges && typeof window.WorkbenchMenuBadges.refresh === "function") {
      window.WorkbenchMenuBadges.refresh();
    }
  }).catch(function () {});
}
