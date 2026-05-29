var LAYOUT_VERSION = "20260528-profile-settings15";

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
        bootstrapLayout();
    });
} else {
    bootstrapLayout();
}
