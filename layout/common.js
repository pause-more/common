(function () {
    var HOME_SIDEBAR_COLLAPSED_KEY = "homeSidebarCollapsed";

    function getGroupwareApiBase(path) {
        if (window.GroupwareConfig && typeof window.GroupwareConfig.apiBase === "function") {
            return window.GroupwareConfig.apiBase(path);
        }
        if (typeof window.getGroupwareApiBase === "function") {
            return window.getGroupwareApiBase(path);
        }
        return String(path || "");
    }

    function isSavedHomeSidebarCollapsed() {
        try {
            return localStorage.getItem(HOME_SIDEBAR_COLLAPSED_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function saveHomeSidebarCollapsedState(isCollapsed) {
        try {
            localStorage.setItem(HOME_SIDEBAR_COLLAPSED_KEY, isCollapsed ? "true" : "false");
        } catch (error) {}
        document.documentElement.classList.remove("homeSidebarCollapsedInitial");
    }

    function applySavedHomeSidebarState() {
        var isCollapsed = isSavedHomeSidebarCollapsed();
        document.documentElement.classList.toggle("homeSidebarCollapsedInitial", isCollapsed);
        document.body.classList.toggle("homeSidebarCollapsed", isCollapsed);
    }

    function applyInitialUnifiedWorkbenchLayout() {
        if (document.body.classList.contains("homePage")) return;
        var sidebar = document.querySelector(".sidebar");
        var topbar = document.querySelector(".workbenchTopbar");
        if (!sidebar || !topbar) return;

        document.body.classList.add("unifiedWorkbench");
        applySavedHomeSidebarState();
        document.querySelectorAll('[data-workbench-item="home"], [data-mobile-nav="home"], [data-account-home="true"]').forEach(function (item) {
            if (item.tagName === "A") item.setAttribute("href", "/index.html");
            if (item.hasAttribute("data-workbench-paths")) item.setAttribute("data-workbench-paths", "/ /index.html");
        });

        var left = topbar.querySelector(".workbenchTopbarLeft") || topbar.querySelector(".homeTopbarLeft");
        if (!left) {
            left = document.createElement("div");
            topbar.insertBefore(left, topbar.firstChild);
        }
        left.className = "workbenchTopbarLeft homeTopbarLeft";
        if (!left.querySelector(".homeSidebarToggleBtn")) {
            left.innerHTML = '<button type="button" class="homeSidebarToggleBtn" aria-label="사이드바 토글" aria-expanded="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1b1b1b" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg></button>';
        }

        var brand = topbar.querySelector(".workbenchTopbarBrand") || topbar.querySelector(".homeTopbarBrand");
        if (!brand) {
            brand = document.createElement("span");
            topbar.insertBefore(brand, topbar.querySelector(".workbenchTopbarActions") || null);
        }
        brand.className = "workbenchTopbarBrand homeTopbarBrand";
        brand.removeAttribute("href");
        brand.setAttribute("aria-label", "오토원워크");
        if (!brand.querySelector('img[src="/img/work_logo.png"]')) {
            brand.innerHTML = '<img src="/img/work_logo.png" alt="AUTOONE work">';
        }

        var profileButton = document.querySelector(".workbenchProfileBtn");
        var actions = topbar.querySelector(".workbenchTopbarActions");
        if (actions && profileButton && profileButton.parentElement !== actions) {
            actions.appendChild(profileButton);
        }

        var button = topbar.querySelector(".homeSidebarToggleBtn");
        if (button && !button.dataset.sidebarToggleBound) {
            button.dataset.sidebarToggleBound = "true";
            button.addEventListener("click", function () {
                document.body.classList.toggle("homeSidebarCollapsed");
                saveHomeSidebarCollapsedState(document.body.classList.contains("homeSidebarCollapsed"));
                button.setAttribute("aria-expanded", String(!document.body.classList.contains("homeSidebarCollapsed")));
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyInitialUnifiedWorkbenchLayout);
    } else {
        applyInitialUnifiedWorkbenchLayout();
    }

    var ADMIN_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9ca4b0" viewBox="0 0 256 256"><path d="M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z"></path></svg>';
    var CHAT_API_BASE = getGroupwareApiBase("/api/chat");
    var CHAT_WS_BASE = "wss://autone-mail-api.autone1team.workers.dev/api/chat/ws";
    var CHAT_USER_WS_BASE = "wss://autone-mail-api.autone1team.workers.dev/api/chat/user-ws";
    var MAIL_API_BASE = getGroupwareApiBase("/api/mail");
    var APPROVAL_NOTIFICATION_API_BASE = getGroupwareApiBase("/api/notifications");
    var SHARED_CALENDAR_API_BASE = getGroupwareApiBase("/api/calendar/shared");
    var BOARD_NEWS_API_BASE = getGroupwareApiBase("/api/board/news");
    var BOARD_RESOURCES_API_BASE = getGroupwareApiBase("/api/board/resources");
    var BOARD_TEAMBOARD_API_BASE = getGroupwareApiBase("/api/board/teamboard");
    var API = window.GroupwareApi;
    var chatUnreadIntervalId = null;
    var chatUnreadObserver = null;
    var mailNotificationIntervalId = null;
    var lastChatUnreadCount = 0;
    var chatReadOverrides = {};
    var chatNotificationBaselineReady = false;
    var chatNotificationSeenByRoom = {};
    var chatNotificationSeenMessageIds = {};
    var chatNotificationIssuedIds = {};
    var sharedChatRooms = [];
    var sharedChatUserSocket = null;
    var sharedChatUserSocketReady = false;
    var sharedChatUserReconnectTimer = null;
    var sharedChatSockets = {};
    var sharedChatReconnectTimers = {};
    var CHAT_READ_OVERRIDE_MS = 15000;
    var MAIL_NOTIFICATION_POLL_MS = 5000;
    var MAIL_MENU_BADGE_POLL_MS = 5000;
    var menuBadgeIntervalId = null;
    var menuBadgeObserver = null;
    var lastMenuBadgeCounts = {};
    var menuBadgeKeys = ["mail"];
    var WORK_ACCOUNT_ALLOWED_MENU_KEYS = ["home", "mail", "calendar", "news", "resources"];
    var WORK_ACCOUNT_ALLOWED_PATHS = ["/", "/index.html", "/mail/", "/calendar/", "/board/news.html", "/board/resources.html"];
    var tableScrollObserver = null;

    function logDesktopNotificationDebug(message) {
        try {
            if (window.groupwareDesktop && typeof window.groupwareDesktop.debugLog === "function") {
                window.groupwareDesktop.debugLog(message);
            }
        } catch (error) {}
    }

    function isDesktopNotificationBridgeAvailable() {
        return !!(window.groupwareDesktop && typeof window.groupwareDesktop.showNotification === "function");
    }

    function wrapScrollableTables(root) {
        var scope = root && root.querySelectorAll ? root : document;
        Array.prototype.slice.call(scope.querySelectorAll("#contents table, .mainArea table, .siteSheet table")).forEach(function (table) {
            if (!table || table.closest(".gwTableScrollWrap")) return;
            if (table.classList.contains("calendarDatePickerGrid")) return;

            var wrapper = document.createElement("div");
            wrapper.className = "gwTableScrollWrap";
            wrapper.setAttribute("tabindex", "0");
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    function observeScrollableTables() {
        if (tableScrollObserver || !document.body || typeof MutationObserver === "undefined") return;
        tableScrollObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                Array.prototype.slice.call(mutation.addedNodes || []).forEach(function (node) {
                    if (!node || node.nodeType !== 1) return;
                    if (node.matches && node.matches("#contents table, .mainArea table, .siteSheet table")) {
                        wrapScrollableTables(node.parentNode || document);
                        return;
                    }
                    wrapScrollableTables(node);
                });
            });
        });
        tableScrollObserver.observe(document.body, { childList: true, subtree: true });
    }

    function isWorkAccount() {
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        return userId === "work";
    }

    function isPrivilegedUser() {
        if (window.AuthStore && typeof window.AuthStore.isExecutive === "function") {
            return window.AuthStore.isExecutive();
        }
        var savedRole = String(localStorage.getItem("userRole") || "staff").trim().toLowerCase();
        return savedRole === "admin" || savedRole === "ceo" || savedRole === "관리자" || savedRole === "대표";
    }

    function isAdminUser() {
        if (window.AuthStore && typeof window.AuthStore.isAdmin === "function") {
            return window.AuthStore.isAdmin();
        }
        var savedRole = String(localStorage.getItem("userRole") || "staff").trim().toLowerCase();
        return savedRole === "admin" || savedRole === "관리자";
    }

    function isRepresentativeUser() {
        if (window.AuthStore && typeof window.AuthStore.isRepresentative === "function") {
            return window.AuthStore.isRepresentative();
        }
        var savedId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        var savedName = String(localStorage.getItem("userName") || "").trim();
        var savedRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
        var savedDepartment = String(localStorage.getItem("userDepartment") || "").trim();
        var savedEmail = String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
        return savedId === "jschoi" || savedId === "ceo" || savedEmail === "jschoi@autonecar.kr" || savedName === "최재성" || savedRole === "ceo" || savedRole === "대표" || savedDepartment === "대표";
    }

    function canSeeAdminMenu() {
        var isAdminPage = document.body && (document.body.classList.contains("adminPageLayout") || document.body.classList.contains("is-admin-layout"));
        if (isAdminPage || String(location.pathname || "").indexOf("/admin/") === 0) return true;
        var savedId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        var savedEmail = String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
        var savedName = String(localStorage.getItem("userName") || "").trim();
        var savedRole = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
        var savedDepartment = String(localStorage.getItem("userDepartment") || "").trim();
        return savedId === "jschoi" ||
            savedId === "admin" ||
            savedEmail === "jschoi@autonecar.kr" ||
            savedEmail === "admin@autone.co.kr" ||
            savedName === "최재성" ||
            savedRole === "admin" ||
            savedRole === "ceo" ||
            savedRole === "관리자" ||
            savedRole === "대표" ||
            savedDepartment === "대표";
    }

    function updateAdminMenuVisibility() {
        var sideBottom = document.querySelector(".side_bottom");
        if (!sideBottom) return;
        var icon = sideBottom.querySelector(".menu_ico");
        if (icon) icon.innerHTML = ADMIN_ICON_SVG;
        var canSeeAdminMenuItem = canSeeAdminMenu();
        if (document.body) document.body.classList.toggle("workbenchHasAdminMenu", canSeeAdminMenuItem);
        var adminLink = sideBottom.querySelector('a[href="/admin/employees.html"], a[href="../admin/employees.html"], [data-account-path="/admin/employees.html"]');
        var adminMenuItem = adminLink && adminLink.closest ? adminLink.closest("p") : null;
        if (adminMenuItem) {
            adminMenuItem.style.display = canSeeAdminMenuItem ? "" : "none";
        }
        sideBottom.classList.add("is-visible");
        sideBottom.hidden = false;
    }

    function updateAdminMenuLinks() {
        document.querySelectorAll('a[href="/settings/employees.html"]').forEach(function (link) {
            link.setAttribute("href", "/admin/employees.html");
        });
    }

    function updateAttendanceMenuVisibility() {
        var gnbMenu = document.querySelector(".gnbMenu");
        var attendanceMenuGroup = document.querySelector(".attendanceMenuGroup");
        var attendanceRailItems = document.querySelectorAll('[data-workbench-item="attendance"]');
        var absenceMenuItem = document.querySelector('.attendanceMenuGroup a[href="/attendance/absence.html"]');
        var department = String(localStorage.getItem("userDepartment") || "").trim();
        var shouldHideAttendanceMenu = isPrivilegedUser() || department.indexOf("대표") !== -1;
        var shouldHideAbsenceMenu = department === "영업1팀" || department === "영업2팀";
        attendanceRailItems.forEach(function (item) {
            item.style.display = shouldHideAttendanceMenu ? "none" : "";
        });
        if (attendanceMenuGroup) {
            attendanceMenuGroup.style.display = shouldHideAttendanceMenu ? "none" : "";
        }
        if (absenceMenuItem && absenceMenuItem.parentElement) {
            absenceMenuItem.parentElement.style.display = !shouldHideAttendanceMenu && shouldHideAbsenceMenu ? "none" : "";
        }
        if (gnbMenu) {
            gnbMenu.classList.toggle("is-attendance-hidden", shouldHideAttendanceMenu);
        }
    }

    function updateTeamboardMenuVisibility() {
        var shouldHideTeamboardMenu = isPrivilegedUser();
        document.querySelectorAll('[data-workbench-item="teamboard"]').forEach(function (item) {
            item.style.display = shouldHideTeamboardMenu ? "none" : "";
        });
        if (shouldHideTeamboardMenu) {
            setWorkbenchMenuBadge("teamboard", 0);
        }
    }

    function updateChatMenuVisibility() {
        var shouldHideChatMenu = (isAdminUser() && !isRepresentativeUser()) || isWorkAccount();
        document.querySelectorAll('[data-workbench-item="chat"], [data-mobile-nav="chat"]').forEach(function (item) {
            item.style.display = shouldHideChatMenu ? "none" : "";
        });
        if (shouldHideChatMenu) {
            setChatMenuUnreadBadge(0);
        }
    }

    function updateWorkAccountMenuVisibility() {
        var shouldLimitMenu = isWorkAccount();
        document.body.classList.toggle("is-work-account", shouldLimitMenu);
        if (!shouldLimitMenu) return;
        document.querySelectorAll("[data-workbench-item]").forEach(function (item) {
            var key = String(item.getAttribute("data-workbench-item") || "").trim().toLowerCase();
            if (!key) return;
            item.style.display = WORK_ACCOUNT_ALLOWED_MENU_KEYS.indexOf(key) > -1 ? "" : "none";
        });
        document.querySelectorAll("[data-mobile-nav]").forEach(function (item) {
            var key = String(item.getAttribute("data-mobile-nav") || "").trim().toLowerCase();
            if (!key) return;
            item.style.display = (key === "home" || key === "mail" || key === "calendar" || key === "more") ? "" : "none";
        });
        var sideBottom = document.querySelector(".side_bottom");
        if (sideBottom && shouldLimitMenu && !document.body.classList.contains("is-admin-layout") && !document.body.classList.contains("adminPageLayout")) {
            sideBottom.classList.remove("is-visible");
            sideBottom.hidden = true;
            sideBottom.style.display = "none";
        }
        if (shouldLimitMenu) {
            setChatMenuUnreadBadge(0);
            setWorkbenchMenuBadge("approval", 0);
            setWorkbenchMenuBadge("teamboard", 0);
        }
    }

    function refreshWorkbenchMenuVisibility() {
        updateAdminMenuLinks();
        updateAdminMenuVisibility();
        updateAttendanceMenuVisibility();
        updateTeamboardMenuVisibility();
        updateChatMenuVisibility();
        updateWorkAccountMenuVisibility();
        updateHomeMenuVisibility();
    }

    function bindWorkbenchSubmenuDisclosure() {
        document.querySelectorAll(".workbenchAppRail .workbenchAppItem + .workbenchAppSubmenu").forEach(function (submenu) {
            var item = submenu.previousElementSibling;
            if (!item || !item.classList.contains("workbenchAppItem")) return;
            if (item.dataset.workbenchSubmenuBound === "true") return;
            item.dataset.workbenchSubmenuBound = "true";
            item.setAttribute("aria-expanded", String(item.classList.contains("is-active") || item.classList.contains("is-open")));
        });
    }

    function applyWorkbenchSubmenuSelection() {
        var currentPath = normalizeWorkbenchPath(location.pathname || "");
        if (!currentPath) return;

        document.querySelectorAll(".workbenchAppSubmenu .workbenchAppSubitem").forEach(function (item) {
            item.classList.remove("is-active");
            if (item.tagName !== "A") return;
            var href = normalizeWorkbenchPath(item.getAttribute("href") || "");
            if (href && (currentPath === href || currentPath.slice(-href.length) === href)) {
                item.classList.add("is-active");
            }
        });

        document.querySelectorAll(".workbenchAppRail .workbenchAppItem + .workbenchAppSubmenu").forEach(function (submenu) {
            var item = submenu.previousElementSibling;
            if (!item || !item.classList.contains("workbenchAppItem")) return;
            item.setAttribute("aria-expanded", String(item.classList.contains("is-active") || item.classList.contains("is-open")));
        });
    }

    function updateHomeMenuVisibility() {
        document.querySelectorAll('.workbenchAppRail [data-workbench-item="home"]').forEach(function (item) {
            item.style.display = "";
            item.setAttribute("href", "/index.html");
            item.setAttribute("data-workbench-paths", "/ /index.html");
        });
        document.querySelectorAll('[data-mobile-nav="home"], [data-account-home="true"]').forEach(function (item) {
            item.style.display = "none";
        });
    }

    function setupUnifiedWorkbenchLayout() {
        if (document.body.classList.contains("homePage")) return;
        var sidebar = document.querySelector(".sidebar");
        var topbar = document.querySelector(".workbenchTopbar");
        if (!sidebar || !topbar) return;

        document.body.classList.add("unifiedWorkbench");
        document.querySelectorAll('[data-workbench-item="home"], [data-mobile-nav="home"], [data-account-home="true"]').forEach(function (item) {
            if (item.tagName === "A") item.setAttribute("href", "/index.html");
            if (item.hasAttribute("data-workbench-paths")) item.setAttribute("data-workbench-paths", "/ /index.html");
        });

        var left = topbar.querySelector(".workbenchTopbarLeft") || topbar.querySelector(".homeTopbarLeft");
        if (!left) {
            left = document.createElement("div");
            left.className = "workbenchTopbarLeft";
            topbar.insertBefore(left, topbar.firstChild);
        }
        left.classList.add("homeTopbarLeft");
        if (!left.querySelector(".homeSidebarToggleBtn")) {
            left.innerHTML = '<button type="button" class="homeSidebarToggleBtn" aria-label="사이드바 토글" aria-expanded="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#1b1b1b" viewBox="0 0 256 256" aria-hidden="true"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg></button>';
        }

        var brand = topbar.querySelector(".workbenchTopbarBrand") || topbar.querySelector(".homeTopbarBrand");
        if (!brand) {
            brand = document.createElement("span");
            brand.className = "workbenchTopbarBrand";
            topbar.insertBefore(brand, topbar.querySelector(".workbenchTopbarActions") || null);
        }
        brand.classList.add("homeTopbarBrand");
        brand.removeAttribute("href");
        brand.setAttribute("aria-label", "오토원워크");
        if (!brand.querySelector('img[src="/img/work_logo.png"]')) {
            brand.innerHTML = '<img src="/img/work_logo.png" alt="AUTOONE work">';
        }

        var profileButton = document.querySelector(".workbenchProfileBtn");
        var actions = topbar.querySelector(".workbenchTopbarActions");
        if (actions && profileButton && profileButton.parentElement !== actions) {
            actions.appendChild(profileButton);
        }
    }

    window.setupUnifiedWorkbenchLayout = setupUnifiedWorkbenchLayout;

    function redirectWorkAccountFromBlockedPage() {
        if (!isWorkAccount()) return;
        var path = normalizeWorkbenchPath(location.pathname || "/");
        var isAllowed = WORK_ACCOUNT_ALLOWED_PATHS.some(function (allowedPath) {
            return allowedPath.slice(-1) === "/" ? path.indexOf(allowedPath) === 0 : path === allowedPath;
        });
        if (!isAllowed) location.href = "/";
    }

    function getCurrentUserId() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            var user = window.AuthStore.getCurrentUser();
            if (user && user.id) return String(user.id);
        }
        return String(localStorage.getItem("userId") || "").trim();
    }

    function getCurrentUserEmail() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            var user = window.AuthStore.getCurrentUser();
            if (user && user.email) return String(user.email).trim().toLowerCase();
        }
        return String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
    }

    function getChatUnreadTargets() {
        return Array.prototype.slice.call(document.querySelectorAll('[data-workbench-item="chat"], [data-mobile-nav="chat"]'));
    }

    function setChatMenuUnreadBadge(count) {
        var unreadCount = Math.max(0, Number(count || 0));
        lastChatUnreadCount = unreadCount;
        getChatUnreadTargets().forEach(function (target) {
            var badge = target.querySelector(".chatMenuUnreadBadge");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "chatMenuUnreadBadge workbenchMenuUnreadBadge";
                target.appendChild(badge);
            }
            var label = String(Math.min(unreadCount, 99));
            var shouldHide = unreadCount <= 0;
            if (badge.textContent !== label) badge.textContent = label;
            if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
        });
    }

    function getMenuBadgeTargets(key) {
        var safeKey = String(key || "").trim().toLowerCase();
        if (!safeKey) return [];
        return Array.prototype.slice.call(document.querySelectorAll('[data-workbench-item="' + safeKey + '"], [data-mobile-nav="' + safeKey + '"]'));
    }

    function isAllowedWorkbenchBadgeKey(key) {
        var menuKey = String(key || "").trim().toLowerCase();
        return menuKey === "chat" || menuBadgeKeys.indexOf(menuKey) !== -1;
    }

    function clearUnsupportedWorkbenchMenuBadges(root) {
        var scope = root && root.querySelectorAll ? root : document;
        Array.prototype.slice.call(scope.querySelectorAll(".workbenchMenuUnreadBadge")).forEach(function (badge) {
            var target = badge.closest("[data-workbench-item], [data-mobile-nav]");
            var key = target && (target.getAttribute("data-workbench-item") || target.getAttribute("data-mobile-nav"));
            if (!isAllowedWorkbenchBadgeKey(key)) badge.remove();
        });
    }

    function setWorkbenchMenuBadge(key, count) {
        var menuKey = String(key || "").trim().toLowerCase();
        var unreadCount = Math.max(0, Number(count || 0));
        if (!menuKey) return;
        if (!isAllowedWorkbenchBadgeKey(menuKey)) {
            getMenuBadgeTargets(menuKey).forEach(function (target) {
                var badge = target.querySelector(".workbenchMenuUnreadBadge");
                if (badge) badge.remove();
            });
            return;
        }
        lastMenuBadgeCounts[menuKey] = unreadCount;
        if (menuKey === "mail") {
            getMenuBadgeTargets(menuKey).forEach(function (target) {
                var badge = target.querySelector(".workbenchMenuUnreadBadge");
                if (badge) badge.remove();
            });
            setMailSubmenuUnreadBadges(unreadCount);
            return;
        }
        getMenuBadgeTargets(menuKey).forEach(function (target) {
            var badge = target.querySelector(".workbenchMenuUnreadBadge");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "chatMenuUnreadBadge workbenchMenuUnreadBadge";
                target.appendChild(badge);
            }
            var label = unreadCount > 99 ? "99+" : String(unreadCount);
            var shouldHide = unreadCount <= 0;
            if (badge.textContent !== label) badge.textContent = label;
            if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
        });
    }

    function setMailSubmenuUnreadBadges(count) {
        var unreadCount = Math.max(0, Number(count || 0));
        var label = unreadCount > 99 ? "99+" : String(unreadCount);
        var shouldHide = unreadCount <= 0;

        Array.prototype.slice.call(document.querySelectorAll(".mailSubmenuUnreadBadge")).forEach(function (badge) {
            var link = badge.closest("a[href]");
            var href = normalizeWorkbenchPath(link && link.getAttribute("href") || "");
            if (href !== "/mail/all.html" && href !== "/mail/inbox.html") badge.remove();
        });

        Array.prototype.slice.call(document.querySelectorAll('a[href="/mail/all.html"], a[href="/mail/inbox.html"]')).forEach(function (target) {
            if (!target.classList.contains("workbenchAppSubitem") && !target.closest(".mailSubmenuItem")) return;
            var badge = target.querySelector(".mailSubmenuUnreadBadge");
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "mailSubmenuUnreadBadge";
                target.appendChild(badge);
            }
            if (badge.textContent !== label) badge.textContent = label;
            if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
        });
    }

    function observeWorkbenchMenuBadgeTargets() {
        if (menuBadgeObserver || !document.body || typeof MutationObserver === "undefined") return;
        menuBadgeObserver = new MutationObserver(function () {
            clearUnsupportedWorkbenchMenuBadges();
            menuBadgeKeys.forEach(function (key) {
                setWorkbenchMenuBadge(key, lastMenuBadgeCounts[key] || 0);
            });
            setChatMenuUnreadBadge(lastChatUnreadCount);
        });
        menuBadgeObserver.observe(document.body, { childList: true, subtree: true });
    }

    function getMenuSeenKey(key) {
        return "gw-menu-seen:" + String(key || "").trim().toLowerCase() + ":" + (getCurrentUserId() || "anonymous");
    }

    function getMenuSeenTime(key) {
        var value = localStorage.getItem(getMenuSeenKey(key)) || "";
        var time = value ? new Date(value).getTime() : 0;
        return isNaN(time) ? 0 : time;
    }

    function hasMenuSeenTime(key) {
        return !!localStorage.getItem(getMenuSeenKey(key));
    }

    function setMenuSeenTime(key, value) {
        if (!key || !value) return;
        localStorage.setItem(getMenuSeenKey(key), value);
    }

    function getItemTimeValue(item) {
        return String(item && (item.updatedAt || item.createdAt || item.date || "") || "");
    }

    function getLatestItemTime(items) {
        var latest = "";
        (Array.isArray(items) ? items : []).forEach(function (item) {
            var value = getItemTimeValue(item);
            if (value && (!latest || String(value).localeCompare(latest) > 0)) latest = value;
        });
        return latest;
    }

    function countItemsAfterSeen(key, items, isCountable) {
        var seenTime = getMenuSeenTime(key);
        return (Array.isArray(items) ? items : []).filter(function (item) {
            var itemTime = new Date(getItemTimeValue(item)).getTime();
            if (!itemTime || isNaN(itemTime) || itemTime <= seenTime) return false;
            return typeof isCountable === "function" ? isCountable(item) : true;
        }).length;
    }

    function isOwnItem(item) {
        var userId = getCurrentUserId();
        if (!userId) return false;
        return String(item && (item.authorId || item.createdById || item.requesterId || "") || "").trim().toLowerCase() === String(userId).trim().toLowerCase();
    }

    function isCurrentPathForMenu(key) {
        var path = String(location.pathname || "").toLowerCase();
        if (key === "mail") return path.indexOf("/mail/") === 0 || path.indexOf("/mail.") === 0;
        if (key === "approval") return path.indexOf("/approval/") === 0 || path.indexOf("/approval.") === 0;
        if (key === "calendar") return path.indexOf("/calendar/") === 0 || path.indexOf("/calendar.") === 0;
        if (key === "news") return path.indexOf("/board/news.html") === 0;
        if (key === "resources") return path.indexOf("/board/resources.html") === 0;
        if (key === "teamboard") return path.indexOf("/board/teamboard.html") === 0;
        return false;
    }

    async function fetchJson(url) {
        return await API.get(url, null, { errorMessage: "데이터를 불러오지 못했습니다." });
    }

    async function refreshMailMenuBadge() {
        var userEmail = getCurrentUserEmail();
        if (!userEmail) {
            setWorkbenchMenuBadge("mail", 0);
            return;
        }
        try {
            var data = await fetchJson(MAIL_API_BASE + "/counts?userEmail=" + encodeURIComponent(userEmail));
            var inboxUnread = data.inboxUnread !== undefined ? data.inboxUnread : data.allUnread;
            setWorkbenchMenuBadge("mail", Math.max(0, Number(inboxUnread || 0)));
        } catch (error) {
            setWorkbenchMenuBadge("mail", 0);
        }
    }

    function setMailMenuUnreadBadge(count) {
        setWorkbenchMenuBadge("mail", Math.max(0, Number(count || 0)));
    }

    function getMailNotificationStateKey(userEmail) {
        return "autoneMailNotificationState:" + String(userEmail || "").trim().toLowerCase();
    }

    function readMailNotificationState(userEmail) {
        try {
            var parsed = JSON.parse(localStorage.getItem(getMailNotificationStateKey(userEmail)) || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeMailNotificationState(userEmail, value) {
        try {
            localStorage.setItem(getMailNotificationStateKey(userEmail), JSON.stringify(value || {}));
        } catch (error) {}
    }

    function normalizeMailRecipients(value) {
        return String(value || "")
            .split(",")
            .map(function (item) { return String(item || "").trim().toLowerCase(); })
            .filter(Boolean);
    }

    function isInboxMailForCurrentUser(item, userEmail) {
        var email = String(userEmail || "").trim().toLowerCase();
        if (!email) return false;
        return normalizeMailRecipients(item && item.to || "").indexOf(email) > -1;
    }

    function getMailNotificationTime(item) {
        var time = new Date(String(item && (item.date || item.createdAt || item.updatedAt) || "")).getTime();
        return time && !isNaN(time) ? time : 0;
    }

    function getMailNotificationId(item) {
        return String(item && item.id || "").trim();
    }

    function compactMailSeenIds(ids) {
        var seen = {};
        return (Array.isArray(ids) ? ids : []).filter(function (id) {
            id = String(id || "").trim();
            if (!id || seen[id]) return false;
            seen[id] = true;
            return true;
        }).slice(0, 200);
    }

    function showMailSystemNotification(item) {
        var id = getMailNotificationId(item);
        if (!id) return;
        var link = "/mail/read.html?id=" + encodeURIComponent(id) + "&folder=inbox";
        var subject = String(item && item.subject || "").trim();
        var title = "새 메일 도착 알림";
        var body = subject ? truncateMailNotificationSubject(subject) : "1개의 메일 메시지";

        if (isDesktopNotificationBridgeAvailable()) {
            try {
                logDesktopNotificationDebug("mail notification requested: id=" + id);
                window.groupwareDesktop.showNotification({
                    title: title,
                    body: body,
                    url: link,
                    tag: "mail-inbox-" + id,
                    notificationId: "mail-" + id,
                    type: "mail_inbox"
                });
            } catch (error) {}
            return;
        }

        logDesktopNotificationDebug("mail notification skipped: desktop bridge unavailable");
    }

    function truncateMailNotificationSubject(subject) {
        var text = String(subject || "").replace(/\s+/g, " ").trim();
        return text.length > 26 ? text.slice(0, 26) + "..." : text;
    }

    async function pollMailNotifications() {
        if (localStorage.getItem("isLogin") !== "true") return;
        var userEmail = getCurrentUserEmail();
        if (!userEmail) return;
        if (!isDesktopNotificationBridgeAvailable()) return;

        try {
            var data = await API.get(MAIL_API_BASE + "/inbox", {
                page: 1,
                pageSize: 20,
                userEmail: userEmail
            }, { errorMessage: "받은메일함을 불러오지 못했습니다." });
            var items = (Array.isArray(data && data.items) ? data.items : []).filter(function (item) {
                return isInboxMailForCurrentUser(item, userEmail);
            });
            var state = readMailNotificationState(userEmail);
            var baselineTime = Number(state.baselineTime || 0);
            var seenIds = compactMailSeenIds(state.seenIds || []);
            var seenMap = {};
            seenIds.forEach(function (id) { seenMap[id] = true; });
            var newestTime = baselineTime;
            var nextSeenIds = items.map(getMailNotificationId).filter(Boolean).concat(seenIds);

            items.forEach(function (item) {
                var itemTime = getMailNotificationTime(item);
                if (itemTime > newestTime) newestTime = itemTime;
            });

            if (!state.initialized) {
                writeMailNotificationState(userEmail, {
                    initialized: true,
                    baselineTime: newestTime,
                    seenIds: compactMailSeenIds(nextSeenIds)
                });
                return;
            }

            items.slice().reverse().forEach(function (item) {
                var id = getMailNotificationId(item);
                if (!id || seenMap[id]) return;
                if (item.unread === false) return;
                var itemTime = getMailNotificationTime(item);
                if (itemTime && itemTime <= baselineTime) return;
                seenMap[id] = true;
                nextSeenIds.unshift(id);
                showMailSystemNotification(item);
            });

            writeMailNotificationState(userEmail, {
                initialized: true,
                baselineTime: newestTime,
                seenIds: compactMailSeenIds(nextSeenIds)
            });
        } catch (error) {}
    }

    function startMailNotificationWatcher() {
        pollMailNotifications();
        if (!mailNotificationIntervalId) {
            mailNotificationIntervalId = window.setInterval(pollMailNotifications, MAIL_NOTIFICATION_POLL_MS);
        }
    }

    async function refreshApprovalMenuBadge() {
        var userId = getCurrentUserId();
        if (!userId) {
            setWorkbenchMenuBadge("approval", 0);
            return;
        }
        try {
            var data = await fetchJson(APPROVAL_NOTIFICATION_API_BASE + "?userId=" + encodeURIComponent(userId));
            var items = Array.isArray(data.items) ? data.items : [];
            var count = items.filter(function (item) {
                var type = String(item && item.type || "").trim().toLowerCase();
                return item && item.read !== true && (type === "approval_pending" || type === "approval_reference");
            }).length;
            setWorkbenchMenuBadge("approval", count);
        } catch (error) {
            setWorkbenchMenuBadge("approval", 0);
        }
    }

    async function refreshTimestampMenuBadge(key, url, isCountable) {
        try {
            if (key === "resources" && isCurrentPathForMenu("resources")) {
                setMenuSeenTime("resources", new Date().toISOString());
                setWorkbenchMenuBadge("resources", 0);
                return;
            }
            var data = await fetchJson(url);
            var items = Array.isArray(data.items) ? data.items : [];
            var latest = getLatestItemTime(items);
            if (!hasMenuSeenTime(key) && latest) {
                setMenuSeenTime(key, latest);
                setWorkbenchMenuBadge(key, 0);
                return;
            }
            if (isCurrentPathForMenu(key) && latest) {
                setMenuSeenTime(key, latest);
                setWorkbenchMenuBadge(key, 0);
                return;
            }
            setWorkbenchMenuBadge(key, countItemsAfterSeen(key, items, isCountable));
        } catch (error) {
            setWorkbenchMenuBadge(key, 0);
        }
    }

    async function refreshTeamboardMenuBadge() {
        var userId = getCurrentUserId();
        if (!userId) {
            setWorkbenchMenuBadge("teamboard", 0);
            return;
        }
        try {
            var data = await fetchJson(BOARD_TEAMBOARD_API_BASE + "?userId=" + encodeURIComponent(userId));
            var items = Array.isArray(data.items) ? data.items : [];
            var latest = getLatestItemTime(items);
            if (!hasMenuSeenTime("teamboard") && latest) {
                setMenuSeenTime("teamboard", latest);
                setWorkbenchMenuBadge("teamboard", 0);
                return;
            }
            if (isCurrentPathForMenu("teamboard") && latest) {
                setMenuSeenTime("teamboard", latest);
                setWorkbenchMenuBadge("teamboard", 0);
                return;
            }
            setWorkbenchMenuBadge("teamboard", countItemsAfterSeen("teamboard", items, function (item) {
                return !isOwnItem(item);
            }));
        } catch (error) {
            setWorkbenchMenuBadge("teamboard", 0);
        }
    }

    function refreshWorkbenchMenuBadges() {
        if (localStorage.getItem("isLogin") !== "true") {
            menuBadgeKeys.forEach(function (key) { setWorkbenchMenuBadge(key, 0); });
            return;
        }
        refreshMailMenuBadge();
    }

    function startWorkbenchMenuBadges() {
        observeWorkbenchMenuBadgeTargets();
        clearUnsupportedWorkbenchMenuBadges();
        menuBadgeKeys.forEach(function (key) {
            setWorkbenchMenuBadge(key, lastMenuBadgeCounts[key] || 0);
        });
        if (isCurrentPathForMenu("resources")) {
            setMenuSeenTime("resources", new Date().toISOString());
            setWorkbenchMenuBadge("resources", 0);
        }
        refreshWorkbenchMenuBadges();
        if (!menuBadgeIntervalId) {
            menuBadgeIntervalId = window.setInterval(refreshWorkbenchMenuBadges, MAIL_MENU_BADGE_POLL_MS);
        }
    }

    function dispatchChatRoomsUpdated(rooms, unreadCount) {
        var detail = {
            rooms: Array.isArray(rooms) ? rooms : [],
            unreadCount: Math.max(0, Number(unreadCount || 0))
        };
        try {
            window.dispatchEvent(new CustomEvent("chat:rooms-updated", { detail: detail }));
        } catch (error) {}
    }

    async function refreshChatMenuUnreadBadge() {
        var userId = getCurrentUserId();
        if (!userId || localStorage.getItem("isLogin") !== "true") {
            logDesktopNotificationDebug("chat badge skipped: isLogin=" + String(localStorage.getItem("isLogin") || "") + " userId=" + String(userId || ""));
            setChatMenuUnreadBadge(0);
            chatNotificationBaselineReady = false;
            chatNotificationSeenByRoom = {};
            sharedChatRooms = [];
            closeSharedChatUserSocket();
            closeSharedChatSockets();
            dispatchChatRoomsUpdated([], 0);
            return;
        }
        try {
            var data = await API.get(CHAT_API_BASE + "/rooms", { userId: userId }, { errorMessage: "Failed to load chat rooms" });
            var rooms = Array.isArray(data && data.items) ? data.items : [];
            logDesktopNotificationDebug("chat rooms loaded: userId=" + userId + " rooms=" + rooms.length);
            rooms = applyChatReadOverrides(rooms);
            sharedChatRooms = normalizeSharedChatRooms(rooms);
            connectSharedChatUserSocket(userId);
            syncSharedChatSockets(userId, sharedChatRooms);
            if (!chatNotificationBaselineReady) {
                bootstrapSharedChatNotifications(userId, sharedChatRooms);
            } else {
                reconcileSharedChatNotificationBaseline(userId, sharedChatRooms);
            }
            dispatchSharedChatRooms();
        } catch (error) {
            setChatMenuUnreadBadge(0);
        }
    }

    function getChatNotificationSeenKey(userId) {
        return "autoneChatNotificationSeen:" + String(userId || "").trim().toLowerCase();
    }

    function readChatNotificationSeen(userId) {
        try {
            var parsed = JSON.parse(localStorage.getItem(getChatNotificationSeenKey(userId)) || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeChatNotificationSeen(userId, value) {
        try {
            localStorage.setItem(getChatNotificationSeenKey(userId), JSON.stringify(value || {}));
        } catch (error) {}
    }

    function bootstrapSharedChatNotifications(userId, rooms) {
        chatNotificationSeenByRoom = readChatNotificationSeen(userId);
        (Array.isArray(rooms) ? rooms : []).forEach(function (room) {
            var roomId = String(room && room.id || "").trim();
            var lastMessageAt = String(room && (room.lastMessageAt || room.updatedAt) || "").trim();
            if (roomId && lastMessageAt) chatNotificationSeenByRoom[roomId] = lastMessageAt;
        });
        writeChatNotificationSeen(userId, chatNotificationSeenByRoom);
        chatNotificationBaselineReady = true;
    }

    function reconcileSharedChatNotificationBaseline(userId, rooms) {
        var changed = false;
        (Array.isArray(rooms) ? rooms : []).forEach(function (room) {
            var roomId = String(room && room.id || "").trim();
            var lastMessageAt = String(room && (room.lastMessageAt || room.updatedAt) || "").trim();
            if (!roomId || !lastMessageAt) return;
            if (String(chatNotificationSeenByRoom[roomId] || "") === lastMessageAt) return;
            chatNotificationSeenByRoom[roomId] = lastMessageAt;
            changed = true;
        });
        if (changed) writeChatNotificationSeen(userId, chatNotificationSeenByRoom);
    }

    function showBasicChatRoomNotification(room) {
        if (!isDesktopNotificationBridgeAvailable()) {
            logDesktopNotificationDebug("chat room notification skipped: desktop bridge unavailable");
            return;
        }
        var roomId = String(room && room.id || "").trim();
        var title = buildBasicChatNotificationTitle(room);
        var body = String(room && room.lastMessageText || "").trim() || "새 채팅 메시지";
        var notificationId = String(room && (room.lastMessageId || room.messageId) || "").trim()
            || "chat-room-" + roomId + "-" + String(room && room.lastMessageAt || Date.now());
        if (!reserveChatNotificationId(notificationId)) {
            logDesktopNotificationDebug("chat room notification skipped: duplicate id=" + notificationId);
            return;
        }
        logDesktopNotificationDebug("chat room notification requested: room=" + roomId + " id=" + notificationId);
        try {
            window.groupwareDesktop.showNotification({
                title: title,
                body: body,
                url: "/chat.html?roomId=" + encodeURIComponent(roomId),
                tag: "chat-room-" + roomId,
                notificationId: notificationId,
                type: "chat_message"
            });
        } catch (error) {}
    }

    function buildBasicChatNotificationTitle(room) {
        var memberNames = room && room.memberNames && typeof room.memberNames === "object" ? room.memberNames : {};
        var senderId = String(room && room.lastSenderId || "").trim().toLowerCase();
        var senderName = String(memberNames[senderId] || "").trim();
        if (!senderName) senderName = String(room && room.lastSenderName || "").trim();
        if (senderName) return senderName;
        return "새 채팅 메시지";
    }

    function handleGlobalChatMessageNotification(event) {
        var detail = event && event.detail && typeof event.detail === "object" ? event.detail : {};
        var message = detail.message && typeof detail.message === "object" ? detail.message : null;
        if (!message) return;
        if (String(message.deletedAt || "").trim()) return;
        var currentUserId = String(getCurrentUserId() || "").trim().toLowerCase();
        var senderId = String(message.senderId || "").trim().toLowerCase();
        if (!currentUserId || !senderId || senderId === currentUserId) return;
        var messageId = String(message.id || "").trim();
        var room = detail.room && typeof detail.room === "object" ? detail.room : {};
        showBasicChatRoomNotification(Object.assign({}, room, {
            id: String((room && room.id) || message.roomId || "").trim(),
            lastMessageId: messageId,
            lastMessageText: String(message.text || "").trim(),
            lastMessageAt: String(message.createdAt || "").trim(),
            lastSenderId: String(message.senderId || "").trim(),
            lastSenderName: String(message.senderName || "").trim()
        }));
    }

    function normalizeSharedChatRooms(rooms) {
        return (Array.isArray(rooms) ? rooms : []).map(function (room) {
            return room && typeof room === "object" ? Object.assign({}, room) : null;
        }).filter(Boolean);
    }

    function dispatchSharedChatRooms() {
        var total = sharedChatRooms.reduce(function (sum, room) {
            return sum + Math.max(0, Number(room && room.unreadCount || 0));
        }, 0);
        setChatMenuUnreadBadge(total);
        dispatchChatRoomsUpdated(sharedChatRooms, total);
    }

    function connectSharedChatUserSocket(userId) {
        if (sharedChatUserSocket && sharedChatUserSocketReady) return;
        closeSharedChatUserSocket();
        logDesktopNotificationDebug("chat user socket connecting: userId=" + String(userId || ""));
        var socket = null;
        try {
            socket = new WebSocket(CHAT_USER_WS_BASE + "?userId=" + encodeURIComponent(userId));
        } catch (error) {
            scheduleSharedChatUserSocketReconnect(userId);
            return;
        }
        sharedChatUserSocket = socket;
        sharedChatUserSocketReady = false;
        socket.addEventListener("open", function () {
            sharedChatUserSocketReady = true;
            logDesktopNotificationDebug("chat user socket open: userId=" + String(userId || ""));
        });
        socket.addEventListener("message", function (event) {
            logDesktopNotificationDebug("chat user socket message: " + String(event && event.data || "").slice(0, 180));
            handleSharedChatUserSocketMessage(userId, event.data);
        });
        socket.addEventListener("close", function () {
            logDesktopNotificationDebug("chat user socket closed: userId=" + String(userId || ""));
            if (sharedChatUserSocket === socket) {
                sharedChatUserSocket = null;
                sharedChatUserSocketReady = false;
            }
            scheduleSharedChatUserSocketReconnect(userId);
        });
        socket.addEventListener("error", function () {
            logDesktopNotificationDebug("chat user socket error: userId=" + String(userId || ""));
            try { socket.close(); } catch (error) {}
        });
    }

    function scheduleSharedChatUserSocketReconnect(userId) {
        if (sharedChatUserReconnectTimer) return;
        sharedChatUserReconnectTimer = window.setTimeout(function () {
            sharedChatUserReconnectTimer = null;
            if (localStorage.getItem("isLogin") === "true" && getCurrentUserId()) {
                connectSharedChatUserSocket(userId);
            }
        }, 1500);
    }

    function closeSharedChatUserSocket() {
        if (sharedChatUserReconnectTimer) {
            window.clearTimeout(sharedChatUserReconnectTimer);
            sharedChatUserReconnectTimer = null;
        }
        if (sharedChatUserSocket) {
            try { sharedChatUserSocket.close(); } catch (error) {}
        }
        sharedChatUserSocket = null;
        sharedChatUserSocketReady = false;
    }

    function handleSharedChatUserSocketMessage(userId, raw) {
        var payload = null;
        try {
            payload = JSON.parse(String(raw || ""));
        } catch (error) {
            return;
        }
        if (!payload || payload.type === "ready") return;
        if (payload.type === "chat_message") {
            if (payload.message) {
                try {
                    window.dispatchEvent(new CustomEvent("groupware:chat-message", {
                        detail: {
                            message: payload.message,
                            room: payload.room || { id: payload.roomId || payload.message.roomId || "" },
                            source: "user-socket"
                        }
                    }));
                } catch (error) {}
            }
            if (payload.message && !String(payload.message.deletedAt || "").trim() && String(payload.message.senderId || "").trim().toLowerCase() !== String(userId || "").trim().toLowerCase()) {
                showBasicChatRoomNotification({
                    id: String(payload.roomId || payload.message.roomId || ""),
                    lastMessageId: String(payload.message.id || ""),
                    lastMessageText: String(payload.message.text || "").trim(),
                    lastMessageAt: String(payload.message.createdAt || ""),
                    lastSenderId: String(payload.message.senderId || ""),
                    lastSenderName: String(payload.message.senderName || ""),
                    memberNames: payload.room && payload.room.memberNames || {}
                });
            }
            refreshChatMenuUnreadBadge();
            return;
        }
        if (payload.type === "chat_message_replace") {
            if (payload.message) {
                try {
                    window.dispatchEvent(new CustomEvent("groupware:chat-message-replace", {
                        detail: {
                            message: payload.message,
                            room: payload.room || { id: payload.roomId || payload.message.roomId || "" },
                            source: "user-socket"
                        }
                    }));
                } catch (error) {}
            }
            refreshChatMenuUnreadBadge();
            return;
        }
        if (payload.type === "chat_message_delete") {
            try {
                window.dispatchEvent(new CustomEvent("groupware:chat-message-delete", {
                    detail: {
                        roomId: payload.roomId || "",
                        deletedId: payload.deletedId || "",
                        room: payload.room || null,
                        source: "user-socket"
                    }
                }));
            } catch (error) {}
            refreshChatMenuUnreadBadge();
            return;
        }
        if (payload.type === "chat_read") {
            try {
                window.dispatchEvent(new CustomEvent("groupware:chat-read", {
                    detail: {
                        roomId: payload.roomId || "",
                        userId: payload.readerUserId || "",
                        readAt: payload.readAt || "",
                        room: payload.room || null
                    }
                }));
            } catch (error) {}
            refreshChatMenuUnreadBadge();
            return;
        }
        if (payload.type === "chat_room_sync") {
            refreshChatMenuUnreadBadge();
        }
    }

    function syncSharedChatSockets(userId, rooms) {
        if (typeof WebSocket !== "function") {
            closeSharedChatSockets();
            return;
        }
        var nextRoomIds = {};
        (Array.isArray(rooms) ? rooms : []).forEach(function (room) {
            var roomId = String(room && room.id || "").trim();
            if (!roomId) return;
            nextRoomIds[roomId] = true;
            if (!sharedChatSockets[roomId]) openSharedChatSocket(userId, roomId);
        });
        Object.keys(sharedChatSockets).forEach(function (roomId) {
            if (!nextRoomIds[roomId]) closeSharedChatSocket(roomId);
        });
    }

    function openSharedChatSocket(userId, roomId) {
        closeSharedChatSocket(roomId);
        var socket = null;
        try {
            socket = new WebSocket(CHAT_WS_BASE + "?userId=" + encodeURIComponent(userId) + "&roomId=" + encodeURIComponent(roomId));
        } catch (error) {
            scheduleSharedChatSocketReconnect(userId, roomId);
            return;
        }
        sharedChatSockets[roomId] = socket;
        socket.addEventListener("message", function (event) {
            handleSharedChatSocketMessage(userId, roomId, event.data);
        });
        socket.addEventListener("close", function () {
            if (sharedChatSockets[roomId] === socket) delete sharedChatSockets[roomId];
            scheduleSharedChatSocketReconnect(userId, roomId);
        });
        socket.addEventListener("error", function () {
            try { socket.close(); } catch (error) {}
        });
    }

    function scheduleSharedChatSocketReconnect(userId, roomId) {
        if (sharedChatReconnectTimers[roomId]) return;
        sharedChatReconnectTimers[roomId] = window.setTimeout(function () {
            delete sharedChatReconnectTimers[roomId];
            if (localStorage.getItem("isLogin") === "true" && getCurrentUserId()) {
                openSharedChatSocket(userId, roomId);
            }
        }, 1500);
    }

    function closeSharedChatSocket(roomId) {
        if (sharedChatReconnectTimers[roomId]) {
            window.clearTimeout(sharedChatReconnectTimers[roomId]);
            delete sharedChatReconnectTimers[roomId];
        }
        var socket = sharedChatSockets[roomId];
        if (socket) {
            delete sharedChatSockets[roomId];
            try { socket.close(); } catch (error) {}
        }
    }

    function closeSharedChatSockets() {
        Object.keys(sharedChatSockets).forEach(closeSharedChatSocket);
    }

    function handleSharedChatSocketMessage(userId, roomId, raw) {
        var payload = null;
        try {
            payload = JSON.parse(String(raw || ""));
        } catch (error) {
            return;
        }
        if (!payload || payload.type === "ready") return;
        if (payload.type === "read") {
            applySharedChatReadUpdate(payload);
            try {
                window.dispatchEvent(new CustomEvent("groupware:chat-read", { detail: payload }));
            } catch (error) {}
            return;
        }
        if (payload.type !== "message" || !payload.item) return;
        applySharedChatMessageUpdate(userId, roomId, payload.item, payload.room);
    }

    function applySharedChatReadUpdate(payload) {
        var roomId = String(payload && payload.roomId || payload && payload.room && payload.room.id || "").trim();
        var userId = String(payload && payload.userId || "").trim().toLowerCase();
        var readAt = String(payload && payload.readAt || "").trim();
        if (!roomId || !userId) return;
        sharedChatRooms = sharedChatRooms.map(function (room) {
            if (!room || room.id !== roomId) return room;
            var next = Object.assign({}, room);
            next.lastReadBy = Object.assign({}, next.lastReadBy || {}, payload.room && payload.room.lastReadBy || {});
            next.unreadBy = Object.assign({}, next.unreadBy || {}, payload.room && payload.room.unreadBy || {});
            next.lastReadBy[userId] = readAt || next.lastReadBy[userId] || "";
            next.unreadBy[userId] = 0;
            if (userId === String(getCurrentUserId() || "").trim().toLowerCase()) next.unreadCount = 0;
            return next;
        });
        dispatchSharedChatRooms();
    }

    function applySharedChatMessageUpdate(userId, roomId, message, room) {
        var senderId = String(message && message.senderId || "").trim().toLowerCase();
        var currentUserId = String(userId || "").trim().toLowerCase();
        var normalizedRoom = buildSharedRoomFromMessage(roomId, message, room, currentUserId);
        upsertSharedChatRoom(normalizedRoom);
        if (!String(message && message.deletedAt || "").trim() && senderId !== currentUserId) {
            maybeShowRealtimeChatNotification(normalizedRoom, currentUserId);
        }
        dispatchSharedChatRooms();
        try {
            window.dispatchEvent(new CustomEvent("groupware:chat-message", {
                detail: { message: message, room: normalizedRoom, source: "common-socket" }
            }));
        } catch (error) {}
    }

    function maybeShowRealtimeChatNotification(room, currentUserId) {
        var roomId = String(room && room.id || "").trim();
        var lastMessageAt = String(room && (room.lastMessageAt || room.updatedAt) || "").trim();
        if (!roomId || !lastMessageAt) {
            logDesktopNotificationDebug("chat notification skipped: missing room/time");
            return;
        }
        if (String(chatNotificationSeenByRoom[roomId] || "") === lastMessageAt) {
            logDesktopNotificationDebug("chat notification skipped: already seen room=" + roomId);
            return;
        }
        chatNotificationSeenByRoom[roomId] = lastMessageAt;
        writeChatNotificationSeen(currentUserId, chatNotificationSeenByRoom);
        if (Math.max(0, Number(room && room.unreadCount || 0)) <= 0) {
            logDesktopNotificationDebug("chat notification skipped: unread is zero room=" + roomId);
            return;
        }
        if (String(room && room.lastSenderId || "").trim().toLowerCase() === currentUserId) {
            logDesktopNotificationDebug("chat notification skipped: own message room=" + roomId);
            return;
        }
        showBasicChatRoomNotification(room);
    }

    function reserveChatNotificationId(notificationId) {
        var id = String(notificationId || "").trim();
        if (!id) return true;
        if (chatNotificationIssuedIds[id] || chatNotificationSeenMessageIds[id]) return false;
        var now = Date.now();
        chatNotificationIssuedIds[id] = now;
        chatNotificationSeenMessageIds[id] = now;
        Object.keys(chatNotificationIssuedIds).forEach(function (key) {
            if (now - Number(chatNotificationIssuedIds[key] || 0) > 120000) {
                delete chatNotificationIssuedIds[key];
            }
        });
        return true;
    }

    function buildSharedRoomFromMessage(roomId, message, room, currentUserId) {
        var existing = sharedChatRooms.find(function (item) { return item && item.id === roomId; }) || room || { id: roomId };
        var next = Object.assign({}, existing, room || {});
        next.id = String(next.id || roomId || message && message.roomId || "").trim();
        next.lastMessageText = String(message && message.text || next.lastMessageText || "").trim();
        next.lastMessageId = String(message && message.id || next.lastMessageId || "").trim();
        next.lastMessageAt = String(message && message.createdAt || next.lastMessageAt || next.updatedAt || "").trim();
        next.lastSenderId = String(message && message.senderId || next.lastSenderId || "").trim();
        next.lastSenderName = String(message && message.senderName || next.lastSenderName || "").trim();
        next.updatedAt = next.lastMessageAt || next.updatedAt || "";
        if (String(message && message.deletedAt || "").trim()) {
            next.unreadCount = Math.max(0, Number(room && room.unreadCount || next.unreadCount || 0));
            return next;
        }
        if (String(next.lastSenderId || "").trim().toLowerCase() === currentUserId) {
            next.unreadCount = 0;
        } else {
            next.unreadCount = Math.max(1, Number(next.unreadCount || 0));
        }
        return next;
    }

    function upsertSharedChatRoom(room) {
        if (!room || !room.id) return;
        var found = false;
        sharedChatRooms = sharedChatRooms.map(function (item) {
            if (!item || item.id !== room.id) return item;
            found = true;
            return Object.assign({}, item, room);
        });
        if (!found) sharedChatRooms.unshift(Object.assign({}, room));
        sharedChatRooms.sort(function (a, b) {
            return String(b && (b.lastMessageAt || b.updatedAt) || "").localeCompare(String(a && (a.lastMessageAt || a.updatedAt) || ""));
        });
    }

    function markChatRoomReadOverride(roomId) {
        var id = String(roomId || "").trim();
        if (!id) return;
        chatReadOverrides[id] = Date.now();
        if (lastChatUnreadCount > 0) setChatMenuUnreadBadge(Math.max(0, lastChatUnreadCount - 1));
    }

    function applyChatReadOverrides(rooms) {
        var now = Date.now();
        Object.keys(chatReadOverrides).forEach(function (roomId) {
            if (now - chatReadOverrides[roomId] > CHAT_READ_OVERRIDE_MS) {
                delete chatReadOverrides[roomId];
            }
        });
        return (Array.isArray(rooms) ? rooms : []).map(function (room) {
            var roomId = String(room && room.id || "").trim();
            if (!roomId || !chatReadOverrides[roomId]) return room;
            var next = Object.assign({}, room);
            next.unreadCount = 0;
            return next;
        });
    }

    function startChatMenuUnreadBadge() {
        logDesktopNotificationDebug("chat badge starting: isLogin=" + String(localStorage.getItem("isLogin") || "") + " userId=" + String(getCurrentUserId() || ""));
        observeChatMenuUnreadTargets();
        setChatMenuUnreadBadge(lastChatUnreadCount);
        refreshChatMenuUnreadBadge();
        if (!chatUnreadIntervalId) {
            chatUnreadIntervalId = window.setInterval(refreshChatMenuUnreadBadge, 15000);
        }
    }

    function observeChatMenuUnreadTargets() {
        if (chatUnreadObserver || !document.body || typeof MutationObserver === "undefined") return;
        chatUnreadObserver = new MutationObserver(function () {
            setChatMenuUnreadBadge(lastChatUnreadCount);
        });
        chatUnreadObserver.observe(document.body, { childList: true, subtree: true });
    }

    window.ChatMenuUnread = {
        refresh: refreshChatMenuUnreadBadge,
        set: setChatMenuUnreadBadge,
        markRead: markChatRoomReadOverride
    };

    window.WorkbenchMenuBadges = {
        refresh: refreshWorkbenchMenuBadges,
        refreshMail: refreshMailMenuBadge,
        setMailUnread: setMailMenuUnreadBadge,
        set: setWorkbenchMenuBadge
    };

    window.addEventListener("groupware:chat-message", handleGlobalChatMessageNotification);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            updateAdminMenuLinks();
            refreshWorkbenchMenuVisibility();
            redirectWorkAccountFromBlockedPage();
            applyWorkbenchRailSelection();
            bindWorkbenchSubmenuDisclosure();
            applyWorkbenchSubmenuSelection();
            bindMobileSidebarEvents();
            applyMobileBottomNavSelection();
            wrapScrollableTables(document);
            observeScrollableTables();
            startChatMenuUnreadBadge();
            startWorkbenchMenuBadges();
            startMailNotificationWatcher();
        });
    } else {
        updateAdminMenuLinks();
        refreshWorkbenchMenuVisibility();
        redirectWorkAccountFromBlockedPage();
        applyWorkbenchRailSelection();
        bindWorkbenchSubmenuDisclosure();
        applyWorkbenchSubmenuSelection();
        bindMobileSidebarEvents();
        applyMobileBottomNavSelection();
        wrapScrollableTables(document);
        observeScrollableTables();
        startChatMenuUnreadBadge();
        startWorkbenchMenuBadges();
        startMailNotificationWatcher();
    }

    function bindMobileSidebarEvents() {
        if (document.body.getAttribute("data-mobile-sidebar-ready") === "true") return;
        document.body.setAttribute("data-mobile-sidebar-ready", "true");
        var moduleSidebarCloseTimer = null;
        function closeMobileSidebar() {
            var isModuleSidebar = document.body.classList.contains("mobileModuleSidebarOpen");
            if (moduleSidebarCloseTimer) {
                clearTimeout(moduleSidebarCloseTimer);
                moduleSidebarCloseTimer = null;
            }
            document.body.classList.remove("mobileSidebarOpen");
            if (!isModuleSidebar) return;

            document.body.classList.add("mobileModuleSidebarClosing");
            moduleSidebarCloseTimer = setTimeout(function () {
                document.body.classList.remove("mobileModuleSidebarOpen");
                document.body.classList.remove("mobileModuleSidebarClosing");
                moduleSidebarCloseTimer = null;
            }, 700);
        }
        document.addEventListener("click", function (event) {
            if (!document.body.classList.contains("mobileSidebarOpen")) return;
            var target = event.target;
            var sidebar = document.querySelector(".sidebar");
            if (target && target.closest && (target.closest(".dashboardMobileMenuBtn") || target.closest(".mobileGlobalMenuBtn") || target.closest(".mobileGlobalBottomMoreBtn"))) {
                if (moduleSidebarCloseTimer) {
                    clearTimeout(moduleSidebarCloseTimer);
                    moduleSidebarCloseTimer = null;
                }
                document.body.classList.remove("mobileModuleSidebarOpen");
                document.body.classList.remove("mobileModuleSidebarClosing");
                return;
            }
            if (target && target.closest && target.closest(".mobileSubmenuToggleBtn")) return;
            if (sidebar && target && sidebar.contains(target)) {
                if (target.closest && target.closest("a[href]")) closeMobileSidebar();
                return;
            }
            closeMobileSidebar();
        });
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") closeMobileSidebar();
        });
    }

    function applyWorkbenchRailSelection() {
        var currentPath = normalizeWorkbenchPath(location.pathname || "");
        if (!currentPath) return;

        document.querySelectorAll(".workbenchAppRail .workbenchAppItem[data-workbench-item]").forEach(function (item) {
            var itemKey = String(item.getAttribute("data-workbench-item") || "").trim().toLowerCase();
            var paths = String(item.getAttribute("data-workbench-paths") || "")
                .split(/\s+/)
                .map(normalizeWorkbenchPath)
                .filter(Boolean);
            var href = normalizeWorkbenchPath(item.getAttribute("href") || "");
            if (href) paths.push(href);

            if (itemKey === "home") {
                paths.push("/index.html");
            }

            var isActive = paths.some(function (path) {
                return currentPath === path || currentPath.slice(-path.length) === path;
            });

            item.classList.toggle("is-active", isActive);
        });
    }

    function normalizeWorkbenchPath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function applyMobileBottomNavSelection() {
        var path = String(location.pathname || "/").toLowerCase();
        var url = String(location.href || "").toLowerCase();
        var activeKey = "more";
        if (path === "/" || path === "/index.html") activeKey = "home";
        else if (isMobileNavPath(path, url, "chat")) activeKey = "chat";
        else if (isMobileNavPath(path, url, "mail")) activeKey = "mail";
        else if (isMobileNavPath(path, url, "calendar")) activeKey = "calendar";

        document.querySelectorAll(".mobileGlobalBottomNav [data-mobile-nav]").forEach(function (item) {
            var isActive = String(item.getAttribute("data-mobile-nav") || "") === activeKey;
            item.classList.toggle("is-active", isActive);
        });
    }

    function isMobileNavPath(path, url, key) {
        return path.indexOf("/" + key + "/") === 0 ||
            path.indexOf("/" + key + ".html") === 0 ||
            url.indexOf("/" + key + "/") > -1 ||
            url.indexOf("/" + key + ".html") > -1;
    }

    window.addEventListener("storage", function (event) {
        if (!event.key || event.key === "userRole" || event.key === "userDepartment") {
            refreshWorkbenchMenuVisibility();
        }
        if (!event.key || event.key === "userId" || event.key === "isLogin") {
            refreshChatMenuUnreadBadge();
            refreshWorkbenchMenuBadges();
        }
    });
    window.addEventListener("focus", function () {
        refreshWorkbenchMenuVisibility();
        refreshChatMenuUnreadBadge();
        refreshWorkbenchMenuBadges();
    });
    document.addEventListener("adminShell:ready", refreshWorkbenchMenuVisibility);
    document.addEventListener("adminShell:rail-updated", refreshWorkbenchMenuVisibility);
    window.addEventListener("notifications:updated", refreshWorkbenchMenuBadges);
})();


