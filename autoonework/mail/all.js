(function () {
    var API_BASE = getGroupwareApiBase("/api/mail");
    var API = window.GroupwareApi;
    var allState = { mails: [], filteredMails: [], keyword: "", page: 1, pageSize: 20, total: 0, totalPages: 1 };
    var elements = { listWrap: null, searchInput: null, refreshBtn: null, allCheck: null, deleteBtn: null, unreadBtn: null, replyBtn: null, forwardBtn: null, moveAction: null, moveBtn: null, moveDropdown: null, moveItems: [], unreadCount: null, totalStatus: null, selectAction: null, selectArrowBtn: null, selectDropdown: null, selectDropdownButtons: [], pagination: null };

    document.addEventListener("DOMContentLoaded", function () { cacheElements(); allState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1; renderMoveDropdown(); bindEvents(); loadAllMails(); window.refreshMailList = loadAllMails; });

    function cacheElements() {
        elements.listWrap = document.querySelector(".mailListWrap");
        elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
        elements.refreshBtn = document.querySelector(".refreshBtn");
        elements.allCheck = document.getElementById("allCheck");
        elements.deleteBtn = findActionButton("삭제");
        elements.unreadBtn = findActionButton("안읽음");
        elements.replyBtn = findActionButton("답장");
        elements.forwardBtn = findActionButton("전달");
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

    function getCurrentUserEmail() {
        return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
    }

    function canViewMailForCurrentUser(mail) {
        var userEmail = getCurrentUserEmail();
        if (!userEmail) return false;

        var fromEmail = String(mail.from || "").trim().toLowerCase();
        var toEmails = splitMailAddresses(mail.to || "");

        return fromEmail === userEmail || toEmails.indexOf(userEmail) > -1;
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
        if (elements.searchInput) elements.searchInput.addEventListener("keydown", function (event) { if (event.key !== "Enter") return; event.preventDefault(); allState.keyword = this.value.trim().toLowerCase(); allState.page = 1; applyFilter(); renderMailList(); renderPagination(); updateStatus(); });
        if (elements.refreshBtn) elements.refreshBtn.addEventListener("click", function () { loadAllMails(); });
        if (elements.allCheck) elements.allCheck.addEventListener("change", function () { toggleAllChecked(this.checked); });
        if (elements.deleteBtn) elements.deleteBtn.addEventListener("click", function () { moveSelectedToTrash(); });
        if (elements.unreadBtn) elements.unreadBtn.addEventListener("click", function () { toggleSelectedReadState(); });
        if (elements.replyBtn) elements.replyBtn.addEventListener("click", function () { openComposeBySelection(); });
        if (elements.forwardBtn) elements.forwardBtn.addEventListener("click", function () { openComposeBySelection(); });
        bindSelectDropdownEvents();
        bindMoveDropdownEvents();
    }

    async function loadAllMails() {
        if (elements.listWrap) elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
        try {
            var payload = await API.get(API_BASE + "/all", { page: 1, pageSize: 500, userEmail: getCurrentUserEmail() }, {
                errorMessage: "전체메일 조회 실패"
            });
            allState.mails = (payload.items || [])
                .map(function (item) {
                    return {
                        id: item.id,
                        folder: item.folder || "inbox",
                        from: item.from || "",
                        from_name: item.from_name || "",
                        to: item.to || "",
                        subject: item.subject || "(제목 없음)",
                        snippet: item.snippet || "",
                        date: item.date || "",
                        unread: item.unread === true,
                        starred: item.starred === true,
                        attachmentCount: item.attachmentCount || 0,
                        attachmentsMeta: Array.isArray(item.attachmentsMeta) ? item.attachmentsMeta : [],
                        attachments: Array.isArray(item.attachments) ? item.attachments : []
                    };
                });

            allState.total = allState.mails.length;
            allState.totalPages = Math.max(1, Math.ceil(allState.total / allState.pageSize));
        } catch (error) {
            console.error(error);
            allState.mails = [];
            allState.total = 0;
            allState.totalPages = 1;
        }
        applyFilter(); renderMailList(); renderPagination(); updateStatus(); syncMailUnreadBadge();
    }

    function applyFilter() {
        if (!allState.keyword) { allState.filteredMails = allState.mails.slice(); return; }
        allState.filteredMails = allState.mails.filter(function (mail) {
            return String(mail.from_name || mail.from || "").toLowerCase().indexOf(allState.keyword) > -1 ||
                   String(mail.to || "").toLowerCase().indexOf(allState.keyword) > -1 ||
                   String(mail.subject || "").toLowerCase().indexOf(allState.keyword) > -1 ||
                   String(mail.snippet || "").toLowerCase().indexOf(allState.keyword) > -1;
        });
    }

    function renderMailList() {
        if (!elements.listWrap) return;
        var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function" ? window.MailCommon.getPagedItems(allState, allState.filteredMails) : allState.filteredMails;
        if (!visibleMails.length) { elements.listWrap.innerHTML = '<div class="emptyRow">메일이 없습니다.</div>'; syncAllCheck(); return; }
        var html = "";
        visibleMails.forEach(function (mail) {
            var senderText = mail.folder === "sent" ? (mail.to || "-") : (mail.from_name || mail.from || "-");
            html += '<div class="mailRow ' + (mail.unread ? 'unread' : 'read') + '" data-id="' + esc(mail.id) + '" data-folder="' + esc(mail.folder) + '">';
            html += '<div class="col check"><input type="checkbox" class="mailCheck" data-id="' + esc(mail.id) + '"></div>';
            html += '<div class="col star"><button type="button" class="' + (mail.starred ? 'active' : '') + '">' + renderStarIcon(mail.starred) + '</button></div>';
            html += renderReadStateSlot(mail);
            html += renderAttachmentSlot(mail);
            html += '<div class="col sender">' + esc(senderText) + '</div>';
            html += '<div class="col subject"><a href="/mail/read.html?id=' + encodeURIComponent(mail.id) + '&folder=' + encodeURIComponent(mail.folder) + '" class="mailSubjectLink"><span class="mailFolderBadge badge-' + esc(mail.folder) + '">' + esc(getFolderLabel(mail.folder)) + '</span><span class="mailSubjectText">' + esc(mail.subject) + '</span></a></div>';
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

    function getFolderLabel(folder) {
        if (folder === "inbox") return "받은메일함";
        if (folder === "sent") return "보낸메일함";
        if (folder === "spam") return "스팸메일함";
        if (folder === "trash") return "휴지통";
        if (folder === "draft") return "임시보관함";
        if ((folder === "my1" || folder === "my2" || folder === "my3") && window.MyMailFolderStore && typeof window.MyMailFolderStore.getFolderById === "function") {
            var found = window.MyMailFolderStore.getFolderById(folder);
            if (found && found.name) return found.name;
        }
        if (folder === "my1") return "메일함 1";
        if (folder === "my2") return "메일함 2";
        if (folder === "my3") return "메일함 3";
        return "메일";
    }

    function bindRowEvents() {
        Array.prototype.slice.call(document.querySelectorAll(".mailRow")).forEach(function (row) {
            var checkbox = row.querySelector(".mailCheck");
            var starBtn = row.querySelector(".col.star button");
            var link = row.querySelector(".mailSubjectLink");
            if (checkbox) checkbox.addEventListener("click", function (e) { e.stopPropagation(); row.classList.toggle("selected", checkbox.checked); syncAllCheck(); updateReadActionButton(); });
            if (starBtn) starBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); var id = row.getAttribute("data-id"); var currentMail = findMailById(id); var nextStarred = currentMail ? !currentMail.starred : !starBtn.classList.contains("active"); updateStarState(id, nextStarred, starBtn, currentMail); });
            row.addEventListener("click", function (e) { if (e.target.closest(".mailCheck") || e.target.closest(".col.star")) return; if (link) location.href = link.getAttribute("href"); });
        });
    }

    async function updateStarState(id, starred, starBtn, currentMail) {
        try {
            await API.post(API_BASE + "/star-state", { id: id, starred: starred }, {
                errorMessage: "별 상태 저장 실패"
            });
            if (currentMail) currentMail.starred = starred;
            if (window.MailCommon && typeof window.MailCommon.updateStarButton === "function") window.MailCommon.updateStarButton(starBtn, starred);
            else { starBtn.classList.toggle("active", starred); starBtn.innerHTML = renderStarIcon(starred); }
        } catch (error) { console.error(error); alert("즐겨찾기 저장 중 오류가 발생했습니다."); }
    }

    async function moveSelectedToTrash() {
        var selected = getSelectedMails();
        if (!selected.length) { alert("삭제할 메일을 선택해 주세요."); return; }
        try {
            var grouped = groupByFolder(selected);
            for (var folder in grouped) await post("/trash", { ids: grouped[folder], folder: folder });
            alert("메일을 휴지통으로 이동하였습니다.");
            if (elements.allCheck) elements.allCheck.checked = false;
            loadAllMails();
        } catch (error) { console.error(error); alert("삭제 중 오류가 발생했습니다."); }
    }

    async function toggleSelectedReadState() {
        var selected = getSelectedMails();
        if (!selected.length) { alert("메일을 선택해 주세요."); return; }
        var shouldMarkUnread = !selected.some(function (mail) { return !!mail.unread; });
        try {
            var grouped = groupByFolder(selected);
            for (var folder in grouped) await post("/read-state", { ids: grouped[folder], unread: shouldMarkUnread, folder: folder });
            selected.forEach(function (mail) { mail.unread = shouldMarkUnread; });
            applyFilter();
            renderMailList();
            updateStatus();
            syncMailUnreadBadge();
            loadAllMails();
        } catch (error) { console.error(error); alert("읽음 상태 변경 중 오류가 발생했습니다."); }
    }

    function openComposeBySelection() {
        var selected = getSelectedMails();
        if (selected.length !== 1) { alert("메일 1개만 선택해 주세요."); return; }
        var mail = selected[0];
        location.href = "/mail/read.html?id=" + encodeURIComponent(mail.id) + "&folder=" + encodeURIComponent(mail.folder);
    }

    async function moveSelectedMails(toFolder) {
        var selected = getSelectedMails();
        if (!selected.length) { alert("이동할 메일을 선택해 주세요."); return; }
        try {
            var grouped = groupByFolder(selected);
            for (var fromFolder in grouped) {
                var ids = grouped[fromFolder];
                if (toFolder === "trash") await post("/trash", { ids: ids, folder: fromFolder });
                else if (toFolder === "spam") await post("/spam", { ids: ids, fromFolder: fromFolder });
                else await post("/move", { ids: ids, fromFolder: fromFolder, toFolder: toFolder });
            }
            alert("메일을 " + getMoveFolderLabel(toFolder) + "으로 이동하였습니다.");
            loadAllMails();
        } catch (error) { console.error(error); alert("이동 오류"); }
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
                if (type === "starred") toggleByCondition(function (mail) { return !!mail.starred; });
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
        if (!checkboxes.length) { elements.allCheck.checked = false; updateReadActionButton(); return; }
        elements.allCheck.checked = checkboxes.every(function (checkbox) { return checkbox.checked; });
        updateReadActionButton();
    }

    function getSelectedMails() {
        return Array.prototype.slice.call(document.querySelectorAll(".mailCheck:checked")).map(function (checkbox) { return findMailById(checkbox.getAttribute("data-id")); }).filter(Boolean);
    }

    function updateReadActionButton() {
        if (!elements.unreadBtn) return;
        var selected = getSelectedMails();
        var hasUnread = selected.some(function (mail) { return !!mail.unread; });
        elements.unreadBtn.textContent = hasUnread ? "읽음" : "안읽음";
    }

    function groupByFolder(selected) {
        var grouped = {};
        selected.forEach(function (mail) { var folder = mail.folder || "inbox"; if (!grouped[folder]) grouped[folder] = []; grouped[folder].push(mail.id); });
        return grouped;
    }

    function findMailById(id) {
        return allState.mails.find(function (mail) { return String(mail.id) === String(id); }) || null;
    }

    async function post(path, body) {
        return API.post(API_BASE + path, body, {
            errorMessage: "요청 실패"
        });
    }

    function updateStatus() {
        var unreadCount = allState.mails.filter(function (mail) { return !!mail.unread; }).length;
        if (elements.unreadCount) elements.unreadCount.textContent = unreadCount;
        if (elements.totalStatus) elements.totalStatus.innerHTML = '안읽음 <em>' + unreadCount + '</em> / ' + allState.total;
    }

    function syncMailUnreadBadge() {
        if (!window.WorkbenchMenuBadges || typeof window.WorkbenchMenuBadges.setMailUnread !== "function") return;
        var inboxUnread = allState.mails.filter(function (mail) {
            return (mail.folder || "inbox") === "inbox" && !!mail.unread;
        }).length;
        window.WorkbenchMenuBadges.setMailUnread(inboxUnread);
    }

    function renderPagination() {
        if (!elements.pagination) return;
        if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
            window.MailCommon.renderPagination(elements.pagination, allState, function () {
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
        var buttons = Array.prototype.slice.call(document.querySelectorAll(".mailActionBar .actionLeft > button"));
        return buttons.find(function (button) {
            return button.textContent.trim() === text;
        }) || null;
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr || "";
        var yyyy = d.getFullYear();
        var dateText = String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        return yyyy === new Date().getFullYear() ? dateText : yyyy + "-" + dateText;
    }

    function esc(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
})();
