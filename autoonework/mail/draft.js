(function () {
    var API_BASE = getGroupwareApiBase("/api/mail");
    var API = window.GroupwareApi;
    var DRAFT_STAR_KEY = "starredDraftIds";

    var draftState = {
        drafts: [],
        filteredDrafts: [],
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
        statusText: null,
        statusCount: null,
        pagination: null
    };

    function getCurrentUserEmail() {
        return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
    }

    document.addEventListener("DOMContentLoaded", function () {
        cacheElements();
        draftState.page = window.MailCommon && typeof window.MailCommon.getInitialPage === "function" ? window.MailCommon.getInitialPage() : 1;
        bindEvents();
        loadDrafts();
    });

    function cacheElements() {
        elements.listWrap = document.querySelector(".mailListWrap");
        elements.searchInput = document.querySelector(".mailActionSearchBox input[type='text']");
        elements.allCheck = document.getElementById("allCheck");
        elements.deleteBtn = findActionButton("삭제");
        elements.statusText = document.querySelector(".mailStatus span");
        elements.statusCount = document.querySelector(".mailStatus em");
        elements.pagination = document.querySelector(".mailPagination");
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("keydown", function (event) {
                if (event.key !== "Enter") return;
                event.preventDefault();
                draftState.keyword = this.value.trim().toLowerCase();
                draftState.page = 1;
                applyFilter();
                renderDraftList();
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
                deleteSelectedDrafts();
            });
        }
    }

    function findActionButton(text) {
        var buttons = document.querySelectorAll(".actionLeft > button");
        var found = null;

        buttons.forEach(function (btn) {
            if (btn.textContent.replace(/\s+/g, "") === text) {
                found = btn;
            }
        });

        return found;
    }

    async function loadDrafts() {
        try {
            var payload = await API.get(API_BASE + "/draft", {
                page: 1,
                pageSize: 500
            }, {
                errorMessage: "임시보관함 조회 실패"
            });

            draftState.drafts = normalizeDraftData(payload.items || []);
            draftState.total = draftState.drafts.length;
            draftState.totalPages = Math.max(1, Math.ceil(draftState.total / draftState.pageSize));

        } catch (error) {
            console.error("임시보관함 조회 실패:", error);
            draftState.drafts = [];
            draftState.total = 0;
            draftState.totalPages = 1;
        }

        applyFilter();
        renderDraftList();
        updateStatus();
        renderPagination();
    }

    async function deleteSelectedDrafts() {
        var ids = draftState.drafts
            .filter(function (d) { return d.selected; })
            .map(function (d) { return String(d.id); });

        if (ids.length === 0) {
            alert("삭제할 임시저장 메일을 선택해 주세요.");
            return;
        }

        try {
            await API.post(API_BASE + "/draft/delete", {
                    ids: ids,
                    userEmail: getCurrentUserEmail()
                }, {
                    errorMessage: "삭제 실패"
            });

            removeStarredDraftIds(ids);
            alert("삭제되었습니다.");
            loadDrafts();

        } catch (error) {
            console.error(error);
            alert("삭제 중 오류 발생");
        }
    }

    function normalizeDraftData(drafts) {
        return (drafts || [])
            .map(function (draft) {
                return {
                    id: draft.id,
                    receiver: draft.receiver || draft.to || "",
                    to: draft.to || draft.receiver || "",
                    subject: draft.subject || "(제목 없음)",
                    snippet: draft.snippet || "",
                    body: draft.body || "",
                    date: draft.date || "",
                    ownerEmail: String(draft.owner_email || "").trim().toLowerCase(),
                    selected: false,
                    starred: isStarredDraft(draft.id)
                };
            })
            .filter(function (draft) {
                return draft.ownerEmail && draft.ownerEmail === getCurrentUserEmail();
            });
    }

    function applyFilter() {
        var keyword = (draftState.keyword || "").toLowerCase();

        if (!keyword) {
            draftState.filteredDrafts = draftState.drafts.slice();
            return;
        }

        draftState.filteredDrafts = draftState.drafts.filter(function (draft) {
            var receiver = (draft.receiver || "").toLowerCase();
            var subject = (draft.subject || "").toLowerCase();
            var snippet = (draft.snippet || "").toLowerCase();

            return receiver.indexOf(keyword) > -1 ||
                   subject.indexOf(keyword) > -1 ||
                   snippet.indexOf(keyword) > -1;
        });
    }

    function renderDraftList() {
        if (!elements.listWrap) return;

        var visibleDrafts = window.MailCommon && typeof window.MailCommon.getPagedItems === "function"
            ? window.MailCommon.getPagedItems(draftState, draftState.filteredDrafts)
            : draftState.filteredDrafts;

        if (!visibleDrafts.length) {
            elements.listWrap.innerHTML = '<div class="emptyRow">임시저장된 메일이 없습니다.</div>';
            syncAllCheck();
            return;
        }

        var html = "";

        visibleDrafts.forEach(function (draft) {
            html += ''
                + '<div class="mailRow read" data-id="' + escapeHtml(draft.id) + '">'
                +   '<div class="col check"><input type="checkbox" class="mailCheck" data-id="' + escapeHtml(draft.id) + '"' + (draft.selected ? ' checked' : '') + '></div>'
                +   '<div class="col star">'
                +     '<button type="button" class="' + (draft.starred ? 'active' : '') + '">' + renderStarIcon(draft.starred) + '</button>'
                +   '</div>'
                +   renderReadStateSlot(draft)
                +   renderAttachmentSlot(draft)
                +   '<div class="col sender">' + escapeHtml(draft.receiver || "-") + '</div>'
                +   '<div class="col subject">'
                +     '<a href="/mail/compose.html?mode=draft&id=' + encodeURIComponent(draft.id) + '">' + escapeHtml(draft.subject || "(제목 없음)") + '</a>'
                +   '</div>'
                +   '<div class="col date">' + formatDate(draft.date) + '</div>'
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
                    setSelected(checkbox.getAttribute("data-id"), checkbox.checked);
                    row.classList.toggle("selected", checkbox.checked);
                    syncAllCheck();
                });
            }

            if (starBtn) {
                starBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    var id = row.getAttribute("data-id");
                    var currentDraft = findDraftById(id);
                    var nextStarred = currentDraft ? !currentDraft.starred : !starBtn.classList.contains("active");

                    updateDraftStarState(id, nextStarred, starBtn, currentDraft);
                });
            }

            row.addEventListener("click", function (e) {
                if (e.target.closest(".mailCheck") || e.target.closest(".col.star")) return;
                if (link) location.href = link.getAttribute("href");
            });
        });
    }

    function setSelected(id, checked) {
        draftState.drafts.forEach(function (draft) {
            if (String(draft.id) === String(id)) draft.selected = checked;
        });

        draftState.filteredDrafts.forEach(function (draft) {
            if (String(draft.id) === String(id)) draft.selected = checked;
        });
    }

    function toggleAllChecked(checked) {
        draftState.filteredDrafts.forEach(function (draft) {
            draft.selected = checked;
            draftState.drafts.forEach(function (original) {
                if (String(original.id) === String(draft.id)) original.selected = checked;
            });
        });

        var checkboxes = document.querySelectorAll(".mailCheck");
        checkboxes.forEach(function (checkbox) {
            checkbox.checked = checked;
            var row = checkbox.closest(".mailRow");
            if (row) row.classList.toggle("selected", checked);
        });
    }

    function syncAllCheck() {
        if (!elements.allCheck) return;

        var checkboxes = Array.prototype.slice.call(document.querySelectorAll(".mailCheck"));
        if (!checkboxes.length) {
            elements.allCheck.checked = false;
            return;
        }

        elements.allCheck.checked = checkboxes.every(function (checkbox) {
            return checkbox.checked;
        });
    }

    function updateStatus() {
        if (elements.statusCount) elements.statusCount.textContent = draftState.total;
        if (elements.statusText) elements.statusText.textContent = '전체 ' + draftState.total;
    }

    function renderPagination() {
        if (!elements.pagination) return;
        if (window.MailCommon && typeof window.MailCommon.renderPagination === "function") {
            window.MailCommon.renderPagination(elements.pagination, draftState, function () {
                renderDraftList();
                renderPagination();
            });
        }
    }

    function getStarredDraftIds() {
        try {
            var saved = localStorage.getItem(DRAFT_STAR_KEY);
            if (!saved) return [];
            var parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function saveStarredDraftIds(ids) {
        localStorage.setItem(DRAFT_STAR_KEY, JSON.stringify(ids || []));
    }

    function isStarredDraft(id) {
        return getStarredDraftIds().indexOf(String(id)) > -1;
    }

    function updateDraftStarState(id, starred, starBtn, currentDraft) {
        try {
            var ids = getStarredDraftIds();
            var targetId = String(id);

            if (starred) {
                if (ids.indexOf(targetId) === -1) ids.push(targetId);
            } else {
                ids = ids.filter(function (rowId) {
                    return String(rowId) !== targetId;
                });
            }

            saveStarredDraftIds(ids);

            if (currentDraft) currentDraft.starred = starred;

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

    function removeStarredDraftIds(idsToRemove) {
        var ids = getStarredDraftIds();
        ids = ids.filter(function (rowId) {
            return idsToRemove.indexOf(String(rowId)) === -1;
        });
        saveStarredDraftIds(ids);
    }

    function findDraftById(id) {
        return draftState.drafts.find(function (draft) {
            return String(draft.id) === String(id);
        }) || null;
    }

    function formatDate(value) {
        if (!value) return "";
        var date = new Date(value);
        if (isNaN(date.getTime())) return value;
        var yyyy = date.getFullYear();
        var mm = pad(date.getMonth() + 1);
        var dd = pad(date.getDate());
        var hh = pad(date.getHours());
        var mi = pad(date.getMinutes());
        var dateText = mm + "-" + dd + " " + hh + ":" + mi;
        return yyyy === new Date().getFullYear() ? dateText : yyyy + "-" + dateText;
    }

    function pad(num) {
        return num < 10 ? "0" + num : String(num);
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
