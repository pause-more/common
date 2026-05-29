(function () {
    var MODULE_MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>';
    var MENU_ITEMS = [
        {
            href: "/calendar/my.html",
            label: "내 캘린더",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208Z"></path></svg>'
        },
        {
            href: "/calendar/team.html",
            label: "팀/부서 캘린더",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"></path></svg>'
        },
        {
            href: "/calendar/company-wide.html",
            label: "전사 일정",
            icon: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V208Zm-31.38-94.36-29.84-2.31-11.43-26.5a8,8,0,0,0-14.7,0l-11.43,26.5-29.84,2.31a8,8,0,0,0-4.47,14.14l22.52,18.59-6.86,27.71a8,8,0,0,0,11.82,8.81L128,167.82l25.61,15.07a8,8,0,0,0,11.82-8.81l-6.86-27.71,22.52-18.59a8,8,0,0,0-4.47-14.14Zm-32.11,23.6a8,8,0,0,0-2.68,8.09l3.5,14.12-13.27-7.81a8,8,0,0,0-8.12,0l-13.27,7.81,3.5-14.12a8,8,0,0,0-2.68-8.09l-11.11-9.18,14.89-1.15a8,8,0,0,0,6.73-4.8l6-13.92,6,13.92a8,8,0,0,0,6.73,4.8l14.89,1.15Z"></path></svg>'
        }
    ];

    function normalizePath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function renderCalendarSidebar() {
        var host = document.querySelector(".gnbMenu");
        if (!host || host.querySelector(".calendarSubmenuPanel")) return;

        host.innerHTML = ''
            + '<div class="calendarSubmenuPanel">'
            + '<h3 class="calendarMenuHeading">캘린더</h3>'
            + '<div class="calendarSubmenuList">'
            + MENU_ITEMS.map(function (item) {
                return ''
                    + '<p class="calendarSubmenuItem">'
                    + '<a href="' + item.href + '">'
                    + '<span class="menu_ico">' + item.icon + '</span>'
                    + '<span class="menu_txt">' + item.label + '</span>'
                    + '</a>'
                    + '</p>';
            }).join("")
            + '</div>'
            + '</div>';
    }

    function applyCalendarSidebarSelection() {
        var currentPath = normalizePath(location.pathname || "");
        document.querySelectorAll(".calendarSubmenuItem").forEach(function (item) {
            item.classList.remove("selected");
        });

        document.querySelectorAll(".calendarSubmenuItem a[href]").forEach(function (link) {
            var href = normalizePath(link.getAttribute("href") || "");
            if (!href || href !== currentPath) return;
            var item = link.closest(".calendarSubmenuItem");
            if (item) item.classList.add("selected");
        });
    }

    function ensureMobileMenuToggle() {
        var titleArea = document.querySelector(".titleArea");
        if (!titleArea || titleArea.querySelector(".mobileSubmenuToggleBtn")) return;

        var button = document.createElement("button");
        button.type = "button";
        button.className = "mobileSubmenuToggleBtn";
        button.setAttribute("aria-label", "캘린더 메뉴 열기");
        button.innerHTML = MODULE_MENU_ICON;
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            document.body.classList.add("mobileSidebarOpen");
            document.body.classList.add("mobileModuleSidebarOpen");
        });
        titleArea.appendChild(button);
    }

    function initializeCalendarLayout() {
        renderCalendarSidebar();
        applyCalendarSidebarSelection();
        ensureMobileMenuToggle();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeCalendarLayout);
    } else {
        initializeCalendarLayout();
    }
})();
