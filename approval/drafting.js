var APPROVAL_DRAFT_TEMP_KEY = "approvalDraftingTemp";
var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
var API = window.GroupwareApi;
var APPROVAL_DRAFT_SERVER_ID_KEY = "approvalDraftingServerId";
var APPROVAL_DOCNO_COUNTER_KEY = "approvalDraftDocNoCounterV2";
var APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY = "approvalDraftingConfirmedDocNoV2";
var APPROVAL_DEFAULT_DOC_TYPE = "지출품의서";
var APPROVAL_DOC_TYPE_SETTINGS = {
    "지출품의서": {},
    "지출결의서": {},
    "입금결의서": {},
    "비품구매 품의서": {},
    "증명서 발급": {},
    "출장신청서": {},
    "휴가원": {},
    "일반기안서": {},
    "일반품의서": {}
};
var approvalDraftEmployees = [];
var approvalLineModalSelection = null;
var approvalLineApproverSelections = [];
var approvalLineReferenceSelections = [];
var approvalLineActiveType = "approver";
var approvalLineEmployeeLoadError = "";
var approvalLineModalScrollY = 0;
var approvalAttachedFiles = [];
var approvalSavedFileNames = [];
var approvalSavedAttachmentsData = [];
var approvalTripCompanionSelections = [];

document.addEventListener("DOMContentLoaded", function () {
    initializeApprovalDraftingPage();
});

async function initializeApprovalDraftingPage() {
    renderDraftingUserInfo();
    renderCategoryName();
    renderDocumentNumber();
    bindDraftingActions();
    var loadedRemoteDraft = await hydrateApprovalDraftFromUrl();
    if (!loadedRemoteDraft) clearLocalDraftCache();
    renderApprovalLineList();
    renderAttachmentList();
}

function renderDraftingUserInfo() {
    var userName = String(localStorage.getItem("userName") || "").trim() || "-";
    var userDepartment = String(localStorage.getItem("userDepartment") || "").trim() || "부서 미지정";
    document.querySelectorAll(".approvalWriterName").forEach(function (field) {
        field.textContent = userName;
    });
    document.querySelectorAll(".approvalWriterDept").forEach(function (field) {
        field.textContent = userDepartment;
    });
    document.querySelectorAll(".approvalWriteDate").forEach(function (field) {
        field.textContent = formatDraftingDate(new Date());
    });
}

function renderCategoryName() {
    var categoryField = document.querySelector("#approvalDocType");
    var cateName = document.querySelector(".cateName");
    if (!categoryField || !cateName) return;
    var docType = normalizeApprovalDocType(categoryField.value || APPROVAL_DEFAULT_DOC_TYPE);
    if (categoryField.value !== docType) categoryField.value = docType;
    cateName.textContent = docType;
    renderApprovalDocTypeButtons(docType);
    applyApprovalDocTypeSettings(docType);
}

function renderApprovalDocTypeButtons(docType) {
    document.querySelectorAll(".approvalDocTypeList button").forEach(function (button) {
        button.classList.toggle("selected", button.getAttribute("data-doc-type") === docType);
    });
}

function applyApprovalDocTypeSettings(docType) {
    var settings = APPROVAL_DOC_TYPE_SETTINGS[docType] || APPROVAL_DOC_TYPE_SETTINGS[APPROVAL_DEFAULT_DOC_TYPE];
    var isExpenseProposal = docType === "지출품의서";
    var isExpenseResolution = docType === "지출결의서";
    var isDepositResolution = docType === "입금결의서";
    var isAssetPurchase = docType === "비품구매 품의서";
    var isCertificate = docType === "증명서 발급";
    var isBusinessTrip = docType === "출장신청서";
    var isVacation = docType === "휴가원";
    var isResolutionType = isExpenseResolution || isDepositResolution;
    var titleField = document.querySelector("#approvalDocTitle");
    var bodyField = document.querySelector("#approvalDocBody");
    var draftMetaTable = document.querySelector(".approvalWrite > .approvalTable");
    var expenseForm = document.querySelector(".approvalExpenseProposalForm");
    var resolutionForm = document.querySelector(".approvalExpenseResolutionForm");
    var assetPurchaseForm = document.querySelector(".approvalAssetPurchaseForm");
    var certificateForm = document.querySelector(".approvalCertificateForm");
    var tripContentForm = document.querySelector(".approvalTripContentForm");
    var tripExpenseForm = document.querySelector(".approvalTripExpenseForm");
    var commonDocBody = document.querySelector(".approvalCommonDocBody");
    var expenseDocMeta = document.querySelector(".ap_expense_doc_meta");
    var assetInfo = document.querySelector(".ap_asset_info");
    var tripInfo = document.querySelector(".ap_trip_info");
    var tripDetail = document.querySelector(".ap_trip_detail");
    var vacationInfo = document.querySelector(".ap_vacation_info");
    var resolutionDocNo = document.querySelector(".ap_resolution_docno");
    var resolutionSummary = document.querySelector(".ap_resolution_summary");
    var expenseSummary = document.querySelector(".ap_expense_summary");
    var proposalContentRow = document.querySelector(".ap_proposal_content");
    var proposalContentTitle = document.querySelector(".approvalProposalContentTitle");
    var resolutionDateHead = document.querySelector(".approvalResolutionDateHead");
    var resolutionCategoryHead = document.querySelector(".approvalResolutionCategoryHead");
    var resolutionContentHead = document.querySelector(".approvalResolutionContentHead");
    if (titleField) titleField.setAttribute("placeholder", "제목을 입력하세요.");
    if (bodyField) bodyField.setAttribute("placeholder", "기타 추가 내용을 입력하세요.");
    if (draftMetaTable) draftMetaTable.classList.toggle("approvalCertificateMeta", isCertificate);
    if (draftMetaTable) draftMetaTable.classList.toggle("approvalTripMeta", isBusinessTrip);
    if (expenseForm) expenseForm.style.display = isExpenseProposal ? "block" : "none";
    if (resolutionForm) resolutionForm.style.display = isResolutionType ? "block" : "none";
    if (assetPurchaseForm) assetPurchaseForm.style.display = isAssetPurchase ? "block" : "none";
    if (certificateForm) certificateForm.style.display = isCertificate ? "block" : "none";
    if (tripContentForm) tripContentForm.style.display = isBusinessTrip ? "block" : "none";
    if (tripExpenseForm) tripExpenseForm.style.display = isBusinessTrip ? "block" : "none";
    if (commonDocBody) commonDocBody.style.display = "block";
    if (expenseDocMeta) expenseDocMeta.style.display = isExpenseResolution ? "none" : "grid";
    if (assetInfo) assetInfo.style.display = isAssetPurchase ? "grid" : "none";
    if (tripInfo) tripInfo.style.display = isBusinessTrip ? "grid" : "none";
    if (tripDetail) tripDetail.style.display = isBusinessTrip ? "grid" : "none";
    if (vacationInfo) vacationInfo.style.display = isVacation ? "grid" : "none";
    if (resolutionDocNo) resolutionDocNo.style.display = isExpenseResolution ? "flex" : "none";
    if (resolutionSummary) resolutionSummary.style.display = isExpenseResolution ? "grid" : "none";
    if (expenseSummary) expenseSummary.style.display = isExpenseProposal ? "grid" : "none";
    if (proposalContentRow) proposalContentRow.style.display = isCertificate || isBusinessTrip ? "none" : "grid";
    if (proposalContentTitle) proposalContentTitle.textContent = getApprovalProposalContentTitle(docType);
    if (resolutionDateHead) resolutionDateHead.textContent = docType === "입금결의서" ? "입금일자" : "일자";
    if (resolutionCategoryHead) resolutionCategoryHead.textContent = docType === "입금결의서" ? "거래처명" : "분류";
    if (resolutionContentHead) resolutionContentHead.textContent = docType === "입금결의서" ? "상세 내역" : "사용 내역";
}

function getApprovalProposalContentTitle(docType) {
    if (docType === "지출결의서") return "지출사유";
    if (docType === "입금결의서") return "적요";
    if (docType === "비품구매 품의서") return "사유";
    if (docType === "휴가원") return "사유";
    if (docType === "일반기안서") return "내용";
    return "품의내용";
}

function normalizeApprovalDocType(docType) {
    var normalized = String(docType || "").trim();
    if (normalized === "연차휴가 계획서") return "휴가원";
    return normalized || APPROVAL_DEFAULT_DOC_TYPE;
}

function renderDocumentNumber(docNo) {
    var docNoFields = document.querySelectorAll(".docno");
    if (!docNoFields.length) return;
    var nextDocNo = isValidApprovalDocumentNumber(docNo) ? docNo : buildApprovalDocumentNumberPreview();
    docNoFields.forEach(function (field) {
        field.textContent = nextDocNo;
    });
    if (isValidApprovalDocumentNumber(docNo)) localStorage.setItem(APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY, docNo);
}

function bindDraftingActions() {
    document.querySelectorAll(".approvalLineBtn").forEach(function (button) {
        button.addEventListener("click", openApprovalLineModal);
    });

    var approvalLineList = document.querySelector(".approvalLineList");
    if (approvalLineList) {
        approvalLineList.addEventListener("click", function (event) {
            var resetButton = event.target.closest(".approvalLineResetBtn");
            if (!resetButton) return;
            event.preventDefault();
            openApprovalLineModal();
        });
    }

    document.querySelectorAll(".approvalTempSaveBtn").forEach(function (button) {
        button.addEventListener("click", saveTempDraft);
    });

    document.querySelectorAll(".approvalSubmitBtn").forEach(function (button) {
        button.addEventListener("click", submitApprovalDraft);
    });

    var categoryField = document.querySelector("#approvalDocType");
    if (categoryField) {
        categoryField.addEventListener("change", renderCategoryName);
    }

    document.querySelectorAll(".approvalDocTypeList button").forEach(function (button) {
        button.addEventListener("click", function () {
            if (!categoryField) return;
            categoryField.value = button.getAttribute("data-doc-type") || APPROVAL_DEFAULT_DOC_TYPE;
            renderCategoryName();
        });
    });

    bindApprovalLineModal();
    bindAttachmentActions();
    bindExpenseProposalActions();
    bindExpenseResolutionActions();
    bindAssetPurchaseActions();
    bindTripCompanionActions();
    bindTripExpenseActions();
    bindVacationActions();
    bindApprovalDatePickers();
}