(function(){
    if (window.AuthStore && typeof window.AuthStore.ensureSeedEmployees === "function") {
        window.AuthStore.ensureSeedEmployees();
    }

    var isLogin = localStorage.getItem("isLogin");
    var path = location.pathname;
    var isLoginPage = path.indexOf("login") > -1;
    var isPasswordChangePage = path.indexOf("passwordChange") > -1;

    if (isLoginPage) return;

    if (!isLogin){
        window.location.href = "/login.html";
        return;
    }

    if (localStorage.getItem("mustChangePassword") === "true" && !isPasswordChangePage) {
        window.location.href = "/passwordChange.html";
    }
})();


(function () {
    var params = new URLSearchParams(String(location.search || ""));
    if (params.get("embedded") !== "true") return;

    document.addEventListener("DOMContentLoaded", function () {
        var sidebar = document.querySelector(".sidebar");
        if (sidebar) sidebar.style.display = "none";
        document.body.style.paddingLeft = "0";
        document.body.style.background = "#fff";

        var style = document.createElement("style");
        style.textContent = [
            ".siteSheet{padding:0 !important;}",
            ".contents_{padding:0 !important;}",
            ".cont_flex_area{padding:0 !important;}",
            ".titleArea{display:none !important;}",
            ".approvalArea,.approvalDetailPage,.contents_,.cont_flex_area{margin:0 !important;}",
            ".approvalDetailPage{border:0 !important;padding:0 !important;}",
            ".approvalDetailPage .approvalDetailBody{padding:0 !important;}"
        ].join("");
        document.head.appendChild(style);
    });
})();


