var LAYOUT_VERSION = "20260530-modal-keys1";

function installGlobalPopupKeyboardShortcuts() {
    if (window.__groupwarePopupKeyboardShortcutsInstalled) return;
    window.__groupwarePopupKeyboardShortcutsInstalled = true;

    document.addEventListener("keydown", function (event) {
        if (!event || event.defaultPrevented || event.isComposing) return;
        if (event.key !== "Escape" && event.key !== "Enter") return;

        var popup = getTopVisiblePopup();
        if (!popup) return;

        if (event.key === "Escape") {
            var closeButton = findPopupCloseButton(popup);
            if (!closeButton) return;
            event.preventDefault();
            event.stopPropagation();
            closeButton.click();
            return;
        }

        if (isEnterTextEditingTarget(event.target)) return;
        var actionButton = findPopupActionButton(popup);
        if (!actionButton) return;
        event.preventDefault();
        event.stopPropagation();
        actionButton.click();
    }, true);
}

function getTopVisiblePopup() {
    var selector = [
        '[role="dialog"]',
        '.myMailModal',
        '.calendarModal',
        '.chatMemberModal',
        '.chatRoomMembersModal',
        '.chatPollModal',
        '.chatClipboardModal',
        '.chatImageViewerModal',
        '.chatMessageShareModal',
        '.notificationLayerModal',
        '.workbenchProfileLayer',
        '.approvalDetailModal',
        '[class*="Modal"]',
        '[class*="modal"]',
        '[class*="Popup"]',
        '[class*="popup"]',
        '[class*="Layer"]'
    ].join(',');
    return Array.prototype.slice.call(document.querySelectorAll(selector))
        .filter(isVisiblePopupElement)
        .sort(function (a, b) { return getPopupZIndex(a) - getPopupZIndex(b); })
        .pop() || null;
}