function bindApprovalDatePickers() {
    document.querySelectorAll("#approvalPaymentRequestDate, .approvalResolutionDate, #approvalTripStartDate, #approvalTripEndDate, #approvalVacationStartDate, #approvalVacationEndDate").forEach(function (dateInput) {
        bindApprovalDatePicker(dateInput);
    });
}

function bindApprovalDatePicker(dateInput) {
    if (!dateInput) return;
    enhanceApprovalDateField(dateInput);
    applyDefaultApprovalDate(dateInput);
}

function enhanceApprovalDateField(dateInput) {
    if (!dateInput || dateInput.dataset.dropdownBound === "true") return;

    var wrapper = document.createElement("span");
    wrapper.className = "approvalDateDropdown";

    var yearSelect = buildApprovalDateSelect("approvalDateSelect approvalDateSelect--year", "연도", 1990, new Date().getFullYear() + 10);
    var monthSelect = buildApprovalDateSelect("approvalDateSelect approvalDateSelect--month", "월", 1, 12);
    var daySelect = buildApprovalDateSelect("approvalDateSelect approvalDateSelect--day", "일", 1, 31);

    wrapper.appendChild(yearSelect);
    wrapper.appendChild(monthSelect);
    wrapper.appendChild(daySelect);

    dateInput.type = "hidden";
    dateInput.dataset.dropdownBound = "true";
    dateInput.dataset.dropdownField = "true";
    dateInput.dataset.dropdownInitialType = dateInput.getAttribute("type") || "date";
    dateInput.parentNode.insertBefore(wrapper, dateInput.nextSibling);
    dateInput._approvalDateDropdown = { wrapper: wrapper, year: yearSelect, month: monthSelect, day: daySelect };

    yearSelect.addEventListener("change", function () {
        rebuildApprovalDayOptions(daySelect, yearSelect.value, monthSelect.value);
        syncApprovalDateInputFromSelects(dateInput);
    });
    monthSelect.addEventListener("change", function () {
        rebuildApprovalDayOptions(daySelect, yearSelect.value, monthSelect.value);
        syncApprovalDateInputFromSelects(dateInput);
    });
    daySelect.addEventListener("change", function () {
        syncApprovalDateInputFromSelects(dateInput);
    });

    syncApprovalDateSelects(dateInput, dateInput.value || "");
}

function applyDefaultApprovalDate(dateInput) {
    if (!dateInput || dateInput.value) return;
    if (dateInput.id === "approvalVacationStartDate" || dateInput.id === "approvalVacationEndDate") return;
    if (dateInput.id === "approvalTripEndDate") return;
    dateInput.value = getTodayApprovalDateValue();
    syncApprovalDateSelects(dateInput, dateInput.value);
}

function buildApprovalDateSelect(className, placeholder, start, end) {
    var select = document.createElement("select");
    select.className = className;
    select.innerHTML = '<option value="">' + placeholder + '</option>' + buildApprovalDateOptions(start, end);
    return select;
}

function buildApprovalDateOptions(start, end) {
    var options = "";
    for (var value = start; value <= end; value += 1) {
        options += '<option value="' + value + '">' + value + '</option>';
    }
    return options;
}

function syncApprovalDateInputFromSelects(dateInput) {
    var dropdown = dateInput && dateInput._approvalDateDropdown;
    if (!dropdown) return;

    var year = String(dropdown.year.value || "").trim();
    var month = String(dropdown.month.value || "").trim();
    var day = String(dropdown.day.value || "").trim();
    if (!year || !month || !day) {
        dateInput.value = "";
        dispatchApprovalDateChange(dateInput);
        return;
    }

    var maxDay = getApprovalDaysInMonth(Number(year), Number(month));
    if (Number(day) > maxDay) {
        dropdown.day.value = String(maxDay);
        day = String(maxDay);
    }

    dateInput.value = year + "-" + padDrafting(month) + "-" + padDrafting(day);
    dispatchApprovalDateChange(dateInput);
}

function syncApprovalDateSelects(dateInput, value) {
    var dropdown = dateInput && dateInput._approvalDateDropdown;
    if (!dropdown) return;

    var parts = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    dropdown.year.value = parts ? String(Number(parts[1])) : String(new Date().getFullYear());
    dropdown.month.value = parts ? String(Number(parts[2])) : "";
    rebuildApprovalDayOptions(dropdown.day, dropdown.year.value, dropdown.month.value);
    dropdown.day.value = parts ? String(Number(parts[3])) : "";
}

function rebuildApprovalDayOptions(daySelect, yearValue, monthValue) {
    if (!daySelect) return;
    var maxDay = yearValue && monthValue ? getApprovalDaysInMonth(Number(yearValue), Number(monthValue)) : 31;
    var currentValue = String(daySelect.value || "").trim();
    daySelect.innerHTML = '<option value="">일</option>' + buildApprovalDateOptions(1, maxDay);
    if (currentValue && Number(currentValue) <= maxDay) daySelect.value = String(Number(currentValue));
}

function getApprovalDaysInMonth(year, month) {
    return new Date(Number(year), Number(month), 0).getDate();
}

function getTodayApprovalDateValue() {
    var today = new Date();
    return today.getFullYear() + "-" + padDrafting(today.getMonth() + 1) + "-" + padDrafting(today.getDate());
}

function dispatchApprovalDateChange(dateInput) {
    dateInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function bindApprovalLineModal() {
    var modal = document.querySelector(".approvalLineModal");
    var closeButtons = document.querySelectorAll(".approvalLineModalClose, .approvalLineModalCancel");
    var dim = document.querySelector(".approvalLineModalDim");
    var submitButton = document.querySelector(".approvalLineModalSubmit");
    var approverSearchInput = document.querySelector("#approvalApproverSearch");
    var referenceSearchInput = document.querySelector("#approvalReferenceSearch");

    closeButtons.forEach(function (button) {
        button.addEventListener("click", closeApprovalLineModal);
    });

    if (dim) dim.addEventListener("click", closeApprovalLineModal);
    if (submitButton) submitButton.addEventListener("click", applyApprovalLineSelection);
    if (approverSearchInput) {
        approverSearchInput.addEventListener("input", function () {
            approvalLineActiveType = "approver";
            renderApprovalLineSearchResults("approver");
        });
        approverSearchInput.addEventListener("focus", function () {
            approvalLineActiveType = "approver";
            renderApprovalLineSearchResults("approver");
        });
        approverSearchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyApprovalLineSelection();
            }
        });
    }
    if (referenceSearchInput) {
        referenceSearchInput.addEventListener("input", function () {
            if (referenceSearchInput.disabled) return;
            approvalLineActiveType = "reference";
            renderApprovalLineSearchResults("reference");
        });
        referenceSearchInput.addEventListener("focus", function () {
            if (referenceSearchInput.disabled) return;
            approvalLineActiveType = "reference";
            renderApprovalLineSearchResults("reference");
        });
        referenceSearchInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyApprovalLineSelection();
            }
        });
    }

    if (modal) {
        modal.style.display = "none";
        modal.classList.remove("is-open", "is-closing");
    }
}

async function openApprovalLineModal() {
    var modal = document.querySelector(".approvalLineModal");
    var approverSearchInput = document.querySelector("#approvalApproverSearch");
    var referenceSearchInput = document.querySelector("#approvalReferenceSearch");
    var isMobile = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;

    if (!modal || !approverSearchInput || !referenceSearchInput) return;

    approvalLineModalSelection = null;
    approvalLineApproverSelections = getExistingApprovalLineSelections(".approvalFirstApprover");
    approvalLineReferenceSelections = getExistingApprovalLineSelections(".approvalReferenceUser");
    approvalLineActiveType = "approver";
    approverSearchInput.value = "";
    referenceSearchInput.value = "";
    await ensureApprovalEmployeeList();
    syncApprovalLineReferenceInput();
    renderApprovalApproverSelectedList();
    renderApprovalReferenceSelectedList();
    renderApprovalLineSearchResults("approver");
    modal.classList.remove("is-closing");
    modal.style.display = "flex";
    lockApprovalLinePageScroll();
    requestAnimationFrame(function () {
        modal.classList.add("is-open");
    });
    if (!isMobile) {
        setTimeout(function () {
            approverSearchInput.focus();
        }, 0);
    }
}

function closeApprovalLineModal() {
    var modal = document.querySelector(".approvalLineModal");
    if (!modal) return;
    var isMobile = window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
    modal.classList.remove("is-open");
    modal.classList.add("is-closing");
    if (!isMobile) {
        modal.style.display = "none";
        modal.classList.remove("is-closing");
        unlockApprovalLinePageScroll();
        return;
    }
    setTimeout(function () {
        if (!modal) return;
        modal.style.display = "none";
        modal.classList.remove("is-closing");
        unlockApprovalLinePageScroll();
    }, 320);
}

function lockApprovalLinePageScroll() {
    if (document.body.classList.contains("approvalLineModalOpen")) return;
    approvalLineModalScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add("approvalLineModalOpen");
    document.body.classList.add("approvalLineModalOpen");
    document.body.style.position = "fixed";
    document.body.style.top = "-" + approvalLineModalScrollY + "px";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
}