(function () {
    var NOTIFICATION_API_BASE = getGroupwareApiBase("/api/notifications");
    var NOTIFICATION_API = window.GroupwareApi;
    var state = {
        timerId: null,
        items: [],
        layerCloseTimer: null,
        notificationPollTimerId: null
    };
    var elements = {};
    var NOTIFICATION_PERMISSION_STATE_KEY = "autoneNotificationPermissionState";

    function initializeNotificationLayer() {
        logDesktopNotificationDebug("notification layer init: isLogin=" + String(localStorage.getItem("isLogin") || "") + " userId=" + String(localStorage.getItem("userId") || ""));
        applyAccountMenuSelection();
        cacheNotificationElements();
        bindNotificationLayerEvents();
        bindDesktopNotificationBridge();
        scheduleInitialNotificationBadgeRefresh();
        if (isDesktopNotificationBridgeAvailable()) {
            requestInitialNotificationPermission();
            startNotificationPoller();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeNotificationLayer);
    } else {
        initializeNotificationLayer();
    }

    window.addEventListener("notifications:updated", refreshNotificationBadge);
    window.addEventListener("storage", function (event) {
        if (!event.key || event.key === "userId") refreshNotificationBadge();
    });

    function scheduleInitialNotificationBadgeRefresh() {
        var schedule = window.requestIdleCallback || function (callback) {
            return window.setTimeout(callback, 1200);
        };

        schedule(function () {
            refreshNotificationBadge();
            startNotificationBadgeRefresh();
        }, { timeout: 2500 });
    }

    function applyAccountMenuSelection() {
        var currentPath = normalizeAccountPath(location.pathname || "");
        document.querySelectorAll(".accountMenu p[data-account-path]").forEach(function (item) {
            item.classList.toggle("selected", normalizeAccountPath(item.getAttribute("data-account-path") || "") === currentPath);
        });
        var homeMenuItem = document.querySelector('.accountMenu p[data-account-home="true"]');
        if (homeMenuItem) {
            homeMenuItem.classList.toggle("selected", currentPath === "/");
        }
    }

    function cacheNotificationElements() {
        elements.badge = document.querySelector(".notificationMenuBadge");
        elements.layerModal = document.querySelector(".notificationLayerModal");
        elements.layerDim = document.querySelector(".notificationLayerDim");
        elements.layerClose = document.querySelector(".notificationLayerClose");
        elements.layerList = document.querySelector(".notificationLayerList");
        elements.detailModal = document.querySelector(".notificationDetailModal");
        elements.detailDim = document.querySelector(".notificationDetailDim");
        elements.detailClose = document.querySelector(".notificationDetailClose");
        elements.detailFrame = document.querySelector(".notificationDetailFrame");
        ensureNotificationLayerActions();
        elements.layerReadAll = document.querySelector(".notificationLayerReadAll");
        elements.layerDeleteAll = document.querySelector(".notificationLayerDeleteAll");
    }

    function bindNotificationLayerEvents() {
        [elements.layerDim, elements.layerClose].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeNotificationLayer);
        });
        if (elements.layerReadAll) elements.layerReadAll.addEventListener("click", markAllNotificationsRead);
        if (elements.layerDeleteAll) elements.layerDeleteAll.addEventListener("click", deleteAllNotifications);
        [elements.detailDim, elements.detailClose].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeNotificationDetail);
        });
    }

    function ensureNotificationLayerActions() {
        var head = document.querySelector(".notificationLayerHead");
        if (!head || head.querySelector(".notificationLayerActions")) return;
        var actions = document.createElement("div");
        actions.className = "notificationLayerActions";
        actions.innerHTML = ''
            + '<button type="button" class="notificationLayerActionBtn notificationLayerReadAll">전체 읽음</button>'
            + '<button type="button" class="notificationLayerActionBtn notificationLayerDeleteAll">전체 삭제</button>';
        head.appendChild(actions);
    }

    function startNotificationBadgeRefresh() {
        if (state.timerId) clearInterval(state.timerId);
        state.timerId = setInterval(refreshNotificationBadge, 60000);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) refreshNotificationBadge();
        });
    }

    async function refreshNotificationBadge() {
        var badge = elements.badge || document.querySelector(".notificationMenuBadge");
        if (!badge) return;

        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) {
            badge.hidden = true;
            badge.textContent = "0";
            return;
        }

        try {
            var query = "?userId=" + encodeURIComponent(userId);
            var data = await NOTIFICATION_API.get(NOTIFICATION_API_BASE + "/count" + query, null, { errorMessage: "알림 개수를 불러오지 못했습니다." });
            var unreadCount = Number(data.unreadCount || 0);
            badge.hidden = unreadCount <= 0;
            badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        } catch (error) {
            badge.hidden = true;
        }
    }

    function getNotificationBaselineKey(userId) {
        return "autoneSystemNotificationBaseline:" + String(userId || "").trim().toLowerCase();
    }

    function getNotificationSeenIdsKey(userId) {
        return "autoneSystemNotificationSeenIds:" + String(userId || "").trim().toLowerCase();
    }

    function getStoredNotificationBaseline(userId) {
        var raw = Number(localStorage.getItem(getNotificationBaselineKey(userId)) || "0");
        return Number.isFinite(raw) ? raw : 0;
    }

    function setStoredNotificationBaseline(userId, value) {
        if (!userId) return;
        localStorage.setItem(getNotificationBaselineKey(userId), String(Math.max(0, Number(value || 0))));
    }

    function getStoredNotificationSeenIds(userId) {
        try {
            var raw = localStorage.getItem(getNotificationSeenIdsKey(userId));
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function setStoredNotificationSeenIds(userId, ids) {
        if (!userId) return;
        var uniqueIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(function (item) {
            return String(item || "").trim();
        }).filter(Boolean))).slice(-100);
        localStorage.setItem(getNotificationSeenIdsKey(userId), JSON.stringify(uniqueIds));
    }

    function getNotificationTimeValue(item) {
        var date = new Date(String(item && item.createdAt || ""));
        var time = date.getTime();
        return Number.isFinite(time) ? time : 0;
    }

    function isDesktopNotificationBridgeAvailable() {
        return !!(window.groupwareDesktop && typeof window.groupwareDesktop.showNotification === "function");
    }

    function logDesktopNotificationDebug(message) {
        try {
            if (window.groupwareDesktop && typeof window.groupwareDesktop.debugLog === "function") {
                window.groupwareDesktop.debugLog(message);
            }
        } catch (error) {}
    }

    function bindDesktopNotificationBridge() {
        if (!window.groupwareDesktop || typeof window.groupwareDesktop.onNotificationOpen !== "function") return;
        window.groupwareDesktop.onNotificationOpen(function (payload) {
            var url = typeof payload === "string"
                ? String(payload || "").trim()
                : String(payload && payload.url || "").trim();
            if (!url) return;
            try {
                window.focus();
            } catch (error) {}
            location.href = url;
        });
    }

    function canRequestBrowserNotificationPermission() {
        return false;
    }

    function canRequestDesktopNotificationPermission() {
        return !!(window.groupwareDesktop && typeof window.groupwareDesktop.requestNotificationPermission === "function");
    }

    function getStoredNotificationPermissionState() {
        return String(localStorage.getItem(NOTIFICATION_PERMISSION_STATE_KEY) || "").trim().toLowerCase();
    }

    function setStoredNotificationPermissionState(state) {
        var normalized = String(state || "").trim().toLowerCase();
        if (!normalized) return;
        localStorage.setItem(NOTIFICATION_PERMISSION_STATE_KEY, normalized);
    }

    async function requestNotificationPermission() {
        if (canRequestDesktopNotificationPermission()) {
            try {
                var desktopPermission = await window.groupwareDesktop.requestNotificationPermission();
                var normalizedDesktopPermission = String(desktopPermission || "").trim().toLowerCase();
                if (normalizedDesktopPermission === "granted") {
                    setStoredNotificationPermissionState("granted");
                    refreshNotificationBadge();
                    pollSystemNotifications();
                } else if (normalizedDesktopPermission === "denied") {
                    setStoredNotificationPermissionState("denied");
                }
                return normalizedDesktopPermission || "unknown";
            } catch (error) {
                return "error";
            }
        }
        return "unsupported";
    }

    function requestInitialNotificationPermission() {
        if (!isDesktopNotificationBridgeAvailable()) return;
        var storedState = getStoredNotificationPermissionState();
        if (!canRequestDesktopNotificationPermission() && (storedState === "granted" || storedState === "denied")) return;
        window.setTimeout(function () {
            requestNotificationPermission();
        }, 900);
    }

    function showSystemNotification(item) {
        if (!item || !item.id) return;
        var notificationType = String(item.type || "").trim().toLowerCase();
        if (notificationType === "chat_message") {
            logDesktopNotificationDebug("system notification skipped: chat message id=" + String(item.id || ""));
            return;
        }
        var approvalPayload = buildApprovalSystemNotificationPayload(item);
        var title = String(approvalPayload && approvalPayload.title || item.title || "새 알림").trim() || "새 알림";
        var isApprovalNotification = notificationType.indexOf("approval_") === 0;
        var isCalendarNotification = notificationType.indexOf("calendar_") === 0;
        var isTitleOnlyNotification = false;
        var body = isTitleOnlyNotification ? "" : String(approvalPayload && approvalPayload.body || item.body || renderNotificationMeta(item) || "").trim();
        var link = String(item.link || "/index.html").trim() || "/index.html";

        if (isDesktopNotificationBridgeAvailable()) {
            try {
                logDesktopNotificationDebug("system notification requested: id=" + String(item.id || "") + " type=" + String(item.type || ""));
                var desktopResult = window.groupwareDesktop.showNotification({
                    title: title,
                    body: body,
                    url: link,
                    tag: "notification-" + String(item.id || ""),
                    notificationId: String(item.id || ""),
                    type: String(item.type || ""),
                    titleOnly: isTitleOnlyNotification
                });
                if (desktopResult && typeof desktopResult.catch === "function") {
                    desktopResult.catch(function () {});
                }
            } catch (error) {}
            return;
        }

        logDesktopNotificationDebug("system notification skipped: desktop bridge unavailable");
    }

    function buildApprovalSystemNotificationPayload(item) {
        var normalized = String(item && item.type || "").trim().toLowerCase();
        if (normalized.indexOf("approval_") !== 0) return null;
        var docLabel = getApprovalNotificationDocLabel(item);
        var actorName = getApprovalNotificationActorName(item);
        if (normalized === "approval_pending") {
            return {
                title: "새 전자결재 문서 알림",
                body: "1개의 " + docLabel + " 문서가 결재 대기함에 도착했습니다."
            };
        }
        if (normalized === "approval_reference") {
            return {
                title: "[" + docLabel + "] 참조 문서 도착",
                body: (actorName || "직원") + "님이 1개의 참조 문서를 공유하였습니다."
            };
        }
        if (normalized === "approval_approved") {
            return {
                title: "[" + docLabel + "] 승인 완료 알림",
                body: "상신한 기안에 대한 승인이 완료되었습니다."
            };
        }
        if (normalized === "approval_rejected") {
            return {
                title: "[" + docLabel + "] 반려 알림",
                body: "상신한 기안이 반려되었습니다. 반려 사유를 확인하세요."
            };
        }
        return null;
    }

    function getApprovalNotificationDocLabel(item) {
        var direct = String(item && item.docLabel || "").trim();
        if (direct) return direct;
        var body = String(item && item.body || "").trim();
        var metaMatch = body.match(/전자결재\s*[·-]\s*(.+)$/);
        if (metaMatch && metaMatch[1]) return metaMatch[1].trim();
        var title = String(item && item.title || "").trim();
        var bracketMatch = title.match(/^\[([^\]]+)\]/);
        if (bracketMatch && bracketMatch[1]) return bracketMatch[1].trim();
        return "결재 문서";
    }

    function getApprovalNotificationActorName(item) {
        var actorName = String(item && item.actorName || "").trim();
        if (actorName) return actorName;
        var title = String(item && item.title || "").trim();
        var nameMatch = title.match(/^(.+?)님(?:이|께서)?\s/);
        return nameMatch && nameMatch[1] ? nameMatch[1].trim() : "";
    }

    async function pollSystemNotifications() {
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) {
            logDesktopNotificationDebug("system notification poll skipped: no userId");
            return;
        }
        if (!isDesktopNotificationBridgeAvailable()) {
            logDesktopNotificationDebug("system notification poll skipped: no permission or bridge");
            return;
        }

        try {
            var query = "?userId=" + encodeURIComponent(userId);
            var data = await NOTIFICATION_API.get(NOTIFICATION_API_BASE + query, null, { errorMessage: "알림을 불러오지 못했습니다." });
            var items = Array.isArray(data.items) ? data.items : [];
            if (!items.length) {
                logDesktopNotificationDebug("system notification poll: no items");
                return;
            }

            var baseline = getStoredNotificationBaseline(userId);
            var newest = baseline;
            var seenIds = getStoredNotificationSeenIds(userId);
            var nextSeenIds = seenIds.slice();
            var shownCount = 0;

            items.forEach(function (item) {
                if (!item || !item.id) return;
                var createdAt = getNotificationTimeValue(item);
                if (createdAt > newest) newest = createdAt;
                if (item.read === true) return;
                if (seenIds.indexOf(String(item.id)) > -1) return;
                if (!seenIds.length && baseline > 0 && createdAt <= baseline) return;
                nextSeenIds.push(String(item.id));
                shownCount += 1;
                showSystemNotification(item);
            });
            logDesktopNotificationDebug("system notification poll: items=" + items.length + " shown=" + shownCount);

            if (newest > baseline) {
                setStoredNotificationBaseline(userId, newest);
            }
            if (nextSeenIds.length !== seenIds.length) {
                setStoredNotificationSeenIds(userId, nextSeenIds);
            }
        } catch (error) {
            logDesktopNotificationDebug("system notification poll failed: " + String(error && (error.message || error) || ""));
        }
    }

    function startNotificationPoller() {
        if (!isDesktopNotificationBridgeAvailable()) return;
        if (state.notificationPollTimerId) clearInterval(state.notificationPollTimerId);
        window.setTimeout(pollSystemNotifications, 1200);
        window.setTimeout(pollSystemNotifications, 7000);
        state.notificationPollTimerId = setInterval(pollSystemNotifications, 10000);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) pollSystemNotifications();
        });
        window.addEventListener("notifications:updated", pollSystemNotifications);
        window.addEventListener("focus", pollSystemNotifications);
    }

    async function openNotificationLayer() {
        if (!elements.layerModal) return;
        await loadNotifications();
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (userId && state.items.length) {
            var latestTime = state.items.reduce(function (latest, item) {
                var createdAt = getNotificationTimeValue(item);
                return createdAt > latest ? createdAt : latest;
            }, 0);
            if (latestTime > getStoredNotificationBaseline(userId)) {
                setStoredNotificationBaseline(userId, latestTime);
            }
            setStoredNotificationSeenIds(userId, state.items.map(function (item) {
                return item && item.id;
            }));
        }
        renderNotificationLayer();
        if (state.layerCloseTimer) {
            window.clearTimeout(state.layerCloseTimer);
            state.layerCloseTimer = null;
        }
        elements.layerModal.classList.remove("is-closing", "is-open");
        elements.layerModal.style.display = "block";
        document.documentElement.classList.add("notificationLayerOpen");
        document.body.classList.add("notificationLayerOpen");
        window.requestAnimationFrame(function () {
            if (!elements.layerModal) return;
            elements.layerModal.classList.add("is-open");
        });
    }

    function closeNotificationLayer() {
        if (!elements.layerModal) return;
        if (state.layerCloseTimer) window.clearTimeout(state.layerCloseTimer);
        elements.layerModal.classList.remove("is-open");
        elements.layerModal.classList.add("is-closing");
        state.layerCloseTimer = window.setTimeout(function () {
            if (!elements.layerModal) return;
            elements.layerModal.style.display = "none";
            elements.layerModal.classList.remove("is-closing");
            document.documentElement.classList.remove("notificationLayerOpen");
            document.body.classList.remove("notificationLayerOpen");
            state.layerCloseTimer = null;
        }, 320);
    }

    function openNotificationDetail(link) {
        if (!link) return;
        closeNotificationLayer();
        closeNotificationDetail();
        location.href = link;
    }

    function closeNotificationDetail() {
        if (!elements.detailModal || !elements.detailFrame) return;
        elements.detailModal.style.display = "none";
        elements.detailFrame.src = "about:blank";
        document.documentElement.classList.remove("notificationDetailOpen");
        document.body.classList.remove("notificationDetailOpen");
    }

    async function loadNotifications() {
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) {
            state.items = [];
            return;
        }

        try {
            var query = "?userId=" + encodeURIComponent(userId);
            var data = await NOTIFICATION_API.get(NOTIFICATION_API_BASE + query, null, { errorMessage: "알림을 불러오지 못했습니다." });
            state.items = filterGlobalNotifications(Array.isArray(data.items) ? data.items : []);
        } catch (error) {
            state.items = [];
            if (elements.layerList) {
                elements.layerList.innerHTML = '<div class="notificationLayerEmpty">알림을 불러오지 못했습니다.</div>';
            }
        }
    }

    function renderNotificationLayer() {
        if (!elements.layerList) return;
        if (!state.items.length) {
            elements.layerList.innerHTML = '<div class="notificationLayerEmpty">표시할 알림이 없습니다.</div>';
            return;
        }

        elements.layerList.innerHTML = state.items.map(function (item) {
            return ''
                + '<button type="button" class="notificationLayerCard' + (item && item.read === true ? '' : ' is-unread') + '" data-notification-id="' + escapeHtml(item && item.id || '') + '" data-notification-link="' + escapeHtml(item && item.link || '') + '">'
                + '<div class="notificationLayerCardInner">'
                + '<div class="notificationLayerCardMain">'
                + '<div class="notificationLayerCardTitleRow">'
                + '<span class="notificationLayerCardMenu">' + escapeHtml(formatNotificationMenuName(item && item.type)) + '</span>'
                + '<span class="notificationLayerCardTitle">' + renderNotificationTitle(item) + '</span>'
                + '</div>'
                + '<span class="notificationLayerCardMeta">' + renderNotificationMeta(item) + '</span>'
                + '</div>'
                + '<span class="notificationLayerCardTime">' + escapeHtml(formatRelativeTime(item && item.createdAt)) + '</span>'
                + '</div>'
                + '</button>';
        }).join("");

        Array.prototype.slice.call(elements.layerList.querySelectorAll("[data-notification-id]")).forEach(function (button) {
            button.addEventListener("click", function () {
                openNotificationItem(
                    String(button.getAttribute("data-notification-id") || "").trim(),
                    String(button.getAttribute("data-notification-link") || "").trim()
                );
            });
        });
    }

    function filterGlobalNotifications(items) {
        return Array.isArray(items) ? items : [];
    }

    async function openNotificationItem(id, link) {
        if (!id) return;
        await markNotificationsRead([id]);
        renderNotificationLayer();
        refreshNotificationBadge();
        if (link) openNotificationDetail(link);
    }

    async function markNotificationsRead(ids) {
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId || !Array.isArray(ids) || !ids.length) return;
        try {
            await NOTIFICATION_API.post(NOTIFICATION_API_BASE + "/read", { userId: userId, ids: ids }, { errorMessage: "알림 읽음 처리에 실패했습니다." });
            state.items = state.items.map(function (item) {
                if (ids.indexOf(String(item && item.id || "")) === -1) return item;
                return Object.assign({}, item, { read: true });
            });
            emitNotificationsUpdated();
        } catch (error) {
        }
    }

    async function markAllNotificationsRead(event) {
        if (event) event.stopPropagation();
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) return;
        try {
            await NOTIFICATION_API.post(NOTIFICATION_API_BASE + "/read-all", { userId: userId }, { errorMessage: "전체 읽음 처리에 실패했습니다." });
            state.items = state.items.map(function (item) {
                return Object.assign({}, item, { read: true });
            });
            renderNotificationLayer();
            refreshNotificationBadge();
            emitNotificationsUpdated();
        } catch (error) {
            alert(error.message || "전체 읽음 처리에 실패했습니다.");
        }
    }

    async function deleteAllNotifications(event) {
        if (event) event.stopPropagation();
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) return;
        if (!confirm("알림을 모두 삭제할까요?")) return;
        try {
            await NOTIFICATION_API.post(NOTIFICATION_API_BASE + "/delete-all", { userId: userId }, { errorMessage: "전체 삭제에 실패했습니다." });
            state.items = [];
            renderNotificationLayer();
            refreshNotificationBadge();
            emitNotificationsUpdated();
        } catch (error) {
            alert(error.message || "전체 삭제에 실패했습니다.");
        }
    }

    function emitNotificationsUpdated() {
        if (typeof window.CustomEvent !== "function") return;
        window.dispatchEvent(new CustomEvent("notifications:updated"));
    }

    function formatNotificationMenuName(type) {
        var normalized = String(type || "").trim().toLowerCase();
        if (normalized.indexOf("approval_") === 0) return "전자결재";
        if (normalized.indexOf("teamboard_") === 0) return "팀 보드";
        return "알림";
    }

    function renderNotificationTitle(item) {
        var normalized = String(item && item.type || "").trim().toLowerCase();
        var actorName = String(item && item.actorName || "").trim();
        var actionLabel = String(item && item.actionLabel || "").trim();
        if (normalized === "approval_pending" && actorName) {
            return '<strong>' + escapeHtml(actorName) + '</strong>님이 <strong>' + escapeHtml(actionLabel || "결재 승인") + '</strong>을 요청하였습니다.';
        }
        return escapeHtml(item && item.title || "알림");
    }

    function renderNotificationMeta(item) {
        var normalized = String(item && item.type || "").trim().toLowerCase();
        var menuLabel = String(item && item.menuLabel || "").trim();
        var docLabel = String(item && item.docLabel || "").trim();
        if (normalized.indexOf("approval_") === 0) {
            return escapeHtml((menuLabel || "전자결재") + " · " + (docLabel || "문서"));
        }
        if (normalized.indexOf("teamboard_") === 0) {
            return escapeHtml((menuLabel || "팀 보드") + " · " + (docLabel || "팀"));
        }
        return escapeHtml(item && item.body || "");
    }

    function formatRelativeTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        var diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
        if (diffMinutes < 1) return "지금";
        if (diffMinutes < 60) return diffMinutes + "분 전";
        var diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return diffHours + "시간 전";
        var today = new Date();
        var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var dayDiff = Math.round((startOfToday.getTime() - target.getTime()) / 86400000);
        if (dayDiff === 1) return "어제";
        return String(date.getMonth() + 1) + "월 " + String(date.getDate()) + "일";
    }

    function padNotificationValue(value) {
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

    function normalizeAccountPath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    window.NotificationLayer = {
        open: openNotificationLayer,
        close: closeNotificationLayer,
        refreshBadge: refreshNotificationBadge
    };
})();