function isVisiblePopupElement(element) {
    if (!element || element.nodeType !== 1) return false;
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    var style = window.getComputedStyle(element);
    if (!style || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function getPopupZIndex(element) {
    var current = element;
    var zIndex = 0;
    while (current && current.nodeType === 1) {
        var value = parseInt(window.getComputedStyle(current).zIndex || "0", 10);
        if (Number.isFinite(value)) zIndex = Math.max(zIndex, value);
        current = current.parentElement;
    }
    return zIndex;
}

function findPopupCloseButton(popup) {
    return findFirstEnabledButton(popup, [
        '[aria-label*="닫기"]',
        '[aria-label*="취소"]',
        '[data-modal-close]',
        '[data-close]',
        '.mymailCloseBtn',
        '.calendarModalCloseBtn',
        '.chatMemberModalClose',
        '.chatRoomMembersClose',
        '.chatPollClose',
        '.chatClipboardCancel',
        '.chatImageViewerClose',
        '.approvalDetailClose',
        '.approvalDetailCancel',
        '.workbenchProfileCloseBtn',
        '[class*="Close"]',
        '[class*="close"]',
        '[class*="Cancel"]',
        '[class*="cancel"]'
    ]);
}

function findPopupActionButton(popup) {
    var candidates = Array.prototype.slice.call(popup.querySelectorAll('button, input[type="button"], input[type="submit"]'))
        .filter(function (button) {
            return isEnabledPopupButton(button) && !isPopupDismissButton(button);
        });

    return candidates.find(isPrimaryPopupActionButton) ||
        candidates.find(function (button) { return button.type === "submit"; }) ||
        null;
}

function findFirstEnabledButton(root, selectors) {
    for (var index = 0; index < selectors.length; index += 1) {
        var found = Array.prototype.slice.call(root.querySelectorAll(selectors[index])).find(isEnabledPopupButton);
        if (found) return found;
    }
    return null;
}

function isEnabledPopupButton(button) {
    if (!button || button.disabled || button.hidden) return false;
    var style = window.getComputedStyle(button);
    if (!style || style.display === "none" || style.visibility === "hidden") return false;
    return true;
}

function isPopupDismissButton(button) {
    var text = getPopupButtonText(button);
    var className = String(button.className || "").toLowerCase();
    var aria = String(button.getAttribute("aria-label") || "").toLowerCase();
    return /취소|닫기|삭제|제거|뒤로|이전|cancel|close|delete|remove|back/.test(text + " " + className + " " + aria);
}

function isPrimaryPopupActionButton(button) {
    var text = getPopupButtonText(button);
    var className = String(button.className || "").toLowerCase();
    var aria = String(button.getAttribute("aria-label") || "").toLowerCase();
    return /저장|확인|완료|등록|추가|생성|만들기|시작|발송|보내기|submit|save|confirm|ok|done|create|start|send/.test(text + " " + className + " " + aria);
}

function getPopupButtonText(button) {
    return String(button && (button.textContent || button.value) || "").trim().toLowerCase();
}

function isEnterTextEditingTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    var tagName = String(target.tagName || "").toLowerCase();
    return tagName === "textarea" || target.isContentEditable === true;
}

function markWorkbenchLayoutBootstrapping() {
    if (!document.body || document.body.classList.contains("homePage")) return;
    if (document.documentElement) document.documentElement.classList.add("layoutBootstrapping");
    document.body.classList.add("unifiedWorkbench", "layoutBootstrapping");
}

function finishWorkbenchLayoutBootstrapping() {
    if (document.documentElement) document.documentElement.classList.remove("layoutBootstrapping");
    if (document.body) document.body.classList.remove("layoutBootstrapping");
}

function normalizeWorkbenchPath(value) {
    var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
    if (!path || path === "#") return "";
    return path.charAt(0) === "/" ? path : "/" + path;
}

function getEarlyProfileInitial(name) {
    var nameChars = Array.from(String(name || "").replace(/\s+/g, ""));
    if (!nameChars.length) return "나";
    return nameChars[Math.floor(nameChars.length / 2)] || "나";
}

function isEarlyRepresentativeProfileValue(value) {
    var source = String(value || "").trim();
    var normalized = source.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "jschoi" ||
        normalized === "ceo" ||
        source === "최재성" ||
        source === "대표";
}

function getEarlyProfileAvatarColor(value) {
    if (isEarlyRepresentativeProfileValue(value)) return "#0373ef";
    var colors = ["#f99790", "#f3c364", "#83c0f9", "#84c9a1", "#bda5ef"];
    var source = String(value || "").trim();
    var hash = 0;
    for (var index = 0; index < source.length; index += 1) {
        hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
    }
    return colors[hash % colors.length];
}

function getEarlyProfileImage() {
    try {
        var userId = String(localStorage.getItem("userId") || "guest").trim().toLowerCase();
        return String(localStorage.getItem("workbenchProfileImage:" + (userId || "guest")) || "").trim();
    } catch (error) {
        return "";
    }
}

function canEarlySeeAdminMenu() {
    try {
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
    } catch (error) {
        return false;
    }
}

function applyEarlyWorkbenchProfile() {
    var name = "";
    var userId = "";
    var department = "";
    var role = "";
    try {
        name = String(localStorage.getItem("userName") || "").trim();
        userId = String(localStorage.getItem("userId") || "").trim();
        department = String(localStorage.getItem("userDepartment") || "").trim();
        role = String(localStorage.getItem("userRole") || "").trim().toLowerCase();
    } catch (error) {}

    var profileImage = getEarlyProfileImage();
    var avatars = document.querySelectorAll(".workbenchProfileAvatar");
    avatars.forEach(function (avatar) {
        if (profileImage) {
            avatar.innerHTML = '<img src="' + profileImage.replace(/"/g, "&quot;") + '" alt="">';
            return;
        }
        var avatarKey = userId || name;
        var isRepresentative = isEarlyRepresentativeProfileValue(avatarKey) ||
            isEarlyRepresentativeProfileValue(name) ||
            role === "ceo" ||
            department === "대표";
        avatar.style.backgroundColor = isRepresentative ? "#0373ef" : getEarlyProfileAvatarColor(avatarKey);
        avatar.style.color = "#fff";
        avatar.textContent = getEarlyProfileInitial(name);
    });

    document.querySelectorAll(".workbenchProfileName").forEach(function (node) {
        node.textContent = name || "-";
    });
    document.querySelectorAll(".workbenchProfileDepartment").forEach(function (node) {
        node.textContent = department || (role === "ceo" || role === "admin" ? "대표" : "-");
    });
    if (avatars.length && document.documentElement) document.documentElement.classList.add("profileAvatarReady");
    if (document.body) document.body.classList.toggle("workbenchHasAdminMenu", canEarlySeeAdminMenu());
}

function applyEarlyUnifiedWorkbenchLayout() {
    if (!document.body || document.body.classList.contains("homePage")) return;
    var sidebar = document.querySelector(".sidebar");
    var topbar = document.querySelector(".workbenchTopbar");
    if (!sidebar || !topbar) return;

    markWorkbenchLayoutBootstrapping();
    document.querySelectorAll('[data-workbench-item="home"], [data-mobile-nav="home"], [data-account-home="true"]').forEach(function (item) {
        if (item.tagName === "A") item.setAttribute("href", "/index.html");
        if (item.hasAttribute("data-workbench-paths")) item.setAttribute("data-workbench-paths", "/ /index.html");
    });

    applyEarlyWorkbenchRailSelection();
    applyEarlyMobileBottomNavSelection();
    applyEarlyWorkbenchProfile();

    requestAnimationFrame(finishWorkbenchLayoutBootstrapping);
}

function applyEarlyWorkbenchRailSelection() {
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
        if (itemKey === "home") paths.push("/index.html");

        var isActive = paths.some(function (path) {
            return currentPath === path || currentPath.slice(-path.length) === path;
        });
        item.classList.toggle("is-active", isActive);
    });
}

