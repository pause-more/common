(function () {
    if (window.__wideCalendarBooted) return;
    window.__wideCalendarBooted = true;

    var SHARED_API_BASE = getGroupwareApiBase("/api/calendar/shared");
    var SHARED_BIRTHDAY_API = SHARED_API_BASE + "/birthdays";
    var API = window.GroupwareApi;
    var CALENDAR_SCOPE = "wide";
    var DEFAULT_START_TIME = "09:00";
    var DEFAULT_END_TIME = "18:00";
    var BIRTHDAY_LABEL_COLOR = "#85bb67";
    var BIRTHDAY_EVENT_BACKGROUND = "#faffd5";
    var DEFAULT_LABEL_COLOR = "#fff6de";
    var WIDE_LABEL_COLOR = "#fff";
    var WIDE_EVENT_BACKGROUND = "#0373ef";
    var CALENDAR_LABEL_PALETTE = {
        "#fff6de": "#fff6de",
        "#fdeded": "#fdeded",
        "#ebf5e9": "#ebf5e9",
        "#efedf9": "#efedf9",
        "#f4efe9": "#f4efe9"
    };
    var state = {
        currentDate: new Date(),
        selectedDate: formatDateKey(new Date()),
        user: null,
        events: [],
        birthdays: [],
        modalReadonly: false
    };
    var elements = {};

    function initializeWideCalendar(retryCount) {
        retryCount = Number(retryCount || 0);
        state.user = getCurrentUser();
        cacheElements();
        if (!elements.page) {
            if (retryCount < 20) {
                setTimeout(function () { initializeWideCalendar(retryCount + 1); }, 150);
            }
            return;
        }
        bindEvents();
        updateAddButtonState();
        renderCalendar();
        loadEvents().then(function () {
            renderCalendar();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeWideCalendar);
    } else {
        initializeWideCalendar();
    }

    function cacheElements() {
        elements.page = document.querySelector(".calendarPage--wide") || document.querySelector('.calendarPage[data-calendar-scope="wide"]');
        if (!elements.page) return;
        elements.monthLabel = elements.page.querySelector(".calendarCurrentMonth");
        elements.grid = elements.page.querySelector(".calendarGrid");
        elements.prevButton = elements.page.querySelector(".calendarPrevBtn");
        elements.nextButton = elements.page.querySelector(".calendarNextBtn");
        elements.pageMoveSelect = elements.page.querySelector(".calendarPageMoveSelect");
        elements.addButton = elements.page.querySelector(".calendarAddBtn");
        elements.modal = document.querySelector(".calendarModal");
        elements.modalDim = document.querySelector(".calendarModalDim");
        elements.modalHead = document.querySelector(".calendarModalHead");
        elements.closeButton = document.querySelector(".calendarModalCloseBtn");
        elements.eventId = document.querySelector(".calendarEventId");
        elements.titleInput = document.querySelector(".calendarTitleInput");
        elements.startInput = document.querySelector(".calendarStartInput");
        elements.endInput = document.querySelector(".calendarEndInput");
        elements.startTimeInput = document.querySelector(".calendarStartTimeInput");
        elements.endTimeInput = document.querySelector(".calendarEndTimeInput");
        elements.startYearSelect = document.getElementById("calendarStartYear");
        elements.startMonthSelect = document.getElementById("calendarStartMonth");
        elements.startDaySelect = document.getElementById("calendarStartDay");
        elements.endYearSelect = document.getElementById("calendarEndYear");
        elements.endMonthSelect = document.getElementById("calendarEndMonth");
        elements.endDaySelect = document.getElementById("calendarEndDay");
        elements.startTimeSelect = document.getElementById("calendarStartTime");
        elements.endTimeSelect = document.getElementById("calendarEndTime");
        elements.allDayInput = document.querySelector(".calendarAllDayInput");
        elements.locationInput = document.querySelector(".calendarLocationInput");
        elements.memoInput = document.querySelector(".calendarMemoInput");
        elements.labelInputs = Array.prototype.slice.call(document.querySelectorAll(".calendarLabelInput"));
        elements.alertInput = document.querySelector(".calendarAlertInput");
        elements.saveButton = document.querySelector(".calendarSaveBtn");
        elements.deleteButton = document.querySelector(".calendarDeleteBtn");
        elements.modalBody = document.querySelector(".calendarModalBody");
        elements.titleField = elements.titleInput ? elements.titleInput.closest(".calendarField") : null;
        elements.dateField = elements.startInput ? elements.startInput.closest(".calendarField") : null;
        elements.timeField = elements.startTimeInput ? elements.startTimeInput.closest(".calendarField") : null;
        elements.locationField = elements.locationInput ? elements.locationInput.closest(".calendarField") : null;
        elements.memoField = elements.memoInput ? elements.memoInput.closest(".calendarField") : null;
        elements.labelField = elements.labelInputs.length ? elements.labelInputs[0].closest(".calendarField") : null;
        elements.alertField = elements.alertInput ? elements.alertInput.closest(".calendarField") : null;
        elements.actions = elements.saveButton ? elements.saveButton.closest(".calendarModalActions") : null;
        initializeDateSelectGroup(elements.startYearSelect, elements.startMonthSelect, elements.startDaySelect, elements.startInput);
        initializeDateSelectGroup(elements.endYearSelect, elements.endMonthSelect, elements.endDaySelect, elements.endInput);
        initializeTimeSelect(elements.startTimeSelect, elements.startTimeInput);
        initializeTimeSelect(elements.endTimeSelect, elements.endTimeInput);
        ensureReadonlyAuthorBadge();
        ensureReadonlyDetail();
    }

    function bindEvents() {
        if (elements.prevButton) elements.prevButton.addEventListener("click", function () { moveMonth(-1); });
        if (elements.nextButton) elements.nextButton.addEventListener("click", function () { moveMonth(1); });
        if (elements.pageMoveSelect) {
            elements.pageMoveSelect.addEventListener("change", function () {
                var target = String(elements.pageMoveSelect.value || "").trim();
                if (!target) return;
                window.location.href = target;
            });
        }
        if (elements.addButton) {
            elements.addButton.addEventListener("click", function () {
                if (!canManageWideCalendar()) {
                    alert("전사 일정은 관리자 또는 대표만 등록할 수 있습니다.");
                    return;
                }
                openEventModal(null, state.selectedDate);
            });
        }
        if (elements.closeButton) elements.closeButton.addEventListener("click", closeEventModal);
        if (elements.modalDim) elements.modalDim.addEventListener("click", closeEventModal);
        if (elements.saveButton) elements.saveButton.addEventListener("click", saveEvent);
        if (elements.deleteButton) elements.deleteButton.addEventListener("click", deleteEvent);
        if (elements.allDayInput) elements.allDayInput.addEventListener("change", syncAllDayFields);

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && elements.modal && elements.modal.style.display === "block") closeEventModal();
        });
    }

    async function loadEvents() {
        try {
            var data = await API.get(SHARED_API_BASE, null, {
                errorMessage: "전사 일정을 불러오지 못했습니다."
            });
            state.events = Array.isArray(data.items) ? data.items.map(normalizeEvent).filter(function (item) {
                return isWideCalendarEvent(item);
            }) : [];
        } catch (error) {
            state.events = [];
        }
        await loadBirthdayEvents();
    }

    async function loadBirthdayEvents() {
        try {
            var userId = getUserId();
            if (!userId || userId === "guest") {
                state.birthdays = [];
                return;
            }
            var data = await API.get(SHARED_BIRTHDAY_API, { userId: userId }, {
                errorMessage: "구성원 생일을 불러오지 못했습니다."
            });
            state.birthdays = Array.isArray(data.items) ? data.items.map(normalizeBirthdayItem).filter(function (item) {
                return !!(item.name && item.birthDate);
            }) : [];
        } catch (error) {
            state.birthdays = await loadBirthdayEventsFromAuthStore();
        }
    }

    async function loadBirthdayEventsFromAuthStore() {
        try {
            if (!window.AuthStore || typeof window.AuthStore.getEmployees !== "function") return [];
            var employees = await window.AuthStore.getEmployees();
            return Array.isArray(employees) ? employees.map(normalizeBirthdayItem).filter(function (item) {
                return !!(item.name && item.birthDate);
            }) : [];
        } catch (error) {
            return [];
        }
    }

    function updateAddButtonState() {
        if (!elements.addButton) return;
        elements.addButton.style.display = canManageWideCalendar() ? "inline-flex" : "none";
    }

    function moveMonth(amount) {
        state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + amount, 1);
        renderCalendar();
    }

    function renderCalendar() {
        if (!elements.grid || !elements.monthLabel) return;
        var year = state.currentDate.getFullYear();
        var month = state.currentDate.getMonth();
        var firstDay = new Date(year, month, 1);
        var firstWeekDay = firstDay.getDay();
        var startDate = new Date(year, month, 1 - firstWeekDay);
        var daysInMonth = new Date(year, month + 1, 0).getDate();
        var totalWeeks = Math.ceil((firstWeekDay + daysInMonth) / 7);
        var totalCells = totalWeeks * 7;
        var todayKey = formatDateKey(new Date());
        var activeMonthKey = year + "-" + pad(month + 1);
        var cells = [];

        elements.monthLabel.textContent = year + "년 " + pad(month + 1) + "월";

        for (var i = 0; i < totalCells; i += 1) {
            var cellDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
            var dateKey = formatDateKey(cellDate);
            var isCurrentMonth = dateKey.slice(0, 7) === activeMonthKey;
            var isSunday = cellDate.getDay() === 0;
            var dayEvents = getEventsByDate(dateKey);

            cells.push(buildDateCell({
                dateKey: dateKey,
                dayLabel: pad(cellDate.getDate()),
                isCurrentMonth: isCurrentMonth,
                isToday: dateKey === todayKey,
                isSunday: isSunday,
                isSelected: dateKey === state.selectedDate,
                events: dayEvents
            }));
        }

        elements.grid.innerHTML = cells.join("");
        bindGridEvents();
    }

    function buildDateCell(options) {
        var classNames = ["calendarCell"];
        var eventHtml = "";

        if (!options.isCurrentMonth) classNames.push("is-outside");
        if (options.isToday) classNames.push("is-today");
        if (options.isSunday) classNames.push("is-sunday");
        if (options.isSelected) classNames.push("is-selected");

        options.events.slice(0, 3).forEach(function (item) {
            eventHtml += renderCalendarEvent(item, options.dateKey);
        });

        if (options.events.length > 3) {
            eventHtml += '<div class="calendarEventMore">+' + (options.events.length - 3) + ' more</div>';
        }

        return [
            '<div class="' + classNames.join(" ") + '" data-date="' + options.dateKey + '">',
            '<div class="calendarCellInner">',
            '<div class="calendarDateRow"><span class="calendarDateNum">' + options.dayLabel + '</span></div>',
            '<div class="calendarEvents">' + eventHtml + '</div>',
            '</div>',
            '</div>'
        ].join("");
    }

    function renderCalendarEvent(item, dateKey) {
        var color = sanitizeColor(item && item.labelColor);
        var kind = getCalendarEventKind(item);
        var palette = getCalendarEventPalette(color, kind, item);
        var itemClass = "calendarEventItem calendarEventItem--card calendarEventItem--" + kind;
        if (isWideCalendarEvent(item)) itemClass += " calendarEventItem--wide";
        var innerHtml = "";

        if (kind === "birthday") {
            innerHtml = '<span class="calendarEventCardBox"><strong class="calendarEventTitle">' + escapeHtml(item && item.title) + '</strong></span>';
        } else if (kind === "vacation") {
            innerHtml = ''
                + '<span class="calendarEventCardBox">'
                + '<strong class="calendarEventTitle calendarEventVacationText">' + escapeHtml(getVacationDisplayTitle(item)) + '</strong>'
                + '<span class="calendarEventVacationName">' + escapeHtml(getVacationDisplayName(item)) + '</span>'
                + '</span>';
        } else if (item && item.allDay) {
            innerHtml = '<span class="calendarEventCardBox"><strong class="calendarEventTitle">' + escapeHtml(item && item.title) + '</strong></span>';
        } else {
            innerHtml = ''
                + '<span class="calendarEventCardBox">'
                + '<strong class="calendarEventTitle">' + escapeHtml(item && item.title) + '</strong>'
                + '<span class="calendarEventTimeRange">' + escapeHtml(formatEventTimeRange(item)) + '</span>'
                + '</span>';
        }

        return '<button type="button" class="' + itemClass + '" data-id="' + escapeHtml(item && item.id) + '" data-date="' + escapeHtml(dateKey) + '" style="--event-accent:' + escapeHtml(palette.accent) + ';--event-bg:' + escapeHtml(palette.background) + ';">' + innerHtml + '</button>';
    }

    function getCalendarEventKind(item) {
        if (item && item.isBirthday) return "birthday";
        if (isVacationCalendarEvent(item)) return "vacation";
        return item && item.allDay ? "allday" : "timed";
    }

    function isVacationCalendarEvent(item) {
        return /^approval_vacation_/i.test(String(item && item.id || "").trim());
    }

    function getCalendarEventPalette(color, kind, item) {
        if (kind === "birthday") return { accent: BIRTHDAY_LABEL_COLOR, background: BIRTHDAY_EVENT_BACKGROUND };
        if (kind === "vacation") return { accent: "#1b1b1b", background: "#f4f4f4" };
        if (isWideCalendarEvent(item)) return { accent: WIDE_LABEL_COLOR, background: WIDE_EVENT_BACKGROUND };
        return resolveCalendarLabelPalette(color);
    }

    function resolveCalendarLabelPalette(color) {
        var accent = normalizeCalendarLabelColor(color);
        return {
            accent: "#1b1b1b",
            background: CALENDAR_LABEL_PALETTE[accent] || CALENDAR_LABEL_PALETTE[DEFAULT_LABEL_COLOR]
        };
    }

    function normalizeCalendarLabelColor(color) {
        var value = sanitizeColor(color || DEFAULT_LABEL_COLOR).toLowerCase();
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

    function getVacationDisplayTitle(item) {
        var title = String(item && item.title || "").trim();
        var authorName = getVacationDisplayName(item);
        if (authorName && title.indexOf(authorName) === 0) {
            title = String(title.slice(authorName.length) || "").trim();
        }
        return title || String(item && item.title || "").trim();
    }

    function getVacationDisplayName(item) {
        return String(item && item.createdByName || item && item.requesterName || "").trim();
    }

    function formatEventTimeRange(item) {
        var startTime = normalizeClockTime(item && item.startTime);
        var endTime = normalizeClockTime(item && item.endTime);
        return formatDisplayTimeRange(startTime, endTime);
    }

    function formatDisplayTimeRange(startTime, endTime) {
        var start = parseDisplayTimeParts(startTime);
        var end = parseDisplayTimeParts(endTime);
        if (!start && !end) return "";
        if (start && end) {
            if (start.raw === end.raw) return formatDisplayTimeParts(start, true);
            return formatDisplayTimeParts(start, true) + " ~ " + formatDisplayTimeParts(end, start.period !== end.period);
        }
        return formatDisplayTimeParts(start || end, true);
    }

    function parseDisplayTimeParts(value) {
        var text = normalizeClockTime(value);
        if (!text) return null;
        var parts = text.split(":");
        var hour = Number(parts[0] || 0);
        var minute = parts[1] || "00";
        var period = hour < 12 ? "오전" : "오후";
        var displayHour = hour % 12 || 12;
        return { raw: text, period: period, displayHour: pad(displayHour), minute: minute };
    }

    function formatDisplayTimeParts(parts, includePeriod) {
        return (includePeriod ? parts.period + " " : "") + parts.displayHour + ":" + parts.minute;
    }

    function normalizeClockTime(value) {
        var text = String(value || "").trim();
        var match = text.match(/^([0-9]{1,2}):([0-9]{2})/);
        if (!match) return "";
        return pad(match[1]) + ":" + match[2];
    }

    function hexToRgba(hex, alpha) {
        var value = String(hex || "").replace("#", "").trim();
        if (value.length === 3) value = value.replace(/(.)/g, "$1$1");
        if (!/^[0-9a-fA-F]{6}$/.test(value)) return "rgba(217,108,166," + alpha + ")";
        var red = parseInt(value.slice(0, 2), 16);
        var green = parseInt(value.slice(2, 4), 16);
        var blue = parseInt(value.slice(4, 6), 16);
        return "rgba(" + red + "," + green + "," + blue + "," + alpha + ")";
    }

    function bindGridEvents() {
        Array.prototype.slice.call(elements.grid.querySelectorAll(".calendarCell")).forEach(function (cell) {
            cell.addEventListener("click", function () {
                state.selectedDate = cell.getAttribute("data-date") || state.selectedDate;
                renderCalendar();
                if (canManageWideCalendar()) openEventModal(null, state.selectedDate);
            });
        });
        Array.prototype.slice.call(elements.grid.querySelectorAll(".calendarEventItem")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                openEventModal(getEventById(button.getAttribute("data-id")), button.getAttribute("data-date"));
            });
        });
    }

    function openEventModal(item, fallbackDate) {
        if (!elements.modal) return;
        var date = fallbackDate || state.selectedDate || formatDateKey(new Date());
        var editing = !!(item && item.id);
        var editable = canManageWideCalendar() && (!editing || canEditEvent(item));
        if (elements.saveButton) elements.saveButton.textContent = editing ? "일정 수정" : "일정 만들기";
        if (elements.eventId) elements.eventId.value = editing ? item.id : "";
        if (elements.titleInput) elements.titleInput.value = editing ? item.title || "" : "";
        setDateSelectValue(elements.startYearSelect, elements.startMonthSelect, elements.startDaySelect, elements.startInput, editing ? item.startDate || date : date);
        setDateSelectValue(elements.endYearSelect, elements.endMonthSelect, elements.endDaySelect, elements.endInput, editing ? item.endDate || item.startDate || date : date);
        setTimeSelectValue(elements.startTimeSelect, elements.startTimeInput, editing && !item.allDay ? item.startTime || DEFAULT_START_TIME : DEFAULT_START_TIME);
        setTimeSelectValue(elements.endTimeSelect, elements.endTimeInput, editing && !item.allDay ? item.endTime || DEFAULT_END_TIME : DEFAULT_END_TIME);
        if (elements.allDayInput) elements.allDayInput.checked = editing ? item.allDay === true : false;
        if (elements.locationInput) elements.locationInput.value = editing ? item.location || "" : "";
        if (elements.memoInput) elements.memoInput.value = editing ? item.memo || "" : "";
        if (elements.alertInput) elements.alertInput.value = editing ? item.alert || "none" : "none";
        setLabelColorValue(editing ? item.labelColor || WIDE_LABEL_COLOR : WIDE_LABEL_COLOR);
        state.modalReadonly = !editable;
        setModalEditable(editable, editing);
        if (!editable && editing) {
            if (elements.modal) elements.modal.classList.add("is-readonly-view");
            renderReadonlyDetail(item);
        } else {
            if (elements.modal) elements.modal.classList.remove("is-readonly-view");
            toggleReadonlyDetail(false);
        }
        syncAllDayFields();

        elements.modal.classList.remove("is-closing");
        elements.modal.style.display = "block";
        document.documentElement.classList.add("calendarModalOpen");
        document.body.classList.add("calendarModalOpen");
        if (elements.titleInput && shouldFocusModalInput()) elements.titleInput.focus();
    }

    function closeEventModal() {
        if (!elements.modal) return;
        if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
            elements.modal.classList.add("is-closing");
            window.setTimeout(function () {
                elements.modal.style.display = "none";
                elements.modal.classList.remove("is-closing", "is-readonly-view");
                document.documentElement.classList.remove("calendarModalOpen");
                document.body.classList.remove("calendarModalOpen");
            }, 350);
            return;
        }
        elements.modal.style.display = "none";
        elements.modal.classList.remove("is-readonly-view");
        document.documentElement.classList.remove("calendarModalOpen");
        document.body.classList.remove("calendarModalOpen");
    }

    function syncAllDayFields() {
        var checked = !!(elements.allDayInput && elements.allDayInput.checked);
        [elements.startTimeInput, elements.endTimeInput].forEach(function (input) {
            if (!input) return;
            input.readOnly = checked || state.modalReadonly;
            input.disabled = checked || state.modalReadonly;
            input.classList.toggle("is-readonly", checked);
            if (checked) input.value = "";
            else if (!input.value) input.value = input === elements.startTimeInput ? DEFAULT_START_TIME : DEFAULT_END_TIME;
        });
        [elements.startTimeSelect, elements.endTimeSelect].forEach(function (select) {
            if (!select) return;
            select.disabled = checked || state.modalReadonly;
            select.classList.toggle("is-readonly", checked || state.modalReadonly);
            if (checked) select.value = "";
        });
        if (!checked && !state.modalReadonly) {
            if (elements.startTimeSelect && !elements.startTimeSelect.value) setTimeSelectValue(elements.startTimeSelect, elements.startTimeInput, DEFAULT_START_TIME);
            if (elements.endTimeSelect && !elements.endTimeSelect.value) setTimeSelectValue(elements.endTimeSelect, elements.endTimeInput, DEFAULT_END_TIME);
        }
    }

    async function saveEvent() {
        if (!canManageWideCalendar() || state.modalReadonly) {
            alert("전사 일정은 관리자 또는 대표만 수정할 수 있습니다.");
            return;
        }
        var id = elements.eventId ? String(elements.eventId.value || "").trim() : "";
        var title = elements.titleInput ? String(elements.titleInput.value || "").trim() : "";
        var startDate = elements.startInput ? String(elements.startInput.value || "").trim() : "";
        var endDate = elements.endInput ? String(elements.endInput.value || "").trim() : "";
        var allDay = !!(elements.allDayInput && elements.allDayInput.checked);
        var startTime = allDay ? "" : (elements.startTimeInput ? String(elements.startTimeInput.value || "").trim() : "");
        var endTime = allDay ? "" : (elements.endTimeInput ? String(elements.endTimeInput.value || "").trim() : "");
        var location = elements.locationInput ? String(elements.locationInput.value || "").trim() : "";
        var memo = elements.memoInput ? String(elements.memoInput.value || "").trim() : "";
        var labelColor = getLabelColorValue();
        var alertValue = elements.alertInput ? String(elements.alertInput.value || "none").trim() : "none";
        var previousItem = id ? getEventById(id) : null;

        if (!title) {
            alert("일정 제목을 입력해주세요.");
            if (elements.titleInput) elements.titleInput.focus();
            return;
        }
        if (!startDate) {
            alert("시작일을 선택해주세요.");
            return;
        }
        if (!endDate) endDate = startDate;
        if (endDate < startDate) {
            alert("종료일은 시작일보다 빠를 수 없습니다.");
            return;
        }
        if (!allDay && (!startTime || !endTime)) {
            alert("시간을 입력하거나 종일을 선택해주세요.");
            return;
        }
        if (!allDay && startDate === endDate && endTime < startTime) {
            alert("종료 시간은 시작 시간보다 빠를 수 없습니다.");
            return;
        }

        var payload = normalizeEvent({
            id: id || "calendar_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
            title: title,
            startDate: startDate,
            endDate: endDate,
            allDay: allDay,
            startTime: startTime,
            endTime: endTime,
            location: location,
            memo: memo,
            labelColor: labelColor,
            alert: alertValue,
            visibility: "shared",
            requesterId: getUserId(),
            requesterName: getUserName(),
            createdById: previousItem && previousItem.createdById || getUserId(),
            createdByName: previousItem && previousItem.createdByName || getUserName(),
            createdAt: previousItem && previousItem.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            calendarScope: CALENDAR_SCOPE
        });

        state.selectedDate = startDate;
        state.currentDate = parseDateKey(startDate);

        try {
            await saveSharedEvent(payload);
            await loadEvents();
            closeEventModal();
            renderCalendar();
        } catch (error) {
            alert(error.message || "전사 일정을 저장하지 못했습니다.");
        }
    }

    async function deleteEvent() {
        if (!canManageWideCalendar() || state.modalReadonly) {
            alert("전사 일정은 관리자 또는 대표만 삭제할 수 있습니다.");
            return;
        }
        var id = elements.eventId ? String(elements.eventId.value || "").trim() : "";
        if (!id) return;
        if (!confirm("일정을 삭제할까요?")) return;
        try {
            await deleteSharedEvent(id);
            await loadEvents();
            closeEventModal();
            renderCalendar();
        } catch (error) {
            alert(error.message || "전사 일정을 삭제하지 못했습니다.");
        }
    }

    async function saveSharedEvent(payload) {
        await API.post(SHARED_API_BASE + "/save", payload, {
            errorMessage: "전사 일정을 저장하지 못했습니다."
        });
    }

    async function deleteSharedEvent(id) {
        await API.post(SHARED_API_BASE + "/delete", {
            id: id,
            requesterId: getUserId(),
            requesterName: getUserName()
        }, {
            errorMessage: "전사 일정을 삭제하지 못했습니다."
        });
    }

    function getEventsByDate(dateKey) {
        return state.events.concat(buildBirthdayEventsForYear(Number(String(dateKey || "").slice(0, 4)))).filter(function (item) {
            return item.startDate <= dateKey && (item.endDate || item.startDate) >= dateKey;
        }).sort(function (a, b) {
            if (a.isBirthday !== b.isBirthday) return a.isBirthday ? -1 : 1;
            return String(a.startDate || "").localeCompare(String(b.startDate || "")) || String(a.startTime || "").localeCompare(String(b.startTime || "")) || String(a.title || "").localeCompare(String(b.title || ""), "ko");
        });
    }

    function getEventById(id) {
        var event = state.events.find(function (item) { return item.id === id; }) || null;
        if (event) return event;
        return getBirthdayEventById(id);
    }

    function setLabelColorValue(value) {
        var normalizedValue = normalizeCalendarLabelColor(value);
        elements.labelInputs.forEach(function (input) {
            input.checked = String(input.value || "").trim().toLowerCase() === normalizedValue;
        });
    }

    function getLabelColorValue() {
        var checkedValue = DEFAULT_LABEL_COLOR;
        elements.labelInputs.forEach(function (input) {
            if (input.checked) checkedValue = String(input.value || "").trim().toLowerCase();
        });
        return checkedValue;
    }

    function setModalEditable(editable, editing) {
        var showForm = editable || !editing;
        var textInputs = [elements.titleInput, elements.startInput, elements.endInput, elements.startTimeInput, elements.endTimeInput, elements.locationInput, elements.memoInput, elements.alertInput, elements.startYearSelect, elements.startMonthSelect, elements.startDaySelect, elements.endYearSelect, elements.endMonthSelect, elements.endDaySelect, elements.startTimeSelect, elements.endTimeSelect];
        textInputs.forEach(function (input) {
            if (!input) return;
            input.disabled = !showForm;
            input.readOnly = !showForm && input.tagName !== "SELECT" && input.type !== "checkbox";
            input.classList.toggle("is-readonly", !showForm);
        });
        if (elements.allDayInput) {
            elements.allDayInput.disabled = !showForm;
        }
        elements.labelInputs.forEach(function (input) {
            input.disabled = !showForm;
        });
        if (elements.saveButton) {
            elements.saveButton.style.display = editable ? "inline-flex" : "none";
        }
        if (elements.deleteButton) {
            elements.deleteButton.style.display = editable && editing ? "inline-flex" : "none";
        }
    }

    function ensureReadonlyAuthorBadge() {
        if (!elements.modalHead || elements.readonlyAuthor) return;
        var badge = document.createElement("span");
        badge.className = "calendarReadonlyAuthor";
        elements.modalHead.insertBefore(badge, elements.modalHead.firstChild);
        elements.readonlyAuthor = badge;
    }

    function ensureReadonlyDetail() {
        if (!elements.modalBody || elements.readonlyDetail) return;
        var container = document.createElement("div");
        container.className = "calendarReadonlyDetail";
        container.innerHTML = [
            '<div class="calendarReadonlyHero">',
            '<div class="calendarReadonlyHeroText">',
            '<h4 class="calendarReadonlyTitle"></h4>',
            '<div class="calendarReadonlyDateLine"><p class="calendarReadonlyDate"></p><p class="calendarReadonlyTime"></p></div>',
            '</div>',
            '</div>',
            '<div class="calendarReadonlyBody"></div>',
            '<div class="calendarReadonlyMeta"></div>'
        ].join("");
        elements.modalBody.appendChild(container);
        elements.readonlyDetail = container;
        elements.readonlyTitle = container.querySelector(".calendarReadonlyTitle");
        elements.readonlyDateText = container.querySelector(".calendarReadonlyDate");
        elements.readonlyTimeText = container.querySelector(".calendarReadonlyTime");
        elements.readonlyBody = container.querySelector(".calendarReadonlyBody");
        elements.readonlyMeta = container.querySelector(".calendarReadonlyMeta");
    }

    function toggleReadonlyDetail(show) {
        if (!elements.readonlyDetail) return;
        elements.readonlyDetail.style.display = show ? "block" : "none";
        if (elements.readonlyAuthor) elements.readonlyAuthor.style.display = show ? "inline-flex" : "none";
    }

    function renderReadonlyDetail(item) {
        ensureReadonlyDetail();
        if (!elements.readonlyDetail || !item) return;
        toggleReadonlyDetail(true);
        if (elements.readonlyAuthor) {
            elements.readonlyAuthor.classList.toggle("is-vacation", isVacationCalendarEvent(item));
            elements.readonlyAuthor.textContent = getReadonlyAuthorLabel(item);
            elements.readonlyAuthor.style.background = getReadonlyAuthorColor(item);
        }
        if (elements.readonlyTitle) elements.readonlyTitle.textContent = item.isBirthday ? formatBirthdayReadonlyTitle(item.title) : item.title || "";
        if (elements.readonlyDateText) elements.readonlyDateText.textContent = formatReadonlyDateLine(item);
        if (elements.readonlyTimeText) {
            var timeText = formatReadonlyTimeLine(item);
            elements.readonlyTimeText.textContent = timeText;
            elements.readonlyTimeText.style.display = timeText ? "" : "none";
        }
        var sections = buildReadonlySections(item);
        if (elements.readonlyDetail) elements.readonlyDetail.classList.toggle("is-body-empty", sections.length === 0);
        if (elements.readonlyBody) elements.readonlyBody.innerHTML = sections.join("");
        if (elements.readonlyMeta) elements.readonlyMeta.innerHTML = buildReadonlyMeta(item).join("");
    }

    function getReadonlyAuthorLabel(item) {
        if (item && item.isBirthday) return "생일";
        if (isWideCalendarEvent(item)) return "전사 일정";
        return String(item && (item.createdByName || item.createdById) || "작성자").trim();
    }

    function getReadonlyAuthorColor(item) {
        if (item && item.isBirthday) return BIRTHDAY_LABEL_COLOR;
        if (isWideCalendarEvent(item)) return WIDE_LABEL_COLOR;
        return normalizeCalendarLabelColor(item && item.labelColor);
    }

    function buildReadonlySections(item) {
        var sections = [];
        if (item.location) sections.push(buildReadonlySection(iconLocation(), escapeHtml(item.location)));
        if (item.memo) {
            var memoText = isVacationCalendarEvent(item) ? formatVacationMemoLine(item) : item.memo;
            sections.push(buildReadonlySection(iconMemo(), escapeHtml(memoText).replace(/\n/g, "<br>")));
        }
        return sections;
    }

    function buildReadonlyMeta(item) {
        if (item && item.isBirthday) {
            return [
                buildReadonlySection(iconCalendar(), "전사 공개")
            ];
        }
        return [
            buildReadonlySection(iconBell(), escapeHtml(formatAlertText(item.alert || "none"))),
            buildReadonlySection(iconCalendar(), "전사 공개")
        ];
    }

    function buildReadonlySection(icon, content) {
        return '<div class="calendarReadonlySection">' + icon + '<p>' + content + '</p></div>';
    }

    function shouldFocusModalInput() {
        return !(window.matchMedia && window.matchMedia("(max-width: 720px)").matches);
    }

    function formatReadonlyDateLine(item) {
        var start = formatDisplayDate(item.startDate);
        var end = formatDisplayDate(item.endDate || item.startDate);
        return start === end ? start : start + " ~ " + end;
    }

    function formatReadonlyTimeLine(item) {
        if (!item || item.allDay) return "";
        return formatDisplayTimeRange(item.startTime, item.endTime);
    }

    function formatBirthdayReadonlyTitle(value) {
        var title = String(value || "").trim();
        if (!title) return "";
        if (/님\s*생일$/.test(title)) return title;
        if (/생일$/.test(title)) return title.replace(/\s*생일$/, "님 생일");
        return title;
    }

    function formatVacationMemoLine(item) {
        var memo = String(item && item.memo || "").trim();
        var type = "";
        var days = "";
        memo.split(/\r?\n/).forEach(function (line) {
            var cleanLine = String(line || "").trim();
            var typeMatch = cleanLine.match(/^휴가\s*유형\s*:\s*(.+)$/);
            var daysMatch = cleanLine.match(/^사용\s*일수\s*:\s*(.+)$/);
            if (typeMatch) type = typeMatch[1].trim();
            if (daysMatch) days = daysMatch[1].trim();
        });
        if (!type) type = getVacationDisplayTitle(item);
        type = String(type || "").replace(/\s+/g, "");
        days = String(days || "").replace(/[()]/g, "").replace(/\s+/g, "");
        if (days && days.indexOf("일") === -1) days += "일";
        if (type && days) return type + "(" + days + ")";
        return memo.replace(/\s*[\r\n]+\s*/g, " ");
    }

    function formatAlertText(value) {
        var key = String(value || "none").trim();
        if (key === "at-time") return "정시 알림";
        if (key === "10-min") return "10분 전";
        if (key === "30-min") return "30분 전";
        if (key === "1-hour") return "1시간 전";
        if (key === "1-day") return "1일 전";
        return "알림 안 함";
    }

    function canEditEvent(item) {
        if (!item || !item.id) return true;
        if (item.isBirthday) return false;
        if (canManageWideCalendar()) return true;
        return String(item.createdById || "").trim().toLowerCase() === getUserId();
    }

    function getCurrentUser() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            return window.AuthStore.getCurrentUser();
        }
        return {
            id: String(localStorage.getItem("userId") || "guest").trim().toLowerCase(),
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "").trim().toLowerCase()
        };
    }

    function getUserId() {
        return String(state.user && state.user.id || "guest").trim().toLowerCase();
    }

    function getUserName() {
        return String(state.user && state.user.name || "").trim();
    }

    function canManageWideCalendar() {
        if (window.AuthStore && typeof window.AuthStore.canManageCompanyWideCalendar === "function") {
            return !!window.AuthStore.canManageCompanyWideCalendar();
        }
        var role = String(state.user && state.user.role || "").trim().toLowerCase();
        return role === "admin" || role === "ceo";
    }

    function normalizeEvent(item) {
        return {
            id: String(item && item.id || "").trim(),
            title: String(item && item.title || "").trim(),
            startDate: String(item && item.startDate || "").trim(),
            endDate: String(item && (item.endDate || item.startDate) || "").trim(),
            allDay: item && item.allDay === true,
            startTime: String(item && item.startTime || "").trim(),
            endTime: String(item && item.endTime || "").trim(),
            location: String(item && item.location || "").trim(),
            memo: String(item && item.memo || "").trim(),
            labelColor: normalizeCalendarLabelColor(item && item.labelColor),
            alert: String(item && item.alert || "none").trim(),
            visibility: String(item && item.visibility || "shared").trim().toLowerCase(),
            createdById: String(item && (item.createdById || item.requesterId) || "").trim().toLowerCase(),
            createdByName: String(item && (item.createdByName || item.requesterName) || "").trim(),
            createdAt: String(item && item.createdAt || "").trim(),
            updatedAt: String(item && item.updatedAt || "").trim(),
            calendarScope: normalizeCalendarScope(item && (item.calendarScope || item.scope) || "")
        };
    }

    function isWideCalendarEvent(item) {
        return isWideCalendarScope(item && (item.calendarScope || item.scope || item.visibility));
    }

    function isWideCalendarScope(value) {
        var scope = normalizeCalendarScope(value);
        return scope === CALENDAR_SCOPE || scope === "company" || scope === "company-wide" || scope === "global" || scope === "all";
    }

    function normalizeCalendarScope(value) {
        return String(value || "").trim().toLowerCase().replace(/_/g, "-");
    }

    function normalizeBirthdayItem(item) {
        return {
            id: String(item && item.id || "").trim().toLowerCase(),
            name: String(item && item.name || "").trim(),
            birthDate: normalizeBirthdayDate(item && item.birthDate || ""),
            department: String(item && item.department || "").trim()
        };
    }

    function buildBirthdayEventsForYear(year) {
        if (!Number.isFinite(year)) return [];
        return state.birthdays.map(function (item, index) {
            var dateKey = buildBirthdayDateKey(item.birthDate, year);
            if (!dateKey) return null;
            var title = item.name + "님 생일";
            return normalizeEvent({
                id: "birthday_" + (item.id || index) + "_" + year,
                title: title,
                startDate: dateKey,
                endDate: dateKey,
                allDay: true,
                labelColor: BIRTHDAY_LABEL_COLOR,
                alert: "none",
                visibility: "shared",
                createdById: "system",
                createdByName: "생일",
                memo: item.department ? item.department : "",
                calendarScope: CALENDAR_SCOPE
            });
        }).filter(Boolean).map(function (event) {
            event.isBirthday = true;
            return event;
        });
    }

    function getBirthdayEventById(id) {
        var year = Number(String(id || "").split("_").pop());
        var years = Number.isFinite(year) ? [year] : [state.currentDate.getFullYear() - 1, state.currentDate.getFullYear(), state.currentDate.getFullYear() + 1];
        for (var i = 0; i < years.length; i += 1) {
            var event = buildBirthdayEventsForYear(years[i]).find(function (item) {
                return item.id === id;
            });
            if (event) return event;
        }
        return null;
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

    function initializeDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput) {
        if (!yearSelect || !monthSelect || !daySelect || !hiddenInput) return;
        fillYearOptions(yearSelect);
        fillMonthOptions(monthSelect);
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput.value);
        [yearSelect, monthSelect, daySelect].forEach(function (select) {
            select.addEventListener("change", function () {
                if (select === yearSelect || select === monthSelect) refreshDayOptions(daySelect, yearSelect.value, monthSelect.value);
                syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
            });
        });
        bindDatePickerGroup(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function initializeTimeSelect(select, hiddenInput) {
        if (!select || !hiddenInput || select.getAttribute("data-time-ready") === "true") return;
        var options = ['<option value="">시간</option>'];
        for (var hour = 0; hour < 24; hour += 1) {
            for (var minute = 0; minute < 60; minute += 30) {
                var value = pad(hour) + ":" + pad(minute);
                options.push('<option value="' + value + '">' + formatTimeSelectLabel(value) + '</option>');
            }
        }
        select.innerHTML = options.join("");
        select.setAttribute("data-time-ready", "true");
        select.addEventListener("change", function () {
            hiddenInput.value = String(select.value || "").trim();
            syncSelectDisplay(select);
        });
        syncSelectDisplay(select);
        bindTimePicker(select, hiddenInput);
    }

    function fillYearOptions(select) {
        if (!select || select.getAttribute("data-year-ready") === "true") return;
        var currentYear = new Date().getFullYear() + 3;
        var options = ['<option value="">연도</option>'];
        for (var year = currentYear; year >= 2020; year -= 1) {
            options.push('<option value="' + year + '">' + year + '</option>');
        }
        select.innerHTML = options.join("");
        select.setAttribute("data-year-ready", "true");
    }

    function fillMonthOptions(select) {
        if (!select || select.getAttribute("data-month-ready") === "true") return;
        var options = ['<option value="">월</option>'];
        for (var month = 1; month <= 12; month += 1) {
            options.push('<option value="' + pad(month) + '">' + month + '월</option>');
        }
        select.innerHTML = options.join("");
        select.setAttribute("data-month-ready", "true");
    }

    function refreshDayOptions(select, yearValue, monthValue) {
        if (!select) return;
        var selectedDay = String(select.value || "").trim();
        var daysInMonth = new Date(Number(yearValue || 2000), Number(monthValue || 1), 0).getDate();
        var options = ['<option value="">일</option>'];
        for (var day = 1; day <= daysInMonth; day += 1) {
            options.push('<option value="' + pad(day) + '">' + day + '일</option>');
        }
        select.innerHTML = options.join("");
        if (selectedDay && Number(selectedDay) <= daysInMonth) select.value = selectedDay;
    }

    function syncDateSelectGroup(yearSelect, monthSelect, daySelect, value) {
        var normalizedValue = normalizeDateSelectValue(value);
        var parts = normalizedValue.split("-");
        var year = parts[0] || "";
        var month = parts[1] || "";
        var day = parts[2] || "";
        if (yearSelect) yearSelect.value = year;
        if (monthSelect) monthSelect.value = month;
        refreshDayOptions(daySelect, year, month);
        if (daySelect) daySelect.value = day;
    }

    function syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput) {
        if (!hiddenInput) return;
        var year = String(yearSelect && yearSelect.value || "").trim();
        var month = String(monthSelect && monthSelect.value || "").trim();
        var day = String(daySelect && daySelect.value || "").trim();
        hiddenInput.value = year && month && day ? year + "-" + month + "-" + day : "";
        syncSelectDisplay(yearSelect);
        syncSelectDisplay(monthSelect);
        syncSelectDisplay(daySelect);
        syncDateGroupDisplay(yearSelect, monthSelect, daySelect);
    }

    function setDateSelectValue(yearSelect, monthSelect, daySelect, hiddenInput, value) {
        var normalizedValue = normalizeDateSelectValue(value);
        if (hiddenInput) hiddenInput.value = normalizedValue;
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, normalizedValue);
        syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function setTimeSelectValue(select, hiddenInput, value) {
        var normalized = String(value || "").trim();
        if (hiddenInput) hiddenInput.value = normalized;
        if (select) select.value = normalized;
        syncSelectDisplay(select);
    }

    function syncSelectDisplay(select) {
        if (!select) return;
        var box = select.parentNode;
        var textNode = box ? box.querySelector(".calendarSelectText") : null;
        if (!textNode) return;
        var option = select.options && select.selectedIndex > -1 ? select.options[select.selectedIndex] : null;
        textNode.textContent = option ? option.text : "";
    }

    function getInlinePickerSlot(owner) {
        if (!owner || !owner.classList || !owner.classList.contains("calendarScheduleLine")) return null;
        var slot = null;
        Array.prototype.slice.call(owner.children).some(function (child) {
            if (child.classList && child.classList.contains("calendarInlinePickerSlot")) {
                slot = child;
                return true;
            }
            return false;
        });
        if (!slot) {
            slot = document.createElement("div");
            slot.className = "calendarInlinePickerSlot";
            owner.appendChild(slot);
        }
        slot.classList.remove("is-closing");
        slot.removeAttribute("data-closing");
        return slot;
    }

    function animatePickerOpen(picker) {
        if (!picker) return;
        window.requestAnimationFrame(function () {
            picker.classList.add("is-visible");
        });
    }

    function removePickerWithAnimation(picker) {
        if (!picker || picker.getAttribute("data-closing") === "true") return;
        var slot = picker.parentNode && picker.parentNode.classList && picker.parentNode.classList.contains("calendarInlinePickerSlot") ? picker.parentNode : null;
        var line = picker.closest ? picker.closest(".calendarScheduleLine") : null;
        if (!slot) {
            if (line && picker.classList.contains("calendarDatePicker--inline")) line.classList.remove("is-inline-date-picker-open");
            if (line && picker.classList.contains("calendarTimePicker--inline")) line.classList.remove("is-inline-time-picker-open");
            if (picker.parentNode) picker.parentNode.removeChild(picker);
            return;
        }
        if (slot.getAttribute("data-closing") === "true") return;
        picker.setAttribute("data-closing", "true");
        slot.setAttribute("data-closing", "true");
        slot.classList.remove("is-visible");
        slot.classList.add("is-closing");
        window.setTimeout(function () {
            if (line && picker.classList.contains("calendarDatePicker--inline")) line.classList.remove("is-inline-date-picker-open");
            if (line && picker.classList.contains("calendarTimePicker--inline")) line.classList.remove("is-inline-time-picker-open");
            if (slot.parentNode) slot.parentNode.removeChild(slot);
        }, 420);
    }

    function bindTimePicker(select, hiddenInput) {
        var box = select && select.closest ? select.closest(".calendarSelectBox--time") : null;
        if (!box || box.getAttribute("data-time-picker-ready") === "true") return;
        box.setAttribute("data-time-picker-ready", "true");
        box.addEventListener("click", function (event) {
            if (event.target.closest && event.target.closest(".calendarTimePicker")) return;
            event.preventDefault();
            event.stopPropagation();
            openTimePicker(box, select, hiddenInput);
        });
    }

    function openTimePicker(box, select, hiddenInput) {
        var isMobile = isMobilePicker();
        var owner = isMobile && box.closest ? (box.closest(".calendarScheduleLine") || box) : box;
        var opened = owner.querySelector(".calendarTimePicker");
        if (opened) {
            closeTimePickers();
            return;
        }
        closeTimePickers(owner);
        closeDatePickers();
        box.classList.add("is-time-picker-open");
        if (isMobile && owner.classList) owner.classList.add("is-inline-time-picker-open");
        var list = document.createElement("div");
        var selectedValue = String(select.value || "").trim();
        list.className = isMobile ? "calendarTimePicker calendarTimePicker--mobile calendarTimePicker--inline" : "calendarTimePicker";
        if (isMobile) {
            list.innerHTML = renderMobileTimePicker(box, selectedValue);
        } else {
            list.innerHTML = Array.prototype.slice.call(select.options).filter(function (option) {
                return option.value;
            }).map(function (option) {
                var className = "calendarTimePickerOption" + (option.value === selectedValue ? " is-selected" : "");
                return '<button type="button" class="' + className + '" data-value="' + option.value + '">' + option.text + '</button>';
            }).join("");
        }
        var mountTarget = owner;
        if (isMobile) {
            mountTarget = getInlinePickerSlot(owner) || owner;
        }
        mountTarget.appendChild(list);
        animatePickerOpen(isMobile ? mountTarget : list);
        list.addEventListener("click", function (event) {
            event.stopPropagation();
            var button = event.target.closest ? event.target.closest(".calendarTimePickerOption, .calendarTimeWheelOption") : null;
            if (!button) return;
            var value = "";
            if (button.classList.contains("calendarTimeWheelOption")) {
                value = getMobileTimePickerValue(list, button);
                select.value = value;
                if (hiddenInput) hiddenInput.value = value;
                syncSelectDisplay(select);
                list.innerHTML = renderMobileTimePicker(box, value);
                Array.prototype.slice.call(list.querySelectorAll(".calendarTimeWheelColumn")).forEach(function (column) {
                    var selectedWheelButton = column.querySelector(".calendarTimeWheelOption.is-selected");
                    if (selectedWheelButton) column.scrollTop = Math.max(0, selectedWheelButton.offsetTop - 88);
                });
                return;
            }
            value = String(button.getAttribute("data-value") || "").trim();
            select.value = value;
            if (hiddenInput) hiddenInput.value = value;
            syncSelectDisplay(select);
            closeTimePickers();
        });
        var selectedButton = list.querySelector(".calendarTimePickerOption.is-selected");
        if (selectedButton) list.scrollTop = Math.max(0, selectedButton.offsetTop - 8);
        Array.prototype.slice.call(list.querySelectorAll(".calendarTimeWheelColumn")).forEach(function (column) {
            var selectedWheelButton = column.querySelector(".calendarTimeWheelOption.is-selected");
            if (selectedWheelButton) column.scrollTop = Math.max(0, selectedWheelButton.offsetTop - 88);
        });
        setTimeout(function () {
            document.addEventListener("click", closeTimePickersOnce);
        }, 0);
    }

    function isMobilePicker() {
        return window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    }

    function getDatePickerTimeLabel(group) {
        var line = group && group.closest ? group.closest(".calendarScheduleLine") : null;
        var timeText = line ? line.querySelector(".calendarSelectBox--time .calendarSelectText") : null;
        var value = timeText ? String(timeText.textContent || "").trim() : "";
        var match = value.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})$/);
        if (!match) return value === "시간" ? "" : value;
        var hour = Number(match[2]);
        if (match[1] === "오후" && hour < 12) hour += 12;
        if (match[1] === "오전" && hour === 12) hour = 0;
        return pad(hour) + ":" + match[3];
    }

    function getDateLabelFromTimeBox(box) {
        var line = box && box.closest ? box.closest(".calendarScheduleLine") : null;
        var summary = line ? line.querySelector(".calendarDateSummary") : null;
        return formatDatePickerTopLabel(parseDateLabel(summary ? summary.textContent : ""));
    }

    function parseDateLabel(label) {
        var match = String(label || "").match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
        if (!match) return new Date();
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    function formatDatePickerTopLabel(date) {
        if (!date || isNaN(date.getTime())) return "";
        var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        return date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일 (" + weekdays[date.getDay()] + ")";
    }

    function renderMobileTimePicker(box, selectedValue) {
        var value = normalizeClockTime(selectedValue) || "13:00";
        var parts = value.split(":");
        var selectedHour = Number(parts[0]);
        var selectedMinute = Number(parts[1] || "0");
        var hours = [];
        var minutes = [];
        for (var hour = 0; hour < 24; hour += 1) {
            hours.push('<button type="button" class="calendarTimeWheelOption' + (hour === selectedHour ? ' is-selected' : '') + '" data-type="hour" data-value="' + pad(hour) + '">' + pad(hour) + '</button>');
        }
        for (var minute = 0; minute < 60; minute += 5) {
            minutes.push('<button type="button" class="calendarTimeWheelOption' + (minute === selectedMinute ? ' is-selected' : '') + '" data-type="minute" data-value="' + pad(minute) + '">' + pad(minute) + '</button>');
        }
        return '<div class="calendarTimeWheel"><div class="calendarTimeWheelHighlight"></div><div class="calendarTimeWheelColumn" data-type="hour">' + hours.join("") + '</div><div class="calendarTimeWheelColumn" data-type="minute">' + minutes.join("") + '</div></div>';
    }

    function getMobileTimePickerValue(list, button) {
        var selectedHour = list.querySelector('.calendarTimeWheelColumn[data-type="hour"] .calendarTimeWheelOption.is-selected');
        var selectedMinute = list.querySelector('.calendarTimeWheelColumn[data-type="minute"] .calendarTimeWheelOption.is-selected');
        var type = button.getAttribute("data-type");
        var value = button.getAttribute("data-value");
        var hour = selectedHour ? selectedHour.getAttribute("data-value") : "13";
        var minute = selectedMinute ? selectedMinute.getAttribute("data-value") : "00";
        if (type === "hour") hour = value;
        if (type === "minute") minute = value;
        return hour + ":" + minute;
    }

    function closeTimePickersOnce() {
        closeTimePickers();
        document.removeEventListener("click", closeTimePickersOnce);
    }

    function closeTimePickers(exceptBox) {
        Array.prototype.slice.call(document.querySelectorAll(".calendarSelectBox--time.is-time-picker-open")).forEach(function (box) {
            var owner = isMobilePicker() && box.closest ? (box.closest(".calendarScheduleLine") || box) : box;
            if (exceptBox && (box === exceptBox || owner === exceptBox)) return;
            box.classList.remove("is-time-picker-open");
            Array.prototype.slice.call(owner.querySelectorAll(".calendarTimePicker")).forEach(function (picker) {
                removePickerWithAnimation(picker);
            });
        });
    }

    function syncDateGroupDisplay(yearSelect, monthSelect, daySelect) {
        var group = yearSelect && yearSelect.closest ? yearSelect.closest(".calendarDateSelectGroup") : null;
        if (!group) return;
        var summary = group.querySelector(".calendarDateSummary");
        if (!summary) {
            summary = document.createElement("span");
            summary.className = "calendarDateSummary";
            group.insertBefore(summary, group.firstChild);
        }
        var value = String(yearSelect && yearSelect.value || "").trim() + "-" + String(monthSelect && monthSelect.value || "").trim() + "-" + String(daySelect && daySelect.value || "").trim();
        summary.textContent = formatDateSelectLabel(value);
    }

    function bindDatePickerGroup(yearSelect, monthSelect, daySelect, hiddenInput) {
        var group = yearSelect && yearSelect.closest ? yearSelect.closest(".calendarDateSelectGroup") : null;
        if (!group || group.getAttribute("data-picker-ready") === "true") return;
        group.setAttribute("data-picker-ready", "true");
        group.addEventListener("click", function (event) {
            if (event.target.closest && event.target.closest(".calendarDatePicker")) return;
            event.preventDefault();
            event.stopPropagation();
            openDatePicker(group, yearSelect, monthSelect, daySelect, hiddenInput);
        });
    }

    function openDatePicker(group, yearSelect, monthSelect, daySelect, hiddenInput) {
        var isMobile = isMobilePicker();
        var owner = isMobile && group.closest ? (group.closest(".calendarScheduleLine") || group) : group;
        var opened = owner.querySelector(".calendarDatePicker");
        if (opened) {
            closeDatePickers();
            return;
        }
        closeDatePickers(owner);
        closeTimePickers();
        group.classList.add("is-picker-open");
        if (isMobile && owner.classList) owner.classList.add("is-inline-date-picker-open");
        var selected = parseDateKey(hiddenInput && hiddenInput.value || "") || new Date();
        var viewDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
        var panel = document.createElement("div");
        panel.className = isMobile ? "calendarDatePicker calendarDatePicker--inline" : "calendarDatePicker";
        panel.setAttribute("data-picker-time-label", getDatePickerTimeLabel(group));
        var mountTarget = owner;
        if (isMobile) {
            mountTarget = getInlinePickerSlot(owner) || owner;
        }
        mountTarget.appendChild(panel);
        renderDatePicker(panel, viewDate, selected);
        animatePickerOpen(isMobile ? mountTarget : panel);
        panel.addEventListener("click", function (event) {
            event.stopPropagation();
            var button = event.target.closest ? event.target.closest("button") : null;
            if (!button) return;
            var action = button.getAttribute("data-action");
            if (action === "prev-year") viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1);
            if (action === "prev-month") viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
            if (action === "next-month") viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
            if (action === "next-year") viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1);
            if (action === "today") {
                var today = new Date();
                setDateSelectValue(yearSelect, monthSelect, daySelect, hiddenInput, formatDateKey(today));
                closeDatePickers();
                return;
            }
            var dateKey = button.getAttribute("data-date");
            if (dateKey) {
                setDateSelectValue(yearSelect, monthSelect, daySelect, hiddenInput, dateKey);
                closeDatePickers();
                return;
            }
            renderDatePicker(panel, viewDate, selected);
        });
        setTimeout(function () {
            document.addEventListener("click", closeDatePickersOnce);
        }, 0);
    }

    function closeDatePickersOnce() {
        closeDatePickers();
        document.removeEventListener("click", closeDatePickersOnce);
    }

    function closeDatePickers(exceptGroup) {
        Array.prototype.slice.call(document.querySelectorAll(".calendarDateSelectGroup.is-picker-open")).forEach(function (group) {
            var owner = isMobilePicker() && group.closest ? (group.closest(".calendarScheduleLine") || group) : group;
            if (exceptGroup && (group === exceptGroup || owner === exceptGroup)) return;
            group.classList.remove("is-picker-open");
            Array.prototype.slice.call(owner.querySelectorAll(".calendarDatePicker")).forEach(function (picker) {
                removePickerWithAnimation(picker);
            });
        });
    }

    function renderDatePicker(panel, viewDate, selectedDate) {
        var year = viewDate.getFullYear();
        var month = viewDate.getMonth();
        var start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
        var selectedKey = formatDateKey(selectedDate);
        var days = [];
        for (var index = 0; index < 42; index += 1) {
            var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
            var dateKey = formatDateKey(date);
            var className = "calendarDatePickerDay";
            if (date.getDay() === 0) className += " is-sunday";
            if (date.getMonth() !== month) className += " is-outside";
            if (dateKey === selectedKey) className += " is-selected";
            days.push('<button type="button" class="' + className + '" data-date="' + dateKey + '">' + date.getDate() + '</button>');
        }
        panel.innerHTML = ''
            + '<div class="calendarDatePickerHead">'
            + '<button type="button" class="calendarDatePickerNav" data-action="prev-year" aria-label="이전 해">&laquo;</button>'
            + '<button type="button" class="calendarDatePickerNav" data-action="prev-month" aria-label="이전 달">&lsaquo;</button>'
            + '<strong class="calendarDatePickerTitle">' + year + "년 " + (month + 1) + '월</strong>'
            + '<button type="button" class="calendarDatePickerNav" data-action="next-month" aria-label="다음 달">&rsaquo;</button>'
            + '<button type="button" class="calendarDatePickerNav" data-action="next-year" aria-label="다음 해">&raquo;</button>'
            + '</div>'
            + '<div class="calendarDatePickerWeek"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>'
            + '<div class="calendarDatePickerGrid">' + days.join("") + '</div>'
            + '<div class="calendarDatePickerFoot"><button type="button" class="calendarDatePickerToday" data-action="today">오늘</button></div>';
    }

    function formatDateSelectLabel(value) {
        var normalized = normalizeDateSelectValue(value);
        var date = parseDateKey(normalized);
        if (!date || isNaN(date.getTime())) return "날짜";
        var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        return date.getFullYear() + ". " + (date.getMonth() + 1) + ". " + date.getDate() + ". (" + weekdays[date.getDay()] + ")";
    }

    function formatTimeSelectLabel(value) {
        var parts = parseDisplayTimeParts(value);
        return parts ? formatDisplayTimeParts(parts, true) : "시간";
    }

    function normalizeDateSelectValue(value) {
        var text = String(value || "").trim();
        if (!text) return "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
        var digits = text.replace(/[^0-9]/g, "");
        if (/^\d{8}$/.test(digits)) return digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
        return "";
    }

    function formatDisplayDate(value) {
        var parts = String(value || "").split("-");
        if (parts.length < 3) return "";
        var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        var weeks = ["일", "월", "화", "수", "목", "금", "토"];
        return Number(parts[0]) + "." + Number(parts[1]) + "." + Number(parts[2]) + "(" + weeks[date.getDay()] + ")";
    }

    function formatDisplayTime(value) {
        var parts = parseDisplayTimeParts(value);
        return parts ? formatDisplayTimeParts(parts, true) : "";
    }

    function formatEventTime(value) {
        var parts = parseDisplayTimeParts(value);
        return parts ? formatDisplayTimeParts(parts, true) : "";
    }

    function parseDateKey(value) {
        var parts = String(value || "").split("-");
        return new Date(Number(parts[0] || new Date().getFullYear()), Number(parts[1] || 1) - 1, Number(parts[2] || 1));
    }

    function formatDateKey(date) {
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function sanitizeColor(value) {
        var color = String(value || "").trim();
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : WIDE_LABEL_COLOR;
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    function escapeHtml(value) {
        return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }

    function iconLocation() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>';
    }

    function iconMemo() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M12 2v4"/><path d="M16 2v4"/><rect width="16" height="18" x="4" y="4" rx="2"/><path d="M8 10h6"/><path d="M8 14h8"/><path d="M8 18h5"/></svg>';
    }

    function iconBell() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>';
    }

    function iconCalendar() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';
    }
})();
