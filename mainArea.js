import { getKoreanHolidayEventsByDate } from "./calendar/holidays.js";

(function () {
    var AUTH_API_BASE = getGroupwareApiBase("/api/auth");
    var ATTENDANCE_API_BASE = getGroupwareApiBase("/api/attendance");
    var MAIL_API_BASE = getGroupwareApiBase("/api/mail");
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
    var CALENDAR_API_BASE = getGroupwareApiBase("/api/calendar/shared");
    var CALENDAR_BIRTHDAY_API = CALENDAR_API_BASE + "/birthdays";
    var BOARD_NEWS_API_BASE = getGroupwareApiBase("/api/board/news");
    var TEAMBOARD_API_BASE = getGroupwareApiBase("/api/board/teamboard");
    var API = window.GroupwareApi;
    var ABSENCE_STORAGE_PREFIX = "absenceSchedules";
    var BIRTHDAY_LABEL_COLOR = "#85bb67";
    var BIRTHDAY_EVENT_BACKGROUND = "#faffd5";
    var DEFAULT_CALENDAR_LABEL_COLOR = "#fff6de";
    var WIDE_LABEL_COLOR = "#fff";
    var WIDE_EVENT_BACKGROUND = "#0373ef";
    var CALENDAR_LABEL_PALETTE = {
        "#fff6de": "#fff6de",
        "#fdeded": "#fdeded",
        "#ebf5e9": "#ebf5e9",
        "#efedf9": "#efedf9",
        "#f4efe9": "#f4efe9"
    };
    var DASHBOARD_INBOX_FETCH_SIZE = 50;
    var DASHBOARD_NOTICE_LIMIT = 5;
    var DASHBOARD_MAIL_LIMIT = 3;
    var DASHBOARD_APPROVAL_LIMIT = 5;
    var DASHBOARD_TEAMBOARD_LIMIT = 3;
    var DASHBOARD_BIRTHDAY_LIMIT = 2;
    var state = {
        user: null,
        profile: null,
        attendanceRecords: [],
        inboxItems: [],
        inboxUnread: 0,
        inboxTotal: 0,
        approvalDocs: [],
        pendingDocs: [],
        noticeItems: [],
        teamboardItems: [],
        localAbsenceItems: [],
        approvalAbsenceItems: [],
        absenceItems: [],
        absenceLoaded: false,
        calendarScope: "my",
        sharedCalendarEvents: [],
        birthdayEvents: [],
        calendarEvents: [],
        miniCalendarDate: null,
        miniCalendarSelectedDateKey: "",
        birthdayPageIndex: 0,
        clockTimerId: null
    };
    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureUser()) return;
        cacheElements();
        applyDashboardRoleLayout();
        bindEvents();
        renderGreeting();
        startClock();
        renderAttendance();
        renderInbox();
        renderPendingDocs();
        renderNotices();
        renderTeamboard();
        renderBirthdays();
        renderMiniCalendar();
        loadDashboard();
    });

    function ensureUser() {
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) {
            location.href = "/login.html";
            return false;
        }
        state.user = {
            id: userId,
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase(),
            email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
            department: String(localStorage.getItem("userDepartment") || "").trim()
        };
        return true;
    }

    function cacheElements() {
        elements.greeting = document.querySelector(".dashboardGreeting");
        elements.logoutButton = document.querySelector(".dashboardLogoutBtn");
        elements.nowLabel = document.querySelector(".dashboardNowLabel");
        elements.checkInValue = document.querySelector(".dashboardCheckInValue");
        elements.checkOutValue = document.querySelector(".dashboardCheckOutValue");
        elements.checkInButton = document.querySelector(".dashboardCheckInBtn");
        elements.checkOutButton = document.querySelector(".dashboardCheckOutBtn");
        elements.worktimeRange = document.querySelector(".dashboardWorktimeRange");
        elements.workGraph = document.querySelector(".dashboardWorkGraph");
        elements.mailRefreshButton = document.querySelector(".dashboardMailRefreshBtn");
        elements.mailUnreadCount = document.querySelector(".dashboardMailUnreadCount");
        elements.mailTotalCount = document.querySelector(".dashboardMailTotalCount");
        elements.mailboxUsage = document.querySelector(".dashboardMailboxUsage");
        elements.mailList = document.querySelector(".dashboardMailList");
        elements.approvalBody = document.querySelector(".dashboardApprovalBody");
        elements.pendingCount = document.querySelector(".dashboardPendingCount");
        elements.teamCount = document.querySelector(".dashboardTeamCount");
        elements.todayScheduleCount = document.querySelector(".dashboardTodayScheduleCount");
        elements.vacationValue = document.querySelector(".dashboardVacationValue");
        elements.noticeList = document.querySelector(".dashboardNoticeList");
        elements.teamList = document.querySelector(".dashboardTeamList");
        elements.birthdayList = document.querySelector(".dashboardBirthdayList");
        elements.birthdayPrev = document.querySelector(".dashboardBirthdayPrev");
        elements.birthdayNext = document.querySelector(".dashboardBirthdayNext");
        elements.miniCalendarMonth = document.querySelector(".dashboardMiniCalendarMonth");
        elements.miniCalendarPrev = document.querySelector(".dashboardMiniCalendarPrev");
        elements.miniCalendarNext = document.querySelector(".dashboardMiniCalendarNext");
        elements.miniCalendarGrid = document.querySelector(".dashboardMiniCalendarGrid");
        elements.miniAgendaDate = document.querySelector(".dashboardMiniAgendaDate");
        elements.miniAgendaList = document.querySelector(".dashboardMiniAgendaList");
        elements.miniAgenda = document.querySelector(".dashboardMiniAgenda");
        elements.calendarGrid = document.querySelector(".dashboardCalendarGrid");
        elements.calendarAgenda = document.querySelector(".dashboardCalendarAgenda");
    }

    function bindEvents() {
        if (elements.logoutButton) elements.logoutButton.addEventListener("click", handleLogout);
        if (elements.checkInButton) elements.checkInButton.addEventListener("click", handleCheckIn);
        if (elements.checkOutButton) elements.checkOutButton.addEventListener("click", handleCheckOut);
        if (elements.birthdayPrev) elements.birthdayPrev.addEventListener("click", function () {
            moveBirthdayPage(-1);
        });
        if (elements.birthdayNext) elements.birthdayNext.addEventListener("click", function () {
            moveBirthdayPage(1);
        });
        if (elements.miniCalendarPrev) elements.miniCalendarPrev.addEventListener("click", function () {
            moveMiniCalendarMonth(-1);
        });
        if (elements.miniCalendarNext) elements.miniCalendarNext.addEventListener("click", function () {
            moveMiniCalendarMonth(1);
        });
        if (elements.mailRefreshButton) elements.mailRefreshButton.addEventListener("click", function () {
            loadInboxSection();
        });
        window.addEventListener("attendance:updated", function (event) {
            var records = event && event.detail && Array.isArray(event.detail.records) ? event.detail.records : null;
            if (!records) return;
            state.attendanceRecords = records.slice();
            renderAttendance();
        });
    }

    async function loadDashboard() {
        await loadProfile();
        await Promise.all([
            loadAttendance(),
            loadInboxSection(),
            loadPendingDocs(),
            loadAbsenceSummary(),
            loadNotices(),
            loadTeamboard(),
            loadCalendarEvents()
        ]);
        requestInboxRender();
    }

    function requestInboxRender() {
        if (typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(function () {
                renderInbox();
            });
        } else {
            setTimeout(function () {
                renderInbox();
            }, 0);
        }
    }

    async function loadProfile() {
        try {
            var data = await API.get(AUTH_API_BASE + "/profile", { userId: state.user.id }, { errorMessage: "프로필을 불러오지 못했습니다." });
            state.profile = data.item || null;
            applyDashboardRoleLayout();
            renderGreeting();
            renderAttendance();
        } catch (error) {
            state.profile = null;
            applyDashboardRoleLayout();
            renderGreeting();
            renderAttendance();
        }
    }

    function isExecutiveDashboardUser() {
        if (isWorkAccountUser()) return true;
        if (window.AuthStore && typeof window.AuthStore.isExecutive === "function") {
            return window.AuthStore.isExecutive();
        }
        var role = String(state.profile && state.profile.role || state.user && state.user.role || "").trim().toLowerCase();
        var department = String(state.profile && (state.profile.department || state.profile.team) || state.user && state.user.department || "").trim();
        return role === "admin" || role === "ceo" || role === "관리자" || role === "대표" || department.indexOf("대표") !== -1;
    }

    function applyDashboardRoleLayout() {
        document.body.classList.toggle("dashboardPrivileged", isExecutiveDashboardUser());
        document.body.classList.toggle("dashboardWorkAccount", isWorkAccountUser());
    }

    function isWorkAccountUser() {
        var id = String(state.user && state.user.id || localStorage.getItem("userId") || "").trim().toLowerCase();
        return id === "work";
    }

    async function loadAttendance() {
        if (isWorkAccountUser()) {
            state.attendanceRecords = [];
            renderAttendance();
            return;
        }
        try {
            var data = await API.get(ATTENDANCE_API_BASE + "/my", buildAttendanceUserPayload(), { errorMessage: "근태 정보를 불러오지 못했습니다." });
            syncResolvedAttendanceUser(data);
            state.attendanceRecords = Array.isArray(data.items) ? data.items : [];
        } catch (error) {
            state.attendanceRecords = [];
        }
        renderAttendance();
    }

    function buildAttendanceUserPayload() {
        return {
            userId: state.user && state.user.id || "",
            userName: state.profile && state.profile.name || state.user && state.user.name || "",
            userEmail: state.user && state.user.email || ""
        };
    }

    function syncResolvedAttendanceUser(data) {
        var resolvedUserId = String(data && data.userId || "").trim().toLowerCase();
        if (!resolvedUserId || !state.user || resolvedUserId === state.user.id) return;
        state.user.id = resolvedUserId;
        localStorage.setItem("userId", resolvedUserId);
    }

    async function loadInboxSection() {
        await Promise.all([loadInboxItems(), loadInboxCounts()]);
        await hydrateVisibleInboxItems();
        renderInbox();
    }

    async function loadInboxItems() {
        try {
            var data = await API.get(MAIL_API_BASE + "/inbox", {
                page: 1,
                pageSize: DASHBOARD_INBOX_FETCH_SIZE,
                userEmail: state.user.email
            }, { errorMessage: "받은메일함을 불러오지 못했습니다." });
            state.inboxItems = Array.isArray(data.items) ? data.items : [];
            state.inboxTotal = Number(data.pagination && data.pagination.total || state.inboxItems.length || 0);
        } catch (error) {
            state.inboxItems = [];
            state.inboxTotal = 0;
        }
    }

    async function loadInboxCounts() {
        try {
            var data = await API.get(MAIL_API_BASE + "/counts", { userEmail: state.user.email }, { errorMessage: "메일 통계를 불러오지 못했습니다." });
            state.inboxUnread = Number(data.inboxUnread || 0);
        } catch (error) {
            state.inboxUnread = 0;
        }
    }

    async function hydrateVisibleInboxItems() {
        var visibleItems = state.inboxItems.slice(0, DASHBOARD_MAIL_LIMIT);
        if (!visibleItems.length) return;

        var detailedItems = await Promise.all(visibleItems.map(async function (item) {
            if (!item || !item.id) return item;
            try {
                var data = await API.get(MAIL_API_BASE + "/read", { id: item.id }, { errorMessage: "메일 본문을 불러오지 못했습니다." });
                return Object.assign({}, item, data.item || {});
            } catch (error) {
                return item;
            }
        }));

        state.inboxItems = detailedItems.concat(state.inboxItems.slice(DASHBOARD_MAIL_LIMIT));
    }

    async function loadPendingDocs() {
        if (isWorkAccountUser()) {
            state.approvalDocs = [];
            state.pendingDocs = [];
            renderPendingDocs();
            return;
        }
        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents", {
                box: "all",
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "전체문서를 불러오지 못했습니다." });
            state.approvalDocs = (Array.isArray(data.items) ? data.items : []).filter(function (item) {
                return item && item.status !== "draft";
            });
            state.pendingDocs = state.approvalDocs.filter(function (item) {
                return String(item && item.status || "pending").trim().toLowerCase() === "pending";
            });
        } catch (error) {
            state.approvalDocs = [];
            state.pendingDocs = [];
        }
        renderPendingDocs();
    }

    async function loadAbsenceSummary() {
        state.absenceLoaded = false;
        renderVacationValue();
        loadLocalAbsenceItems();
        try {
            await loadApprovedVacationItems();
            syncAbsenceItems();
        } finally {
            state.absenceLoaded = true;
            renderVacationValue();
        }
    }

    function loadLocalAbsenceItems() {
        try {
            var saved = localStorage.getItem(getAbsenceStorageKey());
            var parsed = saved ? JSON.parse(saved) : [];
            state.localAbsenceItems = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            state.localAbsenceItems = [];
        }
        syncAbsenceItems();
    }

    async function loadApprovedVacationItems() {
        state.approvalAbsenceItems = [];
        if (!state.user || !state.user.id) return;

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents", {
                box: "approved",
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "승인된 휴가원 문서를 불러오지 못했습니다." });

            var summaries = (Array.isArray(data.items) ? data.items : []).filter(isOwnApprovedVacationDocument);
            var documents = await Promise.all(summaries.map(loadApprovalDocumentDetail));
            state.approvalAbsenceItems = documents
                .filter(isOwnApprovedVacationDocument)
                .map(mapApprovalVacationToAbsenceItem)
                .filter(Boolean);
        } catch (error) {
            state.approvalAbsenceItems = [];
        }
    }

    async function loadApprovalDocumentDetail(item) {
        if (!item || !item.id) return item;

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents/read", {
                id: item.id,
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "문서 상세를 불러오지 못했습니다." });
            return data.item || item;
        } catch (error) {
            return item;
        }
    }

    function syncAbsenceItems() {
        var seen = {};
        state.absenceItems = state.localAbsenceItems.concat(state.approvalAbsenceItems).filter(function (item, index) {
            var key = item && item.source === "approval" && item.approvalId
                ? "approval:" + item.approvalId
                : "local:" + (item && item.id ? item.id : [item && item.type, item && item.startDate, item && item.endDate, item && item.reason, index].join("|"));

            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function getAbsenceStorageKey() {
        return ABSENCE_STORAGE_PREFIX + ":" + String(state.user && state.user.id || "").trim().toLowerCase();
    }

    async function loadNotices() {
        try {
            var data = await API.get(BOARD_NEWS_API_BASE, null, { errorMessage: "공지사항을 불러오지 못했습니다." });
            var items = Array.isArray(data.items) ? data.items : [];
            state.noticeItems = items
                .filter(function (item) { return item && item.title; })
                .sort(function (a, b) {
                    return Number(!!b.pinned) - Number(!!a.pinned)
                        || new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
                })
                .slice(0, DASHBOARD_NOTICE_LIMIT);
        } catch (error) {
            state.noticeItems = [];
        }
        renderNotices();
    }

    async function loadTeamboard() {
        try {
            var data = await API.get(TEAMBOARD_API_BASE, { userId: state.user.id }, { errorMessage: "팀 보드를 불러오지 못했습니다." });
            var items = Array.isArray(data.items) ? data.items : [];
            state.teamboardItems = items
                .filter(function (item) { return item && item.title; })
                .sort(function (a, b) {
                    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
                })
                .slice(0, DASHBOARD_TEAMBOARD_LIMIT);
        } catch (error) {
            state.teamboardItems = [];
        }
        renderTeamboard();
    }

    async function loadCalendarEvents() {
        try {
            var data = await API.get(CALENDAR_API_BASE, null, { errorMessage: "공유 일정을 불러오지 못했습니다." });
            state.sharedCalendarEvents = Array.isArray(data.items) ? data.items.map(normalizeCalendarEvent) : [];
        } catch (error) {
            state.sharedCalendarEvents = [];
        }
        await loadBirthdayEvents();
        state.calendarScope = "my";
        syncCalendarEvents();
        renderCalendar();
        renderMiniCalendar();
        renderBirthdays();
        renderTodayScheduleCount();
    }

    async function loadBirthdayEvents() {
        try {
            var userId = String(state.user && state.user.id || "").trim().toLowerCase();
            if (!userId || userId === "guest") {
                state.birthdayEvents = [];
                return;
            }
            var data = await API.get(CALENDAR_BIRTHDAY_API, { userId: userId }, { errorMessage: "구성원 생일을 불러오지 못했습니다." });
            state.birthdayEvents = await enrichBirthdayItems(Array.isArray(data.items) ? data.items : []);
        } catch (error) {
            state.birthdayEvents = await loadBirthdayEventsFromAuthStore();
        }
    }

    async function loadBirthdayEventsFromAuthStore() {
        try {
            if (!window.AuthStore || typeof window.AuthStore.getEmployees !== "function") return [];
            var employees = await window.AuthStore.getEmployees({ cache: false, mergeAttendance: false });
            return normalizeBirthdayItems(employees);
        } catch (error) {
            return [];
        }
    }

    async function enrichBirthdayItems(items) {
        var birthdays = normalizeBirthdayItems(items);
        if (!birthdays.length) return birthdays;

        var employees = [];
        try {
            if (window.AuthStore && typeof window.AuthStore.getEmployees === "function") {
                employees = await window.AuthStore.getEmployees({ cache: false, mergeAttendance: false });
            }
        } catch (error) {
            employees = [];
        }

        var employeeBirthdays = normalizeBirthdayItems(employees);
        if (state.profile) employeeBirthdays.push(normalizeBirthdayItem(state.profile));

        return birthdays.map(function (birthday) {
            var matched = findMatchingBirthdayProfile(birthday, employeeBirthdays);
            if (!matched) return birthday;
            return Object.assign({}, birthday, {
                department: birthday.department || matched.department || "",
                position: birthday.position || matched.position || "",
                jobGrade: birthday.jobGrade || matched.jobGrade || ""
            });
        });
    }

    function normalizeBirthdayItems(items) {
        return (Array.isArray(items) ? items : []).map(normalizeBirthdayItem).filter(function (item) {
            return !!(item.name && item.birthDate);
        });
    }

    function findMatchingBirthdayProfile(birthday, profiles) {
        var id = String(birthday && birthday.id || "").trim().toLowerCase();
        var name = String(birthday && birthday.name || "").trim();
        var birthDate = normalizeBirthdayDate(birthday && birthday.birthDate || "");
        return (Array.isArray(profiles) ? profiles : []).find(function (profile) {
            if (!profile) return false;
            var profileId = String(profile.id || "").trim().toLowerCase();
            if (id && profileId && id === profileId) return true;
            return name && birthDate && name === String(profile.name || "").trim() && birthDate === normalizeBirthdayDate(profile.birthDate || "");
        }) || null;
    }

    function startClock() {
        updateClock();
        if (state.clockTimerId) clearInterval(state.clockTimerId);
        state.clockTimerId = setInterval(updateClock, 1000);
    }

    function updateClock() {
        if (!elements.nowLabel) return;
        elements.nowLabel.innerHTML = '<span>홈</span><span class="dashboardNowDivider">/</span><span>' + buildNowLabel(new Date()) + '</span>';
    }

    function renderGreeting() {
        if (!elements.greeting) return;
        var name = String(state.profile && state.profile.name || state.user && state.user.name || "").trim() || "사용자";
        elements.greeting.innerHTML = escapeHtml(name) + '님, 반가워요<img class="dashboardGreetingHello" src="./img/hello.png" alt="">';
    }

    function handleLogout() {
        if (window.AuthStore && typeof window.AuthStore.logout === "function") {
            window.AuthStore.logout();
        } else {
            ["isLogin", "userId", "userName", "userRole", "userEmail", "userDepartment", "mustChangePassword"].forEach(function (key) {
                localStorage.removeItem(key);
            });
        }
            location.href = "/login.html";
    }

    function renderAttendance() {
        var todayRecord = getTodayRecord();
        var workHours = getWorkHoursText();
        if (elements.checkInValue) elements.checkInValue.textContent = formatIsoTime(todayRecord && todayRecord.checkIn);
        if (elements.checkOutValue) elements.checkOutValue.textContent = formatIsoTime(todayRecord && todayRecord.checkOut);
        if (elements.worktimeRange) elements.worktimeRange.textContent = workHours;
        renderVacationValue();
        renderWorkGraph();
        syncAttendanceButtons(todayRecord);
    }

    function renderVacationValue() {
        if (!elements.vacationValue) return;
        var value = formatVacationValue();
        elements.vacationValue.textContent = value;
        elements.vacationValue.classList.toggle("has-value", value !== "-");
    }

    function renderWorkGraph() {
        if (!elements.workGraph) return;
        var weekMinutes = getWeeklyWorkedMinutes();
        var thresholdMinutes = getWeeklyTargetMinutes(getWorkHoursText());
        var maxMinutes = thresholdMinutes + (12 * 60);
        var progressMinutes = Math.min(weekMinutes, maxMinutes);
        var thresholdPercent = maxMinutes > 0 ? (thresholdMinutes / maxMinutes) * 100 : 0;
        var progressPercent = maxMinutes > 0 ? (progressMinutes / maxMinutes) * 100 : 0;
        var overPercent = progressMinutes > thresholdMinutes ? progressPercent - thresholdPercent : 0;
        var basePercent = Math.min(progressPercent, thresholdPercent);

        elements.workGraph.innerHTML = ''
            + '<div class="weekProgressBar">'
            + '<span class="weekProgressBase" style="width:' + basePercent + '%;"></span>'
            + (overPercent > 0 ? '<span class="weekProgressOver" style="left:' + thresholdPercent + '%;width:' + overPercent + '%;"></span>' : '')
            + '<span class="weekProgressMarker" style="left:' + thresholdPercent + '%;"></span>'
            + '</div>'
            + '<div class="weekProgressScale">'
            + '<span class="weekProgressTick weekProgressTick--threshold" style="left:' + thresholdPercent + '%;">' + escapeHtml(formatHourLabel(thresholdMinutes)) + '</span>'
            + '<span class="weekProgressTick weekProgressTick--end">' + escapeHtml(formatHourLabel(maxMinutes)) + '</span>'
            + '</div>';
    }

    function renderInbox() {
        if (elements.mailUnreadCount) elements.mailUnreadCount.textContent = String(state.inboxUnread);
        if (elements.mailTotalCount) elements.mailTotalCount.textContent = String(state.inboxTotal);
        if (elements.mailboxUsage) {
            elements.mailboxUsage.innerHTML = '<span class="dashboardMailboxUsageValue">' + escapeHtml(formatBytes(estimateMailboxBytes(state.inboxItems))) + '</span> / 500MB';
        }
        if (!elements.mailList) return;
        if (!state.inboxItems.length) {
            elements.mailList.innerHTML = '<div class="dashboardMailEmpty">표시할 메일이 없습니다.</div>';
            return;
        }
        var visibleItems = state.inboxItems.slice(0, DASHBOARD_MAIL_LIMIT);
        elements.mailList.innerHTML = visibleItems.map(function (item) {
            var snippet = formatMailSnippet(item);
            return ''
                + '<div class="dashboardMailItem" data-href="/mail/read.html?id=' + encodeURIComponent(item.id || "") + '&folder=inbox">'
                + '<div class="dashboardMailMain">'
                + '<strong class="dashboardMailSubject">'
                + '<img class="dashboardMailIcon" src="./img/home_mail-ico.png" alt="">'
                + (hasMailAttachment(item) ? '<img class="dashboardMailIcon dashboardMailIcon--file" src="./img/home_file-ico.png" alt="">' : '')
                + '<span>' + escapeHtml(item.subject || "(제목 없음)") + '</span>'
                + '</strong>'
                + (snippet ? '<p class="dashboardMailSnippet">' + escapeHtml(snippet) + '</p>' : '')
                + '</div>'
                + '<span class="dashboardMailDate">' + escapeHtml(formatMailMeta(item)) + '</span>'
                + '</div>';
        }).join("");
        Array.prototype.slice.call(elements.mailList.querySelectorAll(".dashboardMailItem")).forEach(function (itemNode) {
            itemNode.addEventListener("click", function () {
                var href = itemNode.getAttribute("data-href");
                if (href) location.href = href;
            });
        });
    }

    function renderPendingDocs() {
        if (!elements.approvalBody) return;
        updateMiniStatValue(elements.pendingCount, state.pendingDocs.length);
        if (!state.approvalDocs.length) {
            elements.approvalBody.innerHTML = '<div class="dashboardApprovalEmpty">전체문서가 없습니다.</div>';
            return;
        }
        elements.approvalBody.innerHTML = ''
            + '<div class="dashboardApprovalTableHead"><span>상신일시</span><span>결재양식</span><span>제목</span><span>상태</span></div>'
            + state.approvalDocs.slice(0, DASHBOARD_APPROVAL_LIMIT).map(function (item) {
            return ''
                + '<button type="button" class="dashboardApprovalItem" data-href="/approval/detail.html?id=' + encodeURIComponent(item.id || "") + '&from=dashboard">'
                + '<span class="dashboardApprovalDate">' + escapeHtml(formatApprovalDate(item.submittedAt || item.updatedAt || item.createdAt || "")) + '</span>'
                + '<span class="dashboardApprovalType">' + escapeHtml(item.docType || "-") + '</span>'
                + '<span class="dashboardApprovalTitle">' + escapeHtml(item.title || "제목 없음") + '</span>'
                + renderDashboardApprovalStatusBadge(item.status)
                + '</button>';
        }).join("");
        Array.prototype.slice.call(elements.approvalBody.querySelectorAll(".dashboardApprovalItem")).forEach(function (row) {
            row.addEventListener("click", function () {
                var href = row.getAttribute("data-href");
                if (href) location.href = href;
            });
        });
    }

    function renderDashboardApprovalStatusBadge(status) {
        var normalized = String(status || "pending").trim().toLowerCase();
        if (normalized === "approved") return '<span class="dashboardApprovalBadge approved">승인</span>';
        if (normalized === "rejected") return '<span class="dashboardApprovalBadge rejected">반려</span>';
        return '<span class="dashboardApprovalBadge pending">결재대기</span>';
    }

    function renderNotices() {
        if (!elements.noticeList) return;
        if (!state.noticeItems.length) {
            elements.noticeList.innerHTML = '<div class="dashboardSimpleEmpty">공지사항에 등록된 글이 없습니다.</div>';
            return;
        }
        elements.noticeList.innerHTML = state.noticeItems.slice(0, DASHBOARD_NOTICE_LIMIT).map(function (item) {
            return '<a class="dashboardNoticeItem" href="/board/news.html">'
                + '<span>' + escapeHtml(item.title || "제목 없음") + '</span>'
                + '</a>';
        }).join("");
    }

    function renderTeamboard() {
        updateMiniStatValue(elements.teamCount, state.teamboardItems.length);
        if (!elements.teamList) return;
        if (!state.teamboardItems.length) {
            elements.teamList.innerHTML = '<div class="dashboardSimpleEmpty">팀 보드에 등록된 글이 없습니다.</div>';
            return;
        }
        elements.teamList.innerHTML = state.teamboardItems.slice(0, DASHBOARD_TEAMBOARD_LIMIT).map(function (item) {
            return '<a class="dashboardTeamItem" href="/board/teamboard.html">'
                + '<strong>' + escapeHtml(item.title || "제목 없음") + '</strong>'
                + '<span>' + escapeHtml(formatBoardDate(item.updatedAt || item.createdAt || "")) + ' · ' + escapeHtml(item.authorName || "-") + '</span>'
                + '</a>';
        }).join("");
    }

    function renderBirthdays() {
        if (!elements.birthdayList) return;
        var allBirthdays = getCurrentMonthBirthdays();
        var totalPages = Math.max(1, Math.ceil(allBirthdays.length / DASHBOARD_BIRTHDAY_LIMIT));
        if (state.birthdayPageIndex >= totalPages) state.birthdayPageIndex = totalPages - 1;
        if (state.birthdayPageIndex < 0) state.birthdayPageIndex = 0;
        var startIndex = state.birthdayPageIndex * DASHBOARD_BIRTHDAY_LIMIT;
        var birthdays = allBirthdays.slice(startIndex, startIndex + DASHBOARD_BIRTHDAY_LIMIT);
        if (!birthdays.length) {
            elements.birthdayList.innerHTML = '<div class="dashboardBirthdayEmpty">이번달은 생일을 맞이한 멤버가 없습니다.</div>';
            syncBirthdayControls(allBirthdays.length, totalPages);
            return;
        }
        elements.birthdayList.innerHTML = birthdays.map(function (item) {
            return '<div class="dashboardBirthdayItem">'
                + '<span class="dashboardBirthdayAvatar">' + escapeHtml(getBirthdayInitial(item.name || "-")) + '</span>'
                + '<span class="dashboardBirthdayInfo">'
                + '<span class="dashboardBirthdayDate">🎉 ' + escapeHtml(formatBirthdayDate(item.birthDate)) + '</span>'
                + '<span class="dashboardBirthdayPerson"><strong>' + escapeHtml(item.name || "-") + '</strong><em>' + escapeHtml(formatBirthdayMemberMeta(item)) + '</em></span>'
                + '</span>'
                + '</div>';
        }).join("");
        syncBirthdayControls(allBirthdays.length, totalPages);
    }

    function moveBirthdayPage(delta) {
        var birthdays = getCurrentMonthBirthdays();
        if (birthdays.length <= DASHBOARD_BIRTHDAY_LIMIT) return;
        var totalPages = Math.ceil(birthdays.length / DASHBOARD_BIRTHDAY_LIMIT);
        state.birthdayPageIndex = (state.birthdayPageIndex + delta + totalPages) % totalPages;
        renderBirthdays();
    }

    function syncBirthdayControls(totalCount, totalPages) {
        var isEnabled = Number(totalCount || 0) > DASHBOARD_BIRTHDAY_LIMIT;
        [elements.birthdayPrev, elements.birthdayNext].forEach(function (button) {
            if (!button) return;
            button.disabled = !isEnabled;
        });
    }

    function renderTodayScheduleCount() {
        if (!elements.todayScheduleCount) return;
        updateMiniStatValue(elements.todayScheduleCount, getCalendarEventsByDate(formatDateKey(new Date())).length);
    }

    function updateMiniStatValue(node, value) {
        if (!node) return;
        var numberValue = Number(value || 0);
        node.textContent = String(numberValue);
        node.classList.toggle("has-value", numberValue > 0);
    }

    function renderCalendar() {
        if (!elements.calendarGrid) return;
        var now = new Date();
        var todayKey = formatDateKey(now);
        var weekDates = getDashboardWeekDates(now);
        var sections = weekDates.map(function (date) {
            var dateKey = formatDateKey(date);
            var events = getCalendarEventsByDate(dateKey).sort(compareCalendarEventsForDashboard);
            var className = "dashboardAgendaDay" + (dateKey === todayKey ? " is-today" : "");
            return ''
                + '<section class="' + className + '">'
                + '<div class="dashboardAgendaDate">'
                + (dateKey === todayKey ? '<span class="dashboardAgendaTodayBadge">오늘</span>' : '')
                + '<span class="dashboardAgendaDateMeta">' + escapeHtml(formatDashboardAgendaDate(date)) + '</span>'
                + '</div>'
                + '<div class="dashboardAgendaEvents">'
                + (events.length ? events.map(renderDashboardAgendaEvent).join("") : '<div class="dashboardAgendaEmpty">예정된 일정이 없습니다.</div>')
                + '</div>'
                + '</section>';
        });

        elements.calendarGrid.innerHTML = ''
            + '<div class="dashboardAgendaCalendar">'
            + '<div class="dashboardAgendaTodaySummary">' + escapeHtml(buildDashboardTodaySummary(todayKey)) + '</div>'
            + '<div class="dashboardAgendaList">' + sections.join("") + '</div>'
            + '</div>';
        if (elements.calendarAgenda) elements.calendarAgenda.innerHTML = "";
    }

    function renderMiniCalendar() {
        if (!elements.miniCalendarGrid) return;
        var today = new Date();
        var todayKey = formatDateKey(today);
        if (!state.miniCalendarDate) {
            state.miniCalendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }
        if (!state.miniCalendarSelectedDateKey) {
            state.miniCalendarSelectedDateKey = todayKey;
        }

        var monthDate = state.miniCalendarDate;
        var monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        var gridStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - monthStart.getDay());
        if (elements.miniCalendarMonth) {
            elements.miniCalendarMonth.textContent = monthStart.getFullYear() + "." + pad(monthStart.getMonth() + 1);
        }

        var cells = [];
        for (var index = 0; index < 42; index += 1) {
            var date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
            var dateKey = formatDateKey(date);
            var isOutside = date.getMonth() !== monthStart.getMonth();
            var events = getMiniCalendarUserEventsByDate(dateKey);
            var isHoliday = getKoreanHolidayEventsByDate(dateKey).length > 0;
            var className = "dashboardMiniCalendarDay"
                + (isOutside ? " is-outside" : "")
                + (date.getDay() === 0 ? " is-sunday" : "")
                + (isHoliday ? " is-holiday" : "")
                + (dateKey === todayKey ? " is-today" : "")
                + (dateKey === state.miniCalendarSelectedDateKey ? " is-selected" : "")
                + (events.length ? " has-events" : "");
            cells.push(
                '<button type="button" class="' + className + '" data-date="' + escapeHtml(dateKey) + '">'
                + '<span class="dashboardMiniCalendarNumber">' + date.getDate() + '</span>'
                + (events.length ? '<span class="dashboardMiniCalendarDot"' + getMiniCalendarDotStyle(getMiniCalendarDotEvent(events)) + '></span>' : '')
                + '</button>'
            );
        }
        elements.miniCalendarGrid.innerHTML = cells.join("");
        Array.prototype.slice.call(elements.miniCalendarGrid.querySelectorAll("[data-date]")).forEach(function (button) {
            button.addEventListener("click", function () {
                state.miniCalendarSelectedDateKey = button.getAttribute("data-date") || todayKey;
                renderMiniCalendar();
            });
        });
        renderMiniAgenda();
    }

    function renderMiniAgenda() {
        if (!elements.miniAgendaDate || !elements.miniAgendaList) return;
        var dateKey = state.miniCalendarSelectedDateKey || formatDateKey(new Date());
        var date = parseDateKey(dateKey);
        var todayKey = formatDateKey(new Date());
        var isHoliday = getKoreanHolidayEventsByDate(dateKey).length > 0;
        var events = getMiniCalendarEventsByDate(dateKey).sort(compareCalendarEventsForDashboard);
        if (elements.miniAgenda) elements.miniAgenda.classList.toggle("is-holiday", isHoliday);
        elements.miniAgendaDate.innerHTML = ''
            + '<span>' + escapeHtml(getKoreanWeekday(date)) + '</span>'
            + '<strong>' + escapeHtml(String(date.getDate())) + '</strong>'
            + (dateKey === todayKey ? '<em>Today</em>' : '');
        elements.miniAgendaList.innerHTML = events.length
            ? events.map(renderMiniAgendaEvent).join("")
            : '<div class="dashboardMiniAgendaEmpty">선택한 날짜에 등록된 일정이 없습니다.</div>';
    }

    function renderMiniAgendaEvent(item) {
        var metaText = getDashboardCalendarEventMetaText(item);
        return ''
            + '<div class="dashboardMiniAgendaItem">'
            + '<span class="dashboardMiniAgendaDot"' + getMiniCalendarDotStyle(item) + '></span>'
            + '<strong>' + escapeHtml(item && item.title || "제목 없음") + '</strong>'
            + (metaText ? '<span class="dashboardMiniAgendaMeta">' + escapeHtml(metaText) + '</span>' : '')
            + '</div>';
    }

    function moveMiniCalendarMonth(delta) {
        var base = state.miniCalendarDate || new Date();
        var next = new Date(base.getFullYear(), base.getMonth() + delta, 1);
        var today = new Date();
        state.miniCalendarDate = next;
        state.miniCalendarSelectedDateKey = next.getFullYear() === today.getFullYear() && next.getMonth() === today.getMonth()
            ? formatDateKey(today)
            : formatDateKey(next);
        renderMiniCalendar();
    }

    async function handleCheckIn() {
        if (isWorkAccountUser()) return;
        var todayRecord = getTodayRecord();
        if (todayRecord && todayRecord.checkIn) {
            alert("이미 출근 처리되었습니다.");
            return;
        }
        try {
            setAttendanceButtonsDisabled(true);
            var data = await API.post(ATTENDANCE_API_BASE + "/check-in", buildAttendanceUserPayload(), { errorMessage: "출근 처리에 실패했습니다." });
            syncResolvedAttendanceUser(data);
            state.attendanceRecords = Array.isArray(data.items) ? data.items : [];
            renderAttendance();
            alert("출근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "출근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons(getTodayRecord());
        }
    }

    async function handleCheckOut() {
        if (isWorkAccountUser()) return;
        var todayRecord = getTodayRecord();
        if (!todayRecord || !todayRecord.checkIn) {
            alert("먼저 출근 처리를 해주세요.");
            return;
        }
        if (todayRecord.checkOut) {
            alert("이미 퇴근 처리되었습니다.");
            return;
        }
        try {
            setAttendanceButtonsDisabled(true);
            var data = await API.post(ATTENDANCE_API_BASE + "/check-out", buildAttendanceUserPayload(), { errorMessage: "퇴근 처리에 실패했습니다." });
            syncResolvedAttendanceUser(data);
            state.attendanceRecords = Array.isArray(data.items) ? data.items : [];
            renderAttendance();
            alert("퇴근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "퇴근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons(getTodayRecord());
        }
    }

    function syncAttendanceButtons(todayRecord) {
        var canCheckIn = !(todayRecord && todayRecord.checkIn);
        var canCheckOut = !!(todayRecord && todayRecord.checkIn) && !(todayRecord && todayRecord.checkOut);
        if (elements.checkInButton) {
            elements.checkInButton.disabled = !canCheckIn;
            elements.checkInButton.classList.toggle("is-active", canCheckIn);
        }
        if (elements.checkOutButton) {
            elements.checkOutButton.disabled = !canCheckOut;
            elements.checkOutButton.classList.toggle("is-active", canCheckOut);
        }
    }

    function setAttendanceButtonsDisabled(disabled) {
        if (elements.checkInButton) elements.checkInButton.disabled = disabled;
        if (elements.checkOutButton) elements.checkOutButton.disabled = disabled;
    }

    function getTodayRecord() {
        var todayKey = formatDateKey(new Date());
        return state.attendanceRecords.find(function (item) {
            return item && item.date === todayKey;
        }) || null;
    }

    function getWeeklyWorkedMinutes() {
        var now = new Date();
        var start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        var startKey = formatDateKey(start);
        return state.attendanceRecords.reduce(function (total, item) {
            if (!item || !item.date || item.date < startKey) return total;
            return total + calculateWorkedMinutes(item.checkIn, item.checkOut);
        }, 0);
    }

    function getWorkHoursText() {
        var profile = state.profile || {};
        return getWorkHoursForDate(new Date(), profile) || normalizeWorkHours(localStorage.getItem("userWorkHours") || "") || "09:00 - 18:00";
    }

    function getWeeklyTargetMinutes() {
        var schedule = getResolvedWorkSchedule(state.profile || {});
        if (hasWorkSchedule(schedule)) {
            return ["mon", "tue", "wed", "thu", "fri"].reduce(function (total, key) {
                return total + getWorkMinutesFromHoursText(schedule[key]);
            }, 0) || (40 * 60);
        }
        return getWorkMinutesFromHoursText(getWorkHoursText()) * 5 || (40 * 60);
    }

    function getCalendarEventsByDate(dateKey) {
        return state.calendarEvents.filter(function (item) {
            return isDateWithinEvent(dateKey, item);
        });
    }

    function getMiniCalendarEventsByDate(dateKey) {
        return getMiniCalendarUserEventsByDate(dateKey).concat(getKoreanHolidayEventsByDate(dateKey));
    }

    function getMiniCalendarUserEventsByDate(dateKey) {
        return getHomeMiniCalendarEvents().filter(function (item) {
            return isDateWithinEvent(dateKey, item);
        });
    }

    function getHomeMiniCalendarEvents() {
        var privateEvents = getPrivateCalendarEvents();
        var userId = String(state.user && state.user.id || "").trim().toLowerCase();
        var ownSharedEvents = state.sharedCalendarEvents.filter(function (item) {
            return userId && String(item && item.createdById || "").trim().toLowerCase() === userId;
        });
        return privateEvents.concat(ownSharedEvents);
    }

    function syncCalendarEvents() {
        state.calendarEvents = getVisibleCalendarEvents().sort(function (a, b) {
            return String(a.startDate || "").localeCompare(String(b.startDate || "")) || String(a.startTime || "").localeCompare(String(b.startTime || "")) || String(a.title || "").localeCompare(String(b.title || ""), "ko");
        });
    }

    function getVisibleCalendarEvents() {
        if (state.calendarScope === "team") return getTeamCalendarEvents();
        if (state.calendarScope === "wide") return getWideCalendarEvents();
        return getMyCalendarEvents();
    }

    function getMyCalendarEvents() {
        var privateEvents = getPrivateCalendarEvents();
        var sharedEvents = state.sharedCalendarEvents.filter(function (item) {
            return item.calendarScope === "wide" || ((item.calendarScope === "team" || item.calendarScope === "shared" || !item.calendarScope) && item.createdById === state.user.id);
        });
        return privateEvents.concat(sharedEvents);
    }

    function getTeamCalendarEvents() {
        var department = normalizeDepartment(state.user && state.user.department || "");
        var isPrivileged = isPrivilegedUser();
        return state.sharedCalendarEvents.filter(function (item) {
            if (item.calendarScope === "wide") return true;
            if (!(item.calendarScope === "team" || item.calendarScope === "shared" || !item.calendarScope)) return false;
            if (item.visibility === "private") return false;
            return isPrivileged || item.department === department;
        });
    }

    function getWideCalendarEvents() {
        var wideEvents = state.sharedCalendarEvents.filter(function (item) {
            return item.calendarScope === "wide";
        });
        return wideEvents.concat(buildBirthdayEventsForDashboard());
    }

    function getPrivateCalendarEvents() {
        try {
            var raw = localStorage.getItem("calendarEvents:my:" + state.user.id);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.map(function (item) {
                return normalizeCalendarEvent(item);
            }) : [];
        } catch (error) {
            return [];
        }
    }

    function normalizeCalendarEvent(item) {
        return {
            id: String(item && item.id || "").trim(),
            title: String(item && item.title || "").trim(),
            startDate: String(item && item.startDate || "").trim(),
            endDate: String(item && (item.endDate || item.startDate) || "").trim(),
            allDay: item && item.allDay === true,
            startTime: String(item && item.startTime || "").trim(),
            endTime: String(item && item.endTime || "").trim(),
            labelColor: normalizeDashboardCalendarLabelColor(item && item.labelColor),
            visibility: String(item && item.visibility || "private").trim().toLowerCase(),
            createdById: String(item && (item.createdById || item.requesterId) || state.user.id || "").trim().toLowerCase(),
            department: normalizeDepartment(item && item.department || state.user && state.user.department || ""),
            calendarScope: String(item && (item.calendarScope || item.scope) || "my").trim().toLowerCase(),
            isBirthday: item && item.isBirthday === true || /^birthday_/i.test(String(item && item.id || ""))
        };
    }

    function formatCalendarTimeRange(item) {
        if (item && item.isBirthday) return "";
        if (isVacationCalendarEvent(item)) return "";
        if (!item || item.allDay) return "종일";
        var startTime = normalizeClockTime(item.startTime);
        var endTime = normalizeClockTime(item.endTime);
        return formatCalendarDisplayTimeRange(startTime, endTime);
    }

    function normalizeClockTime(value) {
        var text = String(value || "").trim();
        var match = text.match(/^([0-9]{1,2}):([0-9]{2})/);
        if (!match) return "";
        return pad(match[1]) + ":" + match[2];
    }

    function formatCalendarDisplayTimeRange(startTime, endTime) {
        var start = parseCalendarDisplayTimeParts(startTime);
        var end = parseCalendarDisplayTimeParts(endTime);
        if (!start && !end) return "";
        if (start && end) {
            if (start.raw === end.raw) return formatCalendarDisplayTimeParts(start, true);
            return formatCalendarDisplayTimeParts(start, true) + " ~ " + formatCalendarDisplayTimeParts(end, start.period !== end.period);
        }
        return formatCalendarDisplayTimeParts(start || end, true);
    }

    function parseCalendarDisplayTimeParts(value) {
        var text = normalizeClockTime(value);
        if (!text) return null;
        var parts = text.split(":");
        var hour = Number(parts[0] || 0);
        var minute = parts[1] || "00";
        var period = hour < 12 ? "오전" : "오후";
        var displayHour = hour % 12 || 12;
        return { raw: text, period: period, displayHour: pad(displayHour), minute: minute };
    }

    function formatCalendarDisplayTimeParts(parts, includePeriod) {
        return (includePeriod ? parts.period + " " : "") + parts.displayHour + ":" + parts.minute;
    }

    function normalizeBirthdayItem(item) {
        return {
            id: String(item && item.id || "").trim().toLowerCase(),
            name: String(item && item.name || "").trim(),
            birthDate: normalizeBirthdayDate(item && item.birthDate || ""),
            department: normalizeDepartment(item && item.department || ""),
            position: String(item && (item.position || item.jobTitle || item.title) || "").trim(),
            jobGrade: String(item && (item.jobGrade || item.duty || item.responsibility) || "").trim()
        };
    }

    function formatBirthdayMemberMeta(item) {
        var department = normalizeDepartment(item && item.department || "");
        return department || "-";
    }

    function buildBirthdayEventsForDashboard() {
        var currentYear = new Date().getFullYear();
        return [currentYear - 1, currentYear, currentYear + 1].reduce(function (events, year) {
            return events.concat(buildBirthdayEventsForYear(year));
        }, []);
    }

    function buildBirthdayEventsForYear(year) {
        if (!Number.isFinite(year)) return [];
        return state.birthdayEvents.map(function (item, index) {
            var dateKey = buildBirthdayDateKey(item.birthDate, year);
            if (!dateKey) return null;
            return normalizeCalendarEvent({
                id: "birthday_" + (item.id || index) + "_" + year,
                title: item.name + " 생일",
                startDate: dateKey,
                endDate: dateKey,
                allDay: true,
                labelColor: BIRTHDAY_LABEL_COLOR,
                visibility: "shared",
                createdById: "system",
                department: item.department || "",
                calendarScope: "wide",
                isBirthday: true
            });
        }).filter(Boolean);
    }

    function normalizeBirthdayDate(value) {
        var digits = String(value || "").replace(/[^0-9]/g, "");
        return /^[0-9]{8}$/.test(digits) ? digits : "";
    }

    function buildBirthdayDateKey(birthDate, year) {
        var digits = normalizeBirthdayDate(birthDate);
        if (!digits || !Number.isFinite(year)) return "";
        var month = digits.slice(4, 6);
        var day = digits.slice(6, 8);
        if (month === "02" && day === "29" && !isLeapYear(year)) day = "28";
        return year + "-" + month + "-" + day;
    }

    function isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    function isPrivilegedUser() {
        if (window.AuthStore && typeof window.AuthStore.isExecutive === "function") {
            return window.AuthStore.isExecutive();
        }
        var role = String(state.user && state.user.role || "").trim().toLowerCase();
        var department = normalizeDepartment(state.user && state.user.department || "");
        return role === "admin" || role === "ceo" || department === "대표";
    }

    function isDateWithinEvent(dateKey, item) {
        var start = String(item && item.startDate || "").trim();
        var end = String(item && item.endDate || start).trim();
        if (!start) return false;
        return dateKey >= start && dateKey <= end;
    }

    function compareCalendarEventsForDashboard(a, b) {
        var aAllDay = isDashboardAllDayEvent(a) ? 0 : 1;
        var bAllDay = isDashboardAllDayEvent(b) ? 0 : 1;
        return aAllDay - bAllDay
            || String(a.startTime || "").localeCompare(String(b.startTime || ""))
            || String(a.title || "").localeCompare(String(b.title || ""), "ko");
    }

    function renderDashboardAgendaEvent(item) {
        var timeText = getDashboardCalendarEventTimeText(item);
        return ''
            + '<div class="dashboardAgendaEvent">'
            + '<span class="dashboardAgendaEventBar"' + getDashboardCalendarEventStyle(item) + '></span>'
            + (timeText ? '<span class="dashboardAgendaEventTime">' + escapeHtml(timeText) + '</span>' : '')
            + '<span class="dashboardAgendaEventTitle">' + escapeHtml(item.title || "제목 없음") + '</span>'
            + '</div>';
    }

    function getDashboardCalendarEventTimeText(item) {
        if (isVacationCalendarEvent(item)) return "";
        return formatCalendarTimeRange(item) || "시간 미정";
    }

    function getDashboardCalendarEventMetaText(item) {
        if (item && item.isHoliday) return "공휴일";
        var parts = [];
        var timeText = getDashboardCalendarEventTimeText(item);
        if (timeText) parts.push(timeText);
        return parts.join(" · ");
    }

    function buildDashboardTodaySummary(todayKey) {
        var count = getCalendarEventsByDate(todayKey).length;
        if (!count) return "오늘 예정된 일정이 없습니다.";
        return "오늘 일정 " + count + "개";
    }

    function formatDashboardAgendaDate(date) {
        var label = (date.getMonth() + 1) + "월 " + date.getDate() + "일(" + getKoreanWeekday(date) + ")";
        return label;
    }

    function getDashboardWeekDates(baseDate) {
        var date = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
        var start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
        var dates = [];
        for (var index = 0; index < 7; index += 1) {
            dates.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
        }
        return dates;
    }

    function getKoreanWeekday(date) {
        return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] || "";
    }

    function isDashboardAllDayEvent(item) {
        return !item || item.allDay || item.isBirthday || !normalizeClockTime(item.startTime) || !normalizeClockTime(item.endTime);
    }

    function getCalendarEventClassName(item) {
        return "dashboardCalendarEvent" + (isVacationCalendarEvent(item) ? " is-vacation" : "");
    }

    function getDashboardCalendarEventStyle(item, extraStyle) {
        var style = String(extraStyle || "");
        if (isVacationCalendarEvent(item)) return style ? ' style="' + escapeHtml(style) + '"' : "";
        if (item && item.isBirthday) {
            return ' style="' + escapeHtml(style) + 'background:' + BIRTHDAY_EVENT_BACKGROUND + ';color:#333333;"';
        }
        if (item && item.calendarScope === "wide") {
            return ' style="' + escapeHtml(style) + 'background:' + WIDE_EVENT_BACKGROUND + ';color:' + WIDE_LABEL_COLOR + ';"';
        }
        var palette = getDashboardCalendarPalette(item && item.labelColor);
        return ' style="' + escapeHtml(style) + 'background:' + escapeHtml(palette.background) + ';color:' + escapeHtml(palette.accent) + ';"';
    }

    function getMiniCalendarDotStyle(item) {
        if (item && item.isHoliday) return ' style="background:#ff5c68;"';
        if (item && item.isBirthday) return ' style="background:#63c94d;"';
        if (item && item.calendarScope === "wide") return ' style="background:#0373ef;"';
        var color = normalizeDashboardCalendarLabelColor(item && item.labelColor);
        var dotColor = color === DEFAULT_CALENDAR_LABEL_COLOR ? "#63c94d" : color;
        return ' style="background:' + escapeHtml(dotColor) + ';"';
    }

    function getMiniCalendarDotEvent(events) {
        return (events || []).slice().sort(compareCalendarEventsForDashboard)[0] || null;
    }

    function getDashboardCalendarPalette(color) {
        var accent = normalizeDashboardCalendarLabelColor(color);
        return {
            accent: "#333333",
            background: CALENDAR_LABEL_PALETTE[accent] || CALENDAR_LABEL_PALETTE[DEFAULT_CALENDAR_LABEL_COLOR]
        };
    }

    function normalizeDashboardCalendarLabelColor(color) {
        var value = sanitizeColor(color || DEFAULT_CALENDAR_LABEL_COLOR).toLowerCase();
        var aliases = {
            "#ffdf89": "#fff6de",
            "#ffb0b0": "#fdeded",
            "#9ff28e": "#ebf5e9",
            "#b9acf9": "#efedf9",
            "#cdae89": "#f4efe9",
            "#da3a2e": "#fdeded",
            "#d93a2e": "#fdeded",
            "#f8756c": "#fdeded",
            "#ff6969": "#fdeded",
            "#ff7444": "#fdeded",
            "#f6b73c": "#fff6de",
            "#f7ac54": "#fff6de",
            "#ffaa31": "#fff6de",
            "#face68": "#fff6de",
            "#3fa66b": "#ebf5e9",
            "#6ccc93": "#ebf5e9",
            "#84c5b1": "#ebf5e9",
            "#32b8b9": "#ebf5e9",
            "#e8f9f7": "#ebf5e9",
            "#a2cb8b": "#ebf5e9",
            "#3b82c4": "#efedf9",
            "#6cb7fb": "#efedf9",
            "#f0faff": "#efedf9",
            "#7c5fb8": "#efedf9",
            "#b792ff": "#efedf9",
            "#f7f3fd": "#efedf9",
            "#44b9f5": "#efedf9",
            "#a167f8": "#efedf9",
            "#898ac4": "#efedf9",
            "#a7aae1": "#efedf9",
            "#a98b76": "#f4efe9",
            "#f4efe9": "#f4efe9"
        };
        return aliases[value] || value;
    }

    function isVacationCalendarEvent(item) {
        var title = String(item && item.title || "").trim();
        return /연차|월차|반차|휴가|휴무|부재/.test(title);
    }

    function calculateWorkedMinutes(checkIn, checkOut) {
        if (!checkIn || !checkOut) return 0;
        var start = new Date(checkIn).getTime();
        var end = new Date(checkOut).getTime();
        if (!isFinite(start) || !isFinite(end) || end <= start) return 0;
        return Math.round((end - start) / 60000);
    }

    function normalizeWorkHours(value) {
        var normalized = String(value || "").trim().replace(/\s+/g, "");
        if (!normalized) return "";
        var match = normalized.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
        if (!match) return "";
        return padTime(match[1]) + " - " + padTime(match[2]);
    }

    function normalizeWorkSchedule(value) {
        var source = value && typeof value === "object" ? value : {};
        var next = {};
        ["mon", "tue", "wed", "thu", "fri"].forEach(function (key) {
            var normalized = normalizeWorkHours(source[key] || "");
            if (normalized) next[key] = normalized;
        });
        return next;
    }

    function getResolvedWorkSchedule(profile) {
        var schedule = normalizeWorkSchedule(profile && profile.workSchedule);
        if (hasWorkSchedule(schedule)) return schedule;
        return getDefaultDepartmentWorkSchedule(profile && profile.department || "");
    }

    function hasWorkSchedule(schedule) {
        return !!(schedule && typeof schedule === "object" && Object.keys(schedule).length);
    }

    function getDefaultDepartmentWorkSchedule(department) {
        var normalizedDepartment = normalizeDepartment(department || "");
        if (normalizedDepartment !== "영업1팀" && normalizedDepartment !== "영업2팀") return {};
        return {
            mon: "09:00 - 18:00",
            tue: "09:00 - 19:00",
            wed: "09:00 - 18:00",
            thu: "09:00 - 19:00",
            fri: "09:00 - 18:00"
        };
    }

    function getWorkHoursForDate(date, profile) {
        var schedule = getResolvedWorkSchedule(profile || {});
        var weekdayKey = getWeekdayKey(date);
        if (weekdayKey && schedule[weekdayKey]) return schedule[weekdayKey];
        return normalizeWorkHours(profile && (profile.workHours || profile.workTime) || "");
    }

    function getWeekdayKey(date) {
        var day = (date instanceof Date ? date : new Date(date)).getDay();
        if (day === 1) return "mon";
        if (day === 2) return "tue";
        if (day === 3) return "wed";
        if (day === 4) return "thu";
        if (day === 5) return "fri";
        return "";
    }

    function getWorkMinutesFromHoursText(value) {
        var normalized = normalizeWorkHours(value);
        if (!normalized) return 0;
        var parts = normalized.split("-");
        if (parts.length !== 2) return 0;
        var start = parseHourMinute(parts[0]);
        var end = parseHourMinute(parts[1]);
        if (!start || !end) return 0;
        return Math.max(0, end.totalMinutes - start.totalMinutes);
    }

    function padTime(value) {
        var parts = String(value || "").split(":");
        if (parts.length !== 2) return value;
        return pad(parts[0]) + ":" + pad(parts[1]);
    }

    function parseHourMinute(value) {
        var parts = String(value || "").trim().split(":");
        if (parts.length !== 2) return null;
        var hour = Number(parts[0]);
        var minute = Number(parts[1]);
        if (!isFinite(hour) || !isFinite(minute)) return null;
        return { hour: hour, minute: minute, totalMinutes: hour * 60 + minute };
    }

    function formatIsoTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatHourLabel(minutes) {
        return Math.round(Math.max(0, Number(minutes || 0)) / 60) + "h";
    }

    function buildNowLabel(date) {
        var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        return date.getFullYear() + "년 " + pad(date.getMonth() + 1) + "월 " + pad(date.getDate()) + "일 (" + weekdays[date.getDay()] + ") " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    function formatMailDate(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatApprovalDate(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatBoardDate(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatMailMeta(item) {
        var name = String(item && (item.from_name || item.from) || "").trim() || "-";
        return name + " · " + formatShortMailDate(item && item.date || "");
    }

    function formatShortMailDate(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        return pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " (" + weekdays[date.getDay()] + ") " + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function estimateMailboxBytes(items) {
        return (Array.isArray(items) ? items : []).reduce(function (total, item) {
            return total + jsonByteSize(item || {});
        }, 0);
    }

    function hasMailAttachment(item) {
        if (Number(item && item.attachmentCount || 0) > 0) return true;
        if (Array.isArray(item && item.attachmentsMeta) && item.attachmentsMeta.length > 0) return true;
        return Array.isArray(item && item.attachments) && item.attachments.length > 0;
    }

    function formatMailSnippet(item) {
        var source = String(item && (item.body || item.bodyText || item.text || item.content || item.snippet) || "");
        return stripMailHtml(source)
            .replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function stripMailHtml(value) {
        return String(value || "")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<\/p>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&zwnj;|&#8204;|&#x200c;/gi, "")
            .replace(/&zwj;|&#8205;|&#x200d;/gi, "")
            .replace(/&ZeroWidthSpace;|&#8203;|&#x200b;/gi, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    function jsonByteSize(value) {
        try {
            return new Blob([JSON.stringify(value || {})]).size;
        } catch (error) {
            return String(JSON.stringify(value || {})).length;
        }
    }

    function formatBytes(bytes) {
        var value = Number(bytes || 0);
        if (!isFinite(value) || value <= 0) return "0MB";
        var mb = value / (1024 * 1024);
        if (mb < 0.1) return "0.1MB";
        return (Math.round(mb * 10) / 10) + "MB";
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

    function resolveHireDate() {
        var profile = state.profile || {};
        var raw = String(profile.hireDate || profile.createdAt || "").trim();
        if (!raw) return null;
        var date = parseFlexibleDate(raw);
        return isNaN(date.getTime()) ? null : date;
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
        return state.absenceItems.reduce(function (total, item) {
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

    function parseFlexibleDate(value) {
        var normalized = String(value || "").trim();
        if (/^[0-9]{8}$/.test(normalized)) {
            return new Date(Number(normalized.slice(0, 4)), Number(normalized.slice(4, 6)) - 1, Number(normalized.slice(6, 8)));
        }
        return new Date(normalized);
    }

    function formatDateInput(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
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

    function formatDayCount(value) {
        var amount = Number(value || 0);
        if (!isFinite(amount) || amount <= 0) return "0d";
        if (Math.floor(amount) === amount) return amount + "d";
        return amount.toFixed(1) + "d";
    }

    function getCurrentMonthBirthdays() {
        var now = new Date();
        var month = pad(now.getMonth() + 1);
        return state.birthdayEvents.filter(function (item) {
            return normalizeBirthdayDate(item.birthDate).slice(4, 6) === month;
        }).sort(function (a, b) {
            return normalizeBirthdayDate(a.birthDate).slice(4, 8).localeCompare(normalizeBirthdayDate(b.birthDate).slice(4, 8))
                || String(a.name || "").localeCompare(String(b.name || ""), "ko");
        });
    }

    function formatBirthdayDate(birthDate) {
        var digits = normalizeBirthdayDate(birthDate);
        if (!digits) return "-";
        var year = new Date().getFullYear();
        var date = new Date(year, Number(digits.slice(4, 6)) - 1, Number(digits.slice(6, 8)));
        return pad(date.getMonth() + 1) + "/" + pad(date.getDate()) + "(" + getKoreanWeekday(date) + ")";
    }

    function getBirthdayInitial(name) {
        var nameChars = Array.from(String(name || "").replace(/\s+/g, ""));
        if (!nameChars.length) return "나";
        return nameChars[Math.floor(nameChars.length / 2)] || "나";
    }

    function formatVacationValue() {
        if (!state.absenceLoaded) return "-";
        var hireDate = resolveHireDate();
        if (!hireDate) return "-";
        var period = buildAnnualPeriod(hireDate, new Date());
        var grantedDays = calculateGrantedDaysForPeriod(hireDate, period, new Date()) + normalizeExtraVacationDays(state.profile && state.profile.extraVacationDays || 0);
        var usedDays = calculateUsedDaysForPeriod(period.start, period.end);
        return formatDayCount(Math.max(0, grantedDays - usedDays));
    }

    function formatDateKey(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function parseDateKey(value) {
        var parts = String(value || "").split("-");
        var year = Number(parts[0] || 0);
        var month = Number(parts[1] || 1) - 1;
        var day = Number(parts[2] || 1);
        var date = new Date(year, month, day);
        return isNaN(date.getTime()) ? new Date() : date;
    }

    function normalizeDepartment(value) {
        return String(value || "").trim();
    }

    function sanitizeColor(value) {
        var color = String(value || "").trim();
        return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : DEFAULT_CALENDAR_LABEL_COLOR;
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
