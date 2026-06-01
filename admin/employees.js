(function () {
    var DEFAULT_TEMP_PASSWORD = "1234";
    var elements = {};
    var state = {
        departments: [],
        employees: [],
        selectedEmployeeId: "",
        employeeSearchKeyword: "",
        currentEmployeePage: 1,
        createSignatureImage: "",
        settingSignatureImage: ""
    };
    var EMPLOYEES_PER_PAGE = 15;

    document.addEventListener("DOMContentLoaded", async function () {
        await waitForAuthStore();

        if (!window.AuthStore || !window.AuthStore.canAccessAdminPages || !window.AuthStore.canAccessAdminPages()) {
            alert("접근 권한이 없습니다.");
            location.href = "/";
            return;
        }

        cacheElements();
        initializeBirthDateFields();
        initializeHireDateFields();
        initializeTimeFields();
        bindEvents();
        renderEmailPreview();

        try {
            await Promise.all([
                renderDepartmentList(),
                renderEmployeeTable()
            ]);
        } catch (error) {
            alert(error.message || "구성원 목록을 불러오지 못했습니다.");
        }
    });

    function waitForAuthStore() {
        return new Promise(function (resolve) {
            var startedAt = Date.now();

            function check() {
                if (window.AuthStore && typeof window.AuthStore.canAccessAdminPages === "function") {
                    resolve();
                    return;
                }
                if (Date.now() - startedAt > 2000) {
                    resolve();
                    return;
                }
                setTimeout(check, 30);
            }

            check();
        });
    }

    function cacheElements() {
        elements.employeeId = document.getElementById("employeeId");
        elements.employeeName = document.getElementById("employeeName");
        elements.employeeRole = document.getElementById("employeeRole");
        elements.employeePosition = document.getElementById("employeePosition");
        elements.employeeJobGrade = document.getElementById("employeeJobGrade");
        elements.employeeMobilePhone = document.getElementById("employeeMobilePhone");
        elements.employeeDirectPhone = document.getElementById("employeeDirectPhone");
        elements.employeeDirectPhoneNone = document.getElementById("employeeDirectPhoneNone");
        elements.employeeNumberPreview = document.getElementById("employeeNumberPreview");
        elements.employeeWeeklyScheduleField = document.getElementById("employeeWeeklyScheduleField");
        elements.employeeSignatureField = document.getElementById("employeeSignatureField");
        elements.employeeSignatureInput = document.getElementById("employeeSignatureInput");
        elements.employeeSignaturePreview = document.getElementById("employeeSignaturePreview");
        elements.employeeSignatureRemoveBtn = document.getElementById("employeeSignatureRemoveBtn");
        elements.employeeBirthDate = document.getElementById("employeeBirthDate");
        elements.employeeBirthYear = document.getElementById("employeeBirthYear");
        elements.employeeBirthMonth = document.getElementById("employeeBirthMonth");
        elements.employeeBirthDay = document.getElementById("employeeBirthDay");
        elements.employeeHireDate = document.getElementById("employeeHireDate");
        elements.employeeHireYear = document.getElementById("employeeHireYear");
        elements.employeeHireMonth = document.getElementById("employeeHireMonth");
        elements.employeeHireDay = document.getElementById("employeeHireDay");
        elements.employeeWorkStart = document.getElementById("employeeWorkStart");
        elements.employeeWorkEnd = document.getElementById("employeeWorkEnd");
        elements.employeeCreateBtn = document.getElementById("employeeCreateBtn");
        elements.employeeOpenModalBtn = document.getElementById("employeeOpenModalBtn");
        elements.employeeCloseModalBtn = document.getElementById("employeeCloseModalBtn");
        elements.employeeModal = document.getElementById("employeeModal");
        elements.employeeModalDim = document.querySelector("#employeeModal .employeeModalDim");
        elements.employeePreviewEmail = document.querySelector(".employeePreviewEmail");
        elements.employeeTableBody = document.querySelector(".employeeTableBody");
        elements.employeeCountText = document.querySelector(".employeeCountText");
        elements.employeeSearchInput = document.getElementById("employeeSearchInput");
        elements.employeePagination = document.getElementById("employeePagination");
        elements.employeeDepartment = document.getElementById("employeeDepartment");
        elements.departmentManageBtn = document.getElementById("departmentManageBtn");
        elements.departmentModal = document.getElementById("departmentModal");
        elements.departmentModalDim = document.querySelector("#departmentModal .departmentModalDim");
        elements.departmentCloseModalBtn = document.getElementById("departmentCloseModalBtn");
        elements.departmentNameInput = document.getElementById("departmentNameInput");
        elements.departmentAddBtn = document.getElementById("departmentAddBtn");
        elements.departmentList = document.getElementById("departmentList");

        elements.employeeSettingModal = document.getElementById("employeeSettingModal");
        elements.employeeSettingModalDim = document.querySelector(".employeeSettingModalDim");
        elements.employeeSettingCloseBtn = document.getElementById("employeeSettingCloseBtn");
        elements.employeeSettingTitle = document.querySelector(".employeeSettingTitle");
        elements.employeeSettingName = document.getElementById("employeeSettingNameInput");
        elements.employeeSettingId = document.getElementById("employeeSettingIdInput");
        elements.employeeSettingEmail = document.querySelector(".employeeSettingEmail");
        elements.employeeSettingRole = document.getElementById("employeeSettingRole");
        elements.employeeSettingBirthDate = document.getElementById("employeeSettingBirthDate");
        elements.employeeSettingBirthYear = document.getElementById("employeeSettingBirthYear");
        elements.employeeSettingBirthMonth = document.getElementById("employeeSettingBirthMonth");
        elements.employeeSettingBirthDay = document.getElementById("employeeSettingBirthDay");
        elements.employeeSettingHireDate = document.getElementById("employeeSettingHireDate");
        elements.employeeSettingHireYear = document.getElementById("employeeSettingHireYear");
        elements.employeeSettingHireMonth = document.getElementById("employeeSettingHireMonth");
        elements.employeeSettingHireDay = document.getElementById("employeeSettingHireDay");
        elements.employeeSettingDepartment = document.getElementById("employeeSettingDepartment");
        elements.employeeSettingPosition = document.getElementById("employeeSettingPosition");
        elements.employeeSettingJobGrade = document.getElementById("employeeSettingJobGrade");
        elements.employeeSettingMobilePhone = document.getElementById("employeeSettingMobilePhone");
        elements.employeeSettingDirectPhone = document.getElementById("employeeSettingDirectPhone");
        elements.employeeSettingDirectPhoneNone = document.getElementById("employeeSettingDirectPhoneNone");
        elements.employeeSettingEmployeeNumber = document.getElementById("employeeSettingEmployeeNumber");
        elements.employeeSettingWeeklyScheduleField = document.getElementById("employeeSettingWeeklyScheduleField");
        elements.employeeSettingSignatureField = document.getElementById("employeeSettingSignatureField");
        elements.employeeSettingSignatureInput = document.getElementById("employeeSettingSignatureInput");
        elements.employeeSettingSignaturePreview = document.getElementById("employeeSettingSignaturePreview");
        elements.employeeSettingSignatureRemoveBtn = document.getElementById("employeeSettingSignatureRemoveBtn");
        elements.employeeSettingWorkStart = document.getElementById("employeeSettingWorkStart");
        elements.employeeSettingWorkEnd = document.getElementById("employeeSettingWorkEnd");
        elements.employeeSettingSaveBtn = document.getElementById("employeeSettingSaveBtn");
        elements.employeeSettingResetBtn = document.getElementById("employeeSettingResetBtn");
        elements.employeeSettingDeleteBtn = document.getElementById("employeeSettingDeleteBtn");
    }

    function bindEvents() {
        if (elements.employeeId) elements.employeeId.addEventListener("input", renderEmailPreview);
        if (elements.employeeRole) {
            elements.employeeRole.addEventListener("change", function () {
                syncCreateRoleFields();
            });
        }
        if (elements.employeeJobGrade) {
            elements.employeeJobGrade.addEventListener("change", syncCreateSignatureField);
        }
        if (elements.employeeDepartment) {
            elements.employeeDepartment.addEventListener("change", function () {
                syncCreateRoleFields();
            });
        }
        if (elements.employeeSettingDepartment) {
            elements.employeeSettingDepartment.addEventListener("change", function () {
                syncSettingRoleFields(getEmployeeById(state.selectedEmployeeId));
            });
        }
        if (elements.employeeSettingRole) {
            elements.employeeSettingRole.addEventListener("change", function () {
                syncSettingRoleFields(getEmployeeById(state.selectedEmployeeId));
            });
        }
        if (elements.employeeSettingJobGrade) {
            elements.employeeSettingJobGrade.addEventListener("change", syncSettingSignatureField);
        }
        [elements.employeeMobilePhone, elements.employeeSettingMobilePhone].forEach(function (input) {
            if (!input) return;
            input.addEventListener("input", function () {
                input.value = formatPhoneNumber(input.value);
            });
        });
        if (elements.employeeDirectPhone) {
            elements.employeeDirectPhone.addEventListener("input", function () {
                elements.employeeDirectPhone.value = formatPhoneNumber(elements.employeeDirectPhone.value);
            });
        }
        if (elements.employeeSettingDirectPhone) {
            elements.employeeSettingDirectPhone.addEventListener("input", function () {
                elements.employeeSettingDirectPhone.value = formatPhoneNumber(elements.employeeSettingDirectPhone.value);
            });
        }
        if (elements.employeeDirectPhoneNone) {
            elements.employeeDirectPhoneNone.addEventListener("change", syncCreateDirectPhoneState);
        }
        if (elements.employeeSettingDirectPhoneNone) {
            elements.employeeSettingDirectPhoneNone.addEventListener("change", syncSettingDirectPhoneState);
        }
        if (elements.employeeCreateBtn) elements.employeeCreateBtn.addEventListener("click", createEmployee);
        if (elements.employeeOpenModalBtn) elements.employeeOpenModalBtn.addEventListener("click", openEmployeeModal);
        if (elements.employeeCloseModalBtn) elements.employeeCloseModalBtn.addEventListener("click", closeEmployeeModal);
        if (elements.employeeModalDim) elements.employeeModalDim.addEventListener("click", closeEmployeeModal);
        if (elements.departmentManageBtn) elements.departmentManageBtn.addEventListener("click", openDepartmentModal);
        if (elements.departmentCloseModalBtn) elements.departmentCloseModalBtn.addEventListener("click", closeDepartmentModal);
        if (elements.departmentModalDim) elements.departmentModalDim.addEventListener("click", closeDepartmentModal);
        if (elements.departmentAddBtn) elements.departmentAddBtn.addEventListener("click", handleAddDepartment);
        if (elements.departmentNameInput) {
            elements.departmentNameInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddDepartment();
                }
            });
        }
        if (elements.employeeSearchInput) {
            elements.employeeSearchInput.addEventListener("input", function () {
                state.employeeSearchKeyword = normalizeSearchKeyword(elements.employeeSearchInput.value);
                state.currentEmployeePage = 1;
                renderEmployeeRows();
            });
        }

        if (elements.employeeSettingCloseBtn) elements.employeeSettingCloseBtn.addEventListener("click", closeEmployeeSettingModal);
        if (elements.employeeSettingModalDim) elements.employeeSettingModalDim.addEventListener("click", closeEmployeeSettingModal);
        if (elements.employeeSettingSaveBtn) elements.employeeSettingSaveBtn.addEventListener("click", handleSaveEmployeeSettings);
        if (elements.employeeSettingResetBtn) elements.employeeSettingResetBtn.addEventListener("click", handleResetEmployeePassword);
        if (elements.employeeSettingDeleteBtn) elements.employeeSettingDeleteBtn.addEventListener("click", handleDeleteEmployee);
        if (elements.employeeSignatureInput) elements.employeeSignatureInput.addEventListener("change", function () {
            handleSignatureFileChange(elements.employeeSignatureInput, "create");
        });
        if (elements.employeeSettingSignatureInput) elements.employeeSettingSignatureInput.addEventListener("change", function () {
            handleSignatureFileChange(elements.employeeSettingSignatureInput, "setting");
        });
        if (elements.employeeSignatureRemoveBtn) elements.employeeSignatureRemoveBtn.addEventListener("click", function () {
            clearSignatureImage("create");
        });
        if (elements.employeeSettingSignatureRemoveBtn) elements.employeeSettingSignatureRemoveBtn.addEventListener("click", function () {
            clearSignatureImage("setting");
        });
    }

    async function openDepartmentModal() {
        if (!elements.departmentModal) return;
        await renderDepartmentList();
        elements.departmentModal.style.display = "block";
        setModalOpen(true);
        if (elements.departmentNameInput) {
            elements.departmentNameInput.value = "";
            elements.departmentNameInput.focus();
        }
    }

    function closeDepartmentModal() {
        if (!elements.departmentModal) return;
        elements.departmentModal.style.display = "none";
        if (elements.departmentNameInput) elements.departmentNameInput.value = "";
        if (!isAnyModalOpen()) setModalOpen(false);
    }

    function initializeBirthDateFields() {
        initializeBirthDateSelectGroup(
            elements.employeeBirthYear,
            elements.employeeBirthMonth,
            elements.employeeBirthDay,
            elements.employeeBirthDate
        );
        initializeBirthDateSelectGroup(
            elements.employeeSettingBirthYear,
            elements.employeeSettingBirthMonth,
            elements.employeeSettingBirthDay,
            elements.employeeSettingBirthDate
        );
    }

    function initializeHireDateFields() {
        initializeDateSelectGroup(
            elements.employeeHireYear,
            elements.employeeHireMonth,
            elements.employeeHireDay,
            elements.employeeHireDate
        );
        initializeDateSelectGroup(
            elements.employeeSettingHireYear,
            elements.employeeSettingHireMonth,
            elements.employeeSettingHireDay,
            elements.employeeSettingHireDate
        );
    }

    function initializeBirthDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput) {
        initializeDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function initializeDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput) {
        if (!yearSelect || !monthSelect || !daySelect || !hiddenInput) return;
        fillYearOptions(yearSelect);
        fillMonthOptions(monthSelect);
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, hiddenInput.value);

        [yearSelect, monthSelect, daySelect].forEach(function (select) {
            select.addEventListener("change", function () {
                if (select === yearSelect || select === monthSelect) {
                    refreshDayOptions(daySelect, yearSelect.value, monthSelect.value);
                }
                syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
            });
        });
    }

    function initializeTimeFields() {
        [
            elements.employeeWorkStart,
            elements.employeeWorkEnd,
            elements.employeeSettingWorkStart,
            elements.employeeSettingWorkEnd
        ].forEach(fillTimeOptions);
    }

    function fillTimeOptions(select) {
        if (!select || select.tagName !== "SELECT" || select.getAttribute("data-time-ready") === "true") return;

        var currentValue = String(select.value || "").trim();
        var options = ['<option value="">--:--</option>'];

        for (var hour = 0; hour < 24; hour += 1) {
            for (var minute = 0; minute < 60; minute += 30) {
                var value = padTime(hour) + ":" + padTime(minute);
                options.push('<option value="' + value + '">' + value + '</option>');
            }
        }

        select.innerHTML = options.join("");
        if (currentValue) select.value = currentValue;
        select.setAttribute("data-time-ready", "true");
    }

    function renderEmailPreview() {
        if (!elements.employeePreviewEmail) return;
        var id = String(elements.employeeId && elements.employeeId.value || "").trim().toLowerCase();
        elements.employeePreviewEmail.textContent = id ? id + "@autonecar.kr" : "-";
    }

    async function createEmployee() {
        var tempPassword = DEFAULT_TEMP_PASSWORD;
        var role = elements.employeeRole ? elements.employeeRole.value : "staff";
        var isCeo = role === "ceo";
        var department = elements.employeeDepartment ? elements.employeeDepartment.value : "";
        var workSchedule = isCeo ? {} : buildDepartmentWorkSchedule(department);
        var isScheduledDepartment = hasWorkSchedule(workSchedule);
        var birthDate = normalizeDateInput(elements.employeeBirthDate && elements.employeeBirthDate.value);
        var hireDate = isCeo ? "" : normalizeDateInput(elements.employeeHireDate && elements.employeeHireDate.value);
        var workStart = isCeo ? "" : String(elements.employeeWorkStart && elements.employeeWorkStart.value || "").trim();
        var workEnd = isCeo ? "" : String(elements.employeeWorkEnd && elements.employeeWorkEnd.value || "").trim();
        var workHours = isScheduledDepartment ? getPrimaryWorkHoursFromSchedule(workSchedule) : buildWorkHours(workStart, workEnd);

        if (!isCeo && !isScheduledDepartment && ((workStart && !workEnd) || (!workStart && workEnd))) {
            alert("근무 시작시간과 종료시간을 모두 입력해주세요.");
            return;
        }

        try {
            var employee = await window.AuthStore.createEmployee({
                id: elements.employeeId ? elements.employeeId.value : "",
                name: elements.employeeName ? elements.employeeName.value : "",
                password: tempPassword,
                role: role,
                department: department,
                position: getInputValue(elements.employeePosition),
                jobGrade: getInputValue(elements.employeeJobGrade),
                mobilePhone: getInputValue(elements.employeeMobilePhone),
                directPhone: elements.employeeDirectPhoneNone && elements.employeeDirectPhoneNone.checked ? "" : getInputValue(elements.employeeDirectPhone),
                birthDate: birthDate,
                hireDate: hireDate,
                workHours: workHours,
                workSchedule: workSchedule,
                signatureImage: isSignatureEligible(getInputValue(elements.employeeJobGrade), role) ? state.createSignatureImage : ""
            });
            alert("구성원이 추가되었습니다.\n메일주소: " + employee.email + "\n임시 비밀번호: " + tempPassword);
            clearForm();
            closeEmployeeModal();
            await renderDepartmentList();
            await renderEmployeeTable();
        } catch (error) {
            alert(error.message);
        }
    }

    function clearForm() {
        if (elements.employeeId) elements.employeeId.value = "";
        if (elements.employeeName) elements.employeeName.value = "";
        if (elements.employeeRole) elements.employeeRole.value = "staff";
        if (elements.employeeDepartment) elements.employeeDepartment.value = "";
        if (elements.employeePosition) elements.employeePosition.value = "";
        if (elements.employeeJobGrade) elements.employeeJobGrade.value = "";
        if (elements.employeeMobilePhone) elements.employeeMobilePhone.value = "";
        if (elements.employeeDirectPhone) elements.employeeDirectPhone.value = "";
        if (elements.employeeDirectPhoneNone) elements.employeeDirectPhoneNone.checked = false;
        state.createSignatureImage = "";
        if (elements.employeeSignatureInput) elements.employeeSignatureInput.value = "";
        renderSignaturePreview("create");
        syncCreateDirectPhoneState();
        if (elements.employeeNumberPreview) elements.employeeNumberPreview.value = "자동 생성";
        setBirthDateSelectValue(
            elements.employeeBirthYear,
            elements.employeeBirthMonth,
            elements.employeeBirthDay,
            elements.employeeBirthDate,
            ""
        );
        setDateSelectValue(
            elements.employeeHireYear,
            elements.employeeHireMonth,
            elements.employeeHireDay,
            elements.employeeHireDate,
            ""
        );
        if (elements.employeeWorkStart) elements.employeeWorkStart.value = "";
        if (elements.employeeWorkEnd) elements.employeeWorkEnd.value = "";
        syncCreateRoleFields();
        renderEmailPreview();
    }

    function openEmployeeModal() {
        if (!elements.employeeModal) return;
        syncCreateRoleFields();
        elements.employeeModal.style.display = "block";
        setModalOpen(true);
        if (elements.employeeId) elements.employeeId.focus();
    }

    function closeEmployeeModal() {
        if (!elements.employeeModal) return;
        elements.employeeModal.style.display = "none";
        if (!isAnyModalOpen()) setModalOpen(false);
    }

    function openEmployeeSettingModal(employeeId) {
        var employee = getEmployeeById(employeeId);
        if (!employee || !elements.employeeSettingModal) return;

        state.selectedEmployeeId = employee.id;
        populateEmployeeSettingForm(employee);
        elements.employeeSettingModal.style.display = "block";
        setModalOpen(true);
        if (elements.employeeSettingName) elements.employeeSettingName.focus();
    }

    function closeEmployeeSettingModal() {
        if (!elements.employeeSettingModal) return;
        elements.employeeSettingModal.style.display = "none";
        state.selectedEmployeeId = "";
        if (!isAnyModalOpen()) setModalOpen(false);
    }

    function isAnyModalOpen() {
        var addOpen = !!(elements.employeeModal && elements.employeeModal.style.display !== "none");
        var settingsOpen = !!(elements.employeeSettingModal && elements.employeeSettingModal.style.display !== "none");
        var departmentOpen = !!(elements.departmentModal && elements.departmentModal.style.display !== "none");
        return addOpen || settingsOpen || departmentOpen;
    }

    function setModalOpen(isOpen) {
        document.documentElement.classList.toggle("employeeModalOpen", !!isOpen);
        document.body.classList.toggle("employeeModalOpen", !!isOpen);
    }

    async function renderEmployeeTable() {
        if (!elements.employeeTableBody) return;

        state.employees = (await window.AuthStore.getEmployees({ mergeAttendance: false })).filter(isVisibleEmployee).slice().sort(function (a, b) {
            if (isPinnedRepresentative(a) !== isPinnedRepresentative(b)) return isPinnedRepresentative(a) ? -1 : 1;
            if (a.role !== b.role) return getRoleRank(a.role) - getRoleRank(b.role);
            return a.name.localeCompare(b.name, "ko");
        });

        if (elements.employeeCountText) elements.employeeCountText.textContent = "총 " + state.employees.length + "명";

        if (!state.employees.length) {
            elements.employeeTableBody.innerHTML = '<tr class="employeeEmptyRow"><td colspan="6">등록된 구성원이 없습니다.</td></tr>';
            renderEmployeePagination(0);
            return;
        }

        renderEmployeeRows();
    }

    function renderEmployeeRows() {
        if (!elements.employeeTableBody) return;

        var filteredEmployees = getFilteredEmployees();

        if (!filteredEmployees.length) {
            elements.employeeTableBody.innerHTML = '<tr class="employeeEmptyRow"><td colspan="6">검색 결과가 없습니다.</td></tr>';
            renderEmployeePagination(0);
            return;
        }

        var totalPages = Math.ceil(filteredEmployees.length / EMPLOYEES_PER_PAGE);
        if (state.currentEmployeePage > totalPages) state.currentEmployeePage = totalPages;
        if (state.currentEmployeePage < 1) state.currentEmployeePage = 1;
        var startIndex = (state.currentEmployeePage - 1) * EMPLOYEES_PER_PAGE;
        var pageEmployees = filteredEmployees.slice(startIndex, startIndex + EMPLOYEES_PER_PAGE);

        elements.employeeTableBody.innerHTML = pageEmployees.map(function (employee) {
            var isRepresentative = isRepresentativeEmployee(employee);
            return ''
                + '<tr data-employee-id="' + escapeHtml(employee.id) + '">'
                + '<td class="employeeNameCell">'
                + '<div class="employeeNameWrap">'
                + '<strong class="employeeNameText">' + escapeHtml(employee.name) + '</strong>'
                + '<button type="button" class="employeeLineSettingBtn settingBtn">설정</button>'
                + '</div>'
                + '</td>'
                + '<td>' + escapeHtml(formatDateValue(employee.birthDate, "미입력")) + '</td>'
                + '<td>' + escapeHtml(isRepresentative ? "-" : formatDateValue(employee.hireDate, "미입력")) + '</td>'
                + '<td>' + escapeHtml(isRepresentative ? "-" : employee.department || "미지정") + '</td>'
                + '<td>' + escapeHtml(employee.id) + '</td>'
                + '<td>' + escapeHtml(employee.email) + '</td>'
                + '</tr>';
        }).join("");

        bindRowEvents();
        renderEmployeePagination(totalPages);
    }

    function renderEmployeePagination(totalPages) {
        if (!elements.employeePagination) return;
        if (!totalPages || totalPages <= 1) {
            elements.employeePagination.innerHTML = "";
            elements.employeePagination.style.display = "none";
            return;
        }

        var buttons = [];
        for (var page = 1; page <= totalPages; page += 1) {
            buttons.push(
                '<button type="button" class="employeePageBtn' + (page === state.currentEmployeePage ? ' is-active' : '') + '" data-page="' + page + '">' + page + '</button>'
            );
        }

        elements.employeePagination.innerHTML = buttons.join("");
        elements.employeePagination.style.display = "flex";

        Array.prototype.slice.call(elements.employeePagination.querySelectorAll(".employeePageBtn")).forEach(function (button) {
            button.addEventListener("click", function () {
                var nextPage = Number(button.getAttribute("data-page") || 1);
                if (!nextPage || nextPage === state.currentEmployeePage) return;
                state.currentEmployeePage = nextPage;
                renderEmployeeRows();
            });
        });
    }

    function getFilteredEmployees() {
        var keyword = state.employeeSearchKeyword;
        if (!keyword) return state.employees.slice();
        return state.employees.filter(function (employee) {
            return normalizeSearchKeyword(employee && employee.name).indexOf(keyword) > -1;
        });
    }

    function isVisibleEmployee(employee) {
        var id = String(employee && employee.id || "").trim().toLowerCase();
        var name = String(employee && employee.name || "").trim();
        return id !== "admin" && id !== "work" && id !== "test" && name !== "홍길동";
    }

    async function renderDepartmentList() {
        state.departments = await window.AuthStore.getDepartments();
        renderDepartmentOptions();

        if (!elements.departmentList) return;
        if (!state.departments.length) {
            elements.departmentList.innerHTML = '<span class="employeeDepartmentEmpty">등록된 부서가 없습니다.</span>';
            return;
        }

        elements.departmentList.innerHTML = state.departments.map(function (department) {
            return ''
                + '<div class="employeeDepartmentItem" data-department-name="' + escapeHtml(department) + '">'
                + '<span class="employeeDepartmentName">' + escapeHtml(department) + '</span>'
                + '<div class="employeeDepartmentActions">'
                + '<button type="button" class="employeeDepartmentActionBtn departmentEditBtn">부서명 변경</button>'
                + '<button type="button" class="employeeDepartmentActionBtn departmentDeleteBtn">삭제</button>'
                + '</div>'
                + '</div>';
        }).join("");

        Array.prototype.slice.call(elements.departmentList.querySelectorAll(".departmentEditBtn")).forEach(function (button) {
            button.addEventListener("click", async function () {
                var item = button.closest(".employeeDepartmentItem");
                var currentName = item ? item.getAttribute("data-department-name") : "";
                var nextName = prompt("부서명을 입력해주세요.", currentName);
                if (nextName === null) return;
                nextName = String(nextName || "").trim();
                if (!nextName) {
                    alert("부서명을 입력해주세요.");
                    return;
                }
                try {
                    await window.AuthStore.updateDepartment(currentName, nextName);
                    await renderDepartmentList();
                    await renderEmployeeTable();
                    if (state.selectedEmployeeId) {
                        populateEmployeeSettingForm(getEmployeeById(state.selectedEmployeeId));
                    }
                } catch (error) {
                    alert(error.message);
                }
            });
        });

        Array.prototype.slice.call(elements.departmentList.querySelectorAll(".departmentDeleteBtn")).forEach(function (button) {
            button.addEventListener("click", async function () {
                var item = button.closest(".employeeDepartmentItem");
                var currentName = item ? item.getAttribute("data-department-name") : "";
                if (!currentName) return;
                if (!confirm(currentName + " 부서를 삭제하시겠습니까?")) return;
                try {
                    await window.AuthStore.deleteDepartment(currentName);
                    await renderDepartmentList();
                    await renderEmployeeTable();
                    if (state.selectedEmployeeId) {
                        populateEmployeeSettingForm(getEmployeeById(state.selectedEmployeeId));
                    }
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    }

    function renderDepartmentOptions() {
        [elements.employeeDepartment, elements.employeeSettingDepartment].forEach(function (select) {
            if (!select) return;
            var currentValue = select.value;
            select.innerHTML = '<option value="">부서 미지정</option>' + state.departments.map(function (department) {
                return '<option value="' + escapeHtml(department) + '">' + escapeHtml(department) + '</option>';
            }).join("");
            select.value = state.departments.indexOf(currentValue) > -1 ? currentValue : "";
        });
    }

    async function handleAddDepartment() {
        var name = String(elements.departmentNameInput && elements.departmentNameInput.value || "").trim();
        if (!name) {
            alert("부서명을 입력해주세요.");
            if (elements.departmentNameInput) elements.departmentNameInput.focus();
            return;
        }
        try {
            await window.AuthStore.createDepartment(name);
            if (elements.departmentNameInput) elements.departmentNameInput.value = "";
            await renderDepartmentList();
            if (elements.departmentNameInput) elements.departmentNameInput.focus();
        } catch (error) {
            alert(error.message);
        }
    }

    function bindRowEvents() {
        Array.prototype.slice.call(document.querySelectorAll(".settingBtn")).forEach(function (button) {
            button.addEventListener("click", function () {
                var row = button.closest("tr");
                var employeeId = row ? row.getAttribute("data-employee-id") : "";
                if (!employeeId) return;
                openEmployeeSettingModal(employeeId);
            });
        });
    }

    function populateEmployeeSettingForm(employee) {
        if (!employee) return;

        var workRange = splitWorkHours(employee.workHours || employee.workTime || "");

        if (elements.employeeSettingTitle) elements.employeeSettingTitle.textContent = employee.name + " 구성원 설정";
        if (elements.employeeSettingName) elements.employeeSettingName.value = employee.name || "";
        if (elements.employeeSettingId) elements.employeeSettingId.value = employee.id || "";
        if (elements.employeeSettingEmail) elements.employeeSettingEmail.textContent = employee.email;
        if (elements.employeeSettingRole) elements.employeeSettingRole.value = isRepresentativeEmployee(employee) ? "admin" : "staff";
        setBirthDateSelectValue(
            elements.employeeSettingBirthYear,
            elements.employeeSettingBirthMonth,
            elements.employeeSettingBirthDay,
            elements.employeeSettingBirthDate,
            employee.birthDate
        );
        setDateSelectValue(
            elements.employeeSettingHireYear,
            elements.employeeSettingHireMonth,
            elements.employeeSettingHireDay,
            elements.employeeSettingHireDate,
            employee.hireDate
        );

        renderDepartmentOptions();
        if (elements.employeeSettingDepartment) {
            elements.employeeSettingDepartment.value = state.departments.indexOf(employee.department || "") > -1 ? employee.department : "";
        }
        if (elements.employeeSettingPosition) elements.employeeSettingPosition.value = employee.position || "";
        if (elements.employeeSettingJobGrade) elements.employeeSettingJobGrade.value = employee.jobGrade || "";
        if (elements.employeeSettingMobilePhone) elements.employeeSettingMobilePhone.value = formatPhoneNumber(employee.mobilePhone || "");
        if (elements.employeeSettingDirectPhone) elements.employeeSettingDirectPhone.value = formatPhoneNumber(employee.directPhone || "");
        if (elements.employeeSettingDirectPhoneNone) elements.employeeSettingDirectPhoneNone.checked = !String(employee.directPhone || "").trim();
        if (elements.employeeSettingEmployeeNumber) elements.employeeSettingEmployeeNumber.value = employee.employeeNumber || "자동 생성 예정";
        if (elements.employeeSettingWorkStart) elements.employeeSettingWorkStart.value = workRange.start;
        if (elements.employeeSettingWorkEnd) elements.employeeSettingWorkEnd.value = workRange.end;
        state.settingSignatureImage = String(employee.signatureImage || "").trim();
        if (elements.employeeSettingSignatureInput) elements.employeeSettingSignatureInput.value = "";
        renderSignaturePreview("setting");
        syncSettingRoleFields(employee);

        if (elements.employeeSettingDeleteBtn) {
            elements.employeeSettingDeleteBtn.style.display = employee.id === "admin" ? "none" : "";
        }
    }

    async function handleSaveEmployeeSettings() {
        var employee = getEmployeeById(state.selectedEmployeeId);
        if (!employee) return;

        var isCeo = isCeoRole(elements.employeeSettingRole && elements.employeeSettingRole.value);
        var birthDate = normalizeDateInput(elements.employeeSettingBirthDate && elements.employeeSettingBirthDate.value);
        var hireDate = isCeo ? "" : normalizeDateInput(elements.employeeSettingHireDate && elements.employeeSettingHireDate.value);
        var department = String(elements.employeeSettingDepartment && elements.employeeSettingDepartment.value || "").trim();
        var workSchedule = isCeo ? {} : buildDepartmentWorkSchedule(department);
        var isScheduledDepartment = hasWorkSchedule(workSchedule);
        var workStart = isCeo ? "" : String(elements.employeeSettingWorkStart && elements.employeeSettingWorkStart.value || "").trim();
        var workEnd = isCeo ? "" : String(elements.employeeSettingWorkEnd && elements.employeeSettingWorkEnd.value || "").trim();
        var workHours = isScheduledDepartment ? getPrimaryWorkHoursFromSchedule(workSchedule) : buildWorkHours(workStart, workEnd);

        if (!isCeo && !isScheduledDepartment && ((workStart && !workEnd) || (!workStart && workEnd))) {
            alert("근무 시작시간과 종료시간을 모두 입력해주세요.");
            return;
        }

        try {
            await saveEmployeeProfile({
                employee: employee,
                name: getInputValue(elements.employeeSettingName),
                role: elements.employeeSettingRole ? elements.employeeSettingRole.value : employee.role,
                birthDate: birthDate,
                hireDate: hireDate,
                department: department,
                position: getInputValue(elements.employeeSettingPosition),
                jobGrade: getInputValue(elements.employeeSettingJobGrade),
                mobilePhone: getInputValue(elements.employeeSettingMobilePhone),
                directPhone: elements.employeeSettingDirectPhoneNone && elements.employeeSettingDirectPhoneNone.checked ? "" : getInputValue(elements.employeeSettingDirectPhone),
                workHours: workHours,
                workSchedule: workSchedule,
                signatureImage: isSignatureEligible(getInputValue(elements.employeeSettingJobGrade), elements.employeeSettingRole && elements.employeeSettingRole.value) ? state.settingSignatureImage : ""
            });
            alert(employee.name + " 구성원 정보가 저장되었습니다.");
            await renderEmployeeTable();
            closeEmployeeSettingModal();
        } catch (error) {
            alert(error.message || "구성원 정보를 저장하지 못했습니다.");
        }
    }

    async function saveEmployeeProfile(payload) {
        var updated = await window.AuthStore.updateEmployeeProfile({
            id: payload.employee.id,
            name: payload.name,
            role: payload.role,
            birthDate: payload.birthDate,
            hireDate: payload.hireDate,
            department: payload.department,
            position: payload.position,
            jobGrade: payload.jobGrade,
            mobilePhone: payload.mobilePhone,
            directPhone: payload.directPhone,
            workHours: payload.workHours,
            workSchedule: payload.workSchedule
        });
        if (window.AuthStore && typeof window.AuthStore.updateEmployeeSignature === "function") {
            updated = await window.AuthStore.updateEmployeeSignature({
                id: payload.employee.id,
                signatureImage: payload.signatureImage || ""
            });
        }
        return updated;
    }

    async function handleResetEmployeePassword() {
        var employee = getEmployeeById(state.selectedEmployeeId);
        if (!employee) return;
        if (!confirm(employee.name + " 계정의 비밀번호를 " + DEFAULT_TEMP_PASSWORD + "로 초기화할까요?")) return;

        try {
            await window.AuthStore.resetEmployeePassword(employee.id, DEFAULT_TEMP_PASSWORD);
            alert(employee.name + " 계정의 임시 비밀번호가 " + DEFAULT_TEMP_PASSWORD + "로 초기화되었습니다.");
            await renderEmployeeTable();
            closeEmployeeSettingModal();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDeleteEmployee() {
        var employee = getEmployeeById(state.selectedEmployeeId);
        if (!employee || employee.id === "admin") return;
        if (!confirm(employee.name + " 구성원을 삭제할까요?")) return;

        try {
            await window.AuthStore.deleteEmployee(employee.id);
            await renderDepartmentList();
            await renderEmployeeTable();
            closeEmployeeSettingModal();
        } catch (error) {
            alert(error.message);
        }
    }

    function getEmployeeById(employeeId) {
        return state.employees.find(function (employee) {
            return employee && employee.id === employeeId;
        }) || null;
    }

    function normalizeSearchKeyword(value) {
        return String(value || "").replace(/\s+/g, "").trim().toLowerCase();
    }

    function getRoleRank(role) {
        var value = String(role || "").trim().toLowerCase();
        if (value === "admin") return 0;
        if (value === "ceo") return 1;
        return 2;
    }

    function isPinnedRepresentative(employee) {
        return String(employee && employee.id || "").trim().toLowerCase() === "jschoi";
    }

    function syncCreateRoleFields() {
        var shouldShow = !isCeoRole(elements.employeeRole && elements.employeeRole.value);
        var department = getInputValue(elements.employeeDepartment);
        toggleFieldVisibility(elements.employeeHireDate, shouldShow);
        toggleFieldVisibility(elements.employeePosition, shouldShow);
        toggleFieldVisibility(elements.employeeJobGrade, shouldShow);
        toggleFieldVisibility(elements.employeeDirectPhone, shouldShow);
        if (elements.employeeDirectPhoneNone) {
            toggleFieldVisibility(elements.employeeDirectPhoneNone, shouldShow);
        }
        syncCreateDirectPhoneState();
        syncWorkScheduleFieldState(elements.employeeWorkStart, elements.employeeWeeklyScheduleField, shouldShow, department);
        syncCreateSignatureField();
    }

    function syncCreateDirectPhoneState() {
        if (!elements.employeeDirectPhone || !elements.employeeDirectPhoneNone) return;
        if (elements.employeeDirectPhoneNone.checked) {
            elements.employeeDirectPhone.value = "";
        }
        elements.employeeDirectPhone.disabled = elements.employeeDirectPhoneNone.checked;
    }

    function syncSettingRoleFields(employee) {
        var shouldShow = !isCeoRole(elements.employeeSettingRole && elements.employeeSettingRole.value);
        var department = getInputValue(elements.employeeSettingDepartment) || String(employee && employee.department || "").trim();
        toggleFieldVisibility(elements.employeeSettingHireDate, shouldShow);
        toggleFieldVisibility(elements.employeeSettingPosition, shouldShow);
        toggleFieldVisibility(elements.employeeSettingJobGrade, shouldShow);
        toggleFieldVisibility(elements.employeeSettingDirectPhone, shouldShow);
        if (elements.employeeSettingDirectPhoneNone) {
            toggleFieldVisibility(elements.employeeSettingDirectPhoneNone, shouldShow);
        }
        syncSettingDirectPhoneState();
        syncWorkScheduleFieldState(elements.employeeSettingWorkStart, elements.employeeSettingWeeklyScheduleField, shouldShow, department);
        syncSettingSignatureField();
    }

    function syncCreateSignatureField() {
        var show = isSignatureEligible(getInputValue(elements.employeeJobGrade), elements.employeeRole && elements.employeeRole.value);
        toggleSignatureField("create", show);
    }

    function syncSettingSignatureField() {
        var show = isSignatureEligible(getInputValue(elements.employeeSettingJobGrade), elements.employeeSettingRole && elements.employeeSettingRole.value);
        toggleSignatureField("setting", show);
    }

    function isSignatureEligible(jobGrade, role) {
        var grade = String(jobGrade || "").trim();
        var normalizedRole = String(role || "").trim().toLowerCase();
        return normalizedRole === "admin" || ["팀장", "수석 팀장", "부서장", "대표"].indexOf(grade) > -1;
    }

    function toggleSignatureField(type, show) {
        var field = type === "setting" ? elements.employeeSettingSignatureField : elements.employeeSignatureField;
        if (!field) return;
        field.style.display = show ? "" : "none";
        if (!show) clearSignatureImage(type);
    }

    function handleSignatureFileChange(input, type) {
        var file = input && input.files && input.files[0];
        if (!file) return;
        if (!isAllowedSignatureFile(file)) {
            alert("서명 이미지는 JPG 또는 PNG 파일만 등록할 수 있습니다.");
            input.value = "";
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            if (type === "setting") state.settingSignatureImage = String(reader.result || "");
            else state.createSignatureImage = String(reader.result || "");
            renderSignaturePreview(type);
        };
        reader.onerror = function () {
            alert("서명 이미지를 읽지 못했습니다.");
            input.value = "";
        };
        reader.readAsDataURL(file);
    }

    function isAllowedSignatureFile(file) {
        var type = String(file && file.type || "").toLowerCase();
        var name = String(file && file.name || "").toLowerCase();
        return type === "image/jpeg" || type === "image/png" || /\.(jpe?g|png)$/.test(name);
    }

    function clearSignatureImage(type) {
        if (type === "setting") {
            state.settingSignatureImage = "";
            if (elements.employeeSettingSignatureInput) elements.employeeSettingSignatureInput.value = "";
        } else {
            state.createSignatureImage = "";
            if (elements.employeeSignatureInput) elements.employeeSignatureInput.value = "";
        }
        renderSignaturePreview(type);
    }

    function renderSignaturePreview(type) {
        var value = type === "setting" ? state.settingSignatureImage : state.createSignatureImage;
        var preview = type === "setting" ? elements.employeeSettingSignaturePreview : elements.employeeSignaturePreview;
        if (!preview) return;
        preview.innerHTML = value ? '<img src="' + escapeHtml(value) + '" alt="등록된 결재선 서명">' : "등록된 서명이 없습니다.";
    }

    function syncSettingDirectPhoneState() {
        if (!elements.employeeSettingDirectPhone || !elements.employeeSettingDirectPhoneNone) return;
        if (elements.employeeSettingDirectPhoneNone.checked) {
            elements.employeeSettingDirectPhone.value = "";
        }
        elements.employeeSettingDirectPhone.disabled = elements.employeeSettingDirectPhoneNone.checked;
    }

    function toggleFieldVisibility(input, show) {
        var field = input ? input.closest(".employeeField") : null;
        if (!field) return;
        field.style.display = show ? "" : "none";
        if (!show && input) input.value = "";
    }

    function syncWorkScheduleFieldState(timeInput, scheduleField, shouldShow, department) {
        var isScheduledDepartment = shouldShow && isSalesFlexibleDepartment(department);
        toggleTimeFieldVisibility(timeInput, shouldShow && !isScheduledDepartment, !shouldShow);
        toggleWeeklyScheduleField(scheduleField, isScheduledDepartment);
    }

    function toggleWeeklyScheduleField(field, show) {
        if (!field) return;
        field.style.display = show ? "" : "none";
    }

    function toggleTimeFieldVisibility(input, show, shouldClear) {
        var field = input ? input.closest(".employeeField") : null;
        if (!field) return;
        field.style.display = show ? "" : "none";
        if (!show && shouldClear) {
            if (elements.employeeWorkStart && input === elements.employeeWorkStart) {
                elements.employeeWorkStart.value = "";
                if (elements.employeeWorkEnd) elements.employeeWorkEnd.value = "";
            }
            if (elements.employeeSettingWorkStart && input === elements.employeeSettingWorkStart) {
                elements.employeeSettingWorkStart.value = "";
                if (elements.employeeSettingWorkEnd) elements.employeeSettingWorkEnd.value = "";
            }
        }
    }

    function isCeoRole(role) {
        return String(role || "").trim().toLowerCase() === "admin";
    }

    function isRepresentativeEmployee(employee) {
        if (employee && window.AuthStore && typeof window.AuthStore.isExecutive === "function") {
            var current = window.AuthStore.getCurrentUser && window.AuthStore.getCurrentUser();
            if (current && String(current.id || "") === String(employee.id || "")) return window.AuthStore.isExecutive();
        }
        var role = String(employee && employee.role || "").trim().toLowerCase();
        var department = String(employee && employee.department || "").trim();
        return role === "admin" || role === "ceo" || department === "대표";
    }

    function isSalesFlexibleDepartment(department) {
        var value = String(department || "").trim();
        return value === "영업1팀" || value === "영업2팀";
    }

    function buildDepartmentWorkSchedule(department) {
        if (!isSalesFlexibleDepartment(department)) return {};
        return {
            mon: "09:00 - 18:00",
            tue: "09:00 - 19:00",
            wed: "09:00 - 18:00",
            thu: "09:00 - 19:00",
            fri: "09:00 - 18:00"
        };
    }

    function hasWorkSchedule(workSchedule) {
        return !!(workSchedule && typeof workSchedule === "object" && Object.keys(workSchedule).length);
    }

    function getPrimaryWorkHoursFromSchedule(workSchedule) {
        if (!hasWorkSchedule(workSchedule)) return "";
        return normalizeWorkHours(workSchedule.mon || workSchedule.wed || workSchedule.fri || workSchedule.tue || workSchedule.thu || "");
    }

    function getInputValue(input) {
        return String(input && input.value || "").trim();
    }

    function formatPhoneNumber(value) {
        var digits = String(value || "").replace(/[^0-9]/g, "").slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return digits.slice(0, 3) + "-" + digits.slice(3);
        return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
    }

    function normalizeDateInput(value) {
        var normalized = String(value || "").replace(/[^0-9]/g, "").trim();
        return /^[0-9]{8}$/.test(normalized) ? normalized : "";
    }

    function fillYearOptions(select) {
        if (!select || select.getAttribute("data-year-ready") === "true") return;
        var currentYear = new Date().getFullYear();
        var options = ['<option value="">연도</option>'];
        for (var year = currentYear; year >= 1940; year -= 1) {
            options.push('<option value="' + year + '">' + year + '</option>');
        }
        select.innerHTML = options.join("");
        select.setAttribute("data-year-ready", "true");
    }

    function fillMonthOptions(select) {
        if (!select || select.getAttribute("data-month-ready") === "true") return;
        var options = ['<option value="">월</option>'];
        for (var month = 1; month <= 12; month += 1) {
            var value = padTime(month);
            options.push('<option value="' + value + '">' + month + '월</option>');
        }
        select.innerHTML = options.join("");
        select.setAttribute("data-month-ready", "true");
    }

    function refreshDayOptions(select, yearValue, monthValue) {
        if (!select) return;
        var selectedDay = String(select.value || "").trim();
        var daysInMonth = getDaysInMonth(yearValue, monthValue);
        var options = ['<option value="">일</option>'];
        for (var day = 1; day <= daysInMonth; day += 1) {
            var value = padTime(day);
            options.push('<option value="' + value + '">' + day + '일</option>');
        }
        select.innerHTML = options.join("");
        if (selectedDay && Number(selectedDay) <= daysInMonth) {
            select.value = selectedDay;
        }
    }

    function getDaysInMonth(yearValue, monthValue) {
        var year = Number(yearValue || 2000);
        var month = Number(monthValue || 1);
        return new Date(year, month, 0).getDate();
    }

    function syncDateSelectGroup(yearSelect, monthSelect, daySelect, value) {
        var normalized = normalizeDateInput(value);
        var year = normalized ? normalized.slice(0, 4) : "";
        var month = normalized ? normalized.slice(4, 6) : "";
        var day = normalized ? normalized.slice(6, 8) : "";
        if (yearSelect) yearSelect.value = year;
        if (monthSelect) monthSelect.value = month;
        refreshDayOptions(daySelect, year, month);
        if (daySelect) daySelect.value = day;
    }

    function syncBirthDateSelectGroup(yearSelect, monthSelect, daySelect, value) {
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, value);
    }

    function syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput) {
        if (!hiddenInput) return;
        var year = String(yearSelect && yearSelect.value || "").trim();
        var month = String(monthSelect && monthSelect.value || "").trim();
        var day = String(daySelect && daySelect.value || "").trim();
        hiddenInput.value = year && month && day ? year + month + day : "";
    }

    function syncBirthDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput) {
        syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function setBirthDateSelectValue(yearSelect, monthSelect, daySelect, hiddenInput, value) {
        var normalized = normalizeDateInput(value);
        if (hiddenInput) hiddenInput.value = normalized;
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, normalized);
        syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function setDateSelectValue(yearSelect, monthSelect, daySelect, hiddenInput, value) {
        var normalized = normalizeDateInput(value);
        if (hiddenInput) hiddenInput.value = normalized;
        syncDateSelectGroup(yearSelect, monthSelect, daySelect, normalized);
        syncDateHiddenInput(yearSelect, monthSelect, daySelect, hiddenInput);
    }

    function formatDateForInput(value) {
        var normalized = normalizeDateInput(value);
        if (!normalized) return "";
        return normalized.slice(0, 4) + "-" + normalized.slice(4, 6) + "-" + normalized.slice(6, 8);
    }

    function formatDateValue(value, emptyText) {
        var normalized = normalizeDateInput(value);
        if (!normalized) return emptyText || "-";
        return normalized.slice(0, 4) + "." + normalized.slice(4, 6) + "." + normalized.slice(6, 8);
    }

    function splitWorkHours(value) {
        var normalized = normalizeWorkHours(value);
        var matched = normalized.match(/^([0-2][0-9]:[0-5][0-9])\s*-\s*([0-2][0-9]:[0-5][0-9])$/);
        if (!matched) return { start: "", end: "" };
        return { start: matched[1], end: matched[2] };
    }

    function buildWorkHours(start, end) {
        if (!start && !end) return "";
        return normalizeWorkHours(start + " - " + end);
    }

    function normalizeWorkHours(value) {
        var text = String(value || "").trim().replace(/\s*~\s*/g, " - ").replace(/\s*-\s*/g, " - ");
        var matched = text.match(/^([0-2][0-9]:[0-5][0-9])\s-\s([0-2][0-9]:[0-5][0-9])$/);
        if (!matched) return "";
        return matched[1] + " - " + matched[2];
    }

    function padTime(value) {
        return String(value).padStart(2, "0");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