function applyEarlyMobileBottomNavSelection() {
    var path = String(location.pathname || "/").toLowerCase();
    var url = String(location.href || "").toLowerCase();
    var activeKey = "more";
    if (path === "/" || path === "/index.html") activeKey = "home";
    else if (isEarlyMobileNavPath(path, url, "chat")) activeKey = "chat";
    else if (isEarlyMobileNavPath(path, url, "mail")) activeKey = "mail";
    else if (isEarlyMobileNavPath(path, url, "calendar")) activeKey = "calendar";

    document.querySelectorAll(".mobileGlobalBottomNav [data-mobile-nav]").forEach(function (item) {
        item.classList.toggle("is-active", String(item.getAttribute("data-mobile-nav") || "") === activeKey);
    });
}

function isEarlyMobileNavPath(path, url, key) {
    return path.indexOf("/" + key + "/") === 0 ||
        path.indexOf("/" + key + ".html") === 0 ||
        url.indexOf("/" + key + "/") > -1 ||
        url.indexOf("/" + key + ".html") > -1;
}

async function injectHtmlIncludes() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-include-html]"));

    await Promise.all(nodes.map(async function (node) {
        var path = node.getAttribute("data-include-html");
        if (!path) return;

        var cacheKey = "layout-include:" + LAYOUT_VERSION + ":" + path;
        clearStaleLayoutIncludeCache(cacheKey);
        var cachedHtml = "";
        try {
            cachedHtml = sessionStorage.getItem(cacheKey) || "";
        } catch (error) {}

        if (cachedHtml) {
            node.outerHTML = cachedHtml;
            return;
        }

        var includePath = path + (path.indexOf("?") > -1 ? "&" : "?") + "v=" + encodeURIComponent(LAYOUT_VERSION);
        var response = await fetch(includePath, { cache: "force-cache" });
        if (!response.ok) {
            throw new Error("Failed to load HTML fragment: " + path);
        }

        var html = await response.text();
        try {
            sessionStorage.setItem(cacheKey, html);
        } catch (error) {}
        node.outerHTML = html;
    }));

    applyEarlyUnifiedWorkbenchLayout();
    document.dispatchEvent(new CustomEvent("layout:includes-ready"));
}

function clearStaleLayoutIncludeCache(currentCacheKey) {
    try {
        for (var index = sessionStorage.length - 1; index >= 0; index -= 1) {
            var key = sessionStorage.key(index);
            if (key && key.indexOf("layout-include:") === 0 && key !== currentCacheKey) {
                sessionStorage.removeItem(key);
            }
        }
    } catch (error) {}
}

function loadClassicScript(path) {
    return new Promise(function (resolve, reject) {
        var script = document.createElement("script");
        script.src = new URL(path, import.meta.url).href;
        script.onload = resolve;
        script.onerror = function () {
            reject(new Error("Failed to load script: " + path));
        };
        document.head.appendChild(script);
    });
}

async function bootstrapLayout() {
    markWorkbenchLayoutBootstrapping();
    applyEarlyWorkbenchProfile();

    try {
        await injectHtmlIncludes();
    } catch (error) {
        console.error(error);
        finishWorkbenchLayoutBootstrapping();
    }

    if (!window.AuthStore) {
        try {
            await loadClassicScript("./auth.js?v=" + LAYOUT_VERSION);
        } catch (error) {
            console.error(error);
        }
    }

    try {
        await loadClassicScript("./common.js?v=" + LAYOUT_VERSION);
    } catch (error) {
        console.error(error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
        installGlobalPopupKeyboardShortcuts();
        bootstrapLayout();
    });
} else {
    installGlobalPopupKeyboardShortcuts();
    bootstrapLayout();
}
