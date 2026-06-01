(function () {
    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        if (!localStorage.getItem("isLogin")) {
            location.href = "/login.html";
            return;
        }
        cacheElements();
        bindEvents();
    });

    function cacheElements() {
        elements.newPassword = document.getElementById("newPassword");
        elements.confirmPassword = document.getElementById("confirmPassword");
        elements.passwordChangeBtn = document.getElementById("passwordChangeBtn");
        elements.passwordChangeMsg = document.getElementById("passwordChangeMsg");
    }

    function bindEvents() {
        if (elements.passwordChangeBtn) elements.passwordChangeBtn.addEventListener("click", submitPasswordChange);
        [elements.newPassword, elements.confirmPassword].forEach(function (input) {
            if (!input) return;
            input.addEventListener("keydown", function (event) {
                if (event.key !== "Enter") return;
                event.preventDefault();
                submitPasswordChange();
            });
        });
    }

    async function submitPasswordChange() {
        var userId = localStorage.getItem("userId") || "";
        var newPassword = String(elements.newPassword && elements.newPassword.value || "").trim();
        var confirmPassword = String(elements.confirmPassword && elements.confirmPassword.value || "").trim();
        setMessage("");

        if (!newPassword || !confirmPassword) {
            setMessage("새 비밀번호를 모두 입력해주세요.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage("비밀번호 확인이 일치하지 않습니다.");
            return;
        }

        try {
            await window.AuthStore.changeOwnPassword(userId, newPassword);
            alert("비밀번호가 변경되었습니다.");
            location.href = "./index.html";
        } catch (error) {
            setMessage(error.message);
        }
    }

    function setMessage(message) {
        if (!elements.passwordChangeMsg) return;
        elements.passwordChangeMsg.textContent = message || "";
        elements.passwordChangeMsg.style.display = message ? "block" : "none";
    }
})();