function unlockApprovalLinePageScroll() {
    if (!document.body.classList.contains("approvalLineModalOpen")) return;
    document.documentElement.classList.remove("approvalLineModalOpen");
    document.body.classList.remove("approvalLineModalOpen");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, approvalLineModalScrollY || 0);
}

async function ensureApprovalEmployeeList() {
    if (approvalDraftEmployees.length) return approvalDraftEmployees;
    approvalLineEmployeeLoadError = "";
    try {
        var items = await fetchApprovalEmployeeList();
        approvalDraftEmployees = Array.isArray(items) ? items.filter(function (item) {
            return item && item.id && item.name && isVisibleApprovalEmployee(item);
        }) : [];
    } catch (error) {
        approvalDraftEmployees = [];
        approvalLineEmployeeLoadError = error.message || "직원 목록을 불러오지 못했습니다.";
    }
    return approvalDraftEmployees;
}

async function fetchApprovalEmployeeList() {
    var user = getApprovalCurrentUser();
    var data = await API.get(APPROVAL_API_BASE + "/employees", { userId: user.id || "" }, { errorMessage: "직원 목록을 불러오지 못했습니다." });
    return Array.isArray(data.items) ? data.items : [];
}

function renderApprovalLineSearchResults(type) {
    approvalLineActiveType = type === "reference" ? "reference" : "approver";
    var resultBox = document.querySelector(".approvalLineSearchResult");
    var searchInput = document.querySelector(type === "reference" ? "#approvalReferenceSearch" : "#approvalApproverSearch");
    var keyword = searchInput ? String(searchInput.value || "").trim().toLowerCase() : "";
    if (!resultBox) return;

    if (approvalLineEmployeeLoadError) {
        resultBox.innerHTML = '<p class="approvalLineEmpty">' + escapeDraftingHtml(approvalLineEmployeeLoadError) + '</p>';
        approvalLineModalSelection = null;
        return;
    }

    var sourceItems = approvalLineActiveType === "approver" ? approvalDraftEmployees.filter(function (item) {
        return isApprovalApproverCandidate(item);
    }) : approvalDraftEmployees;
    var items = sourceItems.filter(function (item) {
        if (!keyword) return true;
        return [item.name, item.id, item.email, item.department, item.position, item.jobGrade, formatApprovalEmployeePosition(item), formatApprovalEmployeeDepartment(item)].some(function (value) {
            return String(value || "").toLowerCase().indexOf(keyword) > -1;
        });
    }).slice(0, 60);

    if (!items.length) {
        resultBox.innerHTML = '<p class="approvalLineEmpty">검색 결과가 없습니다.</p>';
        approvalLineModalSelection = null;
        return;
    }

    resultBox.innerHTML = '<div class="approvalLineResultList">' + items.map(function (item) {
        var selectedClass = isApprovalLineSelectedResult(type, item) ? " selected" : "";
        return '<button type="button" class="approvalLineResultItem' + selectedClass + '" data-line-type="' + escapeDraftingHtml(type) + '" data-id="' + escapeDraftingHtml(item.id) + '" data-name="' + escapeDraftingHtml(item.name) + '" data-email="' + escapeDraftingHtml(item.email || "") + '" data-department="' + escapeDraftingHtml(formatApprovalEmployeeDepartment(item)) + '" data-position="' + escapeDraftingHtml(item.position || "") + '" data-job-grade="' + escapeDraftingHtml(item.jobGrade || "") + '"><strong>' + escapeDraftingHtml(item.name) + '</strong><span class="approvalLineResultPosition">' + escapeDraftingHtml(formatApprovalEmployeePosition(item)) + '</span><span class="approvalLineResultDept">' + escapeDraftingHtml(formatApprovalEmployeeDepartment(item)) + '</span></button>';
    }).join("") + '</div>';

    resultBox.querySelectorAll(".approvalLineResultItem").forEach(function (button) {
        button.addEventListener("click", function () {
            resultBox.querySelectorAll(".approvalLineResultItem").forEach(function (item) {
                item.classList.remove("selected");
            });
            button.classList.add("selected");
            var selectedEmployee = findApprovalDraftEmployee(button.getAttribute("data-id") || "", button.getAttribute("data-name") || "");
            approvalLineModalSelection = {
                id: button.getAttribute("data-id") || "",
                name: button.getAttribute("data-name") || "",
                email: button.getAttribute("data-email") || "",
                department: button.getAttribute("data-department") || "",
                position: button.getAttribute("data-position") || "",
                jobGrade: button.getAttribute("data-job-grade") || "",
                signatureImage: selectedEmployee ? String(selectedEmployee.signatureImage || "") : ""
            };
            if (type === "reference") {
                addApprovalReferenceSelection(approvalLineModalSelection);
                var referenceInput = document.querySelector("#approvalReferenceSearch");
                if (referenceInput) referenceInput.value = "";
                renderApprovalReferenceSelectedList();
                resultBox.innerHTML = "";
            } else {
                addApprovalApproverSelection(approvalLineModalSelection);
                var approverInput = document.querySelector("#approvalApproverSearch");
                if (approverInput) approverInput.value = "";
                renderApprovalApproverSelectedList();
                syncApprovalLineReferenceInput();
                var referenceInput = document.querySelector("#approvalReferenceSearch");
                if (referenceInput) referenceInput.focus();
                renderApprovalLineSearchResults("reference");
            }
        });
    });
}

function isApprovalLineSelectedResult(type, item) {
    if (type === "reference") return approvalLineReferenceSelections.some(function (selected) {
        return isSameApprovalLinePerson(selected, item);
    });
    return approvalLineApproverSelections.some(function (selected) {
        return isSameApprovalLinePerson(selected, item);
    });
}

function applyApprovalLineSelection() {
    if (!approvalLineApproverSelections.length) {
        alert("승인자를 선택해주세요.");
        return;
    }

    renderApprovalLineList();

    closeApprovalLineModal();
}

function getExistingApprovalLineSelection(selector) {
    var value = getText(selector);
    if (!value || value === "미지정") return null;
    return { id: "", name: value, email: "", department: "" };
}

function getExistingApprovalLineSelections(selector) {
    var fields = Array.prototype.slice.call(document.querySelectorAll(selector));
    if (!fields.length) return [];

    var people = fields.reduce(function (result, field) {
        return result.concat(Array.prototype.slice.call(field.querySelectorAll(".approvalLinePerson")));
    }, []);
    if (people.length) {
        return people.map(function (item) {
            var nameEl = item.querySelector(".approvalLinePersonName");
            var deptEl = item.querySelector(".approvalLinePersonDept");
            return {
                id: item.getAttribute("data-id") || "",
                name: String(nameEl ? nameEl.textContent : "").trim(),
                email: item.getAttribute("data-email") || "",
                department: String(deptEl ? deptEl.textContent : "").trim()
            };
        }).filter(function (item) {
            return !!item.name;
        });
    }

    var value = fields.map(function (field) {
        return String(field.textContent || "").trim();
    }).filter(function (text) {
        return text && text !== "미지정";
    }).join(",");
    if (!value) return [];
    return value.split(",").map(function (name) {
        return { id: "", name: String(name || "").trim(), email: "", department: "" };
    }).filter(function (item) {
        return !!item.name;
    });
}

function addApprovalApproverSelection(person) {
    if (!person) return;
    var exists = approvalLineApproverSelections.some(function (item) {
        return isSameApprovalLinePerson(item, person);
    });
    if (!exists) approvalLineApproverSelections.push(person);
}

function addApprovalReferenceSelection(person) {
    if (!person) return;
    var exists = approvalLineReferenceSelections.some(function (item) {
        return isSameApprovalLinePerson(item, person);
    });
    if (!exists && approvalLineReferenceSelections.length >= 3) {
        alert("참조는 최대 3명까지 지정할 수 있습니다.");
        return;
    }
    if (!exists) approvalLineReferenceSelections.push(person);
}

function renderApprovalApproverSelectedList() {
    var list = document.querySelector(".approvalApproverSelectedList");
    if (!list) return;
    if (!approvalLineApproverSelections.length) {
        list.innerHTML = "";
        return;
    }
    list.innerHTML = approvalLineApproverSelections.map(function (item, index) {
        return '<span class="approvalApproverChip">' + escapeDraftingHtml(item.name || item.id) + '<button type="button" data-index="' + index + '" aria-label="승인 삭제">×</button></span>';
    }).join("");
    list.querySelectorAll("button").forEach(function (button) {
        button.addEventListener("click", function () {
            var index = Number(button.getAttribute("data-index"));
            if (!Number.isFinite(index)) return;
            approvalLineApproverSelections.splice(index, 1);
            renderApprovalApproverSelectedList();
            syncApprovalLineReferenceInput();
            renderApprovalLineSearchResults("approver");
        });
    });
}

function renderApprovalReferenceSelectedList() {
    var list = document.querySelector(".approvalReferenceSelectedList");
    if (!list) return;
    if (!approvalLineReferenceSelections.length) {
        list.innerHTML = "";
        return;
    }
    list.innerHTML = approvalLineReferenceSelections.map(function (item, index) {
        return '<span class="approvalReferenceChip">' + escapeDraftingHtml(item.name || item.id) + '<button type="button" data-index="' + index + '" aria-label="참조 삭제">×</button></span>';
    }).join("");
    list.querySelectorAll("button").forEach(function (button) {
        button.addEventListener("click", function () {
            var index = Number(button.getAttribute("data-index"));
            if (!Number.isFinite(index)) return;
            approvalLineReferenceSelections.splice(index, 1);
            renderApprovalReferenceSelectedList();
            renderApprovalLineSearchResults("reference");
        });
    });
}

function isSameApprovalLinePerson(a, b) {
    if (!a || !b) return false;
    if (a.id && b.id) return String(a.id) === String(b.id);
    return String(a.name || "") === String(b.name || "");
}