(function () {
    var API_BASE = getGroupwareApiBase("/api/attendance");
    var state = {
        userId: "",
        userName: "",
        userEmail: "",
        userTeam: "",
        records: []
    };
    var elements = {};

    function getCurrentPageName() {
        var path = String(location.pathname || "").split("?")[0].split("#")[0];
        var segments = path.split("/");
        return String(segments[segments.length - 1] || "").trim().toLowerCase();
    }

    function normalizeMenuPath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function isSameMenuPath(currentPath, hrefPath) {
        if (!currentPath || !hrefPath) return false;
        if (currentPath === hrefPath) return true;
        return currentPath.slice(-hrefPath.length) === hrefPath;
    }

    function applyAttendanceMenuSelection() {
        var currentPageName = getCurrentPageName();
        var currentPath = normalizeMenuPath(location.pathname || "");
        if (!currentPageName && !currentPath) return;

        document.querySelectorAll(".subMenu p").forEach(function (item) {
            item.classList.remove("selected");
        });

        document.querySelectorAll(".subMenu p > a[href]").forEach(function (link) {
            var href = String(link.getAttribute("href") || "").split("?")[0].split("#")[0].trim().toLowerCase();
            if (!href || href !== currentPageName) return;

            var item = link.closest("p");
            if (item) item.classList.add("selected");
        });

        document.querySelectorAll(".gnbMenu p, .gnbMenu .myMailItem").forEach(function (item) {
            item.classList.remove("selected");
        });

        document.querySelectorAll(".gnbMenu a[href]").forEach(function (link) {
            var href = normalizeMenuPath(link.getAttribute("href") || "");
            if (!href) return;
            if (!isSameMenuPath(currentPath, href)) return;

            var item = link.closest(".myMailItem") || link.closest("p");
            if (item) item.classList.add("selected");
        });
    }

    function cacheAttendanceElements() {
        elements.name = document.querySelector(".w_name");
        elements.team = document.querySelector(".belong");
        elements.todayDate = document.querySelector(".todayDate");
        elements.checkIn = document.querySelector(".atteTime");
        elements.checkOut = document.querySelector(".leaveTime");
        elements.checkInBtn = document.querySelector(".stateBtn button:first-child");
        elements.checkOutBtn = document.querySelector(".stateBtn button:last-child");
    }

    function hasAttendanceWidget() {
        return !!(elements.todayDate || elements.checkIn || elements.checkOut || elements.checkInBtn || elements.checkOutBtn);
    }

    function ensureAttendanceUser() {
        state.userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        state.userName = String(localStorage.getItem("userName") || "").trim();
        state.userEmail = String(localStorage.getItem("userEmail") || "").trim().toLowerCase();
        state.userTeam = String(localStorage.getItem("userDepartment") || localStorage.getItem("userTeam") || "").trim();
        return !!(state.userId || state.userEmail || state.userName);
    }

    function buildAttendanceUserPayload() {
        return {
            userId: state.userId,
            userName: state.userName,
            userEmail: state.userEmail
        };
    }

    function syncResolvedAttendanceUser(data) {
        var resolvedUserId = String(data && data.userId || "").trim().toLowerCase();
        if (!resolvedUserId || resolvedUserId === state.userId) return;
        state.userId = resolvedUserId;
        localStorage.setItem("userId", resolvedUserId);
    }

    async function initializeAttendanceWidget() {
        cacheAttendanceElements();
        if (!hasAttendanceWidget()) return;
        if (!ensureAttendanceUser()) return;

        renderAttendanceIdentity();
        bindAttendanceEvents();
        updateAttendanceDate();
        await loadAttendanceRecords();
        renderAttendanceWidget();
    }

    function renderAttendanceIdentity() {
        if (elements.name) elements.name.textContent = state.userName || state.userId || "-";
        if (elements.team) elements.team.textContent = state.userTeam || "부서 미지정";
    }

    function bindAttendanceEvents() {
        if (elements.checkInBtn && !elements.checkInBtn.dataset.bound) {
            elements.checkInBtn.dataset.bound = "true";
            elements.checkInBtn.addEventListener("click", handleAttendanceCheckIn);
        }
        if (elements.checkOutBtn && !elements.checkOutBtn.dataset.bound) {
            elements.checkOutBtn.dataset.bound = "true";
            elements.checkOutBtn.addEventListener("click", handleAttendanceCheckOut);
        }
    }

    async function loadAttendanceRecords() {
        try {
            var data = await API.get(API_BASE + "/my", buildAttendanceUserPayload(), { errorMessage: "근태 정보를 불러오지 못했습니다." });
            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
        } catch (error) {
            state.records = [];
        }
    }

    async function handleAttendanceCheckIn() {
        var todayRecord = getTodayAttendanceRecord();
        if (todayRecord && todayRecord.checkIn) {
            alert("이미 출근 처리되었습니다.");
            return;
        }

        try {
            setAttendanceButtonsDisabled(true);
            var data = await API.post(API_BASE + "/check-in", {
                userId: state.userId,
                userName: state.userName,
                userEmail: state.userEmail
            }, { errorMessage: "출근 처리에 실패했습니다." });

            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
            renderAttendanceWidget();
            alert("출근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "출근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons();
        }
    }

    async function handleAttendanceCheckOut() {
        var todayRecord = getTodayAttendanceRecord();
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
            var data = await API.post(API_BASE + "/check-out", {
                userId: state.userId,
                userName: state.userName,
                userEmail: state.userEmail
            }, { errorMessage: "퇴근 처리에 실패했습니다." });

            syncResolvedAttendanceUser(data);
            state.records = Array.isArray(data.items) ? data.items : [];
            renderAttendanceWidget();
            alert("퇴근 처리되었습니다.");
        } catch (error) {
            alert(error.message || "퇴근 처리 중 오류가 발생했습니다.");
        } finally {
            syncAttendanceButtons();
        }
    }

    function updateAttendanceDate() {
        if (!elements.todayDate) return;
        elements.todayDate.textContent = formatAttendanceLongDate(new Date());
    }

    function renderAttendanceWidget() {
        var todayRecord = getTodayAttendanceRecord();
        if (elements.checkIn) elements.checkIn.textContent = todayRecord && todayRecord.checkIn ? formatAttendanceTime(todayRecord.checkIn) : "-";
        if (elements.checkOut) elements.checkOut.textContent = todayRecord && todayRecord.checkOut ? formatAttendanceTime(todayRecord.checkOut) : "-";
        syncAttendanceButtons();
        emitAttendanceUpdated();
    }

    function syncAttendanceButtons() {
        var todayRecord = getTodayAttendanceRecord();
        var canCheckIn = !(todayRecord && todayRecord.checkIn);
        var canCheckOut = !!(todayRecord && todayRecord.checkIn) && !(todayRecord && todayRecord.checkOut);

        if (elements.checkInBtn) {
            elements.checkInBtn.disabled = !canCheckIn;
            elements.checkInBtn.classList.toggle("on", canCheckIn);
        }
        if (elements.checkOutBtn) {
            elements.checkOutBtn.disabled = !canCheckOut;
            elements.checkOutBtn.classList.toggle("on", canCheckOut);
        }
    }

    function setAttendanceButtonsDisabled(disabled) {
        if (elements.checkInBtn) elements.checkInBtn.disabled = disabled;
        if (elements.checkOutBtn) elements.checkOutBtn.disabled = disabled;
    }

    function getTodayAttendanceRecord() {
        var todayKey = formatAttendanceDateKey(new Date());
        return state.records.find(function (item) {
            return item && item.date === todayKey;
        }) || null;
    }

    function formatAttendanceDateKey(date) {
        return date.getFullYear() + "-" + padAttendance(date.getMonth() + 1) + "-" + padAttendance(date.getDate());
    }

    function formatAttendanceTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return padAttendance(date.getHours()) + ":" + padAttendance(date.getMinutes());
    }

    function formatAttendanceLongDate(date) {
        var days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        return date.getFullYear() + "년 " + padAttendance(date.getMonth() + 1) + "월 " + padAttendance(date.getDate()) + "일 " + days[date.getDay()];
    }

    function padAttendance(value) {
        return String(value).padStart(2, "0");
    }

    function emitAttendanceUpdated() {
        if (typeof window.CustomEvent !== "function") return;
        window.dispatchEvent(new CustomEvent("attendance:updated", {
            detail: {
                records: state.records.slice()
            }
        }));
    }

document.addEventListener("DOMContentLoaded", function () {
        applyAttendanceMenuSelection();
        initializeAttendanceWidget();
    });
})();

