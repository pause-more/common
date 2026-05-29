(function () {
    var AUTO_LOGIN_KEY = "autoLoginEnabled";
    var REMEMBER_USER_ID_KEY = "rememberedUserId";

    document.addEventListener("DOMContentLoaded", function () {
        var toggle = document.querySelector(".morePageSettingsToggle");
        var menu = document.querySelector(".morePageSettingsMenu");
        if (!toggle || !menu) return;
        syncAutoLoginLabel();

        toggle.addEventListener("click", function () {
            var isOpen = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!isOpen));
            menu.hidden = isOpen;
            toggle.classList.toggle("is-active", !isOpen);
        });

        menu.addEventListener("click", function (event) {
            var button = event.target && event.target.closest && event.target.closest("[data-more-action]");
            if (!button) return;

            var action = button.getAttribute("data-more-action");
            if (action === "profile") {
                openProfileLayer();
                return;
            }
            if (action === "auto-login") {
                toggleAutoLogin();
                return;
            }
            if (action === "clear-cache") {
                clearAppCache();
            }
        });
    });

    async function openProfileLayer() {
        var profileButton = await waitForElement(".workbenchProfileBtn", 2000);
        if (!profileButton) return;

        await waitForProfileBinding(2000);
        profileButton.click();
        setTimeout(function () {
            ensureProfileLayerVisible();
        }, 80);
    }

    function toggleAutoLogin() {
        var enabled = localStorage.getItem(AUTO_LOGIN_KEY) === "true";
        if (enabled) {
            var disableOk = confirm("자동 로그인을 해제하시겠습니까?");
            if (!disableOk) return;

            localStorage.removeItem(AUTO_LOGIN_KEY);
            syncAutoLoginLabel();
            return;
        }

        var ok = confirm("신뢰하는 기기에서만 해당 기능을 사용하시기 바랍니다. 자동 로그인을 설정하시겠습니까?");
        if (!ok) return;

        localStorage.setItem(AUTO_LOGIN_KEY, "true");
        var userId = String(localStorage.getItem("userId") || "").trim().toLowerCase();
        if (userId) localStorage.setItem(REMEMBER_USER_ID_KEY, userId);
        syncAutoLoginLabel();
    }

    function syncAutoLoginLabel() {
        var button = document.querySelector('[data-more-action="auto-login"]');
        if (!button) return;
        button.textContent = localStorage.getItem(AUTO_LOGIN_KEY) === "true" ? "자동 로그인 해제" : "자동 로그인 설정";
    }

    function waitForElement(selector, timeout) {
        var startedAt = Date.now();
        return new Promise(function (resolve) {
            (function find() {
                var element = document.querySelector(selector);
                if (element || Date.now() - startedAt >= timeout) {
                    resolve(element || null);
                    return;
                }
                setTimeout(find, 50);
            })();
        });
    }

    function waitForProfileBinding(timeout) {
        var startedAt = Date.now();
        return new Promise(function (resolve) {
            (function check() {
                if (document.body.getAttribute("data-profile-layer-bound") === "true" || document.querySelector(".workbenchProfileLayer") || Date.now() - startedAt >= timeout) {
                    resolve();
                    return;
                }
                setTimeout(check, 50);
            })();
        });
    }

    function ensureProfileLayerVisible() {
        var layer = document.querySelector(".workbenchProfileLayer");
        if (!layer) return;
        installProfileLayerStyle();
        ensureProfileDim();
        if (layer.parentElement !== document.body) {
            document.body.appendChild(layer);
        }
        layer.hidden = false;
        layer.classList.add("is-open");
        document.body.classList.add("workbenchProfileLayerOpen");
    }

    function ensureProfileDim() {
        if (document.querySelector(".moreProfileDim")) return;
        var dim = document.createElement("button");
        dim.type = "button";
        dim.className = "moreProfileDim";
        dim.setAttribute("aria-label", "프로필 팝업 닫기");
        dim.addEventListener("click", function () {
            var closeButton = document.querySelector(".workbenchProfileCloseBtn");
            if (closeButton) closeButton.click();
        });
        document.body.appendChild(dim);
    }

    function installProfileLayerStyle() {
        if (document.getElementById("moreProfileLayerStyle")) return;
        var style = document.createElement("style");
        style.id = "moreProfileLayerStyle";
        style.textContent = [
            "@media all and (max-width:720px){",
            "body.morePage .moreProfileDim{display:none;position:fixed;inset:0;z-index:10029;border:0;background:rgba(58,64,76,.35);}",
            "body.morePage.workbenchProfileLayerOpen .moreProfileDim{display:block;}",
            "body.morePage .workbenchProfileLayer{position:fixed;top:50%;left:50%;right:auto;bottom:auto;z-index:10030;width:calc(100% - 30px);max-width:360px;border:1px solid #e1e1e1;border-radius:14px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.14);line-height:1;box-sizing:border-box;transform:translate(-50%,-50%);}",
            "body.morePage .workbenchProfileLayer[hidden]{display:none;}",
            "body.morePage .workbenchProfileLayerHead{padding:24px 22px 20px;}",
            "body.morePage .workbenchProfileLayerAvatar{width:64px;height:64px;font-size:25px;}",
            "body.morePage .workbenchProfileLayerName{font-size:20px;}",
            "body.morePage .workbenchProfileLayerEmail{font-size:15px;}",
            "body.morePage .workbenchProfileCloseBtn{width:30px;height:30px;margin-top:6px;}",
            "body.morePage .workbenchProfileCloseBtn svg{width:28px;height:28px;}",
            "body.morePage .workbenchProfileLayerBody{margin:0 22px;padding:18px 0 2px;}",
            "body.morePage .workbenchProfileInfoList div{grid-template-columns:112px minmax(0,1fr);min-height:40px;}",
            "body.morePage .workbenchProfileInfoList dt,body.morePage .workbenchProfileInfoList dd{font-size:15px;}",
            "body.morePage .workbenchProfileLayerActions{gap:12px;padding:16px 22px 18px;}",
            "body.morePage .workbenchProfileLayerActions button{height:48px;border-radius:8px;font-size:16px;}",
            "body.morePage .workbenchSettingsBox{padding:36px 24px 42px;}",
            "body.morePage .workbenchSettingsHead{margin-bottom:34px;}",
            "body.morePage .workbenchSettingsHead h3{font-size:28px;}",
            "body.morePage .workbenchSettingsRow{gap:16px;min-height:92px;}",
            "body.morePage .workbenchSettingsText strong{font-size:18px;}",
            "body.morePage .workbenchSettingsText em{font-size:15px;white-space:normal;}",
            "body.morePage .workbenchSettingsFolderBtn{min-width:88px;height:44px;font-size:15px;}",
            "}"
        ].join("");
        document.head.appendChild(style);
    }

    async function clearAppCache() {
        try {
            if ("caches" in window) {
                var keys = await caches.keys();
                await Promise.all(keys.map(function (key) {
                    return caches.delete(key);
                }));
            }
            alert("캐시를 삭제했습니다.");
        } catch (error) {
            alert("캐시를 삭제하지 못했습니다.");
        }
    }
})();
