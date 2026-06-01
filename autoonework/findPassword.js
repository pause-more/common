(function () {
    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        cacheElements();
        bindEvents();
        refreshSubmitState();
        focusUserId();
    });

    function cacheElements() {
        elements.userId = document.getElementById("findUserId");
        elements.userName = document.getElementById("findUserName");
        elements.birthDate = document.getElementById("findBirthDate");
        elements.submitBtn = document.getElementById("findPasswordBtn");
        elements.message = document.getElementById("findPasswordMsg");
    }

    function bindEvents() {
        if (elements.submitBtn) elements.submitBtn.addEventListener("click", submitFindPassword);
        [elements.userId, elements.userName, elements.birthDate].forEach(function (element) {
            if (!element) return;
            element.addEventListener("input", refreshSubmitState);
            element.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    submitFindPassword();
                }
            });
        });
    }

    async function submitFindPassword() {
        var userId = String(elements.userId && elements.userId.value || "").trim();
        var userName = String(elements.userName && elements.userName.value || "").trim();
        var birthDate = String(elements.birthDate && elements.birthDate.value || "").replace(/[^0-9]/g, "").trim();

        setMessage("");

        if (!userId || !userName || !birthDate) {
            setMessage("아이디, 이름, 생년월일을 모두 입력해주세요.");
            refreshSubmitState();
            return;
        }
        if (!/^[0-9]{8}$/.test(birthDate)) {
            setMessage("생년월일은 YYYYMMDD 8자리로 입력해주세요.");
            refreshSubmitState();
            return;
        }

        try {
            await window.AuthStore.findPassword(userId, userName, birthDate);
            alert("임시 비밀번호가 1234로 재설정되었습니다. 로그인 후 비밀번호를 변경해주세요.");
            location.href = "/login.html";
        } catch (error) {
            setMessage(error.message || "임시 비밀번호 발급 중 오류가 발생했습니다.");
            refreshSubmitState();
        }
    }

    function setMessage(message) {
        if (!elements.message) return;
        elements.message.textContent = message || "";
        elements.message.style.display = message ? "block" : "none";
    }

    function focusUserId() {
        if (!elements.userId) return;
        try {
            elements.userId.focus({ preventScroll: true });
        } catch (error) {
            elements.userId.focus();
        }
    }

    function refreshSubmitState() {
        if (!elements.submitBtn) return;
        var userId = String(elements.userId && elements.userId.value || "").trim();
        var userName = String(elements.userName && elements.userName.value || "").trim();
        var birthDate = String(elements.birthDate && elements.birthDate.value || "").replace(/[^0-9]/g, "").trim();
        elements.submitBtn.disabled = !(userId && userName && birthDate);
    }
})();
