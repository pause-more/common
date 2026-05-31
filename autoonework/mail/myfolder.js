(function () {
    var API_BASE = getGroupwareApiBase("/api/mail");
    var API = window.GroupwareApi;
    var myMailState = { folderId: "", mails: [], filteredMails: [], keyword: "", page: 1, pageSize: 20, total: 0, totalPages: 1 };
    var elements = { pageRoot: null, boxLabel: null, boxLabels: [], listWrap: null, searchInput: null, refreshBtn: null, allCheck: null, deleteBtn: null, unreadBtn: null, moveAction: null, moveBtn: null, moveDropdown: null, moveItems: [], unreadCount: null, totalStatus: null, selectAction: null, selectArrowBtn: null, selectDropdown: null, selectDropdownButtons: [], pagination: null };

    document.addEventListener("DOMContentLoaded", function () { cacheElements(); myMailState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1; setupFolderInfo(); renderMoveDropdown(); bindEvents(); loadMyFolderMails(); window.refreshMailList = loadMyFolderMails; });

    function cacheElements() {
        elements.pageRoot = document.querySelector(".myMailPage");
        elements.boxLabel = document.querySelector(".mailBoxLabel");
        elements.boxLabels = Array.prototype.slice.call(document.querySelectorAll(".mailBoxLabel"));
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
    }

    function setupFolderInfo() {
        if (!elements.pageRoot) return;
        myMailState.folderId = String(elements.pageRoot.getAttribute("data-folder-id") || "").trim();
        var folderName = getFolderDisplayName(myMailState.folderId);
        elements.boxLabels.forEach(function (label) { label.textContent = folderName; });
    }

    function getFolderDisplayName(folderId) {
        if (window.MyMailFolderStore && typeof window.MyMailFolderStore.getFolderById === "function") {
            var folder = window.MyMailFolderStore.getFolderById(folderId);
            if (folder && folder.name) return String(folder.name);
        }
        if (folderId === "my1") return "메일함 1";
        if (folderId === "my2") return "메일함 2";
        if (folderId === "my3") return "메일함 3";
        return "내 메일함";
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
        if (elements.searchInput) elements.searchInput.addEventListener("keydown", function (event) { if (event.key !== "Enter") return; event.preventDefault(); myMailState.keyword = this.value.trim().toLowerCase(); myMailState.page = 1; applyFilter(); renderMailList(); updateStatus(); renderPagination(); });
        if (elements.allCheck) elements.allCheck.addEventListener("change", function () { toggleAllChecked(this.checked); });
        if (elements.deleteBtn) elements.deleteBtn.addEventListener("click", deleteSelectedMails);
        if (elements.unreadBtn) elements.unreadBtn.addEventListener("click", markSelectedUnread);
        bindSelectDropdownEvents();
        bindMoveDropdownEvents();
    }

    async function loadMyFolderMails() {
        if (!myMailState.folderId) return;
        try {
            if (elements.listWrap) elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
            var userEmail = getCurrentUserEmail();
            var payload = await API.get(API_BASE + "/" + encodeURIComponent(myMailState.folderId), {
                page: 1,
                pageSize: 500,
                userEmail: userEmail
            }, {
                errorMessage: "조회 실패"
            });
            myMailState.mails = (payload.items || []).map(function (item) { item.selected = false; return item; });
            myMailState.total = myMailState.mails.length;
            myMailState.totalPages = Math.max(1, Math.ceil(myMailState.total / myMailState.pageSize));
        } catch (error) {
            console.error(error);
            myMailState.mails = [];
            myMailState.total = 0;
            myMailState.totalPages = 1;
        }
        applyFilter(); renderMailList(); updateStatus(); renderPagination();
    }

    function applyFilter() {
        if (!myMailState.keyword) { myMailState.filteredMails = myMailState.mails.slice(); return; }
        myMailState.filteredMails = myMailState.mails.filter(function (mail) {
            return String(mail.from_name || mail.from || "").toLowerCase().indexOf(myMailState.keyword) > -1 ||
                   String(mail.subject || "").toLowerCase().indexOf(myMailState.keyword) > -1 ||
                   String(mail.snippet || "").toLowerCase().indexOf(myMailState.keyword) > -1;
        });
    }

    function renderMailList() {
        if (!elements.listWrap) return;
        var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function" ? window.MailCommon.getPagedItems(myMailState, myMailState.filteredMails) : myMailState.filteredMails;
        if (!visibleMails.length) { elements.listWrap.innerHTML = '<div class="emptyRow">메일이 없습니다.</div>'; syncAllCheck(); return; }
        var html = "";
        visibleMails.forEach(function (mail) {
            var sender = mail.folder === "sent" ? (mail.to || "-") : (mail.from_name || mail.from || "-");
            html += '<div class="mailRow ' + (mail.unread ? 'unread' : 'read') + '" data-id="' + esc(mail.id) + '">';
            html += '<div class="col check"><input type="checkbox" class="rowCheck" data-id="' + esc(mail.id) + '"></div>';
            html += '<div class="col star"><button type="button" class="' + (mail.starred ? 'active' : '') + '">' + renderStarIcon(mail.starred) + '</button></div>';
            html += renderReadStateSlot(mail);
            html += renderAttachmentSlot(mail);
            html += '<div class="col sender">' + esc(sender) + '</div>';
            html += '<div class="col subject"><a href="/mail/read.html?id=' + encodeURIComponent(mail.id) + '&folder=' + encodeURIComponent(myMailState.folderId) + '" class="mailSubjectLink">' + esc(mail.subject || "(제목 없음)") + '</a></div>';
            html += '<div class="col date">' + formatDate(mail.date) + '</div>';
            html += '</div>';
        });
        elements.listWrap.innerHTML = html; bindRowEvents(); syncAllCheck();
    }

    function renderAttachmentSlot(mail) {
        return window.MailCommon && typeof window.MailCommon.renderAttachmentSlot === "function" ? window.MailCommon.renderAttachmentSlot(mail) : '<div class="col attach"></div>';
    }

    function renderReadStateSlot(mail) {
        return window.MailCommon && typeof window.MailCommon.renderReadStateSlot === "function" ? window.MailCommon.renderReadStateSlot(mail) : '<div class="col readState"></div>';
    }

    function renderStarIcon(starred) {
        return window.MailCommon && typeof window.MailCommon.renderStarIcon === "function" ? window.MailCommon.renderStarIcon(starred) : '<i class="' + (starred ? 'ph-fill ph-star' : 'ph ph-star') + '"></i>';
    }

    function bindRowEvents() {
        Array.prototype.slice.call(document.querySelectorAll(".mailRow")).forEach(function (row) {
            var checkbox = row.querySelector(".rowCheck");
            var starBtn = row.querySelector(".col.star button");
            var link = row.querySelector(".mailSubjectLink");
            if (checkbox) checkbox.addEventListener("click", function (e) { e.stopPropagation(); row.classList.toggle("selected", checkbox.checked); syncAllCheck(); });
            if (starBtn) starBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                var id = row.getAttribute("data-id");
                var currentMail = findMailById(id);
                var nextStarred = currentMail ? !currentMail.starred : !starBtn.classList.contains("active");
                updateStarState(id, nextStarred, starBtn, currentMail);
            });
            row.addEventListener("click", function (e) { if (e.target.closest(".rowCheck") || e.target.closest(".col.star")) return; if (link) location.href = link.getAttribute("href"); });
        });
    }

    async function updateStarState(id, starred, starBtn, currentMail) {
        try {
            await post("/star-state", { id: id, starred: starred });
            if (currentMail) currentMail.starred = starred;
            if (window.MailCommon && typeof window.MailCommon.updateStarButton === "function") window.MailCommon.updateStarButton(starBtn, starred);
            else { starBtn.classList.toggle("active", starred); starBtn.innerHTML = renderStarIcon(starred); }
        } catch (error) {
            console.error(error);
            alert("즐겨찾기 저장 중 오류가 발생했습니다.");
        }
    }

    async function deleteSelectedMails() {
        var ids = selectedIds();
        if (!ids.length) { alert("삭제할 메일을 선택해 주세요."); return; }
        try { await post("/trash", { ids: ids, folder: myMailState.folderId }); showTrashMoveToast(ids.length); loadMyFolderMails(); } catch (error) { console.error(error); alert("삭제 중 오류가 발생했습니다."); }
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

    async function markSelectedUnread() {
        var ids = selectedIds();
        if (!ids.length) { alert("메일을 선택해 주세요."); return; }
        try { await post("/read-state", { ids: ids, unread: true, folder: myMailState.folderId }); loadMyFolderMails(); } catch (error) { console.error(error); alert("읽음 상태 변경 중 오류가 발생했습니다."); }
    }

    async function moveSelected(targetFolder) {
        var ids = selectedIds();
        if (!ids.length) { alert("이동할 메일을 선택해 주세요."); return; }
        try {
            if (targetFolder === "trash") await post("/trash", { ids: ids, folder: myMailState.folderId });
            else if (targetFolder === "spam") await post("/spam", { ids: ids, fromFolder: myMailState.folderId });
            else await post("/move", { ids: ids, fromFolder: myMailState.folderId, toFolder: targetFolder });
            showMoveToast(ids.length, getMoveFolderLabel(targetFolder));
            loadMyFolderMails();
        } catch (error) { console.error(error); alert("이동 중 오류가 발생했습니다."); }
    }

    function bindSelectDropdownEvents() {
        if (elements.selectArrowBtn && elements.selectAction && elements.selectDropdown) {
            if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
            elements.selectArrowBtn.addEventListener("click", function (e) {
                e.preventDefault(); e.stopPropagation();
                var isOpen = elements.selectAction.classList.contains("is-open");
                if (elements.moveAction) {
                    elements.moveAction.classList.remove("is-open");
                    if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
                }
                elements.selectAction.classList.remove("is-open");
                if (!isOpen) elements.selectAction.classList.add("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
            });
        }
        elements.selectDropdownButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var type = btn.getAttribute("data-select");
                if (type === "all") toggleAllChecked(true);
                if (type === "read") toggleByCondition(function (mail) { return !mail.unread; });
                if (type === "unread") toggleByCondition(function (mail) { return !!mail.unread; });
                if (type === "clear") toggleAllChecked(false);
                if (elements.selectAction) elements.selectAction.classList.remove("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
            });
        });
        document.addEventListener("click", function (e) {
            if (elements.selectAction && !elements.selectAction.contains(e.target)) {
                elements.selectAction.classList.remove("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
            }
            if (elements.moveAction && !elements.moveAction.contains(e.target)) {
                elements.moveAction.classList.remove("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
            }
        });
    }

    function bindMoveDropdownEvents() {
        if (elements.moveBtn && elements.moveAction) {
            if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
            elements.moveBtn.addEventListener("click", function (e) {
                e.preventDefault(); e.stopPropagation();
                var isOpen = elements.moveAction.classList.contains("is-open");
                if (elements.selectAction) {
                    elements.selectAction.classList.remove("is-open");
                    if (window.MailCommon && typeof window.MailCommon.updateSelectButtonIcon === "function") window.MailCommon.updateSelectButtonIcon(elements.selectAction, elements.selectArrowBtn);
                }
                elements.moveAction.classList.remove("is-open");
                if (!isOpen) elements.moveAction.classList.add("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
            });
        }
        elements.moveItems.forEach(function (btn) {
            btn.addEventListener("click", function () {
                var folder = btn.getAttribute("data-move-folder");
                if (elements.moveAction) elements.moveAction.classList.remove("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
                moveSelected(folder);
            });
        });
    }

    function selectedIds() {
        return Array.prototype.slice.call(document.querySelectorAll(".rowCheck:checked")).map(function (checkbox) { return checkbox.getAttribute("data-id"); });
    }

    function toggleAllChecked(checked) {
        Array.prototype.slice.call(document.querySelectorAll(".rowCheck")).forEach(function (cb) {
            cb.checked = checked;
            var row = cb.closest(".mailRow");
            if (row) row.classList.toggle("selected", checked);
        });
        syncAllCheck();
    }

    function toggleByCondition(predicate) {
        Array.prototype.slice.call(document.querySelectorAll(".rowCheck")).forEach(function (cb) {
            var id = cb.getAttribute("data-id");
            var mail = findMailById(id);
            var checked = mail ? predicate(mail) : false;
            cb.checked = checked;
            var row = cb.closest(".mailRow");
            if (row) row.classList.toggle("selected", checked);
        });
        syncAllCheck();
    }

    function syncAllCheck() {
        if (!elements.allCheck) return;
        var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".rowCheck"));
        if (!checkboxes.length) { elements.allCheck.checked = false; return; }
        elements.allCheck.checked = checkboxes.every(function (cb) { return cb.checked; });
    }

    function findMailById(id) {
        return myMailState.mails.find(function (mail) { return String(mail.id) === String(id); }) || null;
    }

    async function post(path, body) {
        var requestBody = Object.assign({}, body || {});
        var userEmail = getCurrentUserEmail();
        if (userEmail) requestBody.userEmail = userEmail;
        return API.post(API_BASE + path, requestBody, {
            errorMessage: "요청 실패"
        });
    }

    function getCurrentUserEmail() {
        return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
    }

    function updateStatus() {
        if (elements.unreadCount) elements.unreadCount.textContent = myMailState.total;
        if (elements.totalStatus) elements.totalStatus.textContent = '전체 ' + myMailState.total;
    }

    function renderPagination() {
        if (!elements.pagination) return;
        if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
            window.MailCommon.renderPagination(elements.pagination, myMailState, function () {
                renderMailList();
                renderPagination();
            });
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



    function findActionButton(text) {
        var buttons = document.querySelectorAll(".actionLeft > button");
        var found = null;
        buttons.forEach(function (btn) { if (btn.textContent.replace(/\s+/g, "") === text) found = btn; });
        return found;
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
})();