function findApprovalDraftEmployee(id, name) {
    var normalizedId = String(id || "").trim();
    var normalizedName = String(name || "").trim();
    return approvalDraftEmployees.find(function (item) {
        return (normalizedId && String(item.id || "").trim() === normalizedId) || (normalizedName && String(item.name || "").trim() === normalizedName);
    }) || null;
}

function getApprovalApproverDisplayText() {
    if (!approvalLineApproverSelections.length) return "미지정";
    return approvalLineApproverSelections.map(function (item) {
        return item.name || item.id;
    }).filter(Boolean).join(", ");
}

function isVisibleApprovalEmployee(item) {
    if (isRepresentativeApprovalEmployee(item)) return true;
    var id = String(item && item.id || "").trim().toLowerCase();
    var name = String(item && item.name || "").trim();
    var email = String(item && item.email || "").trim().toLowerCase();
    var role = String(item && item.role || "").trim().toLowerCase();
    return id !== "admin"
        && id !== "work"
        && id !== "test"
        && !/^test/i.test(id)
        && role !== "admin"
        && name !== "관리자"
        && name !== "홍길동"
        && email !== "admin@autone.co.kr"
        && !/^test@/i.test(email);
}

function isRepresentativeApprovalEmployee(item) {
    var id = String(item && item.id || "").trim().toLowerCase();
    var name = String(item && item.name || "").trim();
    var email = String(item && item.email || "").trim().toLowerCase();
    var role = String(item && item.role || "").trim().toLowerCase();
    var label = [item && item.position, item && item.jobGrade, item && item.duty, item && item.responsibility, item && item.jobTitle].map(function (value) {
        return String(value || "").trim();
    }).join(" ");
    return name === "최재성" || id === "jschoi" || email === "jschoi@autonecar.kr" || role === "ceo" || label.indexOf("대표") > -1;
}

function isApprovalApproverCandidate(item) {
    if (isRepresentativeApprovalEmployee(item)) return true;
    var label = [item && item.position, item && item.jobGrade, item && item.duty, item && item.responsibility, item && item.jobTitle, formatApprovalEmployeePosition(item)].map(function (value) {
        return String(value || "").trim();
    }).join(" ");
    return label.indexOf("과장") > -1 || label.indexOf("팀장") > -1;
}

function formatApprovalEmployeeDepartment(item) {
    var name = String(item && item.name || "").trim();
    if (name === "최재성") return "대표";
    return String(item && item.department || "").trim() || "-";
}

function formatApprovalEmployeePosition(item) {
    var name = String(item && item.name || "").trim();
    if (name === "최재성") return "대표";
    var position = String(item && item.position || "").trim();
    var duty = String(item && (item.jobGrade || item.duty || item.responsibility || item.jobTitle || "") || "").trim();
    if (position && duty) return position + "(" + duty + ")";
    return position || duty || "-";
}

function getApprovalReferenceDisplayText() {
    if (!approvalLineReferenceSelections.length) return "미지정";
    return approvalLineReferenceSelections.slice(0, 3).map(function (item) {
        return item.name || item.id;
    }).filter(Boolean).join(", ");
}

function renderApprovalLineList() {
    var list = document.querySelector(".approvalLineList");
    if (!list) return;
    list.innerHTML = renderApprovalLineItems("승인", "approvalFirstApprover", approvalLineApproverSelections) + renderApprovalLineItems("참조", "approvalReferenceUser", approvalLineReferenceSelections);
}

function renderApprovalLineItems(label, valueClass, items) {
    items = Array.isArray(items) ? items.filter(function (item) {
        return item && (item.name || item.id);
    }) : [];
    if (!items.length) {
        return '<div class="approvalLineItem"><span class="label">' + escapeDraftingHtml(label) + '</span><span class="value ' + escapeDraftingHtml(valueClass) + '">미지정</span><button type="button" class="approvalLineResetBtn">설정</button></div>';
    }
    return items.map(function (item) {
        var name = item.name || item.id || "";
        var department = formatApprovalEmployeeDepartment(item);
        return '<div class="approvalLineItem"><span class="label">' + escapeDraftingHtml(label) + '</span><span class="value ' + escapeDraftingHtml(valueClass) + '"><span class="approvalLinePerson" data-id="' + escapeDraftingHtml(item.id || "") + '" data-email="' + escapeDraftingHtml(item.email || "") + '"><strong class="approvalLinePersonName">' + escapeDraftingHtml(name) + '</strong><em class="approvalLinePersonDept">' + escapeDraftingHtml(department) + '</em></span></span><button type="button" class="approvalLineResetBtn">재설정</button></div>';
    }).join("");
}

function syncApprovalLineReferenceInput() {
    var referenceInput = document.querySelector("#approvalReferenceSearch");
    var referenceSection = document.querySelector(".approvalReferenceSection");
    var enabled = approvalLineApproverSelections.length > 0;
    if (referenceInput) {
        referenceInput.disabled = !enabled;
        referenceInput.readOnly = !enabled;
        referenceInput.setAttribute("aria-disabled", enabled ? "false" : "true");
        referenceInput.tabIndex = enabled ? 0 : -1;
        if (!enabled) {
            referenceInput.value = "";
            approvalLineReferenceSelections = [];
            renderApprovalReferenceSelectedList();
            var wasReferenceActive = approvalLineActiveType === "reference";
            if (approvalLineActiveType === "reference") approvalLineActiveType = "approver";
            var resultBox = document.querySelector(".approvalLineSearchResult");
            if (resultBox && wasReferenceActive) resultBox.innerHTML = "";
        } else {
            renderApprovalReferenceSelectedList();
        }
    }
    if (referenceSection) referenceSection.classList.toggle("disabled", !enabled);
}

function bindAttachmentActions() {
    var fileInput = document.querySelector("#approvalFileInput");
    var fileButton = document.querySelector(".approvalFileBtn");

    if (fileButton && fileInput) {
        fileButton.addEventListener("click", function () {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", function () {
            approvalAttachedFiles = Array.prototype.slice.call(fileInput.files || []);
            renderAttachmentList();
        });
    }
}

function renderAttachmentList(savedNames) {
    var list = document.querySelector(".approvalFileList");
    var guide = document.querySelector(".approvalFileGuide");
    if (!list || !guide) return;

    if (Array.isArray(savedNames)) approvalSavedFileNames = savedNames.slice();

    var savedItems = approvalSavedFileNames.map(function (name) {
        return { name: name, saved: true };
    });
    var attachedItems = approvalAttachedFiles.map(function (file) {
        return { name: file.name, saved: false };
    });
    var items = savedItems.concat(attachedItems);

    if (!items.length) {
        guide.style.display = "block";
        list.innerHTML = "";
        return;
    }

    guide.style.display = "none";
    list.innerHTML = items.map(function (item, index) {
        return '<li><span>' + escapeDraftingHtml(item.name) + '</span>' + (item.saved ? '' : '<button type="button" class="approvalFileDeleteBtn" data-index="' + (index - approvalSavedFileNames.length) + '">삭제</button>') + '</li>';
    }).join("");

    list.querySelectorAll(".approvalFileDeleteBtn").forEach(function (button) {
        button.addEventListener("click", function () {
            var index = Number(button.getAttribute("data-index"));
            if (!Number.isFinite(index)) return;
            approvalAttachedFiles.splice(index, 1);
            syncApprovalFileInput();
            renderAttachmentList();
        });
    });
}

function syncApprovalFileInput() {
    var fileInput = document.querySelector("#approvalFileInput");
    if (!fileInput || typeof DataTransfer === "undefined") return;
    var transfer = new DataTransfer();
    approvalAttachedFiles.forEach(function (file) {
        transfer.items.add(file);
    });
    fileInput.files = transfer.files;
}

function bindExpenseProposalActions() {
    var addButton = document.querySelector(".approvalExpenseAddBtn");
    var deleteButton = document.querySelector(".approvalExpenseDeleteBtn");
    var table = document.querySelector(".approvalExpenseTable");
    if (addButton) addButton.addEventListener("click", function () {
        addExpenseProposalRow();
    });
    if (deleteButton) deleteButton.addEventListener("click", function () {
        deleteExpenseProposalRow();
    });
    if (table) table.addEventListener("input", function (event) {
        if (event.target && event.target.classList.contains("approvalExpenseInput")) syncExpenseProposalRow(event.target.closest("tr"));
    });
    calculateExpenseProposalTotals();
}

function addExpenseProposalRow(rowData) {
    var tbody = document.querySelector(".approvalExpenseTable tbody");
    if (!tbody) return;
    var row = document.createElement("tr");
    row.innerHTML = '<td><input type="text" class="approvalExpenseInput approvalExpenseName" placeholder="품목을 입력하세요."></td><td><input type="text" class="approvalExpenseInput approvalExpenseQty" inputmode="numeric"></td><td><input type="text" class="approvalExpenseInput approvalExpensePrice" inputmode="numeric"></td><td><input type="text" class="approvalExpenseInput approvalExpenseAmount" inputmode="numeric"></td><td><input type="text" class="approvalExpenseInput approvalExpenseTax" inputmode="numeric" readonly></td><td><input type="text" class="approvalExpenseInput approvalExpenseNote"></td>';
    tbody.appendChild(row);
    if (rowData) fillExpenseProposalRow(row, rowData);
    calculateExpenseProposalTotals();
}

function deleteExpenseProposalRow() {
    var rows = document.querySelectorAll(".approvalExpenseTable tbody tr");
    if (!rows.length) return;
    if (rows.length === 1) {
        rows[0].querySelectorAll("input").forEach(function (input) {
            input.value = "";
        });
    } else {
        rows[rows.length - 1].remove();
    }
    calculateExpenseProposalTotals();
}

