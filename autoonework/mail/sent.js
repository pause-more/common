(function () {
  var API_BASE = getGroupwareApiBase("/api/mail");
  var API = window.GroupwareApi;
  var sentState = { mails: [], filteredMails: [], keyword: "", page: 1, pageSize: 20, total: 0, totalPages: 1 };
  var elements = {};

  document.addEventListener("DOMContentLoaded", function () {
    cacheElements();
    sentState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1;
    renderMoveDropdown();
    bindEvents();
    loadSentList();
  });

  function getCurrentUserEmail() {
    return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
  }

  function cacheElements() {
    elements.listWrap = document.querySelector(".mailListWrap");
    elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
    elements.totalStatus = document.querySelector(".mailStatus span");
    elements.totalCount = document.querySelector(".mailStatus em");
    elements.allCheck = document.getElementById("allCheck");
    elements.deleteBtn = findActionButton("삭제");
    elements.moveAction = document.querySelector(".moveAction");
    elements.moveBtn = document.querySelector(".moveBtn");
    elements.moveDropdown = document.querySelector(".moveDropdown");
    elements.moveItems = Array.prototype.slice.call(document.querySelectorAll(".moveDropdown button"));
    elements.selectAction = document.querySelector(".selectAction");
    elements.selectArrowBtn = document.querySelector(".selectArrowBtn");
    elements.selectDropdown = document.querySelector(".selectDropdown");
    elements.selectDropdownButtons = Array.prototype.slice.call(document.querySelectorAll(".selectDropdown button"));
    elements.pagination = document.querySelector(".mailPagination");
  }

  function renderMoveDropdown() {
    if (window.MailCommon && typeof window.MailCommon.renderMoveDropdown === "function" && elements.moveDropdown) {
      elements.moveItems = window.MailCommon.renderMoveDropdown(elements.moveDropdown);
    }
  }

  function bindEvents() {
    if (elements.searchInput) {
      elements.searchInput.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();
        sentState.keyword = this.value.trim().toLowerCase();
        sentState.page = 1;
        applyFilter();
        renderList();
        renderPagination();
        updateCount();
      });
    }

    if (elements.allCheck) {
      elements.allCheck.addEventListener("change", function () {
        toggleAllChecked(this.checked);
      });
    }

    if (elements.deleteBtn) {
      elements.deleteBtn.addEventListener("click", moveSelectedToTrash);
    }

    bindSelectDropdownEvents();
    bindMoveDropdownEvents();
  }

  async function loadSentList() {
    if (elements.listWrap) elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
    try {
      var result = await API.get(API_BASE + "/sent", {
        page: 1,
        pageSize: 500
      }, {
        errorMessage: "보낸메일함 불러오기 실패"
      });
      var userEmail = getCurrentUserEmail();
      sentState.mails = (result.items || []).filter(function (item) {
        return String(item.from || "").trim().toLowerCase() === userEmail;
      });
      sentState.filteredMails = sentState.mails.slice();
      applyFilter();
      renderList();
      renderPagination();
      updateCount();
    } catch (error) {
      console.error(error);
      if (elements.listWrap) elements.listWrap.innerHTML = '<div class="emptyRow">보낸메일함을 불러오는 중 오류가 발생했습니다.</div>';
    }
  }

  function renderList() {
    if (!elements.listWrap) return;
    var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function"
      ? window.MailCommon.getPagedItems(sentState, sentState.filteredMails)
      : sentState.filteredMails;

    if (!visibleMails.length) {
      elements.listWrap.innerHTML = '<div class="emptyRow">보낸 메일이 없습니다.</div>';
      syncAllCheck();
      return;
    }

    var html = "";
    visibleMails.forEach(function (item) {
      html += '<div class="mailRow ' + (item.unread ? 'unread' : 'read') + '" data-id="' + esc(item.id) + '">';
      html += '<div class="col check"><input type="checkbox" class="mailCheck" data-id="' + esc(item.id) + '"></div>';
      html += '<div class="col star"><button type="button" class="' + (item.starred ? 'active' : '') + '">' + renderStarIcon(item.starred) + '</button></div>';
      html += renderReadStateSlot(item);
      html += renderAttachmentSlot(item);
      html += '<div class="col receiver">' + esc(item.to || "") + '</div>';
      html += '<div class="col subject"><a href="/mail/read.html?id=' + encodeURIComponent(item.id) + '&folder=sent">' + esc(item.subject || "") + '</a></div>';
      html += '<div class="col date">' + formatDate(item.date) + '</div>';
      html += '</div>';
    });
    elements.listWrap.innerHTML = html;
    bindRowEvents();
    syncAllCheck();
  }

  function applyFilter() {
    var keyword = sentState.keyword || "";
    if (!keyword) {
      sentState.filteredMails = sentState.mails.slice();
      return;
    }

    sentState.filteredMails = sentState.mails.filter(function (mail) {
      return String(mail.to || "").toLowerCase().indexOf(keyword) > -1 ||
        String(mail.subject || "").toLowerCase().indexOf(keyword) > -1 ||
        String(mail.snippet || "").toLowerCase().indexOf(keyword) > -1;
    });
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
    Array.prototype.slice.call(document.querySelectorAll(".mailRow")).forEach(function (row) {
      var checkbox = row.querySelector(".mailCheck");
      var starBtn = row.querySelector(".col.star button");
      var link = row.querySelector(".col.subject a");

      if (checkbox) {
        checkbox.addEventListener("click", function (event) {
          event.stopPropagation();
          row.classList.toggle("selected", checkbox.checked);
          syncAllCheck();
        });
      }

      if (starBtn) {
        starBtn.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var id = row.getAttribute("data-id") || "";
          var currentMail = findMailById(id);
          var nextStarred = currentMail ? !currentMail.starred : !starBtn.classList.contains("active");
          updateStarState(id, nextStarred, starBtn, currentMail);
        });
      }

      row.addEventListener("click", function (event) {
        if (event.target.closest(".mailCheck") || event.target.closest(".col.star")) return;
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

  function bindSelectDropdownEvents() {
    if (elements.selectArrowBtn && elements.selectAction && elements.selectDropdown) {
      if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
        window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
      }

      elements.selectArrowBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var isOpen = elements.selectAction.classList.contains("is-open");

        if (elements.moveAction) {
          elements.moveAction.classList.remove("is-open");
          updateMoveButtonIcon();
        }

        elements.selectAction.classList.remove("is-open");
        if (!isOpen) elements.selectAction.classList.add("is-open");
        updateSelectButtonIcon();
      });
    }

    elements.selectDropdownButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-select") || "";
        if (type === "all") toggleAllChecked(true);
        if (type === "read") toggleByCondition(function (mail) { return !mail.unread; });
        if (type === "unread") toggleByCondition(function (mail) { return !!mail.unread; });
        if (type === "starred") toggleByCondition(function (mail) { return !!mail.starred; });
        if (type === "clear") toggleAllChecked(false);

        if (elements.selectAction) elements.selectAction.classList.remove("is-open");
        updateSelectButtonIcon();
      });
    });

    document.addEventListener("click", function (event) {
      if (elements.selectAction && !elements.selectAction.contains(event.target)) {
        elements.selectAction.classList.remove("is-open");
        updateSelectButtonIcon();
      }

      if (elements.moveAction && !elements.moveAction.contains(event.target)) {
        elements.moveAction.classList.remove("is-open");
        updateMoveButtonIcon();
      }
    });
  }

  function bindMoveDropdownEvents() {
    if (elements.moveBtn && elements.moveAction) {
      updateMoveButtonIcon();
      elements.moveBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var isOpen = elements.moveAction.classList.contains("is-open");

        if (elements.selectAction) {
          elements.selectAction.classList.remove("is-open");
          updateSelectButtonIcon();
        }

        elements.moveAction.classList.remove("is-open");
        if (!isOpen) elements.moveAction.classList.add("is-open");
        updateMoveButtonIcon();
      });
    }

    elements.moveItems.forEach(function (button) {
      button.addEventListener("click", function () {
        var folder = button.getAttribute("data-move-folder") || "";
        if (elements.moveAction) elements.moveAction.classList.remove("is-open");
        updateMoveButtonIcon();
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
  }

  function toggleByCondition(predicate) {
    Array.prototype.slice.call(document.querySelectorAll(".mailCheck")).forEach(function (checkbox) {
      var mail = findMailById(checkbox.getAttribute("data-id") || "");
      var checked = mail ? predicate(mail) : false;
      checkbox.checked = checked;
      var row = checkbox.closest(".mailRow");
      if (row) row.classList.toggle("selected", checked);
    });
    syncAllCheck();
  }

  function syncAllCheck() {
    if (!elements.allCheck) return;
    var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".mailCheck"));
    elements.allCheck.checked = checkboxes.length > 0 && checkboxes.every(function (checkbox) {
      return checkbox.checked;
    });
  }

  function getSelectedMails() {
    return Array.prototype.slice.call(document.querySelectorAll(".mailCheck:checked")).map(function (checkbox) {
      return findMailById(checkbox.getAttribute("data-id") || "");
    }).filter(Boolean);
  }

  async function moveSelectedToTrash() {
    var selected = getSelectedMails();
    if (!selected.length) {
      alert("삭제할 메일을 선택해 주세요.");
      return;
    }

    try {
      await post("/trash", {
        ids: selected.map(function (mail) { return mail.id; }),
        folder: "sent"
      });
      alert("메일을 휴지통으로 이동하였습니다.");
      if (elements.allCheck) elements.allCheck.checked = false;
      loadSentList();
    } catch (error) {
      console.error(error);
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  async function moveSelectedMails(toFolder) {
    var selected = getSelectedMails();
    if (!selected.length) {
      alert("이동할 메일을 선택해 주세요.");
      return;
    }

    try {
      await post("/move", {
        ids: selected.map(function (mail) { return mail.id; }),
        fromFolder: "sent",
        toFolder: toFolder
      });
      alert("메일을 " + getMoveFolderLabel(toFolder) + "으로 이동하였습니다.");
      if (elements.allCheck) elements.allCheck.checked = false;
      loadSentList();
    } catch (error) {
      console.error(error);
      alert("이동 오류");
    }
  }

  async function post(path, body) {
    return API.post(API_BASE + path, body, {
      errorMessage: "요청 실패"
    });
  }

  function findMailById(id) {
    return sentState.mails.find(function (mail) {
      return String(mail.id) === String(id);
    }) || null;
  }

  function updateSelectButtonIcon() {
    if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") {
      window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
    }
  }

  function updateMoveButtonIcon() {
    if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
      window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
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

  function updateCount() {
    var count = sentState.filteredMails.length;
    if (elements.totalCount) elements.totalCount.textContent = count;
    if (elements.totalStatus) elements.totalStatus.textContent = '전체 ' + count;
  }

  function renderPagination() {
    if (!elements.pagination) return;
    if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
      window.MailCommon.renderPagination(elements.pagination, sentState, function () {
        renderList();
        renderPagination();
      });
    }
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    var yyyy = date.getFullYear();
    var dateText = String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + " " + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
    return yyyy === new Date().getFullYear() ? dateText : yyyy + "-" + dateText;
  }

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function findActionButton(text) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".mailActionBar .actionLeft > button"));
    return buttons.find(function (button) {
      return button.textContent.trim() === text;
    }) || null;
  }
})();
