(function () {
    var API_BASE = getGroupwareApiBase("/api/attendance");
    var API = window.GroupwareApi;
    var state = {
        employees: [],
        rows: [],
        refreshTimerId: null
    };
    var elements = {};

    document.addEventListener("DOMContentLoaded", async function () {
        if (!(await ensureAdmin())) return;
        cacheElements();
        initializePage();
    });

    async function ensureAdmin() {
        await waitForAuthStore();

        if (window.AuthStore && typeof window.AuthStore.canAccessAdminPages === "function" && window.AuthStore.canAccessAdminPages()) {
            return true;
        }

        alert("접근 권한이 없습니다.");
        location.href = "/";
        return false;
    }

    function waitForAuthStore() {
        return new Promise(function (resolve) {
            var startedAt = Date.now();

            function check() {
                if (window.AuthStore && typeof window.AuthStore.canAccessAdminPages === "function") {
                    resolve();
                    return;
                }
                if (Date.now() - startedAt > 2000) {
                    resolve();
                    return;
                }
                setTimeout(check, 30);
            }

            check();
        });
    }

    function cacheElements() {
        elements.dateLabel = document.querySelector(".attendAdminDateLabel");
        elements.totalCount = document.querySelector(".attendAdminTotalCount");
        elements.checkInCount = document.querySelector(".attendAdminCheckInCount");
        elements.checkOutCount = document.querySelector(".attendAdminCheckOutCount");
        elements.missingCount = document.querySelector(".attendAdminMissingCount");
        elements.tableBody = document.querySelector(".attendAdminBody");
    }

    async function initializePage() {
        await refreshAttendance();
        startAutoRefresh();
    }

    async function refreshAttendance() {
        try {
            var results = await Promise.all([
                fetchEmployees(),
                API.get(API_BASE + "/admin/today", { requesterRole: "admin" }, {
                    errorMessage: "근태 정보를 불러오지 못했습니다."
                })
            ]);
            state.employees = results[0];
            var data = results[1];

            state.rows = Array.isArray(data.items) ? data.items.filter(isVisibleAttendanceRow) : [];
            render();
        } catch (error) {
            if (elements.tableBody && !state.rows.length) {
                elements.tableBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="6">근태 정보를 불러오지 못했습니다.</td></tr>';
            }
        }
    }

    async function fetchEmployees() {
        if (window.AuthStore && typeof window.AuthStore.getEmployees === "function") {
            return await window.AuthStore.getEmployees({ mergeAttendance: false });
        }
        return [];
    }

    function startAutoRefresh() {
        if (state.refreshTimerId) clearInterval(state.refreshTimerId);
        state.refreshTimerId = setInterval(refreshAttendance, 10000);

        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) refreshAttendance();
        });
    }

    function render() {
        if (elements.dateLabel) elements.dateLabel.textContent = buildTodayLabel(new Date());

        var rows = buildRows();
        var checkInCount = rows.filter(function (item) { return item.statusKey === "working" || item.statusKey === "done"; }).length;
        var checkOutCount = rows.filter(function (item) { return item.statusKey === "done"; }).length;
        var missingCount = rows.filter(function (item) { return item.statusKey === "missing"; }).length;

        if (elements.totalCount) elements.totalCount.textContent = rows.length;
        if (elements.checkInCount) elements.checkInCount.textContent = checkInCount;
        if (elements.checkOutCount) elements.checkOutCount.textContent = checkOutCount;
        if (elements.missingCount) elements.missingCount.textContent = missingCount;

        if (!elements.tableBody) return;
        if (!rows.length) {
            elements.tableBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="6">표시할 직원 근태 정보가 없습니다.</td></tr>';
            return;
        }

        elements.tableBody.innerHTML = rows.map(function (row) {
            return ''
                + '<tr>'
                + '<td>' + escapeHtml(row.name) + '</td>'
                + '<td>' + escapeHtml(row.id) + '</td>'
                + '<td>' + escapeHtml(row.checkInText) + '</td>'
                + '<td>' + escapeHtml(row.checkOutText) + '</td>'
                + '<td>' + escapeHtml(row.workedText) + '</td>'
                + '<td><span class="attendStateBadge ' + escapeHtml(row.badgeClass) + '">' + escapeHtml(row.statusLabel) + '</span></td>'
                + '</tr>';
        }).join("");
    }

    function buildRows() {
        return state.rows.map(function (row) {
            var status = buildRecordStatus(row);
            return {
                id: row.id || "-",
                name: row.name || "-",
                checkInText: formatIsoTime(row.checkIn),
                checkOutText: formatIsoTime(row.checkOut),
                workedText: formatWorkedTime(row.checkIn, row.checkOut),
                statusLabel: status.label,
                badgeClass: status.className,
                statusKey: status.className === "is-done" ? "done" : (status.className === "is-working" ? "working" : "missing")
            };
        });
    }

    function isVisibleAttendanceRow(row) {
        var id = String(row && row.id || "").trim().toLowerCase();
        var name = String(row && row.name || "").trim();
        var employee = findEmployeeById(id) || findEmployeeByName(name);
        if (!employee) return false;
        var role = String(employee && employee.role || row && row.role || "").trim().toLowerCase();
        var department = String(employee && employee.department || row && row.department || "").trim();
        return role !== "ceo" && department !== "대표" && id !== "admin" && id !== "work" && id !== "test" && name !== "관리자" && name !== "홍길동";
    }

    function findEmployeeById(id) {
        return state.employees.find(function (employee) {
            return String(employee && employee.id || "").trim().toLowerCase() === String(id || "").trim().toLowerCase();
        }) || null;
    }

    function findEmployeeByName(name) {
        return state.employees.find(function (employee) {
            return String(employee && employee.name || "").trim() === String(name || "").trim();
        }) || null;
    }

    function buildRecordStatus(record) {
        if (!record || !record.checkIn) {
            return { label: "미출근", className: "is-missing" };
        }
        if (record.checkIn && !record.checkOut) {
            return { label: "근무중", className: "is-working" };
        }
        return { label: "퇴근완료", className: "is-done" };
    }

    function buildTodayLabel(date) {
        var days = ["일", "월", "화", "수", "목", "금", "토"];
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) + " (" + days[date.getDay()] + ")";
    }

    function formatIsoTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatWorkedTime(checkIn, checkOut) {
        if (!checkIn) return "-";
        var start = new Date(checkIn);
        if (isNaN(start.getTime())) return "-";
        var end = checkOut ? new Date(checkOut) : new Date();
        if (isNaN(end.getTime()) || end.getTime() < start.getTime()) return "-";

        var diffMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
        var hours = Math.floor(diffMinutes / 60);
        var minutes = diffMinutes % 60;
        return hours + "시간 " + minutes + "분";
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