function syncExpenseProposalRow(row) {
    if (!row) return;
    var qtyInput = row.querySelector(".approvalExpenseQty");
    var priceInput = row.querySelector(".approvalExpensePrice");
    var amountInput = row.querySelector(".approvalExpenseAmount");
    var taxInput = row.querySelector(".approvalExpenseTax");
    var qty = parseApprovalNumber(qtyInput ? qtyInput.value : "");
    var price = parseApprovalNumber(priceInput ? priceInput.value : "");
    if (qtyInput) qtyInput.value = qtyInput.value ? formatApprovalNumber(qty) : "";
    if (priceInput) priceInput.value = priceInput.value ? formatApprovalNumber(price) : "";
    if (amountInput && qty && price) {
        var amount = qty * price;
        amountInput.value = formatApprovalNumber(amount);
    }
    if (amountInput && amountInput.value) amountInput.value = formatApprovalNumber(parseApprovalNumber(amountInput.value));
    if (taxInput) taxInput.value = amountInput && amountInput.value ? formatApprovalNumber(parseApprovalNumber(amountInput.value) * 0.1) : "";
    calculateExpenseProposalTotals();
}

function calculateExpenseProposalTotals() {
    var amountTotal = 0;
    var taxTotal = 0;
    document.querySelectorAll(".approvalExpenseTable tbody tr").forEach(function (row) {
        amountTotal += parseApprovalNumber(getExpenseInputValue(row, ".approvalExpenseAmount"));
        taxTotal += parseApprovalNumber(getExpenseInputValue(row, ".approvalExpenseTax"));
    });
    setText(".approvalExpenseTotalAmount", formatApprovalNumber(amountTotal));
    setText(".approvalExpenseTotalTax", formatApprovalNumber(taxTotal));
    setText(".approvalExpenseSummaryAmount", formatApprovalNumber(amountTotal + taxTotal));
    setText(".approvalExpenseGrandTotal", "");
}

function getExpenseProposalItems() {
    return Array.prototype.slice.call(document.querySelectorAll(".approvalExpenseTable tbody tr")).map(function (row) {
        return { name: getExpenseInputValue(row, ".approvalExpenseName"), quantity: getExpenseInputValue(row, ".approvalExpenseQty"), price: getExpenseInputValue(row, ".approvalExpensePrice"), amount: getExpenseInputValue(row, ".approvalExpenseAmount"), tax: getExpenseInputValue(row, ".approvalExpenseTax"), note: getExpenseInputValue(row, ".approvalExpenseNote") };
    }).filter(function (item) {
        return Object.keys(item).some(function (key) {
            return !!String(item[key] || "").trim();
        });
    });
}

function hydrateExpenseProposalItems(items) {
    var tbody = document.querySelector(".approvalExpenseTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
        addExpenseProposalRow();
        return;
    }
    items.forEach(function (item) {
        addExpenseProposalRow(item);
    });
    calculateExpenseProposalTotals();
}

function fillExpenseProposalRow(row, data) {
    setExpenseInputValue(row, ".approvalExpenseName", data.name);
    setExpenseInputValue(row, ".approvalExpenseQty", data.quantity);
    setExpenseInputValue(row, ".approvalExpensePrice", data.price);
    setExpenseInputValue(row, ".approvalExpenseAmount", data.amount);
    setExpenseInputValue(row, ".approvalExpenseTax", data.tax);
    setExpenseInputValue(row, ".approvalExpenseNote", data.note);
}

function getExpenseInputValue(row, selector) {
    var input = row ? row.querySelector(selector) : null;
    return input ? String(input.value || "").trim() : "";
}

function setExpenseInputValue(row, selector, value) {
    var input = row ? row.querySelector(selector) : null;
    if (input) {
        input.value = value || "";
        if (input.dataset && input.dataset.dropdownField === "true") syncApprovalDateSelects(input, input.value || "");
    }
}

function bindExpenseResolutionActions() {
    var addButton = document.querySelector(".approvalResolutionAddBtn");
    var deleteButton = document.querySelector(".approvalResolutionDeleteBtn");
    var table = document.querySelector(".approvalResolutionTable");
    if (addButton) addButton.addEventListener("click", function () {
        addExpenseResolutionRow();
    });
    if (deleteButton) deleteButton.addEventListener("click", function () {
        deleteExpenseResolutionRow();
    });
    if (table) table.addEventListener("input", function (event) {
        if (event.target && event.target.classList.contains("approvalResolutionInput")) syncExpenseResolutionRow(event.target.closest("tr"));
    });
    calculateExpenseResolutionTotals();
}

function addExpenseResolutionRow(rowData) {
    var tbody = document.querySelector(".approvalResolutionTable tbody");
    if (!tbody) return;
    var row = document.createElement("tr");
    row.innerHTML = '<td class="approvalResolutionDateCell"><input type="date" class="approvalResolutionInput approvalResolutionDate"></td><td><input type="text" class="approvalResolutionInput approvalResolutionCategory"></td><td><input type="text" class="approvalResolutionInput approvalResolutionContent"></td><td><input type="text" class="approvalResolutionInput approvalResolutionAmount" inputmode="numeric"></td><td><input type="text" class="approvalResolutionInput approvalResolutionNote"></td>';
    tbody.appendChild(row);
    bindApprovalDatePicker(row.querySelector(".approvalResolutionDate"));
    if (rowData) fillExpenseResolutionRow(row, rowData);
    calculateExpenseResolutionTotals();
}

function deleteExpenseResolutionRow() {
    var rows = document.querySelectorAll(".approvalResolutionTable tbody tr");
    if (!rows.length) return;
    if (rows.length === 1) {
        rows[0].querySelectorAll("input").forEach(function (input) {
            input.value = "";
        });
    } else {
        rows[rows.length - 1].remove();
    }
    calculateExpenseResolutionTotals();
}

function syncExpenseResolutionRow(row) {
    if (!row) return;
    var amountInput = row.querySelector(".approvalResolutionAmount");
    if (amountInput && amountInput.value) amountInput.value = formatApprovalNumber(parseApprovalNumber(amountInput.value));
    calculateExpenseResolutionTotals();
}

function calculateExpenseResolutionTotals() {
    var amountTotal = 0;
    document.querySelectorAll(".approvalResolutionTable tbody tr").forEach(function (row) {
        amountTotal += parseApprovalNumber(getExpenseInputValue(row, ".approvalResolutionAmount"));
    });
    setText(".approvalResolutionTotalAmount", formatApprovalNumber(amountTotal));
    setText(".approvalResolutionSummaryAmount", formatApprovalNumber(amountTotal));
}

function getExpenseResolutionItems() {
    return Array.prototype.slice.call(document.querySelectorAll(".approvalResolutionTable tbody tr")).map(function (row) {
        return { date: getExpenseInputValue(row, ".approvalResolutionDate"), category: getExpenseInputValue(row, ".approvalResolutionCategory"), content: getExpenseInputValue(row, ".approvalResolutionContent"), amount: getExpenseInputValue(row, ".approvalResolutionAmount"), note: getExpenseInputValue(row, ".approvalResolutionNote") };
    }).filter(function (item) {
        return ["category", "content", "amount", "note"].some(function (key) {
            return !!String(item[key] || "").trim();
        });
    });
}

function hydrateExpenseResolutionItems(items) {
    var tbody = document.querySelector(".approvalResolutionTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
        addExpenseResolutionRow();
        return;
    }
    items.forEach(function (item) {
        addExpenseResolutionRow(item);
    });
    calculateExpenseResolutionTotals();
}

function fillExpenseResolutionRow(row, data) {
    setExpenseInputValue(row, ".approvalResolutionDate", data.date);
    setExpenseInputValue(row, ".approvalResolutionCategory", data.category);
    setExpenseInputValue(row, ".approvalResolutionContent", data.content);
    setExpenseInputValue(row, ".approvalResolutionAmount", data.amount);
    setExpenseInputValue(row, ".approvalResolutionNote", data.note);
}

function bindAssetPurchaseActions() {
    var addButton = document.querySelector(".approvalAssetAddBtn");
    var deleteButton = document.querySelector(".approvalAssetDeleteBtn");
    var table = document.querySelector(".approvalAssetTable");
    if (addButton) addButton.addEventListener("click", function () {
        addAssetPurchaseRow();
    });
    if (deleteButton) deleteButton.addEventListener("click", function () {
        deleteAssetPurchaseRow();
    });
    if (table) table.addEventListener("input", function (event) {
        if (event.target && event.target.classList.contains("approvalAssetInput")) syncAssetPurchaseRow(event.target.closest("tr"));
    });
    calculateAssetPurchaseTotals();
}

function addAssetPurchaseRow(rowData) {
    var tbody = document.querySelector(".approvalAssetTable tbody");
    if (!tbody) return;
    var row = document.createElement("tr");
    row.innerHTML = '<td><input type="text" class="approvalAssetInput approvalAssetItemName" placeholder="품명을 입력하세요."></td><td><input type="text" class="approvalAssetInput approvalAssetQty" inputmode="numeric"></td><td><input type="text" class="approvalAssetInput approvalAssetPrice" inputmode="numeric"></td><td><input type="text" class="approvalAssetInput approvalAssetAmount" inputmode="numeric"></td><td><input type="text" class="approvalAssetInput approvalAssetNote"></td>';
    tbody.appendChild(row);
    if (rowData) fillAssetPurchaseRow(row, rowData);
    calculateAssetPurchaseTotals();
}

function deleteAssetPurchaseRow() {
    var rows = document.querySelectorAll(".approvalAssetTable tbody tr");
    if (!rows.length) return;
    if (rows.length === 1) {
        rows[0].querySelectorAll("input").forEach(function (input) {
            input.value = "";
        });
    } else {
        rows[rows.length - 1].remove();
    }
    calculateAssetPurchaseTotals();
}

