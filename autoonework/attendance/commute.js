(function () {
    var API_BASE = getGroupwareApiBase("/api/attendance");
    var API = window.GroupwareApi;
    var TIMELINE_START_HOUR = 7;
    var TIMELINE_END_HOUR = 24;
    var state = {
        userId: "",
        userEmail: "",
        profile: null,
        records: [],
        timerId: null
    };
    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        if (!ensureUser()) return;
        cacheElements();
        bindAttendanceSync();
        startClock();
        initializePage();
    });

    function ensureUser() {
        state.userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        state.userEmail = String(localStorage.getItem("userEmail") || "").trim().toLowerCase();

        if (state.userId || state.userEmail) return true;

        alert("로그인 후 이용할 수 있습니다.");
        location.href = "/login.html";
        return false;
    }

    function cacheElements() {
        elements.todayText = document.querySelector(".commuteTodayDate");
        elements.nowTime = document.querySelector(".nowClock");
        elements.stateValue = document.querySelector(".attendStateValue");
        elements.stateSubText = document.querySelector(".attendStateSubText");
        elements.checkInValue = document.querySelector(".atteTime");
        elements.checkOutValue = document.querySelector(".leaveTime");
        elements.checkInBtn = document.querySelector(".commuteCheckInBtn");
        elements.checkOutBtn = document.querySelector(".commuteCheckOutBtn");
        elements.workedValue = document.querySelector(".attendWorkedValue");
        elements.workHours = document.querySelector(".w_hours");
        elements.workGraph = document.querySelector(".workGraph");
        elements.weekHours = document.querySelector(".week_hm");
        elements.lateCount = document.querySelector(".late_cnt");
        elements.outsideCount = document.querySelector(".outside_cnt");
        elements.earlyCount = document.querySelector(".early_cnt");
        elements.tripCount = document.querySelector(".trip_cnt");
        elements.specialButtons = document.querySelectorAll(".commuteSpecialBtn");
        elements.monthLabel = document.querySelector(".attendMonthLabel");
        elements.historyList = document.querySelector(".attendGraphList");
        bindSpecialButtons();
        bindAttendanceButtons();
    }

    async function initializePage() {
        await loadProfile();
        await loadRecords();
        render();
    }

    function bindAttendanceSync() {
        window.addEventListener("attendance:updated", function (event) {
            var items = event && event.detail && Array.isArray(event.detail.records) ? event.detail.records : [];
            state.records = items;
            render();
            syncAttendanceButtons();
        });
    }

    function bindAttendanceButtons() {
        if (elements.checkInBtn && !elements.checkInBtn.dataset.bound) {
            elements.checkInBtn.dataset.bound = "true";
            elements.checkInBtn.addEventListener("click", handleAttendanceCheckIn);
        }
        if (elements.checkOutBtn && !elements.checkOutBtn.dataset.bound) {
            elements.checkOutBtn.dataset.bound = "true";
            elements.checkOutBtn.addEventListener("click", handleAttendanceCheckOut);
        }
    }

    function bindSpecialButtons() {
        elements.specialButtons.forEach(function (button) {
            if (button.dataset.bound) return;
            button.dataset.bound = "true";
            button.addEventListener("click", function () {
                updateTodaySpecial(button.getAttribute("data-type") || "");
            });
        });
    }

    async function loadProfile() {
        try {
            var data = await API.get(getGroupwareApiBase("/api/auth") + "/profile", { userId: state.userId }, {
                errorMessage: "프로필을 불러오지 못했습니다."
            });
            state.profile = data.item || null;
            syncUserWorkHours(state.profile);
        } catch (error) {
            state.profile = null;
        }
    }

    async function loadRecords() {
        try {
            var data = await API.get(API_BASE + "/my", buildAttendanceUserPayload(), {
                errorMessage: "근태 정보를 불러오지 못했습니다."
            });

            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
        } catch (error) {
            state.records = [];
        }
    }

    function buildAttendanceUserPayload() {
        return {
            userId: state.userId,
            userEmail: state.userEmail,
            userName: state.profile && state.profile.name || localStorage.getItem("userName") || ""
        };
    }

    function syncResolvedAttendanceUser(data) {
        var resolvedUserId = String(data && data.userId || "").trim().toLowerCase();
        if (!resolvedUserId || resolvedUserId === state.userId) return;
        state.userId = resolvedUserId;
        localStorage.setItem("userId", resolvedUserId);
    }

    function getTodayRecord() {
        var todayKey = formatDateKey(new Date());
        return state.records.find(function (item) {
            return item && item.date === todayKey;
        }) || null;
    }

    function startClock() {
        updateClock();
        if (state.timerId) clearInterval(state.timerId);
        state.timerId = setInterval(updateClock, 1000);
    }

    function updateClock() {
        var now = new Date();
        if (elements.todayText) elements.todayText.textContent = buildTodayLabel(now);
        if (elements.nowTime) elements.nowTime.textContent = formatTime(now);
    }

    function render() {
        renderSummary();
        renderHistory();
        syncAttendanceButtons();
    }

    function renderSummary() {
        var todayRecord = getTodayRecord();
        var summary = buildSummary(todayRecord);

        if (elements.stateValue) elements.stateValue.textContent = summary.stateText;
        if (elements.stateSubText) elements.stateSubText.textContent = summary.subText;
        if (elements.checkInValue) elements.checkInValue.textContent = summary.checkInText;
        if (elements.checkOutValue) elements.checkOutValue.textContent = summary.checkOutText;
        if (elements.workedValue) elements.workedValue.textContent = summary.workedText;
        if (elements.workHours) elements.workHours.textContent = getWorkHoursText();
        if (elements.weekHours) elements.weekHours.textContent = formatWeeklyWorkedTime();
        renderWorkGraph();
        renderSpecialCounts(todayRecord);
        if (elements.monthLabel) elements.monthLabel.textContent = buildMonthLabel(new Date());
    }

    async function handleAttendanceCheckIn() {
        var todayRecord = getTodayRecord();
        if (todayRecord && todayRecord.checkIn) {
            alert("이미 출근 처리되었습니다.");
            return;
        }
        try {
            setAttendanceButtonsDisabled(true);
            var data = await API.post(API_BASE + "/check-in", {
                    userId: state.userId,
                    userName: state.profile && state.profile.name || localStorage.getItem("userName") || "",
                    userEmail: state.userEmail
                }, {
                    errorMessage: "출근 처리에 실패했습니다."
            });
            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
            render();
            window.dispatchEvent(new CustomEvent("attendance:updated", {
                detail: { records: state.records.slice() }
            }));
            alert("출근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "출근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons();
        }
    }

    async function handleAttendanceCheckOut() {
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
            var data = await API.post(API_BASE + "/check-out", buildAttendanceUserPayload(), {
                errorMessage: "퇴근 처리에 실패했습니다."
            });
            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
            render();
            window.dispatchEvent(new CustomEvent("attendance:updated", {
                detail: { records: state.records.slice() }
            }));
            alert("퇴근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "퇴근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons();
        }
    }

    function syncAttendanceButtons() {
        var todayRecord = getTodayRecord();
        var canCheckIn = !(todayRecord && todayRecord.checkIn);
        var canCheckOut = !!(todayRecord && todayRecord.checkIn) && !(todayRecord && todayRecord.checkOut);
        if (elements.checkInBtn) {
            elements.checkInBtn.disabled = !canCheckIn;
            elements.checkInBtn.classList.toggle("is-active", canCheckIn);
        }
        if (elements.checkOutBtn) {
            elements.checkOutBtn.disabled = !canCheckOut;
            elements.checkOutBtn.classList.toggle("is-active", canCheckOut);
        }
    }

    function setAttendanceButtonsDisabled(disabled) {
        if (elements.checkInBtn) elements.checkInBtn.disabled = disabled;
        if (elements.checkOutBtn) elements.checkOutBtn.disabled = disabled;
    }

    function renderSpecialCounts(record) {
        var specials = record && record.specials ? record.specials : {};
        if (elements.lateCount) elements.lateCount.textContent = specials.late ? "1" : "0";
        if (elements.outsideCount) elements.outsideCount.textContent = specials.outside ? "1" : "0";
        if (elements.earlyCount) elements.earlyCount.textContent = specials.early ? "1" : "0";
        if (elements.tripCount) elements.tripCount.textContent = specials.trip ? "1" : "0";
        elements.specialButtons.forEach(function (button) {
            var type = button.getAttribute("data-type") || "";
            button.classList.toggle("selected", !!specials[type]);
        });
    }

    function getWorkHoursText() {
        var profile = state.profile || {};
        return getWorkHoursForDate(new Date(), profile) || normalizeWorkHours(localStorage.getItem("userWorkHours") || "") || "09:00 - 18:00";
    }

    function syncUserWorkHours(profile) {
        var workHours = getWorkHoursForDate(new Date(), profile);
        if (!workHours) return;
        localStorage.setItem("userWorkHours", workHours);
    }

    function buildWorkHoursFromProfile(profile) {
        var start = String(profile && (profile.workStart || profile.startWorkTime) || "").trim();
        var end = String(profile && (profile.workEnd || profile.endWorkTime) || "").trim();
        if (!start || !end) return "";
        return start + " - " + end;
    }

    function normalizeWorkHours(value) {
        var text = String(value || "").trim().replace(/\s*~\s*/g, " - ").replace(/\s*-\s*/g, " - ");
        var matched = text.match(/^([0-2][0-9]:[0-5][0-9])\s-\s([0-2][0-9]:[0-5][0-9])$/);
        if (!matched) return "";
        return matched[1] + " - " + matched[2];
    }

    async function updateTodaySpecial(type) {
        if (!type) return;
        var todayRecord = getTodayRecord();
        var current = todayRecord && todayRecord.specials && todayRecord.specials[type] === true;

        try {
            setSpecialButtonsDisabled(true);
            var payload = buildAttendanceUserPayload();
            payload.type = type;
            payload.value = !current;
            var data = await API.post(API_BASE + "/special", payload, {
                errorMessage: "특이사항을 저장하지 못했습니다."
            });
            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
            render();
        } catch (error) {
            alert(error.message || "특이사항 저장 중 오류가 발생했습니다.");
        } finally {
            setSpecialButtonsDisabled(false);
        }
    }

    function setSpecialButtonsDisabled(disabled) {
        elements.specialButtons.forEach(function (button) {
            button.disabled = disabled;
        });
    }

    function renderHistory() {
        if (!elements.historyList) return;

        var weekRange = getCurrentHistoryWeekRange();
        var weekRecords = state.records.filter(function (item) {
            var dateKey = item && String(item.date || "");
            return !!dateKey && dateKey >= weekRange.start && dateKey <= weekRange.end;
        }).sort(function (a, b) {
            return String(b.date || "").localeCompare(String(a.date || ""));
        });

        if (!weekRecords.length) {
            elements.historyList.innerHTML = '<div class="attendEmptyRow">이번 주 근태 기록이 없습니다.</div>';
            return;
        }

        elements.historyList.innerHTML = weekRecords.map(function (record) {
            var timeline = buildTimelineStyle(record);
            return ''
                + '<div class="attendGraphCard">'
                + '<div class="attendGraphHead">'
                + '<div class="attendGraphDate">' + escapeHtml(formatRecordDate(record.date)) + '</div>'
                + '<div class="attendGraphSummaryInline">'
                + '<span>근무 시간 <strong>' + escapeHtml(formatRecordTime(record.checkIn)) + '</strong></span>'
                + '<span>근무 종료 <strong>' + escapeHtml(formatRecordTime(record.checkOut)) + '</strong></span>'
                + '<span>총 근로시간 <strong>' + escapeHtml(formatWorkedTime(record.checkIn, record.checkOut, record.date)) + '</strong></span>'
                + '</div>'
                + '</div>'
                + '<div class="attendTimelineCard">'
                + '<div class="attendTimelineHours">' + buildTimelineHours() + '</div>'
                + '<div class="attendTimelineGrid">'
                + '<div class="attendTimelineLines">' + buildTimelineLines() + '</div>'
                + (timeline ? '<div class="attendTimelineBar ' + escapeHtml(timeline.className) + '" style="left:' + escapeHtml(timeline.left) + ';width:' + escapeHtml(timeline.width) + ';"><span>' + escapeHtml(timeline.label) + '</span></div>' : '')
                + '</div>'
                + '</div>'
                + '</div>';
        }).join("");
    }

    function buildSummary(record) {
        if (!record || !record.checkIn) {
            return {
                stateText: "미출근",
                subText: "아직 오늘 출근 기록이 없습니다.",
                checkInText: "-",
                checkOutText: "-",
                workedText: "-"
            };
        }

        if (record.checkIn && !record.checkOut) {
            return {
                stateText: "근무중",
                subText: "오늘 출근 기록이 저장되어 있습니다.",
                checkInText: formatIsoTime(record.checkIn),
                checkOutText: "-",
                workedText: formatWorkedTime(record.checkIn, "", record.date)
            };
        }

        return {
            stateText: "퇴근완료",
            subText: "오늘 출퇴근 기록이 모두 저장되었습니다.",
            checkInText: formatIsoTime(record.checkIn),
            checkOutText: formatIsoTime(record.checkOut),
            workedText: formatWorkedTime(record.checkIn, record.checkOut, record.date)
        };
    }

    function buildRecordStatus(record) {
        if (!record || !record.checkIn) {
            return { label: "미출근", className: "is-missing" };
        }
        if (record.checkIn && !record.checkOut) {
            if (!isTodayRecord(record.date)) {
                return { label: "퇴근누락", className: "is-missed" };
            }
            return { label: "근무중", className: "is-working" };
        }
        return { label: "퇴근완료", className: "is-done" };
    }

    function buildTodayLabel(date) {
        var days = ["일", "월", "화", "수", "목", "금", "토"];
        return date.getFullYear() + "년 " + pad(date.getMonth() + 1) + "월 " + pad(date.getDate()) + "일 (" + days[date.getDay()] + ") " + formatTime(date);
    }

    function buildMonthLabel(date) {
        return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 기록";
    }

    function formatDateKey(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function formatMonthKey(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1);
    }

    function formatRecordDate(value) {
        if (!value) return "-";
        var parts = String(value).split("-");
        if (parts.length !== 3) return value;
        var date = new Date(parts[0], Number(parts[1]) - 1, parts[2]);
        if (isNaN(date.getTime())) return parts[0] + "." + parts[1] + "." + parts[2];
        return parts[0] + "." + parts[1] + "." + parts[2] + "(" + getDayText(date, true) + ")";
    }

    function formatTime(date) {
        return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
    }

    function formatIsoTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function formatRecordTime(value) {
        var time = formatIsoTime(value);
        return time === "-" ? "-" : time;
    }

    function formatWorkedTime(checkIn, checkOut, recordDate) {
        if (!checkIn) return "-";
        var start = new Date(checkIn);
        if (isNaN(start.getTime())) return "-";
        if (!checkOut && recordDate && !isTodayRecord(recordDate)) return "-";
        var end = checkOut ? new Date(checkOut) : new Date();
        if (isNaN(end.getTime()) || end.getTime() < start.getTime()) return "-";

        var diffMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
        var hours = Math.floor(diffMinutes / 60);
        var minutes = diffMinutes % 60;
        return hours + "시간 " + minutes + "분";
    }

    function formatWeeklyWorkedTime() {
        var weekMinutes = getCurrentWeekWorkedMinutes();
        if (!weekMinutes) return "-";
        return Math.floor(weekMinutes / 60) + "h " + (weekMinutes % 60) + "m";
    }

    function getCurrentWeekWorkedMinutes() {
        var range = getCurrentWeekRange();
        return state.records.reduce(function (total, record) {
            if (!record || !record.date || record.date < range.start || record.date > range.end) return total;
            return total + getWorkedMinutes(record.checkIn, record.checkOut, record.date);
        }, 0);
    }

    function getCurrentWeekRange() {
        var now = new Date();
        var monday = new Date(now);
        var day = monday.getDay();
        var mondayOffset = day === 0 ? -6 : 1 - day;
        monday.setDate(monday.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);

        var friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        friday.setHours(23, 59, 59, 999);

        return {
            start: formatDateKey(monday),
            end: formatDateKey(friday)
        };
    }

    function getCurrentHistoryWeekRange() {
        var now = new Date();
        var monday = new Date(now);
        var day = monday.getDay();
        var mondayOffset = day === 0 ? -6 : 1 - day;
        monday.setDate(monday.getDate() + mondayOffset);
        monday.setHours(0, 0, 0, 0);

        var sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
            start: formatDateKey(monday),
            end: formatDateKey(sunday)
        };
    }

    function getWorkedMinutes(checkIn, checkOut, recordDate) {
        if (!checkIn) return 0;
        var start = new Date(checkIn);
        if (isNaN(start.getTime())) return 0;
        if (!checkOut && recordDate && !isTodayRecord(recordDate)) return 0;
        var end = checkOut ? new Date(checkOut) : new Date();
        if (isNaN(end.getTime()) || end.getTime() < start.getTime()) return 0;
        return Math.floor((end.getTime() - start.getTime()) / 60000);
    }

    function renderWorkGraph() {
        if (!elements.workGraph) return;
        var weekMinutes = getCurrentWeekWorkedMinutes();
        var thresholdMinutes = getWeeklyTargetMinutes();
        var maxMinutes = thresholdMinutes + (12 * 60);
        var progressMinutes = Math.min(weekMinutes, maxMinutes);
        var thresholdPercent = (thresholdMinutes / maxMinutes) * 100;
        var progressPercent = (progressMinutes / maxMinutes) * 100;
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

    function getWeeklyTargetMinutes() {
        var schedule = getResolvedWorkSchedule(state.profile || {});
        if (hasWorkSchedule(schedule)) {
            return ["mon", "tue", "wed", "thu", "fri"].reduce(function (total, key) {
                return total + getWorkMinutesFromHoursText(schedule[key]);
            }, 0) || (40 * 60);
        }
        var hoursText = getWorkHoursText();
        return getWorkMinutesFromHoursText(hoursText) * 5 || (40 * 60);
    }

    function getWorkHoursForDate(date, profile) {
        var schedule = getResolvedWorkSchedule(profile || {});
        var weekdayKey = getWeekdayKey(date);
        if (weekdayKey && schedule[weekdayKey]) return schedule[weekdayKey];
        return normalizeWorkHours(profile && (profile.workHours || profile.workTime || buildWorkHoursFromProfile(profile)) || "");
    }

    function getResolvedWorkSchedule(profile) {
        var schedule = normalizeWorkSchedule(profile && profile.workSchedule);
        if (hasWorkSchedule(schedule)) return schedule;
        return getDefaultDepartmentWorkSchedule(profile && profile.department || "");
    }

    function getDefaultDepartmentWorkSchedule(department) {
        var normalizedDepartment = String(department || "").trim();
        if (normalizedDepartment !== "영업1팀" && normalizedDepartment !== "영업2팀") return {};
        return {
            mon: "09:00 - 18:00",
            tue: "09:00 - 19:00",
            wed: "09:00 - 18:00",
            thu: "09:00 - 19:00",
            fri: "09:00 - 18:00"
        };
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

    function hasWorkSchedule(schedule) {
        return !!(schedule && typeof schedule === "object" && Object.keys(schedule).length);
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

    function getWorkMinutesFromHoursText(hoursText) {
        var matched = String(hoursText || "").match(/^([0-2][0-9]):([0-5][0-9])\s-\s([0-2][0-9]):([0-5][0-9])$/);
        if (!matched) return 0;
        var startMinutes = Number(matched[1]) * 60 + Number(matched[2]);
        var endMinutes = Number(matched[3]) * 60 + Number(matched[4]);
        return Math.max(endMinutes - startMinutes, 0);
    }

    function formatHourLabel(minutes) {
        return Math.round(minutes / 60) + "h";
    }

    function buildTimelineHours() {
        var labels = [];
        for (var hour = TIMELINE_START_HOUR; hour < TIMELINE_END_HOUR; hour += 1) {
            labels.push('<span>' + pad(hour) + '</span>');
        }
        return labels.join("");
    }

    function buildTimelineLines() {
        var lines = [];
        for (var hour = TIMELINE_START_HOUR; hour < TIMELINE_END_HOUR; hour += 1) {
            lines.push('<span></span>');
        }
        return lines.join("");
    }

    function buildTimelineStyle(record) {
        if (!record || !record.checkIn) return null;
        var start = new Date(record.checkIn);
        if (isNaN(start.getTime())) return null;
        var end;
        if (record.checkOut) {
            end = new Date(record.checkOut);
        } else if (isTodayRecord(record.date)) {
            end = new Date();
        } else {
            end = new Date(start);
            end.setHours(Math.min(start.getHours() + 8, 23), start.getMinutes(), 0, 0);
        }
        if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) return null;

        var timelineStartMinutes = TIMELINE_START_HOUR * 60;
        var timelineEndMinutes = TIMELINE_END_HOUR * 60;
        var totalTimelineMinutes = timelineEndMinutes - timelineStartMinutes;
        var minimumWidthPercent = 100 / (TIMELINE_END_HOUR - TIMELINE_START_HOUR);
        var startMinutes = Math.max(start.getHours() * 60 + start.getMinutes(), timelineStartMinutes);
        var endMinutes = Math.min(end.getHours() * 60 + end.getMinutes(), timelineEndMinutes);
        if (endMinutes <= timelineStartMinutes || startMinutes >= timelineEndMinutes || endMinutes <= startMinutes) return null;
        var left = ((startMinutes - timelineStartMinutes) / totalTimelineMinutes) * 100;
        var width = Math.max(((endMinutes - startMinutes) / totalTimelineMinutes) * 100, minimumWidthPercent);
        var status = buildRecordStatus(record);
        return {
            left: left + "%",
            width: width + "%",
            label: status.label === "퇴근완료" ? "퇴근" : status.label,
            className: status.className
        };
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function isTodayRecord(dateValue) {
        return String(dateValue || "") === formatDateKey(new Date());
    }

    function getDayText(date, shortMode) {
        var shortDays = ["일", "월", "화", "수", "목", "금", "토"];
        var fullDays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        return shortMode ? shortDays[date.getDay()] : fullDays[date.getDay()];
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
