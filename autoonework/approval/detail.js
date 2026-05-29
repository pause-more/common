(function () {
    var APPROVAL_API_BASE = getGroupwareApiBase("/api/approval");
var API = window.GroupwareApi;
    var state = { user: null, selectedItem: null, from: "" };

    document.addEventListener("DOMContentLoaded", function () {
        initializeApprovalDetailPage();
    });

    async function initializeApprovalDetailPage() {
        state.user = getCurrentApprovalUser();
        state.from = getUrlParam("from") || "pending";
        bindDetailPageEvents();
        await loadApprovalDetail();
    }

    function bindDetailPageEvents() {
        document.querySelectorAll(".approvalDetailClose, .approvalDetailCancel").forEach(function (button) {
            button.addEventListener("click", goBackToApprovalList);
        });
        var approveButton = document.querySelector(".approvalApproveBtn");
        var rejectButton = document.querySelector(".approvalRejectBtn");
        if (approveButton) approveButton.addEventListener("click", function () {
            decideApprovalDocument("approved");
        });
        if (rejectButton) rejectButton.addEventListener("click", function () {
            var reason = prompt("반려 사유를 입력해주세요.");
            if (reason === null) return;
            decideApprovalDocument("rejected", reason);
        });
    }

    async function loadApprovalDetail() {
        var body = document.querySelector(".approvalDetailBody");
        var id = getUrlParam("id");
        if (!body) return;
        body.innerHTML = '<p class="approvalDetailLoading">문서를 불러오는 중입니다.</p>';
        state.selectedItem = null;
        syncDetailDecisionButtons(null);

        if (!state.user || !state.user.id) {
            body.innerHTML = '<p class="approvalDetailEmpty">로그인 정보가 없습니다.</p>';
            return;
        }
        if (!id) {
            body.innerHTML = '<p class="approvalDetailEmpty">문서 정보가 없습니다.</p>';
            return;
        }

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

    function goBackToApprovalList() {
        var from = state.from || "pending";
        var map = {
            pending: "/approval/pending.html",
            closed: "/approval/closed.html",
            return: "/approval/return.html",
            dashboard: "/approval/dashboard.html",
            temp: "/approval/temp.html"
        };
        location.href = map[from] || "/approval/pending.html";
    }

    function renderApprovalDetail(item) {
        var body = document.querySelector(".approvalDetailBody");
        var title = document.querySelector(".approvalDetailHead h3");
        if (!body) return;
        if (title) title.textContent = item.title || "제목 없음";
        syncDetailDecisionButtons(item);
        body.innerHTML =
            '<div class="approvalDetailGrid">' +
                renderDetailPair("문서번호", item.docNo) +
                renderDetailPair("상신일시", formatApprovalDateTime(item.submittedAt || item.updatedAt || item.createdAt || "")) +
                renderDetailPair("기안자", item.authorName) +
                renderDetailPair("부서명", item.department) +
            '</div>' +
            renderDetailSectionTitle("결재선") +
            renderDetailApprovalLineCards(item) +
            renderDetailRejectReason(item) +
            renderDetailSectionTitle("기안내용") +
            renderDetailTextSection(getProposalTitle(item.docType), item.proposalContent) +
            renderDetailDocumentTables(item) +
            renderDetailTextSection(item.docType === "출장신청서" ? "내용" : "기타 추가 내용", item.body) +
            renderDetailFiles(item) +
            renderDetailDeleteAction(item);
        bindDetailDeleteButton(item);
    }

    function renderDetailRejectReason(item) {
        if (!item || item.status !== "rejected" || !item.decisionReason) return "";
        return '<div class="approvalDetailRejectReason">' +
            '<h5><ion-icon name="alert-circle"></ion-icon>반려 사유</h5>' +
            '<p>' + escapeApprovalHtml(item.decisionReason).replace(/\r\n|\r|\n/g, "<br>") + '</p>' +
        '</div>';
    }

    function syncDetailDecisionButtons(item) {
        var canDecide = canCurrentUserDecide(item);
        document.querySelectorAll(".approvalApproveBtn, .approvalRejectBtn").forEach(function (button) {
            button.style.display = canDecide ? "inline-flex" : "none";
        });
    }

    function canCurrentUserDecide(item) {
        if (!item || !state.user) return false;
        if (item.status && item.status !== "pending") return false;
        if (isCurrentUserAdmin()) return true;
        var approverIds = Array.isArray(item.approverIds) ? item.approverIds : [];
        var approvers = Array.isArray(item.approvers) ? item.approvers : [];
        return approverIds.indexOf(state.user.id) > -1 || approvers.indexOf(state.user.name) > -1;
    }

    function canCurrentUserDelete(item) {
        if (!item || !state.user) return false;
        if (isCurrentUserAdmin()) return true;
        return item.authorId === state.user.id && item.status !== "approved";
    }

    function isCurrentUserAdmin() {
        return window.AuthStore && typeof window.AuthStore.isAdmin === "function"
            ? window.AuthStore.isAdmin()
            : state.user && state.user.role === "admin";
    }

    function renderDetailDeleteAction(item) {
        if (!canCurrentUserDelete(item)) return "";
        return '<div class="boardDetailActions"><button type="button" class="boardDangerBtn" data-detail-delete="true">삭제</button></div>';
    }

    function bindDetailDeleteButton(item) {
        var body = document.querySelector(".approvalDetailBody");
        if (!body) return;
        var button = body.querySelector("[data-detail-delete]");
        if (!button) return;
        button.addEventListener("click", function () {
            deleteApprovalDocument(item && item.id);
        });
    }

    function renderDetailPair(label, value) {
        return '<div class="approvalDetailPair"><span>' + escapeApprovalHtml(label) + '</span><strong>' + escapeApprovalHtml(value || "-") + '</strong></div>';
    }

    function renderDetailSectionTitle(title) {
        return '<h4 class="approvalDetailSectionTitle">' + escapeApprovalHtml(title || "") + '</h4>';
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
        return '<div class="approvalDetailWidePair"><span>' + escapeApprovalHtml(title || "내용") + '</span><strong class="approvalDetailText">' + escapeApprovalHtml(value).replace(/\r\n|\r|\n/g, "<br>") + '</strong></div>';
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
            return renderDetailTable("구매품목", ["품목", "수량", "단가", "금액", "비고"], normalizeDetailRows(item.assetItems, function (row) {
                return [row.name, row.qty, formatDetailMoney(row.price), formatDetailMoney(row.amount), row.note];
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
            var expenses = getDetailTripExpenses(trip.expenses);
            var tripMeta = renderDetailTable("출장정보", ["출장기간", "출장지", "출장목적", "동반출장"], normalizeDetailRows([trip], function (row) {
                return [formatDetailPeriod(row.startDate, row.endDate), row.destination || row.place, row.purpose, formatDetailCompanions(row.companions, row.companionText)];
            }), "");
            return tripMeta + renderDetailGap(20) + renderDetailTable("예정 경비내역", ["항목", "산출내역", "금액"], normalizeDetailRows(expenses, function (row) {
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

    function getDetailTripExpenses(expenses) {
        if (Array.isArray(expenses)) return expenses;
        expenses = expenses && typeof expenses === "object" ? expenses : {};
        return [
            { label: "교통비", detail: expenses.transportDetail, amount: expenses.transportAmount },
            { label: "숙박비", detail: expenses.lodgingDetail, amount: expenses.lodgingAmount },
            { label: "일당비", detail: expenses.dailyDetail, amount: expenses.dailyAmount },
            { label: "기타경비", detail: expenses.etcExpenseDetail, amount: expenses.etcExpenseAmount },
            { label: "기타비용", detail: expenses.etcCostDetail, amount: expenses.etcCostAmount }
        ];
    }

    function formatDetailCompanions(companions, fallback) {
        if (Array.isArray(companions) && companions.length) {
            return companions.map(function (item) {
                if (typeof item === "string") return item;
                return item && item.name ? item.name : "";
            }).filter(Boolean).join(", ");
        }
        return fallback || "";
    }

    function renderDetailTable(title, headers, rows, footHtml) {
        rows = Array.isArray(rows) ? rows : [];
        if (!rows.length && !footHtml) return "";
        var tableClass = "approvalDetailTable";
        if (headers.indexOf("사용 내역") > -1) tableClass += " approvalDetailTableUseWide approvalDetailTableWide3";
        if (headers.indexOf("상세 내역") > -1) tableClass += " approvalDetailTableUseWide approvalDetailTableWide3";
        if (headers[0] === "품목" && headers.length === 5) tableClass += " approvalDetailTableUseWide approvalDetailTableWide1";
        if (headers.indexOf("산출내역") > -1) tableClass += " approvalDetailTableUseWide approvalDetailTableWide2";
        return '<div class="approvalDetailTableWrap"><h5>' + escapeApprovalHtml(title || "상세내역") + '</h5><table class="' + tableClass + '"><thead><tr>' + headers.map(function (header) {
            return '<th>' + escapeApprovalHtml(header) + '</th>';
        }).join("") + '</tr></thead><tbody>' + rows.map(function (row) {
            return '<tr>' + row.map(function (value, index) {
                return '<td data-label="' + escapeApprovalHtml(headers[index] || "") + '">' + escapeApprovalHtml(value || "-") + '</td>';
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
            return '<td>' + escapeApprovalHtml(value === "" ? "" : value || "0") + '</td>';
        }).join("") + '</tr>';
    }

    function renderDetailGap(size) {
        return '<div style="height:' + Number(size || 20) + 'px;"></div>';
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
        return '<div class="approvalDetailWidePair approvalDetailFilePair"><span>첨부파일</span><strong><ul class="approvalDetailFiles">' + names.map(function (name, index) {
            var hasData = attachmentsData[index] && attachmentsData[index].content;
            if (!hasData) return '<li><span>' + escapeApprovalHtml(name) + '</span></li>';
            var href = APPROVAL_API_BASE + "/attachment?id=" + encodeURIComponent(item.id || "") + "&index=" + encodeURIComponent(index) + "&disposition=attachment";
            return '<li><a href="' + href + '" download="' + escapeApprovalHtml(name) + '">' + escapeApprovalHtml(name) + '</a></li>';
        }).join("") + '</ul></strong></div>';
    }

    function getReferenceText(item) {
        if (Array.isArray(item.referenceUsers) && item.referenceUsers.length) return item.referenceUsers.join(", ");
        return item.referenceUser && item.referenceUser !== "미지정" ? item.referenceUser : "-";
    }

    function getProposalTitle(docType) {
        if (docType === "지출결의서") return "지출사유";
        if (docType === "입금결의서") return "적요";
        if (docType === "비품구매 품의서") return "사유";
        if (docType === "휴가원") return "사유";
        if (docType === "일반기안서") return "내용";
        return "품의내용";
    }

    async function decideApprovalDocument(decision, reason) {
        if (!state.selectedItem || !state.selectedItem.id) return;
        var isApproved = decision === "approved";
        if (!confirm(isApproved ? "문서를 승인하시겠습니까?" : "문서를 반려하시겠습니까?")) return;

        try {
            setDecisionButtonsDisabled(true);
            await API.post(APPROVAL_API_BASE + "/documents/decision", {
                id: state.selectedItem.id,
                decision: decision,
                reason: reason || "",
                requesterId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "결재 처리에 실패했습니다." });
            alert(isApproved ? "승인 처리되었습니다." : "반려 처리되었습니다.");
            location.href = isApproved ? "/approval/closed.html" : "/approval/return.html";
        } catch (error) {
            alert(error.message || "결재 처리 중 오류가 발생했습니다.");
        } finally {
            setDecisionButtonsDisabled(false);
        }
    }

    function setDecisionButtonsDisabled(disabled) {
        document.querySelectorAll(".approvalApproveBtn, .approvalRejectBtn").forEach(function (button) {
            button.disabled = disabled;
        });
    }

    async function deleteApprovalDocument(id) {
        if (!id || !state.user) return;
        if (!confirm("문서를 삭제하시겠습니까?")) return;

        try {
            await API.post(APPROVAL_API_BASE + "/documents/delete", {
                id: id,
                requesterId: state.user.id,
                requesterRole: state.user.role || "staff"
            }, { errorMessage: "문서 삭제에 실패했습니다." });
            alert("문서가 삭제되었습니다.");
            goBackToApprovalList();
        } catch (error) {
            alert(error.message || "문서 삭제 중 오류가 발생했습니다.");
        }
    }

    function getUrlParam(name) {
        return new URLSearchParams(location.search).get(name) || "";
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