function syncAssetPurchaseRow(row) {
    if (!row) return;
    var priceInput = row.querySelector(".approvalAssetPrice");
    var qtyInput = row.querySelector(".approvalAssetQty");
    var amountInput = row.querySelector(".approvalAssetAmount");
    var price = parseApprovalNumber(priceInput ? priceInput.value : "");
    var qty = parseApprovalNumber(qtyInput ? qtyInput.value : "");
    if (priceInput) priceInput.value = priceInput.value ? formatApprovalNumber(price) : "";
    if (qtyInput) qtyInput.value = qtyInput.value ? formatApprovalNumber(qty) : "";
    if (amountInput && price && qty) amountInput.value = formatApprovalNumber(price * qty);
    if (amountInput && amountInput.value) amountInput.value = formatApprovalNumber(parseApprovalNumber(amountInput.value));
    calculateAssetPurchaseTotals();
}

function calculateAssetPurchaseTotals() {
    var amountTotal = 0;
    document.querySelectorAll(".approvalAssetTable tbody tr").forEach(function (row) {
        amountTotal += parseApprovalNumber(getExpenseInputValue(row, ".approvalAssetAmount"));
    });
    setText(".approvalAssetTotalAmount", formatApprovalNumber(amountTotal));
}

function getAssetPurchaseItems() {
    return Array.prototype.slice.call(document.querySelectorAll(".approvalAssetTable tbody tr")).map(function (row) {
        return { name: getExpenseInputValue(row, ".approvalAssetItemName"), price: getExpenseInputValue(row, ".approvalAssetPrice"), quantity: getExpenseInputValue(row, ".approvalAssetQty"), amount: getExpenseInputValue(row, ".approvalAssetAmount"), note: getExpenseInputValue(row, ".approvalAssetNote") };
    }).filter(function (item) {
        return Object.keys(item).some(function (key) {
            return !!String(item[key] || "").trim();
        });
    });
}

function hydrateAssetPurchaseItems(items) {
    var tbody = document.querySelector(".approvalAssetTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
        addAssetPurchaseRow();
        return;
    }
    items.forEach(function (item) {
        addAssetPurchaseRow(item);
    });
    calculateAssetPurchaseTotals();
}

function fillAssetPurchaseRow(row, data) {
    setExpenseInputValue(row, ".approvalAssetItemName", data.name);
    setExpenseInputValue(row, ".approvalAssetPrice", data.price);
    setExpenseInputValue(row, ".approvalAssetQty", data.quantity);
    setExpenseInputValue(row, ".approvalAssetAmount", data.amount);
    setExpenseInputValue(row, ".approvalAssetNote", data.note);
}

function getCertificateInfo() {
    return { type: getFieldValue("#approvalCertificateType"), purpose: getFieldValue("#approvalCertificatePurpose"), quantity: getFieldValue("#approvalCertificateQty"), submitTo: getFieldValue("#approvalCertificateSubmitTo"), note: getFieldValue("#approvalCertificateNote") };
}

function hydrateCertificateInfo(data) {
    data = data || {};
    setFieldValue("#approvalCertificateType", data.type || "");
    setFieldValue("#approvalCertificatePurpose", data.purpose || "");
    setFieldValue("#approvalCertificateQty", data.quantity || "");
    setFieldValue("#approvalCertificateSubmitTo", data.submitTo || "");
    setFieldValue("#approvalCertificateNote", data.note || "");
}

function bindTripCompanionActions() {
    var searchInput = document.querySelector("#approvalTripCompanionSearch");
    if (!searchInput) return;
    searchInput.addEventListener("input", function () {
        renderTripCompanionSearchResults();
    });
    searchInput.addEventListener("focus", async function () {
        await ensureApprovalEmployeeList();
        renderTripCompanionSearchResults();
    });
}

async function renderTripCompanionSearchResults() {
    var resultBox = document.querySelector(".approvalTripCompanionSearchResult");
    var searchInput = document.querySelector("#approvalTripCompanionSearch");
    var keyword = searchInput ? String(searchInput.value || "").trim().toLowerCase() : "";
    if (!resultBox) return;
    await ensureApprovalEmployeeList();
    if (!keyword) {
        resultBox.innerHTML = "";
        return;
    }
    var items = approvalDraftEmployees.filter(function (item) {
        return [item.name, item.id, item.email, item.department, item.position, item.jobGrade, formatApprovalEmployeePosition(item), formatApprovalEmployeeDepartment(item)].some(function (value) {
            return String(value || "").toLowerCase().indexOf(keyword) > -1;
        });
    });
    if (!items.length) {
        resultBox.innerHTML = '<p class="approvalTripCompanionEmpty">검색 결과가 없습니다.</p>';
        return;
    }
    resultBox.innerHTML = '<div class="approvalTripCompanionResultList">' + items.map(function (item) {
        var selectedClass = approvalTripCompanionSelections.some(function (selected) {
            return isSameApprovalLinePerson(selected, item);
        }) ? " selected" : "";
        return '<button type="button" class="approvalTripCompanionResultItem' + selectedClass + '" data-id="' + escapeDraftingHtml(item.id) + '" data-name="' + escapeDraftingHtml(item.name) + '" data-email="' + escapeDraftingHtml(item.email || "") + '" data-department="' + escapeDraftingHtml(formatApprovalEmployeeDepartment(item)) + '"><strong>' + escapeDraftingHtml(item.name) + '</strong><span>' + escapeDraftingHtml(formatApprovalEmployeePosition(item)) + '</span><span>' + escapeDraftingHtml(formatApprovalEmployeeDepartment(item)) + '</span></button>';
    }).join("") + '</div>';
    resultBox.querySelectorAll(".approvalTripCompanionResultItem").forEach(function (button) {
        button.addEventListener("click", function () {
            addTripCompanionSelection({
                id: button.getAttribute("data-id") || "",
                name: button.getAttribute("data-name") || "",
                email: button.getAttribute("data-email") || "",
                department: button.getAttribute("data-department") || ""
            });
            if (searchInput) searchInput.value = "";
            resultBox.innerHTML = "";
            renderTripCompanionSelectedList();
        });
    });
}

function addTripCompanionSelection(person) {
    if (!person) return;
    var exists = approvalTripCompanionSelections.some(function (item) {
        return isSameApprovalLinePerson(item, person);
    });
    if (!exists) approvalTripCompanionSelections.push(person);
}

function renderTripCompanionSelectedList() {
    var list = document.querySelector(".approvalTripCompanionSelectedList");
    if (!list) return;
    if (!approvalTripCompanionSelections.length) {
        list.innerHTML = "";
        return;
    }
    list.innerHTML = approvalTripCompanionSelections.map(function (item, index) {
        return '<span class="approvalTripCompanionChip">' + escapeDraftingHtml(item.name || item.id) + '<button type="button" data-index="' + index + '" aria-label="동반출장 삭제">×</button></span>';
    }).join("");
    list.querySelectorAll("button").forEach(function (button) {
        button.addEventListener("click", function () {
            var index = Number(button.getAttribute("data-index"));
            if (!Number.isFinite(index)) return;
            approvalTripCompanionSelections.splice(index, 1);
            renderTripCompanionSelectedList();
            renderTripCompanionSearchResults();
        });
    });
}

function hydrateTripCompanions(items) {
    approvalTripCompanionSelections = Array.isArray(items) ? items.map(function (item) {
        if (typeof item === "string") return { id: "", name: item, email: "", department: "" };
        return item || {};
    }).filter(function (item) {
        return !!(item.name || item.id);
    }) : [];
    renderTripCompanionSelectedList();
}

function getTripCompanions() {
    return approvalTripCompanionSelections.map(function (item) {
        return { id: item.id || "", name: item.name || "", email: item.email || "", department: item.department || "" };
    });
}

function bindTripExpenseActions() {
    var table = document.querySelector(".approvalTripExpenseTable");
    if (!table) return;
    table.addEventListener("input", function (event) {
        if (event.target && event.target.classList.contains("approvalTripExpenseAmount")) {
            event.target.value = event.target.value ? formatApprovalNumber(parseApprovalNumber(event.target.value)) : "";
            calculateTripExpenseTotal();
        }
    });
    calculateTripExpenseTotal();
}

function calculateTripExpenseTotal() {
    var amountTotal = 0;
    document.querySelectorAll(".approvalTripExpenseAmount").forEach(function (input) {
        amountTotal += parseApprovalNumber(input.value);
    });
    setText(".approvalTripExpenseTotal", formatApprovalNumber(amountTotal));
}

function getTripInfo() {
    return { startDate: getFieldValue("#approvalTripStartDate"), endDate: getFieldValue("#approvalTripEndDate"), destination: getFieldValue("#approvalTripDestination"), purpose: getFieldValue("#approvalTripPurpose"), companionText: getFieldValue("#approvalTripCompanionText"), companions: getTripCompanions(), content: getFieldValue("#approvalTripContent"), expenses: getTripExpenses() };
}

function hydrateTripInfo(data) {
    data = data || {};
    setFieldValue("#approvalTripStartDate", data.startDate || "");
    setFieldValue("#approvalTripEndDate", data.endDate || "");
    setFieldValue("#approvalTripDestination", data.destination || "");
    setFieldValue("#approvalTripPurpose", data.purpose || "");
    setFieldValue("#approvalTripCompanionText", data.companionText || (Array.isArray(data.companions) ? data.companions.map(function (item) { return typeof item === "string" ? item : item.name; }).filter(Boolean).join(", ") : ""));
    setFieldValue("#approvalTripContent", data.content || "");
    hydrateTripCompanions(data.companions);
    hydrateTripExpenses(data.expenses);
}

function getTripExpenses() {
    return { transportDetail: getFieldValue("#approvalTripTransportDetail"), transportAmount: getFieldValue("#approvalTripTransportAmount"), lodgingDetail: getFieldValue("#approvalTripLodgingDetail"), lodgingAmount: getFieldValue("#approvalTripLodgingAmount"), dailyDetail: getFieldValue("#approvalTripDailyDetail"), dailyAmount: getFieldValue("#approvalTripDailyAmount"), etcExpenseDetail: getFieldValue("#approvalTripEtcExpenseDetail"), etcExpenseAmount: getFieldValue("#approvalTripEtcExpenseAmount"), etcCostDetail: getFieldValue("#approvalTripEtcCostDetail"), etcCostAmount: getFieldValue("#approvalTripEtcCostAmount") };
}

