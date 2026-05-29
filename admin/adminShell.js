(function () {
    var APP_ITEMS = [
        { href: "/", key: "home", label: "홈", icon: "ri-home-5-line" },
        { href: "/chat.html", key: "chat", label: "채팅", icon: "ri-message-2-line" },
        { href: "/attendance/commute.html", key: "attendance", label: "출퇴근 현황", icon: "ri-time-line" },
        { href: "/mail/inbox.html", key: "mail", label: "받은메일함", icon: "ri-mail-line" },
        { href: "/approval/dashboard.html", key: "approval", label: "전체문서", icon: "ri-draft-line" },
        { href: "/calendar/my.html", key: "calendar", label: "내 캘린더", icon: "ri-calendar-line" },
        { href: "/board/cloud.html", key: "cloud", label: "클라우드", icon: "ri-server-line" },
        { href: "/board/resources.html", key: "resources", label: "리소스센터", icon: "ri-folder-2-line" },
        { href: "/board/news.html", key: "news", label: "뉴스", icon: "ri-flag-line" }
    ];
    var ADMIN_GEAR_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="m21.16 7.86-1-1.73a1.997 1.997 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11V4c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.5.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.5.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.78 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.96.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73l-.5-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.5-.29c.96-.55 1.28-1.78.73-2.73ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" fill="currentColor"/></svg>';

    function renderFallbackRail() {
        return APP_ITEMS.map(function (item) {
            return ''
                + '<a href="' + item.href + '" class="workbenchAppItem" data-workbench-item="' + item.key + '" data-workbench-paths="' + item.href + '">'
                + '<span class="workbenchAppIcon"><i class="' + item.icon + '"></i></span>'
                + '<span class="workbenchAppLabel">' + item.label + '</span>'
                + '</a>';
        }).join("");
    }

    async function loadSharedRail() {
        try {
            var response = await fetch("/index.html?v=20260506-4", { method: "GET" });
            if (!response.ok) throw new Error("index.html");
            var html = await response.text();
            var doc = new DOMParser().parseFromString(html, "text/html");
            var rail = doc.querySelector(".workbenchAppRail");
            if (!rail) throw new Error("workbench rail");
            return rail.innerHTML;
        } catch (error) {
            return renderFallbackRail();
        }
    }

    function applyRailSelection() {
        var currentPath = normalizePath(location.pathname || "");
        document.querySelectorAll(".workbenchAppRail .workbenchAppItem[data-workbench-item]").forEach(function (item) {
            var paths = String(item.getAttribute("data-workbench-paths") || "")
                .split(/\s+/)
                .map(normalizePath)
                .filter(Boolean);
            var href = normalizePath(item.getAttribute("href") || "");
            if (href) paths.push(href);

            if (String(item.getAttribute("data-workbench-item") || "") === "home") {
                paths.push("/index.html");
            }

            item.classList.toggle("is-active", paths.some(function (path) {
                return currentPath === path || currentPath.slice(-path.length) === path;
            }));
        });
    }

    function normalizePath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function bootstrapShell() {
        if (document.querySelector(".workbenchTopbar")) return;

        var railMarkup = renderFallbackRail();
        var originalContent = document.body.innerHTML;
        document.body.classList.add("adminPageLayout");
        document.body.innerHTML = ''
            + '<div id="wrap">'
            + '<div id="container">'
            + '<div id="contents" class="contents">'
            + '<header class="workbenchTopbar">'
            + '<div class="workbenchTopbarLeft"></div>'
            + '<div class="workbenchTopbarBrand">'
            + '<span class="workbenchTopbarBrandMark"><img src="/img/symbol.svg" alt=""></span>'
            + '<strong>Auto One Co., Ltd.</strong>'
            + '</div>'
            + '<div class="workbenchTopbarActions"></div>'
            + '</header>'
            + '<div class="sidebar">'
            + '<nav class="workbenchAppRail" aria-label="주요 메뉴">' + railMarkup + '</nav>'
            + '<div class="gnbMenu" style="display:none;"></div>'
            + '<div class="side_bottom" style="display:none;"><p><a href="/admin/employees.html"><span class="menu_ico">' + ADMIN_GEAR_ICON + '</span><span class="menu_txt">어드민</span></a></p></div>'
            + '</div>'
            + '<div class="mainArea">' + originalContent + '</div>'
            + '</div>'
            + '</div>'
            + '</div>';
        applyRailSelection();
        document.dispatchEvent(new CustomEvent("adminShell:ready"));
        replaceRailWithSharedMarkup();
    }

    async function replaceRailWithSharedMarkup() {
        var rail = document.querySelector(".workbenchAppRail");
        if (!rail) return;
        var railMarkup = await loadSharedRail();
        rail.innerHTML = railMarkup;
        applyRailSelection();
        document.dispatchEvent(new CustomEvent("adminShell:rail-updated"));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            bootstrapShell();
        });
    } else {
        bootstrapShell();
    }
})();
