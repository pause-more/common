(function () {
    var DEFAULT_API_ORIGIN = "https://autone-mail-api.autone1team.workers.dev";
    var STORAGE_KEY = "groupwareApiOrigin";
    var HOME_SIDEBAR_COLLAPSED_KEY = "homeSidebarCollapsed";

    try {
        document.documentElement.classList.toggle(
            "homeSidebarCollapsedInitial",
            localStorage.getItem(HOME_SIDEBAR_COLLAPSED_KEY) === "true"
        );
    } catch (error) {}

    function normalizeOrigin(value) {
        var origin = String(value || "").trim();
        if (!origin) return DEFAULT_API_ORIGIN;
        return origin.replace(/\/+$/, "");
    }

    function getApiOrigin() {
        var override = window.GROUPWARE_API_ORIGIN || localStorage.getItem(STORAGE_KEY);
        return normalizeOrigin(override);
    }

    function apiBase(path) {
        var safePath = String(path || "");
        if (!safePath) return getApiOrigin();
        return getApiOrigin() + (safePath.charAt(0) === "/" ? safePath : "/" + safePath);
    }

    function setApiOrigin(value) {
        var nextOrigin = normalizeOrigin(value);
        localStorage.setItem(STORAGE_KEY, nextOrigin);
        return nextOrigin;
    }

    window.GroupwareConfig = {
        defaultApiOrigin: DEFAULT_API_ORIGIN,
        getApiOrigin: getApiOrigin,
        setApiOrigin: setApiOrigin,
        apiBase: apiBase
    };

    window.getGroupwareApiOrigin = getApiOrigin;
    window.getGroupwareApiBase = apiBase;
})();