(function () {
    var ORG_CHART_CONTACTS_API = getGroupwareApiBase("/api/chat/contacts");
    var ORG_CHART_API = window.GroupwareApi;
    var ORG_CHART_COMPANY_LABEL = "오토원";
    var REPRESENTATIVE_AVATAR_BACKGROUND = "#0373ef";
    var REPRESENTATIVE_AVATAR_COLOR = "#fff";
    var HOME_SIDEBAR_COLLAPSED_KEY = "homeSidebarCollapsed";
    var orgChartState = {
        loaded: false,
        loading: false,
        employees: []
    };

    function isSavedHomeSidebarCollapsed() {
        try {
            return localStorage.getItem(HOME_SIDEBAR_COLLAPSED_KEY) === "true";
        } catch (error) {
            return false;
        }
    }

    function saveHomeSidebarCollapsedState(isCollapsed) {
        try {
            localStorage.setItem(HOME_SIDEBAR_COLLAPSED_KEY, isCollapsed ? "true" : "false");
        } catch (error) {}
        document.documentElement.classList.remove("homeSidebarCollapsedInitial");
    }

    function applySavedHomeSidebarState() {
        var isCollapsed = isSavedHomeSidebarCollapsed();
        document.documentElement.classList.toggle("homeSidebarCollapsedInitial", isCollapsed);
        document.body.classList.toggle("homeSidebarCollapsed", isCollapsed);
    }

    function getProfileInitial(name) {
        var nameChars = Array.from(String(name || "").replace(/\s+/g, ""));
        if (!nameChars.length) return "나";
        return nameChars[Math.floor(nameChars.length / 2)] || "나";
    }

    function syncHomeSidebarToggleState() {
        var button = document.querySelector(".homeSidebarToggleBtn");
        if (!button) return;
        button.setAttribute("aria-expanded", String(!document.body.classList.contains("homeSidebarCollapsed")));
    }

    function toggleHomeSidebar() {
        document.body.classList.toggle("homeSidebarCollapsed");
        saveHomeSidebarCollapsedState(document.body.classList.contains("homeSidebarCollapsed"));
        syncHomeSidebarToggleState();
    }

    function getProfileAvatarColor(value) {
        if (isRepresentativeProfileValue(value)) return REPRESENTATIVE_AVATAR_BACKGROUND;
        var colors = ["#f99790", "#f3c364", "#83c0f9", "#84c9a1", "#bda5ef"];
        var source = String(value || "").trim();
        var hash = 0;
        for (var index = 0; index < source.length; index += 1) {
            hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
        }
        return colors[hash % colors.length];
    }

    function isRepresentativeProfileValue(value) {
        var source = String(value || "").trim();
        var normalized = normalizeOrgChartId(source);
        return normalized === "jschoi" ||
            normalized === "ceo" ||
            source === "최재성" ||
            source === "대표";
    }

    function escapeProfileHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function getProfileImageStorageKey() {
        var userId = String(localStorage.getItem("userId") || "guest").trim().toLowerCase();
        return "workbenchProfileImage:" + (userId || "guest");
    }

    function getSavedProfileImage() {
        return String(localStorage.getItem(getProfileImageStorageKey()) || "").trim();
    }

    function formatBirthDateForInput(value) {
        var digits = String(value || "").replace(/\D/g, "").slice(0, 8);
        if (digits.length !== 8) return "";
        return digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6, 8);
    }

    function normalizeProfileBirthDate(value) {
        return String(value || "").replace(/\D/g, "").slice(0, 8);
    }

    function formatProfileDateText(value) {
        var digits = String(value || "").replace(/\D/g, "").slice(0, 8);
        if (digits.length !== 8) return "-";
        return digits.slice(0, 4) + "." + digits.slice(4, 6) + "." + digits.slice(6, 8);
    }

    function formatProfilePhoneText(value) {
        var digits = String(value || "").replace(/\D/g, "");
        if (digits.length === 11) return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
        if (digits.length === 10) return digits.slice(0, 3) + "-" + digits.slice(3, 6) + "-" + digits.slice(6);
        return String(value || "").trim() || "-";
    }

    function formatProfilePositionText(profile) {
        var position = String(profile && profile.position || "").trim();
        var grade = String(profile && (profile.jobGrade || profile.duty || "") || "").trim();
        if (position && grade && position !== grade) return position + "(" + grade + ")";
        return position || grade || "-";
    }

    function getDefaultDownloadFolderText() {
        var saved = String(localStorage.getItem("workbenchDownloadFolder") || "").trim();
        if (saved) return saved;
        var userId = String(localStorage.getItem("userId") || "jinzero").trim() || "jinzero";
        return "/Users/" + userId + "/Downloads/";
    }

    function readProfileImageFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) {
                resolve("");
                return;
            }
            var type = String(file.type || "").toLowerCase();
            var name = String(file.name || "").toLowerCase();
            var isAllowedType = type === "image/jpeg" || type === "image/png" || /\.(jpe?g|png)$/.test(name);
            if (!isAllowedType) {
                reject(new Error("프로필 사진은 JPG, PNG 파일만 가능합니다."));
                return;
            }
            if (file.size > 1024 * 1024) {
                reject(new Error("프로필 사진은 1MB 이하만 가능합니다."));
                return;
            }
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || "")); };
            reader.onerror = function () { reject(new Error("프로필 사진을 읽지 못했습니다.")); };
            reader.readAsDataURL(file);
        });
    }

    function renderWorkbenchProfile() {
        var currentUser = window.AuthStore && typeof window.AuthStore.getCurrentUser === "function"
            ? window.AuthStore.getCurrentUser()
            : null;
        var name = String(localStorage.getItem("userName") || currentUser && currentUser.name || "").trim();
        var department = String(localStorage.getItem("userDepartment") || currentUser && currentUser.department || "").trim();
        var role = String(localStorage.getItem("userRole") || currentUser && currentUser.role || "").trim().toLowerCase();
        var profileMetaText = department || (role === "ceo" || role === "admin" ? "대표" : "");
        var avatar = document.querySelector(".workbenchProfileAvatar");
        var profileName = document.querySelector(".workbenchProfileName");
        var profileDepartment = document.querySelector(".workbenchProfileDepartment");
        var profileImage = getSavedProfileImage();

        if (avatar) {
            if (profileImage) {
                avatar.innerHTML = '<img src="' + profileImage.replace(/"/g, "&quot;") + '" alt="">';
            } else {
                var avatarKey = localStorage.getItem("userId") || currentUser && currentUser.id || name;
                var isRepresentative = isRepresentativeProfileValue(avatarKey) ||
                    isRepresentativeProfileValue(name) ||
                    role === "ceo" ||
                    department === "대표";
                avatar.style.backgroundColor = isRepresentative ? REPRESENTATIVE_AVATAR_BACKGROUND : getProfileAvatarColor(avatarKey);
                avatar.style.color = isRepresentative ? REPRESENTATIVE_AVATAR_COLOR : "#fff";
                avatar.textContent = getProfileInitial(name);
            }
        }
        if (profileName) profileName.textContent = name || "-";
        if (profileDepartment) profileDepartment.textContent = profileMetaText || "-";
        if (document.documentElement) document.documentElement.classList.add("profileAvatarReady");
    }

    function ensureWorkbenchProfileLayer() {
        var button = document.querySelector(".workbenchProfileBtn");
        if (!button || document.querySelector(".workbenchProfileLayer")) return;

        var layer = document.createElement("div");
        layer.className = "workbenchProfileLayer";
        layer.setAttribute("hidden", "hidden");
        layer.innerHTML = ''
            + '<div class="workbenchProfileLayerHead" role="dialog" aria-modal="true" aria-label="내 프로필">'
            + '<div class="workbenchProfileIdentity">'
            + '<span class="workbenchProfileLayerAvatar"></span>'
            + '<span class="workbenchProfileIdentityText">'
            + '<strong class="workbenchProfileLayerName">-</strong>'
            + '<em class="workbenchProfileLayerEmail">-</em>'
            + '</span>'
            + '</div>'
            + '<button type="button" class="workbenchProfileCloseBtn" aria-label="프로필 레이어 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</div>'
            + '<div class="workbenchProfileLayerBody">'
            + '<dl class="workbenchProfileInfoList">'
            + '<div><dt>부서</dt><dd data-profile-field="department">-</dd></div>'
            + '<div><dt>직책(직위)</dt><dd data-profile-field="position">-</dd></div>'
            + '<div><dt>사원번호</dt><dd data-profile-field="employeeNumber">-</dd></div>'
            + '<div><dt>입사일</dt><dd data-profile-field="hireDate">-</dd></div>'
            + '<div><dt>생년월일</dt><dd data-profile-field="birthDate">-</dd></div>'
            + '<div><dt>휴대전화</dt><dd data-profile-field="mobilePhone">-</dd></div>'
            + '</dl>'
            + '</div>'
            + '<p class="workbenchProfileMessage" aria-live="polite" hidden></p>'
            + '<div class="workbenchProfileLayerActions">'
            + '<button type="button" class="workbenchProfileSettingsBtn">설정</button>'
            + '<button type="button" class="workbenchProfileLogoutBtn">로그아웃</button>'
            + '</div>';

        var actions = button.closest(".sideBottomQuickActions") || button.closest(".side_bottom") || button.parentElement || document.body;
        actions.appendChild(layer);
    }

    function ensureWorkbenchSettingsLayer() {
        if (document.querySelector(".workbenchSettingsLayer")) return;
        var layer = document.createElement("div");
        layer.className = "workbenchSettingsLayer";
        layer.setAttribute("hidden", "hidden");
        layer.innerHTML = ''
            + '<div class="workbenchSettingsBox" role="dialog" aria-modal="true" aria-labelledby="workbenchSettingsTitle">'
            + '<div class="workbenchSettingsHead">'
            + '<h3 id="workbenchSettingsTitle">설정</h3>'
            + '<button type="button" class="workbenchSettingsCloseBtn" aria-label="설정 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</div>'
            + '<div class="workbenchSettingsBody">'
            + renderWorkbenchSettingsToggle("autoStart", "윈도우 시작 시 자동 실행", "윈도우가 시작되면 자동으로 잠금모드로 로그인됩니다.")
            + renderWorkbenchSettingsToggle("autoLogin", "자동 로그인 설정", "오토원워크가 실행되면 로그인 없이 자동으로 진입합니다.")
            + renderWorkbenchSettingsToggle("lockMode", "잠금모드 설정", "10분 동안 PC 미사용 시 자동으로 잠금모드로 변경됩니다.")
            + renderWorkbenchSettingsToggle("notifications", "알림 사용", "채팅의 새로운 메시지나 메일 등의 알림을 팝업으로 받습니다.")
            + '<div class="workbenchSettingsRow workbenchSettingsDownloadRow">'
            + '<span class="workbenchSettingsText"><strong>다운로드 폴더 설정</strong><em class="workbenchSettingsDownloadPath"></em></span>'
            + '<button type="button" class="workbenchSettingsFolderBtn">변경</button>'
            + '</div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(layer);
    }

    function renderWorkbenchSettingsToggle(key, title, description) {
        return '<div class="workbenchSettingsRow">'
            + '<span class="workbenchSettingsText"><strong>' + escapeProfileHtml(title) + '</strong><em>' + escapeProfileHtml(description) + '</em></span>'
            + '<label class="workbenchSettingsSwitch">'
            + '<input type="checkbox" data-workbench-setting="' + escapeProfileHtml(key) + '">'
            + '<span></span>'
            + '</label>'
            + '</div>';
    }

    function ensureSidebarQuickActions() {
        if (document.body.classList.contains("unifiedWorkbench")) return null;
        if (document.body.classList.contains("homePage")) return null;
        var sidebar = document.querySelector(".sidebar");
        if (!sidebar) return null;

        var sideBottom = sidebar.querySelector(".side_bottom");
        if (!sideBottom) return null;

        var actions = sideBottom.querySelector(".sideBottomQuickActions");
        if (!actions) {
            actions = document.createElement("div");
            actions.className = "sideBottomQuickActions";
            sideBottom.insertBefore(actions, sideBottom.firstChild);
        }

        var profileButton = document.querySelector(".workbenchProfileBtn");
        if (profileButton && profileButton.parentElement !== actions) {
            actions.appendChild(profileButton);
        }

        var orgButton = document.querySelector(".orgChartToggleBtn");
        if (orgButton && orgButton.parentElement !== actions) {
            orgButton.classList.remove("workbenchTopbarAction");
            orgButton.classList.add("sideOrgChartBtn");
            actions.insertBefore(orgButton, profileButton && profileButton.parentElement === actions ? profileButton : actions.firstChild);
        }

        if (profileButton) profileButton.setAttribute("aria-label", "내 프로필");
        if (orgButton) {
            orgButton.hidden = false;
            orgButton.style.display = "";
            orgButton.setAttribute("aria-label", "조직도 열기");
        }
        return actions;
    }

    function ensureOrgChartButton() {
        if (document.body.classList.contains("homePage")) return;
        if (document.body.classList.contains("adminPageLayout") || document.body.classList.contains("is-admin-layout")) {
            document.querySelectorAll(".orgChartToggleBtn, .orgChartLayer").forEach(function (node) {
                node.remove();
            });
            return;
        }
        var actions = ensureSidebarQuickActions() || document.querySelector(".workbenchTopbarActions");
        if (!actions) return;
        var existingButton = document.querySelector(".orgChartToggleBtn");
        if (existingButton) {
            existingButton.classList.remove("workbenchTopbarAction");
            existingButton.classList.add("sideOrgChartBtn");
            if (existingButton.parentElement !== actions) {
                actions.insertBefore(existingButton, actions.firstChild);
            }
            existingButton.hidden = false;
            existingButton.style.display = "";
            existingButton.setAttribute("aria-label", "조직도 열기");
            return;
        }
        var button = document.createElement("button");
        button.type = "button";
        button.className = "sideOrgChartBtn orgChartToggleBtn";
        button.setAttribute("aria-label", "조직도 열기");
        button.innerHTML = '<svg class="orgChartIcon" xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="currentColor" viewBox="0 0 256 256"><path d="M160,112h48a16,16,0,0,0,16-16V48a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16V64H128a24,24,0,0,0-24,24v32H72v-8A16,16,0,0,0,56,96H24A16,16,0,0,0,8,112v32a16,16,0,0,0,16,16H56a16,16,0,0,0,16-16v-8h32v32a24,24,0,0,0,24,24h16v16a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V160a16,16,0,0,0-16-16H160a16,16,0,0,0-16,16v16H128a8,8,0,0,1-8-8V88a8,8,0,0,1,8-8h16V96A16,16,0,0,0,160,112ZM56,144H24V112H56v32Zm104,16h48v48H160Zm0-112h48V96H160Z"></path></svg>';
        actions.insertBefore(button, actions.firstChild);
    }

    function ensureOrgChartLayer() {
        if (document.body.classList.contains("adminPageLayout") || document.body.classList.contains("is-admin-layout")) return;
        ensureOrgChartButton();
        var button = document.querySelector(".orgChartToggleBtn");
        if (!button || document.querySelector(".orgChartLayer")) return;

        var layer = document.createElement("div");
        layer.className = "orgChartLayer";
        layer.setAttribute("hidden", "hidden");
        layer.innerHTML = ''
            + '<div class="orgChartDim"></div>'
            + '<div class="orgChartBox" role="dialog" aria-modal="true" aria-labelledby="orgChartTitle">'
            + '<div class="orgChartHead">'
            + '<h3 id="orgChartTitle">조직도</h3>'
            + '<button type="button" class="orgChartClose" aria-label="조직도 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</div>'
            + '<div class="orgChartBody"><div class="orgChartList"></div></div>'
            + '</div>';

        document.body.appendChild(layer);
    }

    function openOrgChartLayer() {
        ensureOrgChartLayer();
        var layer = document.querySelector(".orgChartLayer");
        if (!layer) return;
        layer.hidden = false;
        layer.classList.add("is-open");
        document.documentElement.classList.add("orgChartOpen");
        document.body.classList.add("orgChartOpen");
        loadOrgChartEmployees();
        renderOrgChartLayer();
    }

    function closeOrgChartLayer() {
        var layer = document.querySelector(".orgChartLayer");
        if (!layer) return;
        layer.hidden = true;
        layer.classList.remove("is-open");
        document.documentElement.classList.remove("orgChartOpen");
        document.body.classList.remove("orgChartOpen");
    }

    async function loadOrgChartEmployees() {
        if (orgChartState.loaded || orgChartState.loading) return;
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (!userId) return;
        orgChartState.loading = true;
        renderOrgChartLayer();
        try {
            var data = await ORG_CHART_API.get(ORG_CHART_CONTACTS_API, { userId: userId }, { errorMessage: "임직원 정보를 불러오지 못했습니다." });
            var me = data.me || {
                id: userId,
                name: localStorage.getItem("userName") || userId,
                department: localStorage.getItem("userDepartment") || "",
                position: localStorage.getItem("userRole") || ""
            };
            orgChartState.employees = normalizeOrgChartEmployees([me].concat(Array.isArray(data.items) ? data.items : []));
            orgChartState.loaded = true;
        } catch (error) {
            orgChartState.error = error.message || "임직원 정보를 불러오지 못했습니다.";
        } finally {
            orgChartState.loading = false;
            renderOrgChartLayer();
        }
    }

    function renderOrgChartLayer() {
        var list = document.querySelector(".orgChartList");
        if (!list) return;
        if (orgChartState.loading) {
            list.innerHTML = '<div class="orgChartEmpty">불러오는 중입니다.</div>';
            return;
        }
        if (orgChartState.error) {
            list.innerHTML = '<div class="orgChartEmpty">' + escapeProfileHtml(orgChartState.error) + '</div>';
            return;
        }
        var employees = orgChartState.employees;
        if (!employees.length) {
            list.innerHTML = '<div class="orgChartEmpty">표시할 직원이 없습니다.</div>';
            return;
        }
        var grouped = groupOrgChartEmployees(employees);
        list.innerHTML = Object.keys(grouped).map(function (department) {
            var members = grouped[department];
            var count = department === ORG_CHART_COMPANY_LABEL ? employees.length : members.length;
            return '<section class="orgChartDepartment">'
                + '<h4>' + escapeProfileHtml(department) + ' <span>(' + count + ')</span></h4>'
                + '<div class="orgChartPeople">'
                + members.map(renderOrgChartPerson).join("")
                + '</div>'
                + '</section>';
        }).join("");
    }

    function renderOrgChartPerson(employee) {
        var name = String(employee && employee.name || employee && employee.id || "").trim();
        var meta = formatOrgChartMeta(employee);
        var image = getOrgChartProfileImage(employee);
        var avatarContent = image
            ? '<img src="' + escapeProfileHtml(image) + '" alt="">'
            : escapeProfileHtml(getProfileInitial(name));
        var isRepresentative = isOrgChartRepresentative(employee) || isRepresentativeProfileValue(name);
        var avatarStyle = "background:" + escapeProfileHtml(isRepresentative ? REPRESENTATIVE_AVATAR_BACKGROUND : getProfileAvatarColor(employee && employee.id || name)) + ";color:" + escapeProfileHtml(isRepresentative ? REPRESENTATIVE_AVATAR_COLOR : "#fff") + ";";
        return '<article class="orgChartPerson">'
            + '<span class="orgChartAvatar' + (image ? ' is-image' : '') + '" style="' + avatarStyle + '">' + avatarContent + '</span>'
            + '<span class="orgChartPersonText">'
            + '<strong>' + escapeProfileHtml(name || "-") + '</strong>'
            + '<span>' + escapeProfileHtml(meta || "-") + '</span>'
            + '</span>'
            + '</article>';
    }

    function normalizeOrgChartEmployees(items) {
        var seen = {};
        return (Array.isArray(items) ? items : []).filter(function (employee) {
            var id = normalizeOrgChartId(employee && employee.id);
            if (!employee || !id || isHiddenOrgChartEmployee(employee) || seen[id]) return false;
            seen[id] = true;
            return true;
        }).map(normalizeOrgChartEmployee).sort(compareOrgChartEmployees);
    }

    function isHiddenOrgChartEmployee(employee) {
        var id = normalizeOrgChartId(employee && employee.id);
        var name = String(employee && employee.name || "").trim();
        var email = String(employee && employee.email || "").trim().toLowerCase();
        return id === "admin"
            || id === "work"
            || id === "test"
            || /^test/i.test(id)
            || name === "관리자"
            || name === "홍길동"
            || email === "admin@autone.co.kr"
            || /^test@/i.test(email);
    }

    function normalizeOrgChartEmployee(employee) {
        var next = Object.assign({}, employee || {});
        if (isOrgChartRepresentative(next)) {
            next.department = ORG_CHART_COMPANY_LABEL;
            next.position = "대표";
            next.jobGrade = "";
        }
        return next;
    }

    function groupOrgChartEmployees(employees) {
        return employees.reduce(function (groups, employee) {
            var department = getOrgChartDepartment(employee);
            if (!groups[department]) groups[department] = [];
            groups[department].push(employee);
            return groups;
        }, {});
    }

    function compareOrgChartEmployees(a, b) {
        var deptCompare = compareOrgChartDepartments(getOrgChartDepartment(a), getOrgChartDepartment(b));
        if (deptCompare) return deptCompare;
        var rankCompare = getOrgChartRank(a) - getOrgChartRank(b);
        if (rankCompare) return rankCompare;
        return String(a && a.name || "").localeCompare(String(b && b.name || ""), "ko");
    }

    function compareOrgChartDepartments(a, b) {
        if (a === ORG_CHART_COMPANY_LABEL && b !== ORG_CHART_COMPANY_LABEL) return -1;
        if (b === ORG_CHART_COMPANY_LABEL && a !== ORG_CHART_COMPANY_LABEL) return 1;
        return String(a || "").localeCompare(String(b || ""), "ko");
    }

    function getOrgChartDepartment(employee) {
        var department = String(employee && employee.department || "").trim();
        return department || ORG_CHART_COMPANY_LABEL;
    }

    function formatOrgChartMeta(employee) {
        if (isOrgChartRepresentative(employee)) return "대표";
        var position = String(employee && employee.position || "").trim();
        var grade = String(employee && (employee.jobGrade || employee.duty || "") || "").trim();
        if (position && grade && position !== grade) return position + "(" + grade + ")";
        return position || grade || String(employee && employee.email || "").trim();
    }

    function getOrgChartRank(employee) {
        if (isOrgChartRepresentative(employee)) return 0;
        var role = String(employee && employee.role || "").trim().toLowerCase();
        var position = String(employee && employee.position || "").trim();
        var grade = String(employee && (employee.jobGrade || employee.duty || "") || "").trim();
        var combined = (position + " " + grade).trim();
        if (role === "ceo" || combined.indexOf("대표") > -1) return 0;
        if (combined.indexOf("부사장") > -1) return 10;
        if (combined.indexOf("전무") > -1) return 20;
        if (combined.indexOf("상무") > -1) return 30;
        if (combined.indexOf("이사") > -1) return 40;
        if (combined.indexOf("실장") > -1) return 50;
        if (combined.indexOf("팀장") > -1) return 60;
        if (combined.indexOf("부장") > -1) return 70;
        if (combined.indexOf("차장") > -1) return 80;
        if (combined.indexOf("과장") > -1) return 90;
        if (combined.indexOf("대리") > -1) return 100;
        if (combined.indexOf("주임") > -1 || combined.indexOf("선임") > -1) return 110;
        if (combined.indexOf("사원") > -1 || combined.indexOf("팀원") > -1) return 120;
        return 999;
    }

    function isOrgChartRepresentative(employee) {
        var id = normalizeOrgChartId(employee && employee.id);
        var email = String(employee && employee.email || "").trim().toLowerCase();
        return id === "jschoi" || email === "jschoi@autonecar.kr";
    }

    function normalizeOrgChartId(value) {
        return String(value || "").trim().toLowerCase();
    }

    function getOrgChartProfileImage(employee) {
        return String(employee && (employee.profileImage || employee.profilePhoto || employee.photoUrl || employee.avatarData || employee.avatarUrl) || "").trim();
    }

    function setWorkbenchProfileMessage(message, isError) {
        var messageNode = document.querySelector(".workbenchProfileMessage");
        if (!messageNode) return;
        var text = String(message || "").trim();
        messageNode.textContent = text;
        messageNode.hidden = !text;
        messageNode.classList.toggle("is-error", isError === true);
    }

    async function fillWorkbenchProfileLayer() {
        setWorkbenchProfileMessage("", false);
        var currentUser = window.AuthStore && typeof window.AuthStore.getCurrentUser === "function"
            ? window.AuthStore.getCurrentUser()
            : null;
        renderWorkbenchProfileLayerDetails(currentUser || {});

        if (!window.AuthStore || typeof window.AuthStore.getOwnProfile !== "function") {
            return;
        }
        try {
            var profile = await window.AuthStore.getOwnProfile();
            renderWorkbenchProfileLayerDetails(profile || currentUser || {});
        } catch (error) {
            setWorkbenchProfileMessage(error.message || "프로필 정보를 불러오지 못했습니다.", true);
        }
    }

    function renderWorkbenchProfileLayerDetails(profile) {
        profile = profile || {};
        var currentUser = window.AuthStore && typeof window.AuthStore.getCurrentUser === "function"
            ? window.AuthStore.getCurrentUser()
            : null;
        var name = String(profile.name || localStorage.getItem("userName") || currentUser && currentUser.name || "").trim();
        var email = String(profile.email || localStorage.getItem("userEmail") || currentUser && currentUser.email || "").trim();
        var department = String(profile.department || localStorage.getItem("userDepartment") || currentUser && currentUser.department || "").trim();
        var role = String(profile.role || localStorage.getItem("userRole") || currentUser && currentUser.role || "").trim().toLowerCase();
        var avatar = document.querySelector(".workbenchProfileLayerAvatar");
        var profileImage = getSavedProfileImage();

        var nameNode = document.querySelector(".workbenchProfileLayerName");
        var emailNode = document.querySelector(".workbenchProfileLayerEmail");
        if (nameNode) nameNode.textContent = name || "-";
        if (emailNode) emailNode.textContent = email || "-";

        if (avatar) {
            avatar.innerHTML = "";
            if (profileImage) {
                avatar.innerHTML = '<img src="' + profileImage.replace(/"/g, "&quot;") + '" alt="">';
            } else {
                var avatarKey = profile.id || localStorage.getItem("userId") || name;
                var isRepresentative = isRepresentativeProfileValue(avatarKey) ||
                    isRepresentativeProfileValue(name) ||
                    role === "ceo" ||
                    department === "대표";
                avatar.style.backgroundColor = isRepresentative ? REPRESENTATIVE_AVATAR_BACKGROUND : getProfileAvatarColor(avatarKey);
                avatar.style.color = isRepresentative ? REPRESENTATIVE_AVATAR_COLOR : "#fff";
                avatar.textContent = getProfileInitial(name);
            }
        }

        setProfileLayerField("department", department || "-");
        setProfileLayerField("position", formatProfilePositionText(profile));
        setProfileLayerField("employeeNumber", String(profile.employeeNumber || "").trim() || "-");
        setProfileLayerField("hireDate", formatProfileDateText(profile.hireDate || profile.createdAt || ""));
        setProfileLayerField("birthDate", formatProfileDateText(profile.birthDate || ""));
        setProfileLayerField("mobilePhone", formatProfilePhoneText(profile.mobilePhone || profile.phone || ""));
    }

    function setProfileLayerField(name, value) {
        var node = document.querySelector('[data-profile-field="' + name + '"]');
        if (node) node.textContent = String(value || "-").trim() || "-";
    }

    function getWorkbenchSettingValue(key) {
        if (key === "autoLogin") return localStorage.getItem("autoLoginEnabled") === "true";
        var storageKey = "workbenchSetting:" + key;
        var value = localStorage.getItem(storageKey);
        if (value === null && (key === "lockMode" || key === "notifications")) return true;
        return value === "true";
    }

    function setWorkbenchSettingValue(key, enabled) {
        var value = enabled ? "true" : "false";
        if (key === "autoLogin") localStorage.setItem("autoLoginEnabled", value);
        localStorage.setItem("workbenchSetting:" + key, value);
    }

    function syncWorkbenchSettingsLayer() {
        ensureWorkbenchSettingsLayer();
        document.querySelectorAll("[data-workbench-setting]").forEach(function (input) {
            var key = String(input.getAttribute("data-workbench-setting") || "").trim();
            input.checked = getWorkbenchSettingValue(key);
        });
        var path = document.querySelector(".workbenchSettingsDownloadPath");
        if (path) path.textContent = getDefaultDownloadFolderText();
    }

    function openWorkbenchSettingsLayer() {
        ensureWorkbenchSettingsLayer();
        syncWorkbenchSettingsLayer();
        var layer = document.querySelector(".workbenchSettingsLayer");
        if (!layer) return;
        closeWorkbenchProfileLayer();
        layer.hidden = false;
        layer.classList.add("is-open");
        document.body.classList.add("workbenchSettingsLayerOpen");
    }

    function closeWorkbenchSettingsLayer() {
        var layer = document.querySelector(".workbenchSettingsLayer");
        if (!layer) return;
        layer.classList.remove("is-open");
        layer.hidden = true;
        document.body.classList.remove("workbenchSettingsLayerOpen");
    }

    function openWorkbenchProfileLayer() {
        ensureWorkbenchProfileLayer();
        var layer = document.querySelector(".workbenchProfileLayer");
        if (!layer) return;
        layer.hidden = false;
        layer.classList.add("is-open");
        document.body.classList.add("workbenchProfileLayerOpen");
        fillWorkbenchProfileLayer();
    }

    function closeWorkbenchProfileLayer() {
        var layer = document.querySelector(".workbenchProfileLayer");
        if (!layer) return;
        layer.classList.remove("is-open");
        layer.hidden = true;
        document.body.classList.remove("workbenchProfileLayerOpen");
        setWorkbenchProfileMessage("", false);
    }

    async function saveWorkbenchProfileLayer() {
        var layer = document.querySelector(".workbenchProfileLayer");
        if (!layer || !window.AuthStore) return;
        var saveButton = layer.querySelector(".workbenchProfileSaveBtn");
        var photoInput = layer.querySelector(".workbenchProfilePhotoInput");
        var birthInput = layer.querySelector(".workbenchProfileBirthInput");
        var passwordInput = layer.querySelector(".workbenchProfilePasswordInput");
        var passwordConfirmInput = layer.querySelector(".workbenchProfilePasswordConfirmInput");
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        var isAdmin = String(localStorage.getItem("userRole") || "").trim().toLowerCase() === "admin";
        var birthDate = normalizeProfileBirthDate(birthInput && birthInput.value);
        var nextPassword = String(passwordInput && passwordInput.value || "").trim();
        var nextPasswordConfirm = String(passwordConfirmInput && passwordConfirmInput.value || "").trim();

        if (!userId) {
            setWorkbenchProfileMessage("로그인 정보가 없습니다.", true);
            return;
        }
        if (isAdmin && (nextPassword || nextPasswordConfirm)) {
            if (nextPassword !== nextPasswordConfirm) {
                setWorkbenchProfileMessage("새 비밀번호 확인이 일치하지 않습니다.", true);
                return;
            }
            if (nextPassword.length < 4) {
                setWorkbenchProfileMessage("비밀번호는 4자 이상으로 입력해주세요.", true);
                return;
            }
        }

        try {
            if (saveButton) saveButton.disabled = true;
            setWorkbenchProfileMessage("저장 중입니다.", false);

            if (photoInput && photoInput.files && photoInput.files[0]) {
                var imageData = await readProfileImageFile(photoInput.files[0]);
                if (imageData) localStorage.setItem(getProfileImageStorageKey(), imageData);
            }

            await window.AuthStore.updateOwnProfile({
                userId: userId,
                birthDate: birthDate
            });
            if (isAdmin && nextPassword) {
                await window.AuthStore.changeOwnPassword(userId, nextPassword);
            }

            renderWorkbenchProfile();
            setWorkbenchProfileMessage("저장되었습니다.", false);
            setTimeout(closeWorkbenchProfileLayer, 450);
        } catch (error) {
            setWorkbenchProfileMessage(error.message || "프로필을 저장하지 못했습니다.", true);
        } finally {
            if (saveButton) saveButton.disabled = false;
        }
    }

    function bindWorkbenchProfileLayer() {
        ensureOrgChartButton();
        ensureWorkbenchProfileLayer();
        ensureWorkbenchSettingsLayer();
        ensureOrgChartLayer();
        if (document.body.getAttribute("data-profile-layer-bound") === "true") return;
        document.body.setAttribute("data-profile-layer-bound", "true");

        document.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest(".homeSidebarToggleBtn")) {
                event.preventDefault();
                event.stopPropagation();
                toggleHomeSidebar();
                return;
            }
            if (target && target.closest && target.closest(".orgChartToggleBtn")) {
                event.preventDefault();
                var orgLayer = document.querySelector(".orgChartLayer");
                if (orgLayer && !orgLayer.hidden) closeOrgChartLayer();
                else {
                    closeWorkbenchProfileLayer();
                    closeWorkbenchSettingsLayer();
                    openOrgChartLayer();
                }
                return;
            }
            if (target && target.closest && (target.closest(".orgChartClose") || target.closest(".orgChartDim"))) {
                event.preventDefault();
                closeOrgChartLayer();
                return;
            }
            if (target && target.closest && target.closest(".orgChartLayer")) {
                return;
            }
            if (target && target.closest && target.closest(".workbenchProfileBtn")) {
                event.preventDefault();
                closeOrgChartLayer();
                closeWorkbenchSettingsLayer();
                var layer = document.querySelector(".workbenchProfileLayer");
                if (layer && !layer.hidden) closeWorkbenchProfileLayer();
                else openWorkbenchProfileLayer();
                return;
            }
            if (target && target.closest && target.closest(".workbenchProfileSettingsBtn")) {
                event.preventDefault();
                openWorkbenchSettingsLayer();
                return;
            }
            if (target && target.closest && target.closest(".workbenchProfileSaveBtn")) {
                event.preventDefault();
                saveWorkbenchProfileLayer();
                return;
            }
            if (target && target.closest && target.closest(".workbenchSettingsCloseBtn")) {
                event.preventDefault();
                closeWorkbenchSettingsLayer();
                return;
            }
            if (target && target.closest && target.closest("[data-workbench-setting]")) {
                var input = target.closest("[data-workbench-setting]");
                setWorkbenchSettingValue(String(input.getAttribute("data-workbench-setting") || ""), input.checked);
                return;
            }
            if (target && target.closest && target.closest(".workbenchSettingsFolderBtn")) {
                event.preventDefault();
                alert("다운로드 폴더 변경은 데스크톱 앱 설정과 연결될 예정입니다.");
                return;
            }
            if (target && target.closest && target.closest(".workbenchSettingsBox")) {
                return;
            }
            if (target && target.closest && (target.closest(".workbenchProfileCancelBtn") || target.closest(".workbenchProfileCloseBtn"))) {
                event.preventDefault();
                closeWorkbenchProfileLayer();
                return;
            }
            if (target && target.closest && target.closest(".workbenchProfileLogoutBtn")) {
                event.preventDefault();
                if (window.AuthStore && typeof window.AuthStore.logout === "function") {
                    window.AuthStore.logout();
                } else if (typeof window.logout === "function") {
                    window.logout();
                    return;
                }
                window.location.href = "/login.html";
                return;
            }
            var layerNode = document.querySelector(".workbenchProfileLayer");
            if (layerNode && !layerNode.hidden && target && !layerNode.contains(target)) {
                closeWorkbenchProfileLayer();
            }
            var orgLayerNode = document.querySelector(".orgChartLayer");
            if (orgLayerNode && !orgLayerNode.hidden && target && !orgLayerNode.contains(target)) {
                closeOrgChartLayer();
            }
            var settingsLayerNode = document.querySelector(".workbenchSettingsLayer");
            if (settingsLayerNode && !settingsLayerNode.hidden && target && !settingsLayerNode.contains(target)) {
                closeWorkbenchSettingsLayer();
            }
        }, true);

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeWorkbenchProfileLayer();
                closeOrgChartLayer();
                closeWorkbenchSettingsLayer();
            }
        });
    }

    function bindHomeSidebarToggle() {
        var button = document.querySelector(".homeSidebarToggleBtn");
        applySavedHomeSidebarState();
        syncHomeSidebarToggleState();
        if (!button) return;
        if (button.dataset.sidebarToggleBound === "true") return;
        button.dataset.sidebarToggleBound = "true";

        button.addEventListener("click", function () {
            toggleHomeSidebar();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                document.body.classList.add("homeSidebarCollapsed");
                saveHomeSidebarCollapsedState(true);
                syncHomeSidebarToggleState();
            }
        });

        syncHomeSidebarToggleState();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            window.setupUnifiedWorkbenchLayout();
            renderWorkbenchProfile();
            bindHomeSidebarToggle();
            bindWorkbenchProfileLayer();
        });
    } else {
        window.setupUnifiedWorkbenchLayout();
        renderWorkbenchProfile();
        bindHomeSidebarToggle();
        bindWorkbenchProfileLayer();
    }
    window.addEventListener("storage", function (event) {
        if (!event.key || event.key === "userName" || event.key === "userDepartment") {
            renderWorkbenchProfile();
        }
    });
})();
