(function () {
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
    var AUTH_API_BASE = getGroupwareApiBase("/api/auth");
    var API = window.GroupwareApi;
    var ABSENCE_STORAGE_PREFIX = "absenceSchedules";
    var state = {
        user: null,
        profile: null,
        localItems: [],
        approvalItems: [],
        items: [],
        filteredYear: String(new Date().getFullYear()),
        approvalLoadError: ""
    };
    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureUser()) return;
        cacheElements();
        bindEvents();
        initializePage();
    });

    function ensureUser() {
        state.user = getCurrentUserFromSession();
        if (state.user && state.user.id) return true;

        alert("로그인 후 이용할 수 있습니다.");
        location.href = "/login.html";
        return false;
    }

    function getCurrentUserFromSession() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            return window.AuthStore.getCurrentUser();
        }

        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) return null;

        return {
            id: userId,
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase(),
            email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
            department: String(localStorage.getItem("userDepartment") || "").trim(),
            mustChangePassword: String(localStorage.getItem("mustChangePassword") || "false") === "true"
        };
    }

    function cacheElements() {
        elements.userName = document.querySelector(".absenceUserName");
        elements.hireDate = document.querySelector(".absenceHireDate");
        elements.periodLabel = document.querySelector(".w_day");
        elements.dayGraph = document.querySelector(".dayGraph");
        elements.serviceText = document.querySelector(".absenceServiceText");
        elements.grantedDays = document.querySelector(".absenceGrantedDays");
        elements.remainingDays = document.querySelector(".absenceRemainingDays");
        elements.usedDays = document.querySelector(".absenceUsedDays");
        elements.yearSelect = document.querySelector(".absenceYearSelect");
        elements.searchBtn = document.querySelector(".absenceSearchBtn");
        elements.historyBody = document.querySelector(".absenceHistoryBody");
    }

    function bindEvents() {
        if (elements.searchBtn) {
            elements.searchBtn.addEventListener("click", function () {
                state.filteredYear = elements.yearSelect ? String(elements.yearSelect.value || state.filteredYear) : state.filteredYear;
                renderTable();
            });
        }
        if (elements.yearSelect) {
            elements.yearSelect.addEventListener("change", function () {
                state.filteredYear = String(elements.yearSelect.value || state.filteredYear);
                renderTable();
            });
        }
    }

    async function initializePage() {
        renderLoading();
        await loadProfile();
        loadAbsenceItems();
        await loadApprovedVacationItems();
        buildYearOptions();
        renderSummary();
        renderTable();
    }

    async function loadProfile() {
        try {
            if (window.AuthStore && typeof window.AuthStore.getOwnProfile === "function") {
                state.profile = await window.AuthStore.getOwnProfile();
                return;
            }

            if (window.AuthStore && typeof window.AuthStore.getEmployees === "function" && state.user && state.user.id) {
                var employees = await window.AuthStore.getEmployees();
                state.profile = Array.isArray(employees)
                    ? employees.find(function (item) { return item && item.id === state.user.id; }) || null
                    : null;
                if (state.profile) return;
            }

            state.profile = await fetchOwnProfile();
        } catch (error) {
            state.profile = null;
        }
    }

    async function fetchOwnProfile() {
        var userId = String(state.user && state.user.id || "").trim().toLowerCase();
        if (!userId) return null;

        var data = await API.get(AUTH_API_BASE + "/profile", { userId: userId }, {
            errorMessage: "직원 정보를 불러오지 못했습니다."
        });
        if (!data.item) throw new Error("직원 정보를 불러오지 못했습니다.");
        return data.item;
    }

    function loadAbsenceItems() {
        try {
            var saved = localStorage.getItem(getAbsenceStorageKey());
            var parsed = saved ? JSON.parse(saved) : [];
            state.localItems = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            state.localItems = [];
        }
        syncAbsenceItems();
    }

    async function loadApprovedVacationItems() {
        state.approvalItems = [];
        state.approvalLoadError = "";
        if (!state.user || !state.user.id) {
            syncAbsenceItems();
            return;
        }

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents", {
                box: "approved",
                userId: state.user.id,
                requesterRole: getCurrentRole()
            }, {
                errorMessage: "승인된 휴가원 문서를 불러오지 못했습니다."
            });

            var summaries = (Array.isArray(data.items) ? data.items : []).filter(isOwnApprovedVacationDocument);
            var documents = await Promise.all(summaries.map(loadApprovalDocumentDetail));
            state.approvalItems = documents
                .filter(isOwnApprovedVacationDocument)
                .map(mapApprovalVacationToAbsenceItem)
                .filter(Boolean);
        } catch (error) {
            state.approvalLoadError = error.message || "승인된 휴가원 문서를 불러오지 못했습니다.";
            state.approvalItems = [];
        }

        syncAbsenceItems();
    }

    async function loadApprovalDocumentDetail(item) {
        if (!item || !item.id) return item;

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents/read", {
                id: item.id,
                userId: state.user.id,
                requesterRole: getCurrentRole()
            }, {
                errorMessage: "문서 상세를 불러오지 못했습니다."
            });
            if (!data.item) throw new Error("문서 상세를 불러오지 못했습니다.");
            return data.item;
        } catch (error) {
            return item;
        }
    }

    function syncAbsenceItems() {
        var seen = {};
        state.items = state.localItems.concat(state.approvalItems).filter(function (item, index) {
            var key = item && item.source === "approval" && item.approvalId
                ? "approval:" + item.approvalId
                : "local:" + (item && item.id ? item.id : [item && item.type, item && item.startDate, item && item.endDate, item && item.reason, index].join("|"));

            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function isOwnApprovedVacationDocument(item) {
        if (!item || item.status !== "approved") return false;
        if (normalizeVacationDocType(item.docType) !== "휴가원") return false;

        var userId = String(state.user && state.user.id || "").trim().toLowerCase();
        var authorId = String(item.authorId || "").trim().toLowerCase();
        if (authorId) return authorId === userId;

        var userEmail = String(state.user && state.user.email || "").trim().toLowerCase();
        var authorEmail = String(item.authorEmail || "").trim().toLowerCase();
        if (userEmail && authorEmail) return userEmail === authorEmail;

        var userName = String(state.user && state.user.name || state.profile && state.profile.name || "").trim();
        var authorName = String(item.authorName || "").trim();
        return Boolean(userName && authorName && userName === authorName);
    }

    function mapApprovalVacationToAbsenceItem(item) {
        var vacation = item.vacationInfo && typeof item.vacationInfo === "object" ? item.vacationInfo : {};
        var startDate = normalizeDateValue(vacation.startDate || vacation.start || "");
        var endDate = normalizeDateValue(vacation.endDate || vacation.end || startDate);
        var type = normalizeVacationType(vacation.type || "연차");

        if (!startDate) return null;
        if (!endDate) endDate = startDate;

        return {
            id: "approval-" + String(item.id || item.docNo || startDate),
            source: "approval",
            approvalId: String(item.id || item.docNo || ""),
            type: type,
            days: resolveVacationDays(vacation, type, startDate, endDate),
            startDate: startDate,
            endDate: endDate,
            reason: String(item.proposalContent || item.body || item.title || "-").trim() || "-",
            status: item.status || "approved"
        };
    }

    function getAbsenceStorageKey() {
        return ABSENCE_STORAGE_PREFIX + ":" + String(state.user && state.user.id || "").trim().toLowerCase();
    }

    function buildYearOptions() {
        if (!elements.yearSelect) return;

        var currentYear = new Date().getFullYear();
        var yearMap = {};
        addYearOption(yearMap, currentYear - 1);
        addYearOption(yearMap, currentYear);
        addYearOption(yearMap, currentYear + 1);
        state.items.forEach(function (item) {
            addYearOption(yearMap, String(item.startDate || "").slice(0, 4));
            addYearOption(yearMap, String(item.endDate || "").slice(0, 4));
        });

        var years = Object.keys(yearMap).sort();
        if (years.indexOf(state.filteredYear) === -1) state.filteredYear = String(currentYear);
        elements.yearSelect.innerHTML = years.map(function (year) {
            return '<option value="' + year + '"' + (String(year) === state.filteredYear ? ' selected' : '') + '>' + year + '</option>';
        }).join("");
    }

    function addYearOption(map, value) {
        var year = String(value || "").trim();
        if (/^[0-9]{4}$/.test(year)) map[year] = true;
    }

    function renderSummary() {
        var hireDate = resolveHireDate();
        var period = buildAnnualPeriod(hireDate, new Date());
        var serviceInfo = buildServiceInfo(hireDate);
        var grantedDays = calculateGrantedDaysForPeriod(hireDate, period, new Date()) + getExtraVacationDays();
        var usedDays = calculateUsedDaysForPeriod(period.start, period.end);
        var remainingDays = Math.max(0, grantedDays - usedDays);
        var displayName = state.profile && state.profile.name ? state.profile.name : state.user && state.user.name ? state.user.name : state.user && state.user.id ? state.user.id : "";

        if (elements.userName) elements.userName.textContent = displayName;
        if (elements.hireDate) elements.hireDate.textContent = hireDate ? formatDate(hireDate) : "-";
        if (elements.periodLabel) elements.periodLabel.textContent = buildPeriodLabel(period);
        if (elements.serviceText) elements.serviceText.textContent = serviceInfo;
        if (elements.grantedDays) elements.grantedDays.textContent = formatDayCount(grantedDays);
        if (elements.remainingDays) elements.remainingDays.textContent = formatDayCount(remainingDays);
        if (elements.usedDays) elements.usedDays.textContent = formatDayCount(usedDays);
        renderDayGraph(grantedDays, usedDays);
    }

    function renderTable() {
        if (!elements.historyBody) return;
        var remainingDays = getRemainingDaysForYear(Number(state.filteredYear));

        var rows = state.items.filter(function (item) {
            return isItemInYear(item, Number(state.filteredYear));
        }).sort(function (a, b) {
            return String(b.startDate || "").localeCompare(String(a.startDate || ""));
        });

        renderSummary();

        if (!rows.length) {
            elements.historyBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="3">' + escapeHtml(state.approvalLoadError || "나타낼 내용이 없습니다.") + '</td></tr>';
            return;
        }

        elements.historyBody.innerHTML = rows.map(function (item) {
            return ''
                + '<tr>'
                + '<td><span class="absenceTypeBadge ' + escapeHtml(getAbsenceBadgeClass(item.type)) + '">' + escapeHtml(item.type || "-") + '</span></td>'
                + '<td>' + escapeHtml(formatDayCount(Number(item.days || 0))) + '</td>'
                + '<td>' + escapeHtml(buildPeriodText(item)) + '</td>'
                + '</tr>';
        }).join("");
    }

    function renderLoading() {
        if (elements.historyBody) {
            elements.historyBody.innerHTML = '<tr class="attendEmptyRow"><td colspan="3">부재 일정을 불러오는 중입니다.</td></tr>';
        }
    }

    function resolveHireDate() {
        var raw = "";
        if (state.profile && state.profile.hireDate) {
            raw = String(state.profile.hireDate || "").trim();
        } else if (state.profile && state.profile.createdAt) {
            raw = String(state.profile.createdAt || "").trim();
        }

        if (!raw) return null;

        var date = parseFlexibleDate(raw);
        if (isNaN(date.getTime())) return null;
        return date;
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
        if (!hireDate) {
            return { start: null, end: null };
        }

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

        return {
            start: currentCycleStart,
            end: currentCycleEnd
        };
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

    function calculateGrantedDaysForPeriod(hireDate, period, referenceDate) {
        if (!hireDate || !period || !period.start || !period.end) return 0;

        var serviceMonthsAtStart = calculateMonthDiff(hireDate, period.start);
        if (serviceMonthsAtStart < 12) {
            var reference = referenceDate instanceof Date ? referenceDate : new Date();
            var cappedReference = reference < period.start ? period.start : reference;
            if (cappedReference > period.end) cappedReference = period.end;
            var completedMonths = calculateMonthDiff(hireDate, cappedReference);
            return Math.min(Math.max(completedMonths, 0), 11);
        }

        var serviceYearsAtStart = Math.floor(serviceMonthsAtStart / 12);
        return 15 + Math.max(0, Math.floor((serviceYearsAtStart - 1) / 2));
    }

    function calculateUsedDaysForPeriod(startDate, endDate) {
        return state.items.reduce(function (total, item) {
            if (!isDeductibleVacationType(item && item.type)) return total;
            return total + calculateUsedDaysInRange(item, startDate, endDate);
        }, 0);
    }

    function calculateGrantedDays(hireDate, year) {
        if (!hireDate) return 0;

        var today = new Date();
        var currentYear = today.getFullYear();
        var referenceDate = Number(year) === currentYear ? today : new Date(Number(year) || currentYear, 11, 31);
        if (referenceDate < hireDate) return 0;

        var months = (referenceDate.getFullYear() - hireDate.getFullYear()) * 12 + (referenceDate.getMonth() - hireDate.getMonth());
        if (referenceDate.getDate() < hireDate.getDate()) months -= 1;
        if (months < 0) months = 0;

        if (months < 12) return Math.min(months, 11);

        var years = Math.floor(months / 12);
        return 15 + Math.max(0, Math.floor((years - 1) / 2));
    }

    function calculateUsedDaysForYear(year) {
        return state.items.reduce(function (total, item) {
            if (!isDeductibleVacationType(item && item.type)) return total;
            return total + calculateUsedDaysInYear(item, year);
        }, 0);
    }

    function getRemainingDaysForYear(year) {
        var hireDate = resolveHireDate();
        var grantedDays = calculateGrantedDays(hireDate, year) + getExtraVacationDays();
        var usedDays = calculateUsedDaysForYear(year);
        return Math.max(0, grantedDays - usedDays);
    }

    function getExtraVacationDays() {
        return normalizeExtraVacationDays(state.profile && state.profile.extraVacationDays || 0);
    }

    function calculateUsedDaysInRange(item, startDate, endDate) {
        var totalDays = Number(item && item.days || 0);
        if (!totalDays) return 0;

        var rangeStartDate = startDate instanceof Date ? startDate : parseFlexibleDate(startDate);
        var rangeEndDate = endDate instanceof Date ? endDate : parseFlexibleDate(endDate);
        var itemStart = parseFlexibleDate(item.startDate);
        var itemEnd = parseFlexibleDate(item.endDate || item.startDate);

        if (isNaN(rangeStartDate.getTime()) || isNaN(rangeEndDate.getTime()) || isNaN(itemStart.getTime()) || isNaN(itemEnd.getTime())) {
            return 0;
        }

        var overlapStart = itemStart > rangeStartDate ? itemStart : rangeStartDate;
        var overlapEnd = itemEnd < rangeEndDate ? itemEnd : rangeEndDate;
        if (overlapEnd < overlapStart) return 0;

        if (String(item.type || "").indexOf("반차") > -1) return totalDays;

        var overlapDays = calculateInclusiveDays(formatDateInput(overlapStart), formatDateInput(overlapEnd));
        var fullRangeDays = calculateInclusiveDays(item.startDate, item.endDate || item.startDate);
        if (!fullRangeDays) return totalDays;
        return Math.min(totalDays, overlapDays);
    }

    function calculateUsedDaysInYear(item, year) {
        var totalDays = Number(item && item.days || 0);
        if (!totalDays || !isItemInYear(item, year)) return 0;
        if (String(item.type || "").indexOf("반차") > -1) return totalDays;

        var start = parseFlexibleDate(item.startDate);
        var end = parseFlexibleDate(item.endDate || item.startDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return totalDays;

        var yearStart = new Date(year, 0, 1);
        var yearEnd = new Date(year, 11, 31);
        var rangeStart = start > yearStart ? start : yearStart;
        var rangeEnd = end < yearEnd ? end : yearEnd;
        if (rangeEnd < rangeStart) return 0;

        var daysInSelectedYear = calculateInclusiveDays(formatDateInput(rangeStart), formatDateInput(rangeEnd));
        var daysInWholeRange = calculateInclusiveDays(item.startDate, item.endDate || item.startDate);
        if (!daysInWholeRange) return totalDays;
        return Math.min(totalDays, daysInSelectedYear);
    }

    function isItemInYear(item, year) {
        var start = parseFlexibleDate(item && item.startDate);
        var end = parseFlexibleDate(item && (item.endDate || item.startDate));
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
        var yearStart = new Date(year, 0, 1);
        var yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        return start <= yearEnd && end >= yearStart;
    }

    function isDeductibleVacationType(type) {
        var normalized = normalizeVacationType(type);
        return normalized === "연차" || normalized === "월차" || normalized === "오전 반차" || normalized === "오후 반차";
    }

    function buildPeriodText(item) {
        var startDate = String(item.startDate || "").trim();
        var endDate = String(item.endDate || "").trim();

        if (!startDate && !endDate) return "-";
        if (startDate && endDate && startDate !== endDate) {
            return formatDateWithWeekday(startDate) + " ~ " + formatDateWithWeekday(endDate);
        }
        return formatDateWithWeekday(startDate || endDate);
    }

    function formatDate(date) {
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
    }

    function formatDateInput(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function parseFlexibleDate(value) {
        var normalized = String(value || "").trim();
        if (/^[0-9]{8}$/.test(normalized)) {
            return new Date(
                Number(normalized.slice(0, 4)),
                Number(normalized.slice(4, 6)) - 1,
                Number(normalized.slice(6, 8))
            );
        }
        return new Date(normalized);
    }

    function formatDateString(value) {
        if (!value) return "-";
        var parts = String(value).split("-");
        if (parts.length !== 3) return value;
        return parts[0] + "." + parts[1] + "." + parts[2];
    }

    function formatDateWithWeekday(value) {
        if (!value) return "-";
        var date = parseFlexibleDate(value);
        var weekday = ["일", "월", "화", "수", "목", "금", "토"];
        if (isNaN(date.getTime())) return formatDateString(value);
        return formatDateString(value) + "(" + weekday[date.getDay()] + ")";
    }

    function formatDayCount(value) {
        var amount = Number(value || 0);
        if (!isFinite(amount) || amount <= 0) return "0d";
        if (Math.floor(amount) === amount) return amount + "d";
        return amount.toFixed(1) + "d";
    }

    function renderDayGraph(grantedDays, usedDays) {
        if (!elements.dayGraph) return;

        var total = Math.max(Number(grantedDays || 0), Number(usedDays || 0), 1);
        var target = Math.max(0, Number(grantedDays || 0));
        var used = Math.max(0, Number(usedDays || 0));
        var targetPercent = Math.max(0, Math.min(100, target / total * 100));
        var basePercent = Math.max(0, Math.min(100, Math.min(used, target || used) / total * 100));
        var overPercent = used > target ? Math.max(0, Math.min(100 - targetPercent, (used - target) / total * 100)) : 0;

        elements.dayGraph.innerHTML = ''
            + '<div class="weekProgressBar">'
            + '<span class="weekProgressBase" style="width:' + basePercent + '%;"></span>'
            + (overPercent > 0 ? '<span class="weekProgressOver" style="left:' + targetPercent + '%;width:' + overPercent + '%;"></span>' : '')
            + '<span class="weekProgressMarker" style="left:' + targetPercent + '%;"></span>'
            + '</div>'
            + '<div class="weekProgressScale">'
            + '<span class="weekProgressTick weekProgressTick--start">0d</span>'
            + '<span class="weekProgressTick weekProgressTick--end">' + escapeHtml(formatDayCount(target)) + '</span>'
            + '</div>';
    }

    function getAbsenceBadgeClass(type) {
        if (type === "월차") return "is-annual";
        if (type === "연차") return "is-annual";
        if (type === "오전 반차") return "is-half-am";
        if (type === "오후 반차") return "is-half-pm";
        return "";
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

    function getCurrentRole() {
        return String(state.user && state.user.role || localStorage.getItem("userRole") || "staff").trim().toLowerCase();
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

    function normalizeExtraVacationDays(value) {
        var amount = Number(value || 0);
        if (!isFinite(amount) || amount < 0) return 0;
        return Math.round(amount * 10) / 10;
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
