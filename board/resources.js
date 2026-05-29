(function () {
    var RESOURCES_API_BASE = getGroupwareApiBase("/api/board/resources");
    var API = window.GroupwareApi;
    var STORAGE_KEY = "gw-board-resources";
    var LIST_CACHE_KEY = STORAGE_KEY + "-list";
    var page = document.querySelector(".boardPage--resources");
    if (!page) return;

    var state = {
        user: getCurrentUser(),
        files: [],
        pendingFiles: [],
        search: "",
        sort: "latest"
    };
    var elements = {};

    initialize();

    function initialize() {
        renderShell();
        cacheElements();
        bindEvents();
        state.files = loadFilesFromLocalStorage();
        render();
        loadFiles().then(function (files) {
            state.files = files;
            render();
        });
    }

    function renderShell() {
        page.innerHTML = [
            '<div class="resourcesBoard">',
            '<div class="resourcesBoardHead">',
            '<div class="resourcesBoardTitleWrap"><strong class="resourcesBoardTitle">리소스 센터</strong></div>',
            '<div class="resourcesBoardTools">',
            '<div class="resourcesBoardSearch"><div class="boardSearchField"><input type="search" class="boardSearchInput" placeholder="제목이나 파일명을 검색하세요"></div></div>',
            '<select class="boardFormSelect resourcesSortSelect"><option value="latest">최신순</option><option value="oldest">오래된순</option></select>',
            '</div>',
            '</div>',
            '<div class="resourcesTable">',
            '<div class="resourcesTableHead"><span>종류</span><span>이름</span><span>크기</span><span>확장자</span></div>',
            '<div class="resourcesList"></div>',
            '</div>',
            canWrite() ? '<div class="resourcesFooter"><button type="button" class="boardWriteBtn">작성하기</button></div>' : "",
            '</div>',
            '<div class="boardModal" style="display:none;">',
            '<div class="boardModalDim"></div>',
            '<div class="boardModalDialog">',
            '<div class="boardModalHead"><strong class="boardModalTitle">파일 업로드</strong><button type="button" class="boardModalClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></div>',
            '<div class="boardModalBody">',
            '<input type="hidden" class="resourcesFormId">',
            '<div class="boardFormGrid">',
            '<div class="boardFormRow"><label class="boardFormLabel">제목</label><input type="text" class="boardFormInput resourcesTitleInput" placeholder="게시글 제목을 입력하세요"></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">파일</label><div class="boardFormInline resourcesFileInline"><label for="resourcesFileInput" class="boardGhostBtn">파일 선택</label><input type="file" id="resourcesFileInput" class="resourcesFileInput" hidden><div class="boardFileList resourcesUploadList"></div></div></div>',
            '</div>',
            '<div class="boardModalActions"><button type="button" class="boardCancelBtn">취소</button><button type="button" class="boardSubmitBtn">업로드</button></div>',
            '</div>',
            '</div>',
            '</div>'
        ].join("");
    }

    function cacheElements() {
        elements.searchInput = page.querySelector(".boardSearchInput");
        elements.sortSelect = page.querySelector(".resourcesSortSelect");
        elements.writeButton = page.querySelector(".boardWriteBtn");
        elements.list = page.querySelector(".resourcesList");
        elements.modal = page.querySelector(".boardModal");
        elements.modalDim = page.querySelector(".boardModalDim");
        elements.modalClose = page.querySelector(".boardModalClose");
        elements.cancelButton = page.querySelector(".boardCancelBtn");
        elements.submitButton = page.querySelector(".boardSubmitBtn");
        elements.formId = page.querySelector(".resourcesFormId");
        elements.titleInput = page.querySelector(".resourcesTitleInput");
        elements.fileInput = page.querySelector(".resourcesFileInput");
        elements.uploadList = page.querySelector(".resourcesUploadList");
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", function () {
                state.search = String(elements.searchInput.value || "").trim().toLowerCase();
                render();
            });
        }
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener("change", function () {
                state.sort = String(elements.sortSelect.value || "latest").trim().toLowerCase();
                render();
            });
        }
        if (elements.writeButton) {
            elements.writeButton.addEventListener("click", function () {
                if (!canWrite()) {
                    alert("리소스 센터는 관리자 또는 대표만 업로드할 수 있습니다.");
                    return;
                }
                openModal();
            });
        }
        [elements.modalDim, elements.modalClose, elements.cancelButton].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeModal);
        });
        if (elements.fileInput) {
            elements.fileInput.addEventListener("change", handleFileChange);
        }
        if (elements.uploadList) {
            elements.uploadList.addEventListener("click", function (event) {
                var removeButton = event.target.closest("[data-remove-index]");
                if (!removeButton) return;
                removePendingFile(removeButton.getAttribute("data-remove-index"));
            });
        }
        if (elements.submitButton) {
            elements.submitButton.addEventListener("click", saveFiles);
        }
        if (elements.list) {
            elements.list.addEventListener("click", handleListClick);
        }
    }

    function render() {
        var files = getFilteredFiles();
        if (!elements.list) return;
        if (!files.length) {
            elements.list.innerHTML = '<div class="boardEmpty">업로드된 파일이 없습니다.</div>';
            return;
        }
        elements.list.innerHTML = files.map(function (item) {
            return [
                '<article class="resourcesRow" data-id="' + escapeHtml(item.id) + '">',
                '<div class="resourcesRowMain">',
                renderFileTypeIcon(item.name),
                '<div class="resourcesNameCell">',
                '<span class="resourcesRowName">' + escapeHtml(getResourceTitle(item)) + '</span>',
                '<span class="resourcesNameActions">',
                item.dataUrl ? '<button type="button" class="resourcesIconBtn" data-action="download" data-id="' + escapeHtml(item.id) + '" aria-label="다운로드">' + getDownloadIcon() + '</button>' : '<button type="button" class="resourcesIconBtn" disabled aria-label="다운로드">' + getDownloadIcon() + '</button>',
                canEdit(item) ? '<button type="button" class="resourcesTextAction" data-action="edit" data-id="' + escapeHtml(item.id) + '">수정</button>' : '',
                canEdit(item) ? '<button type="button" class="resourcesTextAction" data-action="delete" data-id="' + escapeHtml(item.id) + '">삭제</button>' : '',
                '</span>',
                '</div>',
                '<div class="resourcesMeta">',
                '<span class="resourcesRowSize">' + escapeHtml(formatFileSize(item.size)) + '</span>',
                '<span class="resourcesRowExt">' + escapeHtml(getFileExtension(item.name)) + '</span>',
                '</div>',
                '</div>',
                '</article>'
            ].join("");
        }).join("");
        Array.prototype.slice.call(elements.list.querySelectorAll("[data-action]")).forEach(function (button) {
            button.addEventListener("click", function () {
                var action = button.getAttribute("data-action");
                var id = button.getAttribute("data-id");
                if (action === "download") {
                    downloadResource(getFileById(id));
                    return;
                }
                if (action === "edit") {
                    openModal(getFileById(id));
                    return;
                }
                if (action === "delete") {
                    deleteFile(id);
                }
            });
        });
    }

    function handleListClick(event) {
        var actionTarget = event.target.closest("a, button, input, label, [data-action]");
        if (actionTarget) return;
        if (!window.matchMedia || !window.matchMedia("(max-width: 1000px)").matches) return;
        var row = event.target.closest(".resourcesRow[data-id]");
        if (!row) return;
        var item = getFileById(row.getAttribute("data-id"));
        if (!item || !item.dataUrl) return;
        downloadResource(item);
    }

    function downloadResource(item) {
        if (!item || !item.dataUrl) return;
        if (window.groupwareDesktop && typeof window.groupwareDesktop.downloadFile === "function") {
            window.groupwareDesktop.downloadFile({
                name: item.name || getResourceTitle(item) || "download",
                dataUrl: item.dataUrl,
                type: item.type || ""
            });
            return;
        }
        var link = document.createElement("a");
        link.href = item.dataUrl;
        link.download = item.name || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function openModal(fileItem) {
        if (!elements.modal) return;
        var editing = !!(fileItem && fileItem.id);
        if (elements.formId) elements.formId.value = editing ? fileItem.id : "";
        if (elements.titleInput) elements.titleInput.value = editing ? getResourceTitle(fileItem) : "";
        state.pendingFiles = editing && fileItem ? [{ kind: "existing", item: fileItem }] : [];
        if (elements.fileInput) elements.fileInput.value = "";
        renderUploadList();
        if (elements.submitButton) elements.submitButton.textContent = editing ? "수정하기" : "업로드";
        if (page.querySelector(".boardModalTitle")) {
            page.querySelector(".boardModalTitle").textContent = editing ? "파일 수정" : "파일 업로드";
        }
        elements.modal.classList.remove("is-closing");
        elements.modal.style.display = "block";
        document.documentElement.classList.add("boardModalOpen");
        document.body.classList.add("boardModalOpen");
        requestAnimationFrame(function () {
            if (elements.modal) elements.modal.classList.add("is-open");
        });
    }

    function closeModal() {
        if (!elements.modal) return;
        if (elements.formId) elements.formId.value = "";
        if (elements.titleInput) elements.titleInput.value = "";
        state.pendingFiles = [];
        if (elements.fileInput) elements.fileInput.value = "";
        renderUploadList();
        elements.modal.classList.remove("is-open");
        elements.modal.classList.add("is-closing");
        setTimeout(function () {
            if (!elements.modal) return;
            elements.modal.style.display = "none";
            elements.modal.classList.remove("is-closing");
            document.documentElement.classList.remove("boardModalOpen");
            document.body.classList.remove("boardModalOpen");
        }, 320);
    }

    function handleFileChange() {
        var files = Array.prototype.slice.call(elements.fileInput && elements.fileInput.files || []);
        state.pendingFiles = files.map(function (file) {
            return { kind: "new", file: file };
        });
        renderUploadList();
    }

    function renderUploadList() {
        if (!elements.uploadList) return;
        elements.uploadList.innerHTML = state.pendingFiles.map(function (entry, index) {
            return [
                '<span class="boardFileItem">',
                escapeHtml(getPendingFileName(entry)),
                '<button type="button" class="boardFileRemove" data-remove-index="' + index + '" aria-label="첨부 파일 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>',
                '</span>'
            ].join("");
        }).join("");
    }

    async function saveFiles() {
        if (!canWrite()) {
            alert("리소스 센터는 관리자 또는 대표만 업로드할 수 있습니다.");
            return;
        }
        var editingId = String(elements.formId && elements.formId.value || "").trim();
        var title = String(elements.titleInput && elements.titleInput.value || "").trim();
        var pendingFiles = state.pendingFiles.slice();
        var newFiles = pendingFiles.filter(function (entry) {
            return entry.kind === "new" && entry.file;
        }).map(function (entry) {
            return entry.file;
        });
        if (!title) {
            alert("제목을 입력해 주세요.");
            return;
        }
        if (!editingId && !newFiles.length) {
            alert("파일을 선택해 주세요.");
            return;
        }
        var category = editingId && getFileById(editingId) ? normalizeCategory(getFileById(editingId).category) : "기타";
        if (editingId) {
            var existing = getFileById(editingId);
            if (!existing) {
                alert("수정할 파일을 찾을 수 없습니다.");
                return;
            }
            if (!pendingFiles.length) {
                await deleteFile(existing.id, true);
                return;
            }
            if (!newFiles.length) {
                try {
                    var updateResult = await requestResources(RESOURCES_API_BASE + "/save", {
                        method: "POST",
                        body: JSON.stringify({
                            requesterId: state.user.id,
                            item: {
                                id: existing.id,
                                title: title,
                                name: existing.name,
                                size: existing.size,
                                type: existing.type,
                                dataUrl: existing.dataUrl,
                                category: category,
                                createdAt: existing.createdAt,
                                authorId: existing.authorId,
                                authorName: existing.authorName,
                                authorDepartment: existing.authorDepartment
                            }
                        })
                    });
                    state.files = Array.isArray(updateResult.items) ? updateResult.items : state.files;
                    saveFilesToLocalStorage(state.files);
                    closeModal();
                    render();
                } catch (error) {
                    alert(error.message || "파일을 수정하지 못했습니다.");
                }
                return;
            }
            try {
                var updatedDataUrl = await readFile(newFiles[0]);
                var replaceResult = await requestResources(RESOURCES_API_BASE + "/save", {
                    method: "POST",
                    body: JSON.stringify({
                        requesterId: state.user.id,
                        item: {
                            id: existing.id,
                            title: title,
                            name: newFiles[0].name,
                            size: newFiles[0].size || 0,
                            type: newFiles[0].type || "",
                            dataUrl: updatedDataUrl,
                            category: category,
                            createdAt: existing.createdAt,
                            authorId: existing.authorId,
                            authorName: existing.authorName,
                            authorDepartment: existing.authorDepartment
                        }
                    })
                });
                state.files = Array.isArray(replaceResult.items) ? replaceResult.items : state.files;
                saveFilesToLocalStorage(state.files);
                closeModal();
                render();
            } catch (error) {
                alert("파일을 불러오지 못했습니다.");
            }
            return;
        }
        try {
            var items = await Promise.all(newFiles.map(function (file) {
                return readFile(file).then(function (dataUrl) {
                    return {
                        id: "resource_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                        title: title,
                        name: file.name,
                        size: file.size || 0,
                        type: file.type || "",
                        dataUrl: dataUrl,
                        category: category,
                        createdAt: new Date().toISOString(),
                        authorId: state.user.id,
                        authorName: state.user.name,
                        authorDepartment: state.user.department
                    };
                });
            }));
            var createResult = await requestResources(RESOURCES_API_BASE + "/save", {
                method: "POST",
                body: JSON.stringify({
                    requesterId: state.user.id,
                    items: items
                })
            });
            state.files = Array.isArray(createResult.items) ? createResult.items : state.files;
            saveFilesToLocalStorage(state.files);
            closeModal();
            render();
        } catch (error) {
            alert("파일을 불러오지 못했습니다.");
        }
    }

    function removePendingFile(index) {
        var targetIndex = Number(index);
        if (isNaN(targetIndex) || targetIndex < 0) return;
        state.pendingFiles = state.pendingFiles.filter(function (_, itemIndex) {
            return itemIndex !== targetIndex;
        });
        if (!state.pendingFiles.length && elements.fileInput) {
            elements.fileInput.value = "";
        }
        renderUploadList();
    }

    function getFilteredFiles() {
        var keyword = String(state.search || "").trim().toLowerCase();
        var sort = String(state.sort || "latest").trim().toLowerCase();
        return state.files.slice().filter(function (item) {
            if (!keyword) return true;
            var title = String(getResourceTitle(item) || "").toLowerCase();
            var name = String(item && item.name || "").toLowerCase();
            var author = String(item && item.authorName || "").toLowerCase();
            return title.indexOf(keyword) > -1 || name.indexOf(keyword) > -1 || author.indexOf(keyword) > -1;
        }).sort(function (a, b) {
            var compare = String(b.createdAt).localeCompare(String(a.createdAt));
            return sort === "oldest" ? -compare : compare;
        });
    }

    function loadFiles() {
        return requestResources(RESOURCES_API_BASE, { method: "GET" }).then(function (data) {
            var files = Array.isArray(data.items) ? normalizeResourceItems(data.items) : [];
            saveFilesToLocalStorage(files);
            return files;
        }).catch(function () {
            return loadFilesFromLocalStorage();
        });
    }

    function loadFilesFromLocalStorage() {
        try {
            var saved = localStorage.getItem(LIST_CACHE_KEY) || localStorage.getItem(STORAGE_KEY);
            if (!saved) return [];
            return normalizeResourceItems(JSON.parse(saved));
        } catch (error) {
            return [];
        }
    }

    function saveFilesToLocalStorage(files) {
        try {
            localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(compactResourceList(files)));
        } catch (error) {}
    }

    function compactResourceList(files) {
        return (Array.isArray(files) ? files : []).map(function (item) {
            return {
                id: item.id,
                title: item.title,
                name: item.name,
                size: item.size,
                type: item.type,
                category: normalizeCategory(item.category || item.ownerCategory),
                createdAt: item.createdAt,
                authorId: item.authorId,
                authorName: item.authorName,
                authorDepartment: item.authorDepartment
            };
        });
    }

    function normalizeResourceItems(items) {
        return Array.isArray(items) ? items.map(function (item) {
            item.category = normalizeCategory(item.category || item.ownerCategory);
            return item;
        }) : [];
    }

    function readFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function canWrite() {
        return window.AuthStore && typeof window.AuthStore.canManageContent === "function"
            ? window.AuthStore.canManageContent()
            : state.user.role === "admin" || state.user.role === "ceo";
    }

    function canEdit(item) {
        return canWrite() || String(item.authorId || "") === state.user.id;
    }

    function getFileById(id) {
        return state.files.find(function (item) { return item.id === id; }) || null;
    }

    async function deleteFile(id, skipConfirm) {
        var item = getFileById(id);
        if (!item || !canEdit(item)) return;
        if (!skipConfirm && !confirm("파일을 삭제할까요?")) return;
        try {
            var result = await requestResources(RESOURCES_API_BASE + "/delete", {
                method: "POST",
                body: JSON.stringify({
                    id: id,
                    requesterId: state.user.id
                })
            });
            state.files = Array.isArray(result.items) ? result.items : [];
            saveFilesToLocalStorage(state.files);
            closeModal();
            render();
        } catch (error) {
            alert(error.message || "파일을 삭제하지 못했습니다.");
        }
    }

    function getPendingFileName(entry) {
        if (!entry) return "";
        if (entry.kind === "existing" && entry.item) return String(entry.item.name || "");
        if (entry.kind === "new" && entry.file) return String(entry.file.name || "");
        return "";
    }

    function requestResources(url, options) {
        options = options || {};
        return API.request(url, Object.assign({}, options, {
            errorMessage: "리소스 요청을 처리하지 못했습니다."
        }));
    }

    function normalizeCategory(value) {
        var category = String(value || "").trim();
        if (!category) return "기타";
        if (category === "mine" || category === "shared") return "기타";
        return category;
    }

    function getCurrentUser() {
        if (window.AuthStore && typeof window.AuthStore.getCurrentUser === "function") {
            return window.AuthStore.getCurrentUser() || { id: "guest", name: "게스트", role: "staff", department: "" };
        }
        return {
            id: String(localStorage.getItem("userId") || "guest").trim().toLowerCase(),
            name: String(localStorage.getItem("userName") || "게스트").trim(),
            role: String(localStorage.getItem("userRole") || "staff").trim().toLowerCase(),
            department: String(localStorage.getItem("userDepartment") || "").trim()
        };
    }

    function getFileExtension(name) {
        var value = String(name || "");
        if (value.indexOf(".") === -1) return "-";
        return value.split(".").pop().toLowerCase();
    }

    function getResourceTitle(item) {
        return String(item && (item.title || item.name) || "").trim();
    }

    function getFileTypeKind(name) {
        var extension = getFileExtension(name).toLowerCase();
        if (extension === "ppt" || extension === "pptx") return "ppt";
        if (extension === "xls" || extension === "xlsx" || extension === "csv") return "xls";
        if (extension === "hwp" || extension === "hwpx") return "hwp";
        if (extension === "zip" || extension === "rar" || extension === "7z") return "zip";
        if (extension === "pdf") return "pdf";
        if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic"].indexOf(extension) > -1) return "img";
        return "file";
    }

    function renderFileTypeIcon(name) {
        var kind = getFileTypeKind(name);
        var labelMap = { ppt: "P", xls: "X", hwp: "한", zip: "ZIP", pdf: "PDF", img: "IMG", file: "FILE" };
        return '<span class="resourcesFileIcon resourcesFileIcon--' + kind + '" aria-label="' + escapeHtml(getFileExtension(name).toUpperCase()) + '">' + escapeHtml(labelMap[kind] || "FILE") + '</span>';
    }

    function getDownloadIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17zM5 19h14v2H5z"></path></svg>';
    }

    function formatFileSize(bytes) {
        var size = Number(bytes || 0);
        if (!size) return "-";
        if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + "MB";
        return (size / 1024).toFixed(1) + "KB";
    }

    function formatDate(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
    }

    function pad(value) {
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
