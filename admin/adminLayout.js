(function () {
    var MENU_ITEMS = [
        {
            href: "/index.html",
            label: "홈",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="#9c9c9c" viewBox="0 0 24 24"><path d="M12.71 2.29a.996.996 0 0 0-1.41 0l-8.01 8A1 1 0 0 0 3 11v9c0 1.1.9 2 2 2h3c.55 0 1-.45 1-1v-7h6v7c0 .55.45 1 1 1h3c1.1 0 2-.9 2-2v-9c0-.27-.11-.52-.29-.71z"></path></svg>'
        },
        {
            href: "/admin/employees.html",
            label: "구성원 관리",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="#9c9c9c" viewBox="0 0 24 24"><path d="M19 2H5c-.55 0-1 .45-1 1v4H2v2h2v2H2v2h2v2H2v2h2v4c0 .55.45 1 1 1h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-6.5 5C13.93 7 15 8.07 15 9.5S13.93 12 12.5 12 10 10.93 10 9.5 11.07 7 12.5 7M17 17H8v-1c0-1.66 1.34-3 3-3h3c1.66 0 3 1.34 3 3z"></path></svg>'
        },
        {
            href: "/admin/attendance.html",
            label: "근태 관리",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="#9c9c9c" viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v2.82l1.04.49a20.98 20.98 0 0 0 17.92 0l1.04-.49V8c0-1.1-.9-2-2-2M9 4h6v2H9z"></path><path d="M12 15.32c-3.35 0-6.69-.73-9.81-2.2L2 13.03V20c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-6.97l-.19.09a23 23 0 0 1-9.81 2.2"></path></svg>'
        },
        {
            href: "/admin/holiday.html",
            label: "휴가 관리",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" fill="#9c9c9c" viewBox="0 0 24 24"><path d="M19 4h-2V2h-2v2H9V2H7v2H5c-1.1 0-2 .9-2 2v1h18V6c0-1.1-.9-2-2-2M3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8H3zm4-8h10v2H7zm0 4h7v2H7z"></path></svg>'
        }
    ];

    function normalizePath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function renderAdminSidebar() {
        var host = document.querySelector(".gnbMenu");
        if (!host || host.querySelector(".adminSubmenuPanel")) return;

        function getWorkbenchIconMarkup(icon) {
            return String(icon || "").replace("<svg ", '<svg class="icon-default" ');
        }

        host.innerHTML = ''
            + '<div class="adminSubmenuPanel">'
            + '<div class="adminSubmenuList workbenchAppRail">'
            + MENU_ITEMS.map(function (item) {
                return ''
                    + '<a class="workbenchAppItem adminSubmenuItem" href="' + item.href + '">'
                    + '<span class="workbenchAppIcon menu_ico">' + getWorkbenchIconMarkup(item.icon) + '</span>'
                    + '<span class="workbenchAppLabel menu_txt">' + item.label + '</span>'
                    + '</a>'
            }).join("")
            + '</div>'
            + '</div>';
    }

    function applySidebarSelection() {
        var currentPath = normalizePath(location.pathname || "");
        document.querySelectorAll(".adminSubmenuItem").forEach(function (item) {
            item.classList.remove("selected");
            item.classList.remove("is-active");
        });
        document.querySelectorAll(".adminSubmenuItem[href]").forEach(function (link) {
            var href = normalizePath(link.getAttribute("href") || "");
            if (!href || href !== currentPath) return;
            link.classList.add("selected", "is-active");
        });
    }

    function enableAdminSidebarLayout() {
        document.body.classList.add("is-mail-layout", "is-admin-layout");
        var sideBottom = document.querySelector(".sidebar .side_bottom");
        if (sideBottom) {
            sideBottom.hidden = false;
            sideBottom.style.display = "";
        }
    }

    function initializeAdminLayout() {
        if (!document.querySelector(".gnbMenu")) return false;
        enableAdminSidebarLayout();
        renderAdminSidebar();
        applySidebarSelection();
        return true;
    }

    function waitForAdminMenuHost() {
        if (initializeAdminLayout()) return;

        document.addEventListener("adminShell:ready", initializeAdminLayout);
        document.addEventListener("layout:includes-ready", initializeAdminLayout);

        var attempts = 0;
        var timer = setInterval(function () {
            attempts += 1;
            if (initializeAdminLayout() || attempts >= 80) {
                clearInterval(timer);
            }
        }, 50);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", waitForAdminMenuHost);
    } else {
        waitForAdminMenuHost();
    }
})();