function hydrateTripExpenses(data) {
    data = data || {};
    setFieldValue("#approvalTripTransportDetail", data.transportDetail || "");
    setFieldValue("#approvalTripTransportAmount", data.transportAmount || "");
    setFieldValue("#approvalTripLodgingDetail", data.lodgingDetail || "");
    setFieldValue("#approvalTripLodgingAmount", data.lodgingAmount || "");
    setFieldValue("#approvalTripDailyDetail", data.dailyDetail || "");
    setFieldValue("#approvalTripDailyAmount", data.dailyAmount || "");
    setFieldValue("#approvalTripEtcExpenseDetail", data.etcExpenseDetail || "");
    setFieldValue("#approvalTripEtcExpenseAmount", data.etcExpenseAmount || "");
    setFieldValue("#approvalTripEtcCostDetail", data.etcCostDetail || "");
    setFieldValue("#approvalTripEtcCostAmount", data.etcCostAmount || "");
    calculateTripExpenseTotal();
}

function bindVacationActions() {
    document.querySelectorAll('input[name="approvalVacationType"], #approvalVacationStartDate, #approvalVacationEndDate').forEach(function (field) {
        field.addEventListener("change", calculateVacationDays);
    });
    calculateVacationDays();
}

function calculateVacationDays() {
    var daysText = document.querySelector(".approvalVacationDays");
    if (!daysText) return;
    var type = getVacationType();
    var startValue = getFieldValue("#approvalVacationStartDate");
    var endValue = getFieldValue("#approvalVacationEndDate");
    if (type === "오전반차" || type === "오후반차") {
        daysText.textContent = "(0.5일)";
        if (startValue && !endValue) setFieldValue("#approvalVacationEndDate", startValue);
        return;
    }
    if (!startValue || !endValue) {
        daysText.textContent = "(0일)";
        return;
    }
    var startDate = new Date(startValue + "T00:00:00");
    var endDate = new Date(endValue + "T00:00:00");
    var diff = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    daysText.textContent = "(" + Math.max(diff, 0) + "일)";
}

function getVacationType() {
    var checked = document.querySelector('input[name="approvalVacationType"]:checked');
    return checked ? checked.value : "월차";
}

function setVacationType(type) {
    var normalized = String(type || "월차").trim() || "월차";
    var target = document.querySelector('input[name="approvalVacationType"][value="' + normalized + '"]');
    if (target) target.checked = true;
}

function getVacationInfo() {
    return { type: getVacationType(), startDate: getFieldValue("#approvalVacationStartDate"), endDate: getFieldValue("#approvalVacationEndDate"), daysText: getText(".approvalVacationDays") };
}

function hydrateVacationInfo(data) {
    data = data || {};
    setVacationType(data.type || "월차");
    setFieldValue("#approvalVacationStartDate", data.startDate || "");
    setFieldValue("#approvalVacationEndDate", data.endDate || "");
    calculateVacationDays();
}

async function saveTempDraft() {
    ensureConfirmedDocumentNumber();
    var payload = await buildDraftPayload();
    localStorage.setItem(APPROVAL_DRAFT_TEMP_KEY, JSON.stringify(payload));
    try {
        var saved = await saveApprovalDocument(payload, "draft");
        if (saved && saved.id) localStorage.setItem(APPROVAL_DRAFT_SERVER_ID_KEY, saved.id);
        if (saved && saved.docNo) renderDocumentNumber(saved.docNo);
        applySavedAttachmentPayload(payload);
        clearLocalDraftCache();
        alert("임시저장되었습니다.");
        location.href = "/approval/temp.html";
    } catch (error) {
        alert((error && error.message ? error.message : "임시저장 중 오류가 발생했습니다.") + "\n작성 중인 내용은 현재 브라우저에만 임시 보관되었습니다.");
    }
}

function clearLocalDraftCache() {
    localStorage.removeItem(APPROVAL_DRAFT_TEMP_KEY);
    localStorage.removeItem(APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY);
    localStorage.removeItem(APPROVAL_DRAFT_SERVER_ID_KEY);
}

async function hydrateApprovalDraftFromUrl() {
    var params = new URLSearchParams(location.search || "");
    var approvalId = String(params.get("approvalId") || "").trim();
    if (!approvalId) return false;

    try {
        var user = getApprovalCurrentUser();
        var data = await API.get(APPROVAL_API_BASE + "/documents/read", {
            id: approvalId,
            userId: user.id || "",
            requesterRole: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase()
        }, { errorMessage: "임시저장 문서를 불러오지 못했습니다." });
        if (!data.item) throw new Error(data.message || "임시저장 문서를 불러오지 못했습니다.");
        localStorage.setItem(APPROVAL_DRAFT_SERVER_ID_KEY, data.item.id || approvalId);
        localStorage.setItem(APPROVAL_DRAFT_TEMP_KEY, JSON.stringify(data.item));
        hydrateApprovalDraftData(data.item);
        return true;
    } catch (error) {
        alert(error.message || "임시저장 문서를 불러오지 못했습니다.");
        return false;
    }
}

function hydrateApprovalDraftData(data) {
    data = data || {};
    data.docType = normalizeApprovalDocType(data.docType || APPROVAL_DEFAULT_DOC_TYPE);
    setFieldValue("#approvalDocType", data.docType);
    setFieldValue("#approvalDocTitle", data.title || "");
    setFieldValue("#approvalProposalContent", data.proposalContent || "");
    setFieldValue("#approvalDocBody", data.body || "");
    setFieldValue("#approvalPaymentRequestDate", data.paymentRequestDate || "");
    setFieldValue("#approvalAssetUser", data.assetUser || "");
    setFieldValue("#approvalAssetName", data.assetName || "");
    hydrateApprovalLineSelectionCache(data);
    renderApprovalLineList();
    renderCategoryName();
    renderDocumentNumber(data.docNo || "");
    approvalSavedAttachmentsData = Array.isArray(data.attachmentsData) ? data.attachmentsData.slice() : [];
    renderAttachmentList(Array.isArray(data.fileNames) ? data.fileNames : []);
    hydrateExpenseProposalItems(data.expenseItems);
    hydrateExpenseResolutionItems(data.resolutionItems);
    hydrateAssetPurchaseItems(data.assetItems);
    hydrateCertificateInfo(data.certificateInfo);
    hydrateTripInfo(data.tripInfo || { content: data.docType === "출장신청서" ? data.body : "" });
    hydrateVacationInfo(data.vacationInfo);
}

function hydrateApprovalLineSelectionCache(data) {
    data = data || {};
    approvalLineApproverSelections = buildApprovalLineSelectionCache(data.approvers || [data.firstApprover], data.approverIds, data.approverDepartments, data.approverSignatureImages);
    approvalLineReferenceSelections = buildApprovalLineSelectionCache(data.referenceUsers || [data.referenceUser], data.referenceUserIds, data.referenceUserDepartments, []).slice(0, 3);
}

function buildApprovalLineSelectionCache(names, ids, departments, signatureImages) {
    var nameList = Array.isArray(names) ? names : [];
    var idList = Array.isArray(ids) ? ids : [];
    var departmentList = Array.isArray(departments) ? departments : [];
    var signatureList = Array.isArray(signatureImages) ? signatureImages : [];
    return nameList.map(function (name, index) {
        return { id: idList[index] || "", name: String(name || "").trim(), email: "", department: String(departmentList[index] || "").trim(), signatureImage: String(signatureList[index] || "").trim() };
    }).filter(function (item) {
        return !!item.name;
    });
}

async function submitApprovalDraft() {
    ensureConfirmedDocumentNumber();
    var payload = await buildDraftPayload();
    if (!payload.title) {
        alert("제목을 입력해주세요.");
        focusField("#approvalDocTitle");
        return;
    }
    if (!validateRequiredFieldsForSubmit(payload)) return;
    if (payload.firstApprover === "미지정") {
        alert("승인자를 지정해주세요.");
        return;
    }

    try {
        var saved = await saveApprovalDocument(payload, "pending");
        clearLocalDraftCache();
        alert("문서가 상신되었습니다.");
        location.href = "/approval/pending.html";
    } catch (error) {
        alert(error && error.message ? error.message : "문서 상신 중 오류가 발생했습니다.");
    }
}

