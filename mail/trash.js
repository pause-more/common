(function () {
  var API_BASE = getGroupwareApiBase("/api/mail");
  var API = window.GroupwareApi;

  var trashState = {
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
    allCheck: null,
    deleteBtn: null,
    moveAction: null,
    moveBtn: null,
    moveDropdown: null,
    moveItems: [],
    statusText: null,
    statusCount: null,
    pagination: null
  };

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    trashState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1;
    bindEvents();
    loadTrashMails();
  });

  function cacheElements() {
    elements.listWrap = document.querySelector(".mailListWrap");
    elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
    elements.allCheck = document.getElementById("allCheck");
    elements.deleteBtn = findActionButton("삭제");
    elements.moveAction = document.querySelector(".moveAction");
    elements.moveBtn = document.querySelector(".moveBtn");
    elements.moveDropdown = document.querySelector(".moveDropdown");
    elements.moveItems = Array.prototype.slice.call(document.querySelectorAll(".moveDropdown button"));
    elements.statusText = document.querySelector(".mailStatus span");
    elements.statusCount = document.querySelector(".mailStatus em");
    elements.pagination = document.querySelector(".mailPagination");
    syncMoveDropdownFolders();
  }

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        trashState.keyword = this.value.trim().toLowerCase();
        trashState.page = 1;
        applyFilter();
        renderTrashList();
        updateStatus();
        renderPagination();
      });
    }

    if (elements.allCheck) {
      elements.allCheck.addEventListener("change", function () {
        toggleAllChecked(this.checked);
      });
    }

    if (elements.deleteBtn) {
      elements.deleteBtn.addEventListener("click", function () {
        deleteSelectedMailsForever();
      });
    }

    bindMoveDropdownEvents();
  }

  async function loadTrashMails() {
    setLoadingState();

    try {
      var userEmail = getCurrentUserEmail();
      var payload = await API.get(API_BASE + "/trash", {
        page: 1,
        pageSize: 500,
        userEmail: userEmail
      }, {
        errorMessage: "조회 실패"
      });

      trashState.mails = payload.items || [];
      trashState.total = trashState.mails.length;
      trashState.totalPages = Math.max(1, Math.ceil(trashState.total / trashState.pageSize));
    } catch (error) {
      console.error(error);
      trashState.mails = [];
      trashState.total = 0;
      trashState.totalPages = 1;
    }

    applyFilter();
    renderTrashList();
    updateStatus();
    renderPagination();
  }

  function setLoadingState() {
    if (elements.listWrap) {
      elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
    }
  }

  function applyFilter() {
    var keyword = (trashState.keyword || "").toLowerCase();

    if (!keyword) {
      trashState.filteredMails = trashState.mails.slice();
      return;
    }

    trashState.filteredMails = trashState.mails.filter(function (mail) {
      var sender = ((mail.from_name || "") + " " + (mail.from || "")).toLowerCase();
      var receiver = (mail.to || "").toLowerCase();
      var subject = (mail.subject || "").toLowerCase();
      var snippet = (mail.snippet || "").toLowerCase();

      return sender.indexOf(keyword) > -1 ||
             receiver.indexOf(keyword) > -1 ||
             subject.indexOf(keyword) > -1 ||
             snippet.indexOf(keyword) > -1;
    });
  }

  function renderTrashList() {
    if (!elements.listWrap) {
      return;
    }

    var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function"
      ? window.MailCommon.getPagedItems(trashState, trashState.filteredMails)
      : trashState.filteredMails;

    if (!visibleMails.length) {
      elements.listWrap.innerHTML = '<div class="emptyRow">휴지통에 메일이 없습니다.</div>';
      syncAllCheck();
      return;
    }

    var html = "";

    visibleMails.forEach(function (mail) {
      html += ''
        + '<div class="mailRow ' + (mail.unread ? 'unread' : 'read') + '" data-id="' + escapeHtml(mail.id) + '">'
          + '<div class="col check">'
            + '<input type="checkbox" class="mailCheck" data-id="' + escapeHtml(mail.id) + '">'
          + '</div>'
          + '<div class="col star">'
            + '<button type="button" class="' + (mail.starred ? 'active' : '') + '">' + renderStarIcon(mail.starred) + '</button>'
          + '</div>'
          + renderReadStateSlot(mail)
          + renderAttachmentSlot(mail)
          + '<div class="col sender">' + escapeHtml(mail.from_name || mail.from || "-") + '</div>'
          + '<div class="col subject">'
            + '<a href="/mail/read.html?id=' + encodeURIComponent(mail.id) + '&folder=trash">' + escapeHtml(mail.subject || "(제목 없음)") + '</a>'
          + '</div>'
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
        if (e.target.closest(".mailCheck") || e.target.closest(".col.star")) {
          return;
        }

        if (link) {
          location.href = link.getAttribute("href");
        }
      });
    });
  }

  async function updateStarState(id, starred, starBtn, currentMail) {
    try {
      await API.post(API_BASE + "/star-state", {
          id: id,
          starred: starred,
          userEmail: getCurrentUserEmail()
        }, {
          errorMessage: "별 상태 저장 실패"
      });

      if (currentMail) {
        currentMail.starred = starred;
      }

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

  async function moveSelectedMails(targetFolder) {
    var ids = getSelectedIds();

    if (!ids.length) {
      alert("이동할 메일을 선택해 주세요.");
      return;
    }

    try {
      await API.post(API_BASE + "/move", {
          ids: ids,
          fromFolder: "trash",
          toFolder: targetFolder
        }, {
          errorMessage: "이동 실패"
      });

      showMoveToast(ids.length, getMoveFolderLabel(targetFolder));
      if (elements.allCheck) elements.allCheck.checked = false;
      loadTrashMails();

    } catch (error) {
      console.error(error);
      alert("이동 중 오류가 발생했습니다.");
    }
  }

  function showMoveToast(count, folderName) {
    if (window.MailCommon && typeof window.MailCommon.showMoveToast === "function") {
      window.MailCommon.showMoveToast(count, folderName);
      return;
    }
    alert("메일을 " + folderName + "으로 이동하였습니다.");
  }

  function bindMoveDropdownEvents() {
    if (elements.moveBtn && elements.moveAction && elements.moveDropdown) {
      if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
        window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
      }

      elements.moveBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        var isOpen = elements.moveAction.classList.contains("is-open");
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

    elements.moveItems.forEach(function (button) {
      button.addEventListener("click", function () {
        var folder = button.getAttribute("data-move-folder") || "";
        if (elements.moveAction) elements.moveAction.classList.remove("is-open");
        if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
          window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
        }
        moveSelectedMails(folder);
      });
    });

    document.addEventListener("click", function (event) {
      if (elements.moveAction && !elements.moveAction.contains(event.target) && elements.moveDropdown && !elements.moveDropdown.contains(event.target)) {
        elements.moveAction.classList.remove("is-open");
        if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
          window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
        }
      }
    });
  }

  function syncMoveDropdownFolders() {
    elements.moveItems.forEach(function (button) {
      var folderId = String(button.getAttribute("data-move-folder") || "").trim();
      if (folderId !== "my1" && folderId !== "my2" && folderId !== "my3") return;
      var folder = window.MyMailFolderStore && typeof window.MyMailFolderStore.getFolderById === "function"
        ? window.MyMailFolderStore.getFolderById(folderId)
        : null;
      button.hidden = !folder;
      if (folder && folder.name) button.textContent = folder.name;
    });
  }

  async function deleteSelectedMailsForever() {
    var ids = getSelectedIds();

    if (!ids.length) {
      alert("삭제할 메일을 선택해 주세요.");
      return;
    }

    if (!confirm("선택한 메일을 완전히 삭제하시겠습니까?")) {
      return;
    }

    try {
      await API.post(API_BASE + "/delete", {
          ids: ids,
          userEmail: getCurrentUserEmail()
        }, {
          errorMessage: "삭제 실패"
      });

      alert("메일이 완전히 삭제되었습니다.");
      loadTrashMails();

    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  function toggleAllChecked(checked) {
    var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".mailCheck"));

    checkboxes.forEach(function (checkbox) {
      checkbox.checked = checked;
      var row = checkbox.closest(".mailRow");
      if (row) {
        row.classList.toggle("selected", checked);
      }
    });

    syncAllCheck();
  }

  function syncAllCheck() {
    if (!elements.allCheck) {
      return;
    }

    var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".mailCheck"));

    if (!checkboxes.length) {
      elements.allCheck.checked = false;
      return;
    }

    elements.allCheck.checked = checkboxes.every(function (checkbox) {
      return checkbox.checked;
    });
  }

  function getSelectedIds() {
    return Array.prototype.slice.call(document.querySelectorAll(".mailCheck:checked")).map(function (checkbox) {
      return checkbox.getAttribute("data-id");
    });
  }

  function findMailById(id) {
    return trashState.filteredMails.find(function (mail) {
      return String(mail.id) === String(id);
    }) || null;
  }

  function getCurrentUserEmail() {
    return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
  }

  function updateStatus() {
    if (elements.statusCount) {
      elements.statusCount.textContent = trashState.total;
    }

    if (elements.statusText) {
      elements.statusText.innerHTML = '안읽음 <em>' + trashState.total + '</em> / ' + trashState.total;
    }
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

  function renderPagination() {
    if (!elements.pagination) {
      return;
    }
    if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
      window.MailCommon.renderPagination(elements.pagination, trashState, function () {
        renderTrashList();
        renderPagination();
      });
    }
  }

  function findActionButton(text) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".mailActionBar .actionLeft > button"));
    return buttons.find(function (button) {
      return button.textContent.trim() === text;
    }) || null;
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
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
