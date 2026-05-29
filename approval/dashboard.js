(function () {
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
var API = window.GroupwareApi;
    var state = { user: null, items: [], selectedItem: null, statusFilter: "all" };

    document.addEventListener("DOMContentLoaded", function () {
        initializeApprovalDashboardPage();
    });

    async function initializeApprovalDashboardPage() {
        state.user = getCurrentApprovalUser();
        bindDashboardStatusTabs();
        bindDetailModalEvents();
        await loadDashboardDocuments();
    }

    function bindDashboardStatusTabs() {
        window.addEventListener("resize", updateDashboardStatusIndicator);
        document.querySelectorAll(".approvalStatusTabs button").forEach(function (button) {
            button.addEventListener("click", function () {
                state.statusFilter = button.getAttribute("data-status-filter") || "all";
                renderDashboardStatusTabs();
                renderDashboardDocuments();
            });
        });
        renderDashboardStatusTabs();
    }

    function renderDashboardStatusTabs() {
        document.querySelectorAll(".approvalStatusTabs button").forEach(function (button) {
            button.classList.toggle("selected", (button.getAttribute("data-status-filter") || "all") === state.statusFilter);
        });
        updateDashboardStatusIndicator();
    }

    function updateDashboardStatusIndicator() {
        var tabs = document.querySelector(".approvalStatusTabs");
        var selected = tabs && tabs.querySelector("button.selected");
        if (!tabs || !selected) return;
        tabs.style.setProperty("--tab-x", selected.offsetLeft + "px");
        tabs.style.setProperty("--tab-w", selected.offsetWidth + "px");
    }

    async function loadDashboardDocuments() {
        var tbody = document.querySelector(".approvalDashboardListBody");
        if (!tbody) return;

        if (!state.user || !state.user.id) {
            renderDashboardEmpty("로그인 정보가 없습니다.");
            return;
        }

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents", {
                box: "all",
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "전체문서를 불러오지 못했습니다." });
            state.items = (Array.isArray(data.items) ? data.items : []).filter(function (item) {
                return item && item.status !== "draft";
            });
            renderDashboardDocuments();
        } catch (error) {
            renderDashboardEmpty(error.message || "전체문서를 불러오지 못했습니다.");
        }
    }

    function renderDashboardDocuments() {
        var tbody = document.querySelector(".approvalDashboardListBody");
        if (!tbody) return;

        var items = getFilteredDashboardItems();
        if (!items.length) {
            renderDashboardEmpty(getDashboardEmptyMessage());
            return;
        }

        tbody.innerHTML = items.map(function (item) {
            return '<tr class="approvalListRow approvalDashboardListRow" data-id="' + escapeApprovalHtml(item.id || "") + '">' +
                '<td>' + escapeApprovalHtml(item.docNo || "-") + '</td>' +
                '<td>' + escapeApprovalHtml(item.docType || "-") + '</td>' +
                '<td class="approvalListTitleCell">' + escapeApprovalHtml(item.title || "제목 없음") + '</td>' +
                '<td>' + escapeApprovalHtml(item.authorName || "-") + '</td>' +
                //'<td>' + escapeApprovalHtml(getApproverText(item)) + '</td>' +
                '<td>' + escapeApprovalHtml(formatApprovalDateTime(item.submittedAt || item.updatedAt || item.createdAt || "")) + '</td>' +
                '<td>' + renderStatusBadge(item.status) + '</td>' +
            '</tr>';
        }).join("");

        tbody.querySelectorAll(".approvalDashboardListRow").forEach(function (row) {
            row.addEventListener("click", function () {
                var id = row.getAttribute("data-id") || "";
                if (id) location.href = "/approval/detail.html?id=" + encodeURIComponent(id) + "&from=dashboard";
            });
        });
    }

    function renderDashboardEmpty(message) {
        var tbody = document.querySelector(".approvalDashboardListBody");
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="6" class="approvalListEmpty">' + escapeApprovalHtml(message || "전체문서가 없습니다.") + '</td></tr>';
    }

    function getFilteredDashboardItems() {
        if (state.statusFilter === "all") return state.items.slice();
        return state.items.filter(function (item) {
            return String(item && item.status || "pending").trim().toLowerCase() === state.statusFilter;
        });
    }

    function getDashboardEmptyMessage() {
        if (state.statusFilter === "pending") return "결재대기 문서가 없습니다.";
        if (state.statusFilter === "approved") return "승인 문서가 없습니다.";
        if (state.statusFilter === "rejected") return "반려 문서가 없습니다.";
        return "전체문서가 없습니다.";
    }

    function bindDetailModalEvents() {
        document.querySelectorAll(".approvalDetailClose, .approvalDetailCancel, .approvalDetailDim").forEach(function (button) {
            button.addEventListener("click", closeApprovalDetail);
        });
    }

    function renderStatusBadge(status) {
        var normalized = String(status || "pending").trim().toLowerCase();
        if (normalized === "approved") return '<span class="approvalStatusBadge approved">승인</span>';
        if (normalized === "rejected") return '<span class="approvalStatusBadge rejected">반려</span>';
        return '<span class="approvalStatusBadge pending">결재대기</span>';
    }

    function getDecisionDateLabel(status) {
        var normalized = String(status || "").trim().toLowerCase();
        if (normalized === "approved") return "승인일시";
        if (normalized === "rejected") return "반려일시";
        return "처리일시";
    }

    function getDecisionDateValue(item) {
        item = item || {};
        if (item.status === "approved") return item.approvedAt || item.decidedAt || item.updatedAt || "";
        if (item.status === "rejected") return item.rejectedAt || item.decidedAt || item.updatedAt || "";
        return "";
    }

    async function openApprovalDetail(id) {
        var modal = document.querySelector(".approvalDetailModal");
        var body = document.querySelector(".approvalDetailBody");
        if (!modal || !body) return;
        modal.style.display = "flex";
        body.innerHTML = '<p class="approvalDetailLoading">문서를 불러오는 중입니다.</p>';
        state.selectedItem = null;

        try {
            var data = await API.get(APPROVAL_API_BASE + "/documents/read", {
                id: id,
                userId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "문서를 불러오지 못했습니다." });
            if (!data.item) throw new Error(data.message || "문서를 불러오지 못했습니다.");
            state.selectedItem = data.item;
            renderApprovalDetail(data.item);
        } catch (error) {
            body.innerHTML = '<p class="approvalDetailEmpty">' + escapeApprovalHtml(error.message || "문서를 불러오지 못했습니다.") + '</p>';
        }
    }

    function closeApprovalDetail() {
        var modal = document.querySelector(".approvalDetailModal");
        if (modal) modal.style.display = "none";
        state.selectedItem = null;
    }

    function renderApprovalDetail(item) {
        var body = document.querySelector(".approvalDetailBody");
        var title = document.querySelector(".approvalDetailHead h3");
        if (!body) return;
        if (title) title.textContent = item.title || "제목 없음";
        body.innerHTML =
            '<div class="approvalDetailGrid">' +
                renderDetailPair("문서번호", item.docNo) +
                renderDetailPair("기안양식", item.docType) +
                renderDetailPair("기안자", item.authorName) +
                renderDetailPair("부서명", item.department) +
                renderDetailPair("작성일자", item.writeDate) +
                renderDetailPair("상신일시", formatApprovalDateTime(item.submittedAt || item.createdAt || "")) +
                renderDetailPair(getDecisionDateLabel(item.status), formatApprovalDateTime(getDecisionDateValue(item))) +
            '</div>' +
            renderDetailApprovalLineCards(item) +
            (item.status === "rejected" ? renderDetailTextSection("반려사유", item.decisionReason) : "") +
            renderDetailTextSection(getProposalTitle(item.docType), item.proposalContent) +
            renderDetailDocumentTables(item) +
            renderDetailTextSection(item.docType === "출장신청서" ? "내용" : "기타 추가 내용", item.body) +
            renderDetailFiles(item);
    }

    function renderDetailPair(label, value) {
        return '<div class="approvalDetailPair"><span>' + escapeApprovalHtml(label) + '</span><strong>' + escapeApprovalHtml(value || "-") + '</strong></div>';
    }

    function renderDetailApprovalLineCards(item) {
        var approvers = getDetailPeople(item, "approver");
        var references = getDetailPeople(item, "reference");
        return '<div class="approvalDetailLineCards">' +
            renderDetailPersonCards("승인", approvers, getDetailApproverState(item), item && item.status === "approved") +
            (references.length ? renderDetailPersonCards("참조", references, getDetailReferenceState(item)) : "") +
        '</div>';
    }

    function renderDetailPersonCards(label, people, stateText, showSignature) {
        if (label === "참조") return renderDetailReferenceCard(people);
        if (!people.length) people = [{ name: "미지정", department: "", stateText: "" }];
        return people.map(function (person) {
            return '<div class="approvalDetailLineCard approver">' +
                '<div class="approvalDetailLineCardLabel">' + escapeApprovalHtml(label) + '</div>' +
                '<div class="approvalDetailLineCardSign" aria-hidden="true">' + renderDetailSignatureImage(person, showSignature) + '</div>' +
                '<div class="approvalDetailLineCardNameRow"><strong class="approvalDetailLineCardName">' + escapeApprovalHtml(person.name || "미지정") + '</strong></div>' +
            '</div>';
        }).join("");
    }

    function renderDetailSignatureImage(person, showSignature) {
        if (!showSignature) return "";
        var signatureImage = String(person && person.signatureImage || "").trim();
        if (!/^data:image\/(?:png|jpeg);base64,/.test(signatureImage)) return "";
        return '<img class="approvalDetailLineSignatureImage" src="' + escapeApprovalHtml(signatureImage) + '" alt="">';
    }

    function renderDetailReferenceCard(people) {
        var slots = (Array.isArray(people) ? people : []).filter(function (person) { return person && person.name; }).slice(0, 3);
        if (!slots.length) return "";
        return '<div class="approvalDetailLineCard reference">' +
            '<div class="approvalDetailLineCardLabel">참조</div>' +
            slots.map(function (person) {
                return '<div class="approvalDetailLineCardReferenceRow">' + (person.name ? '<strong class="approvalDetailLineCardName">' + escapeApprovalHtml(person.name) + '</strong>' : '') + '</div>';
            }).join("") +
        '</div>';
    }

    function getDetailPeople(item, type) {
        item = item || {};
        var names = type === "reference" ? item.referenceUsers : item.approvers;
        var departments = type === "reference" ? item.referenceUserDepartments : item.approverDepartments;
        var signatureImages = type === "reference" ? [] : item.approverSignatureImages;
        if (!Array.isArray(names) || !names.length) {
            var fallback = type === "reference" ? item.referenceUser : item.firstApprover;
            names = fallback && fallback !== "미지정" ? [fallback] : [];
        }
        if (!Array.isArray(departments)) departments = [];
        if (!Array.isArray(signatureImages)) signatureImages = [];
        return names.map(function (name, index) {
            var personName = String(name || "").trim();
            return { name: personName, department: formatDetailLineDepartment(personName, departments[index]), signatureImage: String(signatureImages[index] || "") };
        }).filter(function (person) {
            return person.name && person.name !== "미지정";
        });
    }

    function formatDetailLineDepartment(name, department) {
        var normalizedName = String(name || "").trim();
        var normalizedDepartment = String(department || "").trim();
        if (normalizedName === "최재성" && (!normalizedDepartment || normalizedDepartment === "-")) return "대표";
        return normalizedDepartment;
    }

    function getDetailApproverState(item) {
        if (!item) return "";
        if (item.status === "approved") return "승인 " + formatDetailLineDate(item.approvedAt || item.decidedAt || item.updatedAt || "");
        if (item.status === "rejected") return "반려 " + formatDetailLineDate(item.rejectedAt || item.decidedAt || item.updatedAt || "");
        return "결재대기";
    }

    function getDetailReferenceState(item) {
        return "";
    }

    function formatDetailLineDate(value) {
        var date = formatApprovalDateTime(value).split(" ")[0] || "";
        return date === "-" ? "" : date;
    }

    function renderDetailTextSection(title, value) {
        if (!value) return "";
        return '<div class="approvalDetailSection"><h5>' + escapeApprovalHtml(title || "내용") + '</h5><div class="approvalDetailText">' + escapeApprovalHtml(value).replace(/\r\n|\r|\n/g, "<br>") + '</div></div>';
    }

    function renderDetailDocumentTables(item) {
        if (!item) return "";
        if (item.docType === "지출품의서") {
            return renderDetailTable("품목사항", ["품목", "수량", "단가", "금액", "부가세", "비고"], normalizeDetailRows(item.expenseItems, function (row) {
                return [row.name, row.qty, formatDetailMoney(row.price), formatDetailMoney(row.amount), formatDetailMoney(row.tax), row.note];
            }), renderDetailTotalRow("합계", 3, formatDetailMoney(sumDetailRows(item.expenseItems, "amount")), formatDetailMoney(sumDetailRows(item.expenseItems, "tax")), ""));
        }
        if (item.docType === "지출결의서") {
            return renderDetailTable("품목사항", ["일자", "분류", "사용 내역", "금액", "비고"], normalizeDetailRows(item.resolutionItems, function (row) {
                return [formatDetailDate(row.date), row.category, row.content, formatDetailMoney(row.amount), row.note];
            }), renderDetailTotalRow("합계", 3, formatDetailMoney(sumDetailRows(item.resolutionItems, "amount")), ""));
        }
        if (item.docType === "입금결의서") {
            return renderDetailTable("품목사항", ["입금일자", "거래처명", "상세 내역", "금액", "비고"], normalizeDetailRows(item.resolutionItems, function (row) {
                return [formatDetailDate(row.date), row.category, row.content, formatDetailMoney(row.amount), row.note];
            }), renderDetailTotalRow("합계", 3, formatDetailMoney(sumDetailRows(item.resolutionItems, "amount")), ""));
        }
        if (item.docType === "비품구매 품의서") {
            return renderDetailTable("구매품목", ["품목", "단가", "수량", "금액", "비고"], normalizeDetailRows(item.assetItems, function (row) {
                return [row.name, formatDetailMoney(row.price), row.qty, formatDetailMoney(row.amount), row.note];
            }), renderDetailTotalRow("합계", 3, formatDetailMoney(sumDetailRows(item.assetItems, "amount")), ""));
        }
        if (item.docType === "증명서 발급") {
            var info = item.certificateInfo || {};
            return renderDetailTable("신청정보", ["증명서 종류", "용도", "수량", "제출처", "비고"], normalizeDetailRows([info], function (row) {
                return [row.type, row.purpose, row.qty, row.submitTo, row.note];
            }), "");
        }
        if (item.docType === "출장신청서") {
            var trip = item.tripInfo || {};
            var expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
            var tripMeta = renderDetailTable("출장정보", ["출장기간", "출장지", "출장목적", "동반출장"], normalizeDetailRows([trip], function (row) {
                return [formatDetailPeriod(row.startDate, row.endDate), row.place, row.purpose, row.companions];
            }), "");
            return tripMeta + renderDetailTable("예정 경비내역", ["항목", "산출내역", "금액"], normalizeDetailRows(expenses, function (row) {
                return [row.label || row.name, row.detail, formatDetailMoney(row.amount)];
            }), renderDetailTotalRow("출장비 총액", 2, formatDetailMoney(sumDetailRows(expenses, "amount"))));
        }
        if (item.docType === "휴가원") {
            var vacation = item.vacationInfo || {};
            return renderDetailTable("휴가정보", ["구분", "기간", "일수"], normalizeDetailRows([vacation], function (row) {
                return [row.type, formatDetailPeriod(row.startDate, row.endDate), String(row.daysText || "").replace(/[()]/g, "")];
            }), "");
        }
        return "";
    }

    function renderDetailTable(title, headers, rows, footHtml) {
        rows = Array.isArray(rows) ? rows : [];
        if (!rows.length && !footHtml) return "";
        return '<div class="approvalDetailTableWrap"><h5>' + escapeApprovalHtml(title || "상세내역") + '</h5><table class="approvalDetailTable"><thead><tr>' + headers.map(function (header) {
            return '<th>' + escapeApprovalHtml(header) + '</th>';
        }).join("") + '</tr></thead><tbody>' + rows.map(function (row) {
            return '<tr>' + row.map(function (value) {
                return '<td>' + escapeApprovalHtml(value || "-") + '</td>';
            }).join("") + '</tr>';
        }).join("") + '</tbody>' + (footHtml ? '<tfoot>' + footHtml + '</tfoot>' : '') + '</table></div>';
    }

    function normalizeDetailRows(items, mapper) {
        return (Array.isArray(items) ? items : []).map(function (item) {
            return mapper(item || {});
        }).filter(function (row) {
            return row.some(function (value) { return String(value || "").trim(); });
        });
    }

    function renderDetailTotalRow(label, colSpan) {
        var values = Array.prototype.slice.call(arguments, 2);
        return '<tr><td colspan="' + Number(colSpan || 1) + '">' + escapeApprovalHtml(label || "합계") + '</td>' + values.map(function (value) {
            return '<td>' + escapeApprovalHtml(value || "0") + '</td>';
        }).join("") + '</tr>';
    }

    function sumDetailRows(items, key) {
        return (Array.isArray(items) ? items : []).reduce(function (sum, item) {
            return sum + Number(String(item && item[key] || "0").replace(/,/g, "")) || sum;
        }, 0);
    }

    function formatDetailMoney(value) {
        var number = Number(String(value || "0").replace(/,/g, ""));
        if (!number) return "";
        return number.toLocaleString("ko-KR");
    }

    function formatDetailDate(value) {
        var text = String(value || "").trim();
        if (!text) return "";
        return text.replace(/-/g, ".");
    }

    function formatDetailPeriod(startDate, endDate) {
        var start = formatDetailDate(startDate);
        var end = formatDetailDate(endDate);
        if (start && end) return start + " ~ " + end;
        return start || end || "";
    }

    function renderDetailFiles(item) {
        item = item || {};
        var names = Array.isArray(item.fileNames) ? item.fileNames.filter(Boolean) : [];
        var attachmentsData = Array.isArray(item.attachmentsData) ? item.attachmentsData : [];
        if (!names.length) return "";
        return '<div class="approvalDetailSection"><h5>첨부파일</h5><ul class="approvalDetailFiles">' + names.map(function (name, index) {
            var hasData = attachmentsData[index] && attachmentsData[index].content;
            if (!hasData) return '<li><span>' + escapeApprovalHtml(name) + '</span></li>';
            var href = APPROVAL_API_BASE + "/attachment?id=" + encodeURIComponent(item.id || "") + "&index=" + encodeURIComponent(index) + "&disposition=attachment";
            return '<li><a href="' + href + '" download="' + escapeApprovalHtml(name) + '">' + escapeApprovalHtml(name) + '</a></li>';
        }).join("") + '</ul></div>';
    }

    function getApproverText(item) {
        if (Array.isArray(item.approvers) && item.approvers.length) return item.approvers.join(", ");
        return item.firstApprover && item.firstApprover !== "미지정" ? item.firstApprover : "-";
    }

    function getProposalTitle(docType) {
        if (docType === "지출결의서") return "지출사유";
        if (docType === "입금결의서") return "적요";
        if (docType === "비품구매 품의서") return "사유";
        if (docType === "휴가원") return "사유";
        if (docType === "일반기안서") return "내용";
        return "품의내용";
    }

    function getCurrentApprovalUser() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            var user = window.AuthStore.getCurrentUser();
            if (user) return user;
        }
        return {
            id: String(localStorage.getItem("userId") || "").trim().toLowerCase(),
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase(),
            email: String(localStorage.getItem("userEmail") || "").trim().toLowerCase(),
            department: String(localStorage.getItem("userDepartment") || "").trim()
        };
    }

    function formatApprovalDateTime(value) {
        if (!value) return "-";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + padApprovalValue(date.getMonth() + 1) + "." + padApprovalValue(date.getDate()) + " " + padApprovalValue(date.getHours()) + ":" + padApprovalValue(date.getMinutes());
    }

    function padApprovalValue(value) {
        return String(value).padStart(2, "0");
    }

    function escapeApprovalHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
