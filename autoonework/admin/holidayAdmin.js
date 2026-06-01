(function () {
    var AUTH_API_BASE = getGroupwareApiBase("/api/auth");
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
    var API = window.GroupwareApi;
    var state = {
        user: null,
        employees: [],
        approvalItems: [],
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
            state.user = window.AuthStore.getCurrentUser ? window.AuthStore.getCurrentUser() : null;
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
        elements.dateLabel = document.querySelector(".holidayAdminDateLabel");
        elements.totalCount = document.querySelector(".holidayAdminTotalCount");
        elements.usedCount = document.querySelector(".holidayAdminUsedCount");
        elements.tableBody = document.querySelector(".holidayAdminBody");
    }

    async function initializePage() {
        renderLoading();
        await refreshHolidayStatus();
        startAutoRefresh();
    }

    function renderLoading() {
        if (elements.dateLabel) elements.dateLabel.textContent = buildCurrentMonthLabel(new Date());
        if (elements.totalCount) elements.totalCount.textContent = "0";
        if (elements.usedCount) elements.usedCount.textContent = "0d";
        if (elements.tableBody) {
            elements.tableBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="8">휴가 정보를 불러오는 중입니다.</td></tr>';
        }
    }

    async function refreshHolidayStatus() {
        try {
            var results = await Promise.all([
                fetchEmployees(),
                fetchApprovedVacationItems()
            ]);
            var employees = results[0];
            var approvalItems = results[1];
            state.employees = employees.filter(isVisibleEmployee);
            state.approvalItems = approvalItems;
            state.rows = buildRows();
            render();
        } catch (error) {
            if (elements.tableBody) {
                elements.tableBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="8">' + escapeHtml(error.message || "휴가 정보를 불러오지 못했습니다.") + '</td></tr>';
            }
        }
    }

    function startAutoRefresh() {
        if (state.refreshTimerId) clearInterval(state.refreshTimerId);
        state.refreshTimerId = setInterval(refreshHolidayStatus, 30000);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) refreshHolidayStatus();
        });
    }

    async function fetchEmployees() {
        if (window.AuthStore && typeof window.AuthStore.getEmployees === "function") {
            return await window.AuthStore.getEmployees({ mergeAttendance: false });
        }
        var data = await API.get(AUTH_API_BASE + "/employees", { requesterRole: "admin" }, {
            errorMessage: "직원 정보를 불러오지 못했습니다."
        });
        return Array.isArray(data.items) ? data.items : [];
    }

    async function fetchApprovedVacationItems() {
        var data = await API.get(APPROVAL_API_BASE + "/documents", {
            box: "approved",
            requesterRole: "admin",
            userId: getCurrentUserId()
        }, {
            errorMessage: "승인된 휴가원을 불러오지 못했습니다."
        });

        var summaries = (Array.isArray(data.items) ? data.items : []).filter(function (item) {
            return item && item.status === "approved" && normalizeVacationDocType(item.docType) === "휴가원";
        });

        var documents = await Promise.all(summaries.map(function (item) {
            return loadApprovalDocumentDetail(item.id);
        }));

        return documents.filter(Boolean).map(mapApprovalVacationToItem).filter(Boolean);
    }

    async function loadApprovalDocumentDetail(id) {
        if (!id) return null;
        var requesterId = getCurrentUserId();
        if (!requesterId) return null;
        var data = await API.get(APPROVAL_API_BASE + "/documents/read", {
            id: id,
            userId: requesterId,
            requesterRole: "admin"
        }, {
            errorMessage: "문서 상세를 불러오지 못했습니다."
        }).catch(function () { return {}; });
        if (!data.item) return null;
        return data.item;
    }

    function buildRows() {
        return state.employees.map(function (employee) {
            var hireDate = resolveHireDate(employee);
            var period = buildAnnualPeriod(hireDate, new Date());
            var grantedBase = calculateGrantedDaysForPeriod(hireDate, period);
            var extraDays = normalizeExtraVacationDays(employee && employee.extraVacationDays || 0);
            var items = state.approvalItems.filter(function (vacationItem) {
                return isVacationItemForEmployee(vacationItem, employee);
            });
            var usedDays = calculateUsedDaysForPeriod(items, period.start, period.end);
            var remainingDays = Math.max(0, grantedBase + extraDays - usedDays);

            return {
                id: employee && employee.id || "",
                name: employee && employee.name || "-",
                hireDate: hireDate ? formatDate(hireDate) : "-",
                periodText: buildPeriodLabel(period),
                grantedBase: grantedBase,
                usedDays: usedDays,
                extraDays: extraDays,
                remainingDays: remainingDays
            };
        }).sort(function (a, b) {
            return String(a.name || "").localeCompare(String(b.name || ""), "ko");
        });
    }

    function render() {
        if (elements.dateLabel) elements.dateLabel.textContent = buildCurrentMonthLabel(new Date());
        if (elements.totalCount) elements.totalCount.textContent = String(state.employees.filter(isVisibleEmployee).length);
        if (elements.usedCount) elements.usedCount.textContent = formatDayCount(getCurrentMonthUsedDays());

        if (!elements.tableBody) return;
        if (!state.rows.length) {
            elements.tableBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="8">표시할 직원 휴가 정보가 없습니다.</td></tr>';
            return;
        }

        elements.tableBody.innerHTML = state.rows.map(function (row) {
            return ''
                + '<tr>'
                + '<td>' + escapeHtml(row.name) + '</td>'
                + '<td>' + escapeHtml(row.hireDate) + '</td>'
                + '<td>' + escapeHtml(row.periodText) + '</td>'
                + '<td>' + escapeHtml(formatDayCount(row.grantedBase)) + '</td>'
                + '<td>' + escapeHtml(formatDayCount(row.usedDays)) + '</td>'
                + '<td><span class="holidayAdminExtraBadge">' + escapeHtml(formatDayCount(row.extraDays)) + '</span></td>'
                + '<td>' + escapeHtml(formatDayCount(row.remainingDays)) + '</td>'
                + '<td><div class="holidayAdminAction"><input type="number" min="0.5" step="0.5" class="holidayAdminAdjustInput" data-holiday-input="' + escapeHtml(row.id) + '" placeholder="0.5"><button type="button" class="holidayAdminAdjustBtn" data-holiday-add="' + escapeHtml(row.id) + '">추가</button></div></td>'
                + '</tr>';
        }).join("");

        bindTableEvents();
    }

    function bindTableEvents() {
        Array.prototype.slice.call(document.querySelectorAll("[data-holiday-add]")).forEach(function (button) {
            button.addEventListener("click", function () {
                addVacationDays(String(button.getAttribute("data-holiday-add") || "").trim());
            });
        });
    }

    async function addVacationDays(employeeId) {
        var input = document.querySelector('[data-holiday-input="' + employeeId + '"]');
        var raw = input ? String(input.value || "").trim() : "";
        var deltaDays = Number(raw);
        if (!deltaDays || !isFinite(deltaDays) || deltaDays <= 0) {
            alert("추가할 휴가 일수를 입력해주세요.");
            if (input) input.focus();
            return;
        }

        try {
            if (input) input.disabled = true;
            await API.post(AUTH_API_BASE + "/employees/update-extra-vacation-days", {
                    id: employeeId,
                    deltaDays: deltaDays,
                    requesterRole: "admin"
                }, {
                    errorMessage: "추가 연차 저장에 실패했습니다."
            });
            if (input) input.value = "";
            await refreshHolidayStatus();
        } catch (error) {
            alert(error.message || "추가 연차 저장 중 오류가 발생했습니다.");
        } finally {
            if (input) input.disabled = false;
        }
    }

    function sumRows(key) {
        return state.rows.reduce(function (sum, row) {
            return sum + Number(row && row[key] || 0);
        }, 0);
    }

    function isVisibleEmployee(employee) {
        var role = String(employee && employee.role || "").trim().toLowerCase();
        var department = String(employee && employee.department || "").trim();
        var id = String(employee && employee.id || "").trim().toLowerCase();
        var name = String(employee && employee.name || "").trim();
        return role !== "admin" && role !== "ceo" && department !== "대표" && id !== "admin" && id !== "work" && id !== "test" && name !== "관리자" && name !== "홍길동";
    }

    function isVacationItemForEmployee(item, employee) {
        var employeeId = String(employee && (employee.id || employee.authorId) || "").trim().toLowerCase();
        var authorId = String(item && item.authorId || "").trim().toLowerCase();
        if (employeeId && authorId) return employeeId === authorId;
        var employeeName = String(employee && (employee.name || employee.authorName) || "").trim();
        var authorName = String(item && item.authorName || "").trim();
        return Boolean(employeeName && authorName && employeeName === authorName);
    }

    function isCurrentMonthVacationItem(item) {
        if (!item) return false;
        var today = new Date();
        var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        var monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        var start = parseFlexibleDate(item.startDate);
        var end = parseFlexibleDate(item.endDate || item.startDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        return start <= monthEnd && end >= monthStart;
    }

    function mapApprovalVacationToItem(item) {
        var vacation = item && item.vacationInfo && typeof item.vacationInfo === "object" ? item.vacationInfo : {};
        var startDate = normalizeDateValue(vacation.startDate || vacation.start || "");
        var endDate = normalizeDateValue(vacation.endDate || vacation.end || startDate);
        var type = normalizeVacationType(vacation.type || "연차");
        if (!startDate) return null;
        return {
            authorId: String(item.authorId || "").trim().toLowerCase(),
            authorName: String(item.authorName || "").trim(),
            type: type,
            days: resolveVacationDays(vacation, type, startDate, endDate),
            startDate: startDate,
            endDate: endDate || startDate
        };
    }

    function getCurrentMonthUsedDays() {
        return state.approvalItems.filter(isCurrentMonthVacationItem).reduce(function (sum, item) {
            return sum + Number(item && item.days || 0);
        }, 0);
    }

    function resolveHireDate(employee) {
        var raw = employee && employee.hireDate ? String(employee.hireDate || "").trim() : "";
        if (!raw) return null;
        var date = parseFlexibleDate(raw);
        return isNaN(date.getTime()) ? null : date;
    }

    function buildServiceInfo(hireDate) {
        if (!hireDate) return "-";
        var now = new Date();
        var months = (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
        if (now.getDate() < hireDate.getDate()) months -= 1;
        if (months < 0) months = 0;
        var years = Math.floor(months / 12);
        var remainMonths = months % 12;
        if (years <= 0) return remainMonths + "m";
        if (remainMonths <= 0) return years + "y";
        return years + "y " + remainMonths + "m";
    }

    function buildAnnualPeriod(hireDate, referenceDate) {
        if (!hireDate) return { start: null, end: null };
        var reference = referenceDate instanceof Date ? referenceDate : new Date();
        var startYear = reference.getFullYear();
        var currentCycleStart = buildAnniversaryDate(hireDate, startYear);
        if (reference < currentCycleStart) {
            startYear -= 1;
            currentCycleStart = buildAnniversaryDate(hireDate, startYear);
        }
        var nextCycleStart = buildAnniversaryDate(hireDate, startYear + 1);
        var currentCycleEnd = new Date(nextCycleStart.getTime());
        currentCycleEnd.setDate(currentCycleEnd.getDate() - 1);
        return { start: currentCycleStart, end: currentCycleEnd };
    }

    function buildAnniversaryDate(hireDate, year) {
        var month = hireDate.getMonth();
        var day = hireDate.getDate();
        var lastDay = new Date(year, month + 1, 0).getDate();
        return new Date(year, month, Math.min(day, lastDay));
    }

    function buildPeriodLabel(period) {
        if (!period || !period.start || !period.end) return "-";
        return formatDateInput(period.start) + " ~ " + formatDateInput(period.end);
    }

    function calculateGrantedDaysForPeriod(hireDate, period) {
        if (!hireDate || !period || !period.start || !period.end) return 0;
        var serviceMonthsAtStart = calculateMonthDiff(hireDate, period.start);
        if (serviceMonthsAtStart < 12) {
            var serviceMonthsAtEnd = calculateMonthDiff(hireDate, period.end);
            return Math.min(Math.max(serviceMonthsAtEnd, 0), 11);
        }
        var serviceYearsAtStart = Math.floor(serviceMonthsAtStart / 12);
        return 15 + Math.max(0, Math.floor((serviceYearsAtStart - 1) / 2));
    }

    function calculateUsedDaysForPeriod(items, startDate, endDate) {
        return (Array.isArray(items) ? items : []).reduce(function (total, item) {
            if (!isDeductibleVacationType(item && item.type)) return total;
            return total + calculateUsedDaysInRange(item, startDate, endDate);
        }, 0);
    }

    function calculateUsedDaysInRange(item, startDate, endDate) {
        var totalDays = Number(item && item.days || 0);
        if (!totalDays) return 0;
        var rangeStartDate = startDate instanceof Date ? startDate : parseFlexibleDate(startDate);
        var rangeEndDate = endDate instanceof Date ? endDate : parseFlexibleDate(endDate);
        var itemStart = parseFlexibleDate(item.startDate);
        var itemEnd = parseFlexibleDate(item.endDate || item.startDate);
        if (isNaN(rangeStartDate.getTime()) || isNaN(rangeEndDate.getTime()) || isNaN(itemStart.getTime()) || isNaN(itemEnd.getTime())) return 0;
        var overlapStart = itemStart > rangeStartDate ? itemStart : rangeStartDate;
        var overlapEnd = itemEnd < rangeEndDate ? itemEnd : rangeEndDate;
        if (overlapEnd < overlapStart) return 0;
        if (String(item.type || "").indexOf("반차") > -1) return totalDays;
        var overlapDays = calculateInclusiveDays(formatDateInput(overlapStart), formatDateInput(overlapEnd));
        var fullRangeDays = calculateInclusiveDays(item.startDate, item.endDate || item.startDate);
        if (!fullRangeDays) return totalDays;
        return Math.min(totalDays, overlapDays);
    }

    function isDeductibleVacationType(type) {
        var normalized = normalizeVacationType(type);
        return normalized === "연차" || normalized === "월차" || normalized === "오전 반차" || normalized === "오후 반차";
    }

    function normalizeVacationDocType(value) {
        var normalized = String(value || "").trim();
        return normalized === "연차휴가 계획서" ? "휴가원" : normalized;
    }

    function normalizeVacationType(value) {
        var normalized = String(value || "").trim() || "연차";
        if (normalized === "오전반차") return "오전 반차";
        if (normalized === "오후반차") return "오후 반차";
        return normalized;
    }

    function normalizeDateValue(value) {
        var normalized = String(value || "").trim();
        if (!normalized) return "";
        if (/^[0-9]{8}$/.test(normalized)) return normalized.slice(0, 4) + "-" + normalized.slice(4, 6) + "-" + normalized.slice(6, 8);
        normalized = normalized.replace(/\./g, "-");
        var match = normalized.match(/[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}/);
        if (!match) return "";
        var parts = match[0].split("-");
        return parts[0] + "-" + pad(parts[1]) + "-" + pad(parts[2]);
    }

    function resolveVacationDays(vacation, type, startDate, endDate) {
        var raw = String(vacation.days || vacation.daysText || vacation.dayCount || "").trim();
        var parsed = Number(raw.replace(/[^0-9.]/g, ""));
        if (isFinite(parsed) && parsed > 0) return parsed;
        if (String(type || "").indexOf("반차") > -1) return 0.5;
        return calculateInclusiveDays(startDate, endDate);
    }

    function calculateInclusiveDays(startDate, endDate) {
        var start = parseFlexibleDate(startDate);
        var end = parseFlexibleDate(endDate || startDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
        var diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
        return diff > 0 ? diff : 0;
    }

    function calculateMonthDiff(startDate, endDate) {
        var months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
        if (endDate.getDate() < startDate.getDate()) months -= 1;
        return months < 0 ? 0 : months;
    }

    function parseFlexibleDate(value) {
        var normalized = String(value || "").trim();
        if (/^[0-9]{8}$/.test(normalized)) {
            return new Date(Number(normalized.slice(0, 4)), Number(normalized.slice(4, 6)) - 1, Number(normalized.slice(6, 8)));
        }
        return new Date(normalized);
    }

    function normalizeExtraVacationDays(value) {
        var amount = Number(value || 0);
        if (!isFinite(amount) || amount < 0) return 0;
        return Math.round(amount * 10) / 10;
    }

    function buildCurrentMonthLabel(date) {
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + " 기준";
    }

    function getCurrentUserId() {
        return String(state.user && state.user.id || localStorage.getItem("userId") || "").trim().toLowerCase();
    }

    function formatDate(date) {
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
    }

    function formatDateInput(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function formatDayCount(value) {
        var amount = Number(value || 0);
        if (!isFinite(amount) || amount <= 0) return "0d";
        if (Math.floor(amount) === amount) return amount + "d";
        return amount.toFixed(1) + "d";
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
