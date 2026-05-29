(function () {
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
var API = window.GroupwareApi;
    var state = { user: null, items: [] };

    document.addEventListener("DOMContentLoaded", function () {
        initializeApprovalTempPage();
    });

    async function initializeApprovalTempPage() {
        state.user = getCurrentApprovalUser();
        await loadTempDocuments();
    }

    async function loadTempDocuments() {
        var tbody = document.querySelector(".approvalTempListBody");
        if (!tbody) return;

        if (!state.user || !state.user.id) {
            renderTempEmpty("로그인 정보가 없습니다.");
            return;
        }

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents", {
                box: "draft",
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "임시저장 문서를 불러오지 못했습니다." });
            state.items = Array.isArray(data.items) ? data.items : [];
            renderTempDocuments();
        } catch (error) {
            renderTempEmpty(error.message || "임시저장 문서를 불러오지 못했습니다.");
        }
    }

    function renderTempDocuments() {
        var tbody = document.querySelector(".approvalTempListBody");
        if (!tbody) return;

        if (!state.items.length) {
            renderTempEmpty("임시저장된 문서가 없습니다.");
            return;
        }

        tbody.innerHTML = state.items.map(function (item) {
            return '<tr class="approvalListRow" data-id="' + escapeApprovalHtml(item.id || "") + '">' +
                '<td>' + escapeApprovalHtml(item.docNo || "-") + '</td>' +
                '<td>' + escapeApprovalHtml(item.docType || "-") + '</td>' +
                '<td class="approvalListTitleCell">' + escapeApprovalHtml(item.title || "제목 없음") + '</td>' +
                '<td>' + escapeApprovalHtml(item.authorName || "-") + '</td>' +
                '<td>' + escapeApprovalHtml(formatApprovalDateTime(item.updatedAt || item.createdAt || "")) + '</td>' +
                '<td><button type="button" class="approvalTempDeleteBtn" data-id="' + escapeApprovalHtml(item.id || "") + '">삭제</button></td>' +
            '</tr>';
        }).join("");

        tbody.querySelectorAll(".approvalListRow").forEach(function (row) {
            row.addEventListener("click", function () {
                var id = row.getAttribute("data-id") || "";
                if (!id) return;
                location.href = "drafting.html?approvalId=" + encodeURIComponent(id);
            });
        });

        tbody.querySelectorAll(".approvalTempDeleteBtn").forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                var id = button.getAttribute("data-id") || "";
                if (id) deleteTempDocument(id);
            });
        });
    }

    function renderTempEmpty(message) {
        var tbody = document.querySelector(".approvalTempListBody");
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="approvalListEmpty">' + escapeApprovalHtml(message || "임시저장된 문서가 없습니다.") + '</td></tr>';
    }

    async function deleteTempDocument(id) {
        if (!confirm("임시저장 문서를 삭제하시겠습니까?")) return;

        try {
            await API.post(APPROVAL_API_BASE + "/documents/delete", {
                id: id,
                requesterId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "임시저장 문서를 삭제하지 못했습니다." });
            state.items = state.items.filter(function (item) {
                return item.id !== id;
            });
            renderTempDocuments();
        } catch (error) {
            alert(error.message || "임시저장 문서 삭제 중 오류가 발생했습니다.");
        }
    }

    function getCurrentApprovalUser() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            var user = window.AuthStore.getCurrentUser();
            if (user) return user;
        }
        return {
            id: String(localStorage.getItem("userId") || "").trim().toLowerCase(),
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase(),
            email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
            department: String(localStorage.getItem("userDepartment") || "").trim()
        };
    }

    function formatApprovalDateTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + padApprovalValue(date.getMonth() + 1) + "." + padApprovalValue(date.getDate()) + " " + padApprovalValue(date.getHours()) + ":" + padApprovalValue(date.getMinutes());
    }

    function padApprovalValue(value) {
        return String(value).padStart(2, "0");
    }

    function escapeApprovalHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
