(function () {
    var API_BASE = getGroupwareApiBase("/api/mail");
    var API = window.GroupwareApi;

    var spamState = {
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
        moveAction: null,
        moveBtn: null,
        moveDropdown: null,
        moveItems: [],
        blockBtn: null,
        releaseBtn: null,
        statusText: null,
        statusCount: null,
        pagination: null
    };

    document.addEventListener("DOMContentLoaded", function () {
        cacheElements();
        spamState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1;
        renderMoveDropdown();
        bindEvents();
        loadSpamMails();
        window.refreshMailList = loadSpamMails;
    });

    function cacheElements() {
        elements.listWrap = document.querySelector(".mailListWrap");
        elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
        elements.refreshBtn = document.querySelector(".refreshBtn");
        elements.allCheck = document.getElementById("allCheck");
        elements.moveAction = document.querySelector(".moveAction");
        elements.moveBtn = document.querySelector(".moveBtn");
        elements.moveDropdown = document.querySelector(".moveDropdown");
        elements.blockBtn = document.querySelector(".blockBtn");
        elements.releaseBtn = document.querySelector(".releaseBtn");
        elements.statusText = document.querySelector(".mailStatus span");
        elements.statusCount = document.querySelector(".mailStatus em");
        elements.pagination = document.querySelector(".mailPagination");
    }

    function renderMoveDropdown() {
        if (window.MailCommon && typeof window.MailCommon.renderMoveDropdown === "function" && elements.moveDropdown) {
            elements.moveItems = window.MailCommon.renderMoveDropdown(elements.moveDropdown);
        } else {
            elements.moveItems = Array.prototype.slice.call(document.querySelectorAll(".moveDropdown button"));
        }
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("keydown", function (event) {
                if (event.key !== "Enter") return;
                event.preventDefault();
                spamState.keyword = this.value.trim().toLowerCase();
                spamState.page = 1;
                applyFilter();
                renderSpamList();
                updateStatus();
                renderPagination();
            });
        }

        if (elements.allCheck) elements.allCheck.addEventListener("change", function () { toggleAllChecked(this.checked); });
        if (elements.releaseBtn) elements.releaseBtn.addEventListener("click", function () { moveSelected("inbox"); });
        if (elements.blockBtn) elements.blockBtn.addEventListener("click", function () { alert("수신차단 기능은 다음 단계에서 연결하면 됩니다."); });

        bindMoveDropdownEvents();
    }

    async function loadSpamMails() {
        try {
            if (elements.listWrap) elements.listWrap.innerHTML = '<div class="emptyRow">메일을 불러오는 중입니다.</div>';
            var payload = await API.get(API_BASE + "/spam", {
                page: 1,
                pageSize: 500
            }, {
                errorMessage: "조회 실패"
            });

            spamState.mails = (payload.items || []).map(function (item) {
                item.selected = false;
                return item;
            });
            spamState.total = spamState.mails.length;
            spamState.totalPages = Math.max(1, Math.ceil(spamState.total / spamState.pageSize));
        } catch (error) {
            console.error(error);
            spamState.mails = [];
            spamState.total = 0;
            spamState.totalPages = 1;
        }

        applyFilter();
        renderSpamList();
        updateStatus();
        renderPagination();
    }

    function applyFilter() {
        if (!spamState.keyword) {
            spamState.filteredMails = spamState.mails.slice();
            return;
        }

        spamState.filteredMails = spamState.mails.filter(function (mail) {
            return String(mail.from_name || mail.from || "").toLowerCase().indexOf(spamState.keyword) > -1 ||
                   String(mail.subject || "").toLowerCase().indexOf(spamState.keyword) > -1 ||
                   String(mail.snippet || "").toLowerCase().indexOf(spamState.keyword) > -1;
        });
    }

    function renderSpamList() {
        if (!elements.listWrap) return;

        var visibleMails = window.MailCommon && typeof window.MailCommon.getPagedItems === "function"
            ? window.MailCommon.getPagedItems(spamState, spamState.filteredMails)
            : spamState.filteredMails;

        if (!visibleMails.length) {
            elements.listWrap.innerHTML = '<div class="emptyRow">메일이 없습니다.</div>';
            syncAllCheck();
            return;
        }

        var html = "";
        visibleMails.forEach(function (mail) {
            html += '<div class="mailRow ' + (mail.unread ? 'unread' : 'read') + '" data-id="' + esc(mail.id) + '">';
            html += '<div class="col check"><input type="checkbox" class="rowCheck" data-id="' + esc(mail.id) + '"></div>';
            html += '<div class="col star"><button type="button" class="' + (mail.starred ? 'active' : '') + '">' + renderStarIcon(mail.starred) + '</button></div>';
            html += renderReadStateSlot(mail);
            html += renderAttachmentSlot(mail);
            html += '<div class="col sender">' + esc(mail.from_name || mail.from || "-") + '</div>';
            html += '<div class="col subject"><a href="/mail/read.html?id=' + encodeURIComponent(mail.id) + '&folder=spam" class="mailSubjectLink">' + esc(mail.subject || "(제목 없음)") + '</a></div>';
            html += '<div class="col date">' + formatDate(mail.date) + '</div>';
            html += '</div>';
        });

        elements.listWrap.innerHTML = html;
        bindRowEvents();
        syncAllCheck();
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
                if (e.target.closest(".rowCheck") || e.target.closest(".col.star")) return;
                if (link) location.href = link.getAttribute("href");
            });
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

    function findMailById(id) {
        return spamState.mails.find(function (mail) { return String(mail.id) === String(id); }) || null;
    }

    async function moveSelected(targetFolder) {
        var ids = selectedIds();
        if (!ids.length) {
            alert("이동할 메일을 선택해 주세요.");
            return;
        }

        try {
            if (targetFolder === "trash") {
                await post("/trash", { ids: ids, folder: "spam" });
            } else {
                await post("/move", { ids: ids, fromFolder: "spam", toFolder: targetFolder });
            }
            alert("메일을 " + getMoveFolderLabel(targetFolder) + "으로 이동하였습니다.");
            loadSpamMails();
        } catch (error) {
            console.error(error);
            alert("이동 중 오류가 발생했습니다.");
        }
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
                moveSelected(folder);
            });
        });

        document.addEventListener("click", function (e) {
            if (elements.moveAction && !elements.moveAction.contains(e.target) && !elements.moveDropdown.contains(e.target)) {
                elements.moveAction.classList.remove("is-open");
                if (window.MailCommon && typeof window.MailCommon.updateMoveButtonIcon === "function") {
                    window.MailCommon.updateMoveButtonIcon(elements.moveAction, elements.moveBtn);
                }
            }
        });
    }

    function selectedIds() {
        return Array.prototype.slice.call(document.querySelectorAll(".rowCheck:checked")).map(function (checkbox) {
            return checkbox.getAttribute("data-id");
        });
    }

    function toggleAllChecked(checked) {
        Array.prototype.slice.call(document.querySelectorAll(".rowCheck")).forEach(function (cb) {
            cb.checked = checked;
            var row = cb.closest(".mailRow");
            if (row) row.classList.toggle("selected", checked);
        });
        syncAllCheck();
    }

    function syncAllCheck() {
        if (!elements.allCheck) return;
        var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".rowCheck"));
        if (!checkboxes.length) {
            elements.allCheck.checked = false;
            return;
        }
        elements.allCheck.checked = checkboxes.every(function (cb) { return cb.checked; });
    }

    async function post(path, body) {
        return API.post(API_BASE + path, body, {
            errorMessage: "요청 실패"
        });
    }

    function updateStatus() {
        if (elements.statusCount) elements.statusCount.textContent = spamState.total;
        if (elements.statusText) elements.statusText.textContent = '전체 ' + spamState.total;
    }

    function renderPagination() {
        if (!elements.pagination) return;
        if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
            window.MailCommon.renderPagination(elements.pagination, spamState, function () {
                renderSpamList();
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
