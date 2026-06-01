(function () {
  var API_BASE = getGroupwareApiBase("/api/mail");
  var API = window.GroupwareApi;

  var mailState = {
    mails: [],
    filteredMails: [],
    keyword: "",
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  };

  var elements = {
    listWrap: null,
    searchInput: null,
    refreshBtn: null,
    allCheck: null,
    deleteBtn: null,
    unreadBtn: null,
    moveAction: null,
    moveBtn: null,
    moveDropdown: null,
    moveItems: [],
    unreadCount: null,
    totalStatus: null,
    selectAction: null,
    selectArrowBtn: null,
    selectDropdown: null,
    selectDropdownButtons: [],
    pagination: null
  };

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    mailState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1;
    renderMoveDropdown();
    bindEvents();
    loadInbox();
    window.refreshMailList = loadInbox;
  });

  function getCurrentUserEmail() {
    return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
  }

  function isInboxMailForCurrentUser(mail) {
    var userEmail = getCurrentUserEmail();
    if (!userEmail) return false;

    return String(mail.to || "")
      .split(",")
      .map(function (item) { return String(item || "").trim().toLowerCase(); })
      .indexOf(userEmail) > -1;
  }

  function cacheElements() {
    elements.listWrap = document.querySelector(".mailListWrap");
    elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
    elements.refreshBtn = document.querySelector(".refreshBtn");
    elements.allCheck = document.getElementById("allCheck");
    elements.deleteBtn = findActionButton("삭제");
    elements.unreadBtn = findActionButton("안읽음");
    elements.moveAction = document.querySelector(".moveAction");
    elements.moveBtn = document.querySelector(".moveBtn");
    elements.moveDropdown = document.querySelector(".moveDropdown");
    elements.unreadCount = document.querySelector(".mailStatus em");
    elements.totalStatus = document.querySelector(".mailStatus span");
    elements.selectAction = document.querySelector(".selectAction");
    elements.selectArrowBtn = document.querySelector(".selectArrowBtn");
    elements.selectDropdown = document.querySelector(".selectDropdown");
    elements.selectDropdownButtons = Array.prototype.slice.call(document.querySelectorAll(".selectDropdown button"));
    elements.pagination = document.querySelector(".mailPagination");
    elements.moveItems = Array.prototype.slice.call(document.querySelectorAll(".moveDropdown button"));
  }

  function renderMoveDropdown() {
    if (window.MailCommon && typeof window.MailCommon.renderMoveDropdown === "function" && elements.moveDropdown) {
      elements.moveItems = window.MailCommon.renderMoveDropdown(elements.moveDropdown);
      if (!elements.moveDropdown.querySelector('[data-move-folder="spam"]')) {
        elements.moveDropdown.insertAdjacentHTML("beforeend", '<button type="button" data-move-folder="spam">스팸메일함</button>');
        elements.moveItems = Array.prototype.slice.call(elements.moveDropdown.querySelectorAll("button"));
      }
    } else {
      elements.moveItems = Array.prototype.slice.call(document.querySelectorAll(".moveDropdown button"));
    }
  }

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        mailState.keyword = this.value.trim().toLowerCase();
        mailState.page = 1;
        applyFilter();
        renderMailList();
        updateStatus();
        renderPagination();
      });
    }

    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener("click", function () {
        loadInbox();
      });
    }

    if (elements.allCheck) {
      elements.allCheck.addEventListener("change", function () {
        toggleAllChecked(this.checked);
      });
    }

    if (elements.deleteBtn) {
      elements.deleteBtn.addEventListener("click", function () {
        deleteSelectedMails();
      });
    }

    if (elements.unreadBtn) {
      elements.unreadBtn.addEventListener("click", function () {
        toggleSelectedMailsReadState();
      });
    }

    bindSelectDropdownEvents();
    bindMoveDropdownEvents();
  }

  async function loadInbox() {
    try {
      if (elements.listWrap) {
        elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
      }

      var userEmail = getCurrentUserEmail();
      var result = await API.get(API_BASE + "/inbox", {
        page: 1,
        pageSize: 500,
        userEmail: userEmail
      }, {
        errorMessage: "받은메일 조회 실패"
      });

      mailState.mails = (result.items || []).filter(isInboxMailForCurrentUser);
      mailState.total = mailState.mails.length;
      mailState.totalPages = Math.max(1, Math.ceil(mailState.total / mailState.pageSize));

      applyFilter();
      renderMailList();
      updateStatus();
      syncMailUnreadBadge();
      renderPagination();

    } catch (error) {
      console.error(error);
      if (elements.listWrap) {
        elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중 오류가 발생했습니다.</div>';
      }
      updateStatus();
    }
  }

  function applyFilter() {
    var keyword = (mailState.keyword || "").toLowerCase();

    if (!keyword) {
      mailState.filteredMails = mailState.mails.slice();
      return;
    }

    mailState.filteredMails = mailState.mails.filter(function (mail) {
      var sender = ((mail.from_name || "") + " " + (mail.from || "")).toLowerCase();
      var subject = (mail.subject || "").toLowerCase();
      var snippet = (mail.snippet || "").toLowerCase();

      return sender.indexOf(keyword) > -1 ||
             subject.indexOf(keyword) > -1 ||
             snippet.indexOf(keyword) > -1;
    });
  }

  function renderMailList() {
    if (!elements.listWrap) return;

    var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function"
      ? window.MailCommon.getPagedItems(mailState, mailState.filteredMails)
      : mailState.filteredMails;

    if (!visibleMails.length) {
      elements.listWrap.innerHTML = '<div class="emptyRow">메일이 없습니다.</div>';
      syncAllCheck();
      return;
    }

    var html = "";

    visibleMails.forEach(function (mail) {
      html += ''
        + '<div class="mailRow ' + (mail.unread ? 'unread' : 'read') + '" data-id="' + escapeHtml(mail.id) + '">'
          + '<div class="col check"><input type="checkbox" class="mailCheck" data-id="' + escapeHtml(mail.id) + '"></div>'
          + '<div class="col star"><button type="button" class="' + (mail.starred ? 'active' : '') + '">' + renderStarIcon(mail.starred) + '</button></div>'
          + renderReadStateSlot(mail)
          + renderAttachmentSlot(mail)
          + '<div class="col sender">' + escapeHtml(mail.from_name || mail.from || "-") + '</div>'
          + '<div class="col subject"><a href="/mail/read.html?id=' + encodeURIComponent(mail.id) + '&folder=inbox">' + escapeHtml(mail.subject || "(제목 없음)") + '</a></div>'
          + '<div class="col date">' + formatDate(mail.date) + '</div>'
        + '</div>';
    });

    elements.listWrap.innerHTML = html;
    bindRowEvents();
    syncAllCheck();
  }

  function renderAttachmentSlot(mail) {
    return window.MailCommon && typeof window.MailCommon.renderAttachmentSlot === "function"
      ? window.MailCommon.renderAttachmentSlot(mail)
      : '<div class="col attach"></div>';
  }

  function renderReadStateSlot(mail) {
    return window.MailCommon && typeof window.MailCommon.renderReadStateSlot === "function"
      ? window.MailCommon.renderReadStateSlot(mail)
      : '<div class="col readState"></div>';
  }

  function renderStarIcon(starred) {
    return window.MailCommon && typeof window.MailCommon.renderStarIcon === "function"
      ? window.MailCommon.renderStarIcon(starred)
      : '<i class="' + (starred ? 'ph-fill ph-star' : 'ph ph-star') + '"></i>';
  }

  function bindRowEvents() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".mailRow"));

    rows.forEach(function (row) {
      var checkbox = row.querySelector(".mailCheck");
      var starBtn = row.querySelector(".col.star button");
      var link = row.querySelector(".col.subject a");

      if (checkbox) {
        checkbox.addEventListener("click", function (e) {
          e.stopPropagation();
          row.classList.toggle("selected", checkbox.checked);
          syncAllCheck();
          updateReadActionButton();
        });
      }

      if (starBtn) {
        starBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          var id = row.getAttribute("data-id");
          var currentMail = findMailById(id);
          var nextStarred = currentMail ? !currentMail.starred : !starBtn.classList.contains("active");

          updateStarState(id, nextStarred, starBtn, currentMail);
        });
      }

      row.addEventListener("click", function (e) {
        if (e.target.closest(".mailCheck") || e.target.closest(".col.star")) return;
        if (link) location.href = link.getAttribute("href");
      });
    });
  }

  async function updateStarState(id, starred, starBtn, currentMail) {
    try {
      await API.post(API_BASE + "/star-state", { id: id, starred: starred }, {
        errorMessage: "별 상태 저장 실패"
      });

      if (currentMail) currentMail.starred = starred;

      if (window.MailCommon && typeof window.MailCommon.updateStarButton === "function") {
        window.MailCommon.updateStarButton(starBtn, starred);
      } else {
        starBtn.classList.toggle("active", starred);
        starBtn.innerHTML = renderStarIcon(starred);
      }

    } catch (error) {
      console.error(error);
      alert("즐겨찾기 저장 중 오류가 발생했습니다.");
    }
  }

  async function deleteSelectedMails() {
    var selectedIds = getSelectedIds();

    if (!selectedIds.length) {
      alert("삭제할 메일을 선택해 주세요.");
      return;
    }

    try {
      await API.post(API_BASE + "/trash", { ids: selectedIds, folder: "inbox" }, {
        errorMessage: "휴지통 이동 실패"
      });

      showTrashMoveToast(selectedIds.length);
      elements.allCheck.checked = false;
      loadInbox();

    } catch (error) {
      console.error(error);
      alert("오류 발생");
    }
  }

  function showTrashMoveToast(count) {
    if (window.MailCommon && typeof window.MailCommon.showTrashMoveToast === "function") {
      window.MailCommon.showTrashMoveToast(count);
      return;
    }
    alert("메일을 휴지통으로 이동하였습니다.");
  }

  function showMoveToast(count, folderName) {
    if (window.MailCommon && typeof window.MailCommon.showMoveToast === "function") {
      window.MailCommon.showMoveToast(count, folderName);
      return;
    }
    alert("메일을 " + folderName + "으로 이동하였습니다.");
  }

  async function toggleSelectedMailsReadState() {
    var selectedMails = getSelectedMails();
    var selectedIds = selectedMails.map(function (mail) { return mail.id; });

    if (!selectedIds.length) {
      alert("메일을 선택해 주세요.");
      return;
    }

    var shouldMarkUnread = !selectedMails.some(function (mail) { return !!mail.unread; });

    try {
      await API.post(API_BASE + "/read-state", { ids: selectedIds, unread: shouldMarkUnread, folder: "inbox" }, {
        errorMessage: "읽음 상태 변경 실패"
      });

      mailState.mails.forEach(function (mail) {
        if (selectedIds.indexOf(String(mail.id)) > -1) mail.unread = shouldMarkUnread;
      });
      applyFilter();
      renderMailList();
      updateStatus();
      syncMailUnreadBadge();
      loadInbox();

    } catch (error) {
      console.error(error);
      alert("오류 발생");
    }
  }

  async function moveSelectedMails(toFolder) {
    var selectedIds = getSelectedIds();

    if (!selectedIds.length) {
      alert("이동할 메일을 선택해 주세요.");
      return;
    }

    try {
      var path = toFolder === "spam" ? "/spam" : "/move";
      var body = toFolder === "spam"
        ? { ids: selectedIds, fromFolder: "inbox" }
        : { ids: selectedIds, fromFolder: "inbox", toFolder: toFolder };

      await API.post(API_BASE + path, body, {
        errorMessage: "이동 실패"
      });

      showMoveToast(selectedIds.length, getMoveFolderLabel(toFolder));
      loadInbox();

    } catch (error) {
      console.error(error);
      alert("이동 오류");
    }
  }

  function bindSelectDropdownEvents() {
    if (elements.selectArrowBtn && elements.selectAction && elements.selectDropdown) {
      if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
        window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
      }

      elements.selectArrowBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        var isOpen = elements.selectAction.classList.contains("is-open");

        if (elements.moveAction) {
          elements.moveAction.classList.remove("is-open");
          if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
            window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
          }
        }

        elements.selectAction.classList.remove("is-open");

        if (!isOpen) elements.selectAction.classList.add("is-open");

        if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
          window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
        }
      });
    }

    elements.selectDropdownButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var type = btn.getAttribute("data-select");

        if (type === "all") toggleAllChecked(true);
        if (type === "read") toggleByCondition(function (mail) { return !mail.unread; });
        if (type === "unread") toggleByCondition(function (mail) { return !!mail.unread; });
        if (type === "starred") toggleByCondition(function (mail) { return !!mail.starred; });
        if (type === "clear") toggleAllChecked(false);

        if (elements.selectAction) elements.selectAction.classList.remove("is-open");

        if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
          window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (elements.selectAction && !elements.selectAction.contains(e.target)) {
        elements.selectAction.classList.remove("is-open");
        if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
          window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
        }
      }

      if (elements.moveAction && !elements.moveAction.contains(e.target) && !(elements.moveDropdown && elements.moveDropdown.contains(e.target))) {
        elements.moveAction.classList.remove("is-open");
        if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
          window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
        }
      }
    });
  }

  function bindMoveDropdownEvents() {
    if (elements.moveBtn && elements.moveAction && elements.moveDropdown) {
      if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
        window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
      }

      elements.moveBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        var isOpen = elements.moveAction.classList.contains("is-open");

        if (elements.selectAction) {
          elements.selectAction.classList.remove("is-open");
          if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
            window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
          }
        }

        elements.moveAction.classList.remove("is-open");

        if (!isOpen) {
          elements.moveAction.classList.add("is-open");
          elements.moveDropdown.style.left = "";
          elements.moveDropdown.style.top = "";
        }

        if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
          window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
        }
      });
    }

    elements.moveItems.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var folder = btn.getAttribute("data-move-folder");
        if (elements.moveAction) elements.moveAction.classList.remove("is-open");
        if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
          window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
        }
        moveSelectedMails(folder);
      });
    });
  }

  function toggleAllChecked(checked) {
    Array.prototype.slice.call(document.querySelectorAll(".mailCheck")).forEach(function (checkbox) {
      checkbox.checked = checked;
      var row = checkbox.closest(".mailRow");
      if (row) row.classList.toggle("selected", checked);
    });
    syncAllCheck();
    updateReadActionButton();
  }

  function toggleByCondition(predicate) {
    Array.prototype.slice.call(document.querySelectorAll(".mailCheck")).forEach(function (checkbox) {
      var id = checkbox.getAttribute("data-id");
      var mail = findMailById(id);
      var checked = mail ? predicate(mail) : false;
      checkbox.checked = checked;
      var row = checkbox.closest(".mailRow");
      if (row) row.classList.toggle("selected", checked);
    });
    syncAllCheck();
    updateReadActionButton();
  }

  function syncAllCheck() {
    if (!elements.allCheck) return;
    var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".mailCheck"));
    if (!checkboxes.length) {
      elements.allCheck.checked = false;
      updateReadActionButton();
      return;
    }
    elements.allCheck.checked = checkboxes.every(function (checkbox) { return checkbox.checked; });
    updateReadActionButton();
  }

  function getSelectedIds() {
    return Array.prototype.slice.call(document.querySelectorAll(".mailCheck:checked")).map(function (checkbox) {
      return checkbox.getAttribute("data-id");
    });
  }

  function getSelectedMails() {
    return getSelectedIds().map(findMailById).filter(Boolean);
  }

  function updateReadActionButton() {
    if (!elements.unreadBtn) return;
    var selectedMails = getSelectedMails();
    var hasUnread = selectedMails.some(function (mail) { return !!mail.unread; });
    elements.unreadBtn.textContent = hasUnread ? "읽음" : "안읽음";
  }

  function findMailById(id) {
    return mailState.filteredMails.find(function (mail) {
      return String(mail.id) === String(id);
    }) || null;
  }

  function getMoveFolderLabel(folderId) {
    if (folderId === "inbox") return "받은메일함";
    if (folderId === "sent") return "보낸메일함";
    if (folderId === "draft") return "임시보관함";
    if (folderId === "trash") return "휴지통";
    if (folderId === "spam") return "스팸메일함";
    if ((folderId === "my1" || folderId === "my2" || folderId === "my3") && window.MyMailFolderStore && typeof window.MyMailFolderStore.getFolderById === "function") {
      var folder = window.MyMailFolderStore.getFolderById(folderId);
      if (folder && folder.name) return String(folder.name);
    }
    if (folderId === "my1") return "메일함 1";
    if (folderId === "my2") return "메일함 2";
    if (folderId === "my3") return "메일함 3";
    return "선택한 메일함";
  }

  function updateStatus() {
    var unreadCount = mailState.mails.filter(function (mail) { return !!mail.unread; }).length;
    if (elements.unreadCount) elements.unreadCount.textContent = unreadCount;
    if (elements.totalStatus) elements.totalStatus.innerHTML = '안읽음 <em>' + unreadCount + '</em> / ' + mailState.total;
  }

  function syncMailUnreadBadge() {
    if (!window.WorkbenchMenuBadges || typeof window.WorkbenchMenuBadges.setMailUnread !== "function") return;
    window.WorkbenchMenuBadges.setMailUnread(mailState.mails.filter(function (mail) { return !!mail.unread; }).length);
  }

  function renderPagination() {
    if (!elements.pagination) return;
    if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
      window.MailCommon.renderPagination(elements.pagination, mailState, function () {
        renderMailList();
        renderPagination();
      });
    }
  }

  function findActionButton(text) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".mailActionBar .actionLeft > button"));
    return buttons.find(function (button) { return button.textContent.trim() === text; }) || null;
  }

  function formatDate(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || "";
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    var dateText = mm + "-" + dd + " " + hh + ":" + mi;
    return yyyy === new Date().getFullYear() ? dateText : yyyy + "-" + dateText;
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
