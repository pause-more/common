(function () {
    var MODULE_MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>';

    var MENU_ITEMS = [
        {
            href: "/approval/dashboard.html",
            label: "전체문서",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M213.66,66.34l-40-40A8,8,0,0,0,168,24H88A16,16,0,0,0,72,40V56H56A16,16,0,0,0,40,72V216a16,16,0,0,0,16,16H168a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V72A8,8,0,0,0,213.66,66.34ZM168,216H56V72h76.69L168,107.31v84.53c0,.06,0,.11,0,.16s0,.1,0,.16V216Zm32-32H184V104a8,8,0,0,0-2.34-5.66l-40-40A8,8,0,0,0,136,56H88V40h76.69L200,75.31Zm-56-32a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h48A8,8,0,0,1,144,152Zm0,32a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h48A8,8,0,0,1,144,184Z"></path></svg>'
        },
        {
            href: "/approval/pending.html",
            label: "결재대기",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M200,75.64V40a16,16,0,0,0-16-16H72A16,16,0,0,0,56,40V76a16.07,16.07,0,0,0,6.4,12.8L114.67,128,62.4,167.2A16.07,16.07,0,0,0,56,180v36a16,16,0,0,0,16,16H184a16,16,0,0,0,16-16V180.36a16.09,16.09,0,0,0-6.35-12.77L141.27,128l52.38-39.6A16.05,16.05,0,0,0,200,75.64ZM184,216H72V180l56-42,56,42.35Zm0-140.36L128,118,72,76V40H184Z"></path></svg>'
        },
        {
            href: "/approval/closed.html",
            label: "결재완료",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M232,168H63.86c2.66-5.24,5.33-10.63,8-16.11,15,1.65,32.58-8.78,52.66-31.14,5,13.46,14.45,30.93,30.58,31.25,9.06.18,18.11-5.2,27.42-16.37C189.31,143.75,203.3,152,232,152a8,8,0,0,0,0-16c-30.43,0-39.43-10.45-40-16.11a7.67,7.67,0,0,0-5.46-7.75,8.14,8.14,0,0,0-9.25,3.49c-12.07,18.54-19.38,20.43-21.92,20.37-8.26-.16-16.66-19.52-19.54-33.42a8,8,0,0,0-14.09-3.37C101.54,124.55,88,133.08,79.57,135.29,88.06,116.42,94.4,99.85,98.46,85.9c6.82-23.44,7.32-39.83,1.51-50.1-3-5.38-9.34-11.8-22.06-11.8C61.85,24,49.18,39.18,43.14,65.65c-3.59,15.71-4.18,33.21-1.62,48s7.87,25.55,15.59,31.94c-3.73,7.72-7.53,15.26-11.23,22.41H24a8,8,0,0,0,0,16H37.41c-11.32,21-20.12,35.64-20.26,35.88a8,8,0,1,0,13.71,8.24c.15-.26,11.27-18.79,24.7-44.12H232a8,8,0,0,0,0-16ZM58.74,69.21C62.72,51.74,70.43,40,77.91,40c5.33,0,7.1,1.86,8.13,3.67,3,5.33,6.52,24.19-21.66,86.39C56.12,118.78,53.31,93,58.74,69.21Z"></path></svg>'
        },
        {
            href: "/approval/return.html",
            label: "반려문서",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M184,104v32a8,8,0,0,1-8,8H99.31l10.35,10.34a8,8,0,0,1-11.32,11.32l-24-24a8,8,0,0,1,0-11.32l24-24a8,8,0,0,1,11.32,11.32L99.31,128H168V104a8,8,0,0,1,16,0Zm48-48V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z"></path></svg>'
        },
        {
            href: "/approval/temp.html",
            label: "임시저장",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,16V152h-28.7A15.86,15.86,0,0,0,168,156.69L148.69,176H107.31L88,156.69A15.86,15.86,0,0,0,76.69,152H48V48Zm0,160H48V168H76.69L96,187.31A15.86,15.86,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40ZM90.34,125.66a8,8,0,0,1,11.32-11.32L120,132.69V72a8,8,0,0,1,16,0v60.69l18.34-18.35a8,8,0,0,1,11.32,11.32l-32,32a8,8,0,0,1-11.32,0Z"></path></svg>'
        }
    ];

    function normalizePath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function resolveApprovalPath() {
        var currentPath = normalizePath(location.pathname || "");
        if (currentPath !== "/approval/detail.html" && currentPath !== "/approval/drafting.html") return currentPath;

        var referrerPath = "";
        try {
            referrerPath = normalizePath(new URL(document.referrer || "", location.origin).pathname || "");
        } catch (error) {
            referrerPath = "";
        }

        var matched = MENU_ITEMS.find(function (item) {
            return item.href === referrerPath;
        });

        if (matched) return matched.href;
        if (currentPath === "/approval/drafting.html") return "/approval/temp.html";
        return "/approval/dashboard.html";
    }

    function renderApprovalSidebar() {
        var host = document.querySelector(".gnbMenu");
        if (!host || host.querySelector(".approvalSubmenuPanel")) return;

        host.innerHTML = ''
            + '<div class="approvalSubmenuPanel">'
            + '<h3 class="approvalMenuHeading">전자결재</h3>'
            + '<div class="approvalSubmenuList">'
            + MENU_ITEMS.map(function (item) {
                return ''
                    + '<p class="approvalSubmenuItem">'
                    + '<a href="' + item.href + '">'
                    + '<span class="menu_ico">' + item.icon + '</span>'
                    + '<span class="menu_txt">' + item.label + '</span>'
                    + '</a>'
                    + '</p>';
            }).join("")
            + '</div>'
            + '</div>';
    }

    function applyApprovalSidebarSelection() {
        var currentPath = resolveApprovalPath();
        document.querySelectorAll(".approvalSubmenuItem").forEach(function (item) {
            item.classList.remove("selected");
        });

        document.querySelectorAll(".approvalSubmenuItem a[href]").forEach(function (link) {
            var href = normalizePath(link.getAttribute("href") || "");
            if (!href || href !== currentPath) return;
            var item = link.closest(".approvalSubmenuItem");
            if (item) item.classList.add("selected");
        });
    }

    function ensureApprovalComposeFab() {
        var currentPath = normalizePath(location.pathname || "");
        if (currentPath === "/approval/drafting.html") return;
        if (document.querySelector(".approvalComposeFab")) return;

        var button = document.createElement("a");
        button.href = "/approval/drafting.html";
        button.className = "approvalComposeFab";
        button.setAttribute("aria-label", "전자결재 작성");
        button.textContent = "+";
        document.body.appendChild(button);
    }

    function ensureMobileMenuToggle() {
        var titleArea = document.querySelector(".titleArea");
        if (!titleArea || titleArea.querySelector(".mobileSubmenuToggleBtn")) return;

        var button = document.createElement("button");
        button.type = "button";
        button.className = "mobileSubmenuToggleBtn";
        button.setAttribute("aria-label", "전자결재 메뉴 열기");
        button.innerHTML = MODULE_MENU_ICON;
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            document.body.classList.add("mobileSidebarOpen");
            document.body.classList.add("mobileModuleSidebarOpen");
        });
        titleArea.appendChild(button);
    }

    function initializeApprovalLayout() {
        renderApprovalSidebar();
        applyApprovalSidebarSelection();
        ensureMobileMenuToggle();
        ensureApprovalComposeFab();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeApprovalLayout);
    } else {
        initializeApprovalLayout();
    }
})();