function validateRequiredFieldsForSubmit(payload) {
    var docType = payload && payload.docType;
    if (docType === "지출품의서" && !payload.paymentRequestDate) {
        alert("지급요청일을 입력해주세요.");
        focusField("#approvalPaymentRequestDate");
        return false;
    }
    if (docType === "지출품의서" && !hasApprovalLineItems(payload.expenseItems)) {
        alert("품목을 1개 이상 입력해주세요.");
        focusField(".approvalExpenseName");
        return false;
    }
    if (docType === "지출결의서" && !hasApprovalLineItems(payload.resolutionItems)) {
        alert("사용 내역을 1개 이상 입력해주세요.");
        focusField(".approvalResolutionContent");
        return false;
    }
    if (docType === "입금결의서" && !hasApprovalLineItems(payload.resolutionItems)) {
        alert("상세 내역을 1개 이상 입력해주세요.");
        focusField(".approvalResolutionContent");
        return false;
    }
    if (docType === "비품구매 품의서") {
        if (!payload.assetUser) {
            alert("사용자를 입력해주세요.");
            focusField("#approvalAssetUser");
            return false;
        }
        if (!payload.assetName) {
            alert("자산명칭을 입력해주세요.");
            focusField("#approvalAssetName");
            return false;
        }
        if (!hasApprovalLineItems(payload.assetItems)) {
            alert("품명을 1개 이상 입력해주세요.");
            focusField(".approvalAssetItemName");
            return false;
        }
    }
    if (docType === "증명서 발급") {
        var certificateInfo = payload.certificateInfo || {};
        if (!certificateInfo.type) {
            alert("증명서 종류를 입력해주세요.");
            focusField("#approvalCertificateType");
            return false;
        }
    }
    if ((docType === "일반기안서" || docType === "일반품의서") && !payload.proposalContent) {
        alert("내용을 입력해주세요.");
        focusField("#approvalProposalContent");
        return false;
    }
    if (docType === "출장신청서") {
        var tripInfo = payload.tripInfo || {};
        if (!tripInfo.startDate || !tripInfo.endDate) {
            alert("출장기간을 입력해주세요.");
            focusField(!tripInfo.startDate ? "#approvalTripStartDate" : "#approvalTripEndDate");
            return false;
        }
        if (!tripInfo.destination) {
            alert("출장지를 입력해주세요.");
            focusField("#approvalTripDestination");
            return false;
        }
        if (!tripInfo.purpose) {
            alert("출장목적을 입력해주세요.");
            focusField("#approvalTripPurpose");
            return false;
        }
        if (!tripInfo.companionText) {
            alert("동반출장자를 입력해주세요.");
            focusField("#approvalTripCompanionText");
            return false;
        }
    }
    return true;
}

function hasApprovalLineItems(items) {
    return Array.isArray(items) && items.some(function (item) {
        if (!item) return false;
        return Object.keys(item).some(function (key) {
            return !!String(item[key] || "").trim();
        });
    });
}

async function buildDraftPayload() {
    var docType = normalizeApprovalDocType(getFieldValue("#approvalDocType"));
    var tripInfo = getTripInfo();
    var user = getApprovalCurrentUser();
    var newAttachmentsData = await readApprovalAttachedFiles();
    var attachmentsData = approvalSavedAttachmentsData.concat(newAttachmentsData);
    return {
        id: String(localStorage.getItem(APPROVAL_DRAFT_SERVER_ID_KEY) || "").trim(),
        docNo: getText(".docno"),
        docType: docType,
        title: getFieldValue("#approvalDocTitle"),
        proposalContent: getFieldValue("#approvalProposalContent"),
        body: docType === "출장신청서" ? tripInfo.content : getFieldValue("#approvalDocBody"),
        writeDate: getText(".approvalWriteDate"),
        authorId: user.id,
        authorName: user.name,
        authorEmail: user.email,
        department: user.department,
        paymentRequestDate: getFieldValue("#approvalPaymentRequestDate"),
        assetUser: getFieldValue("#approvalAssetUser"),
        assetName: getFieldValue("#approvalAssetName"),
        expenseItems: getExpenseProposalItems(),
        resolutionItems: getExpenseResolutionItems(),
        assetItems: getAssetPurchaseItems(),
        certificateInfo: getCertificateInfo(),
        tripInfo: tripInfo,
        vacationInfo: getVacationInfo(),
        firstApprover: getApprovalApproverDisplayText(),
        approvers: approvalLineApproverSelections.map(function (item) { return item.name || item.id; }).filter(Boolean),
        approverIds: approvalLineApproverSelections.map(function (item) { return item.id; }).filter(Boolean),
        approverDepartments: approvalLineApproverSelections.map(function (item) { return item.department || ""; }),
        approverSignatureImages: approvalLineApproverSelections.map(function (item) { return item.signatureImage || ""; }),
        referenceUser: getApprovalReferenceDisplayText(),
        referenceUsers: approvalLineReferenceSelections.slice(0, 3).map(function (item) { return item.name || item.id; }).filter(Boolean),
        referenceUserIds: approvalLineReferenceSelections.slice(0, 3).map(function (item) { return item.id; }).filter(Boolean),
        referenceUserDepartments: approvalLineReferenceSelections.slice(0, 3).map(function (item) { return item.department || ""; }),
        fileNames: approvalSavedFileNames.concat(newAttachmentsData.map(function (item) { return item.filename; })).filter(Boolean),
        attachmentsData: attachmentsData
    };
}

function readApprovalAttachedFiles() {
    return Promise.all(approvalAttachedFiles.map(function (file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var result = String(reader.result || "");
                resolve({
                    filename: file.name,
                    type: file.type || "application/octet-stream",
                    sizeBytes: file.size || 0,
                    content: result.split(",")[1] || ""
                });
            };
            reader.onerror = function () {
                reject(new Error("첨부파일을 읽지 못했습니다."));
            };
            reader.readAsDataURL(file);
        });
    }));
}

function applySavedAttachmentPayload(payload) {
    payload = payload || {};
    approvalSavedAttachmentsData = Array.isArray(payload.attachmentsData) ? payload.attachmentsData.slice() : [];
    approvalSavedFileNames = Array.isArray(payload.fileNames) ? payload.fileNames.slice() : [];
    approvalAttachedFiles = [];
    syncApprovalFileInput();
    renderAttachmentList(approvalSavedFileNames);
}

async function saveApprovalDocument(payload, status) {
    var requestPayload = Object.assign({}, payload, {
        status: status,
        requesterId: payload.authorId,
        requesterRole: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase()
    });
    var data = await API.post(APPROVAL_API_BASE + "/documents/save", requestPayload, { errorMessage: "전자결재 문서를 저장하지 못했습니다." });
    if (!data.item) {
        throw new Error(data.message || "전자결재 문서를 저장하지 못했습니다.");
    }
    return data.item;
}

function getApprovalCurrentUser() {
    if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
        var user = window.AuthStore.getCurrentUser();
        if (user) return user;
    }
    return {
        id: String(localStorage.getItem("userId") || "").trim().toLowerCase(),
        name: String(localStorage.getItem("userName") || "").trim(),
        email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
        department: String(localStorage.getItem("userDepartment") || "").trim()
    };
}

function ensureConfirmedDocumentNumber() {
    var docNoFields = document.querySelectorAll(".docno");
    if (!docNoFields.length) return "";
    var confirmed = String(localStorage.getItem(APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY) || "").trim();
    if (isValidApprovalDocumentNumber(confirmed)) {
        docNoFields.forEach(function (field) {
            field.textContent = confirmed;
        });
        return confirmed;
    }
    if (confirmed) localStorage.removeItem(APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY);
    var current = String(docNoFields[0].textContent || "").trim();
    var nextDocNo = isValidApprovalDocumentNumber(current) ? current : buildApprovalDocumentNumberPreview();
    reserveApprovalDocumentNumber(nextDocNo);
    docNoFields.forEach(function (field) {
        field.textContent = nextDocNo;
    });
    localStorage.setItem(APPROVAL_DRAFT_CONFIRMED_DOCNO_KEY, nextDocNo);
    return nextDocNo;
}

function buildApprovalDocumentNumberPreview() {
    var now = new Date();
    var prefix = buildApprovalDocumentNumberPrefix(now);
    var stored = getApprovalDocumentNumberCounters();
    var nextNumber = Number(stored[prefix] || 0) + 1;
    return prefix + "-" + String(nextNumber).padStart(6, "0");
}

function isValidApprovalDocumentNumber(docNo) {
    var match = String(docNo || "").match(/^(\d{12})-(\d{6})$/);
    if (!match) return false;
    var number = Number(match[2] || 0);
    return number > 0 && number < 999999;
}

function reserveApprovalDocumentNumber(docNo) {
    var match = String(docNo || "").match(/^(\d{12})-(\d{6})$/);
    if (!match) return;
    var stored = getApprovalDocumentNumberCounters();
    var prefix = match[1];
    var number = Number(match[2] || 0);
    stored[prefix] = Math.max(Number(stored[prefix] || 0), number);
    localStorage.setItem(APPROVAL_DOCNO_COUNTER_KEY, JSON.stringify(stored));
}

function getApprovalDocumentNumberCounters() {
    try {
        var stored = JSON.parse(localStorage.getItem(APPROVAL_DOCNO_COUNTER_KEY) || "{}");
        return stored && typeof stored === "object" ? stored : {};
    } catch (error) {
        return {};
    }
}

function buildApprovalDocumentNumberPrefix(date) {
    return String(date.getFullYear()) + padDrafting(date.getMonth() + 1) + padDrafting(date.getDate()) + padDrafting(date.getHours()) + padDrafting(date.getMinutes());
}

function getFieldValue(selector) {
    var el = document.querySelector(selector);
    return el ? String(el.value || "").trim() : "";
}

function setFieldValue(selector, value) {
    var el = document.querySelector(selector);
    if (el) {
        el.value = value || "";
        if (el.dataset && el.dataset.dropdownField === "true") syncApprovalDateSelects(el, el.value || "");
    }
}

function getText(selector) {
    var el = document.querySelector(selector);
    return el ? String(el.textContent || "").trim() : "";
}

function setText(selector, value) {
    var el = document.querySelector(selector);
    if (el) el.textContent = value;
}

function normalizeApproverValue(value) {
    var normalized = String(value || "").trim();
    return normalized || "미지정";
}

function focusField(selector) {
    var el = document.querySelector(selector);
    if (!el) return;
    if (el.dataset && el.dataset.dropdownField === "true" && el._approvalDateDropdown && el._approvalDateDropdown.year) {
        el._approvalDateDropdown.year.focus();
        return;
    }
    el.focus();
}

function formatDraftingDate(date) {
    return date.getFullYear() + "." + padDrafting(date.getMonth() + 1) + "." + padDrafting(date.getDate());
}

function parseApprovalNumber(value) {
    return Number(String(value || "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
}

function formatApprovalNumber(value) {
    return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function padDrafting(value) {
    return String(value).padStart(2, "0");
}

function escapeDraftingHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
