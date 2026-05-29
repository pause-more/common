(function () {
    var CLOUD_API_BASE = getGroupwareApiBase("/api/cloud/files");
    var CLOUD_DOWNLOAD_BASE = getGroupwareApiBase("/api/cloud/file");
    var API = window.GroupwareApi;
    var STORAGE_KEY = "gw-cloud-files";
    var MAIL_SHARE_ATTACHMENTS_KEY = "gw-mail-share-attachments";
    var page = document.querySelector(".boardPage--cloud");
    if (!page) return;

    var state = {
        user: getCurrentUser(),
        files: [],
        search: "",
        sort: "latest",
        quotaBytes: 2 * 1024 * 1024 * 1024,
        usedBytes: 0,
        selectedIds: {}
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
            '<div class="cloudBoard">',
            '<div class="cloudBoardHead">',
            '<div class="cloudBoardTitleWrap"><strong class="cloudBoardTitle">클라우드</strong></div>',
            '<div class="cloudBoardTools">',
            '<div class="cloudBoardSearch"><div class="boardSearchField"><input type="search" class="boardSearchInput" placeholder="파일명이나 제목을 검색하세요"></div></div>',
            '<select class="boardFormSelect cloudSortSelect"><option value="latest">최신순</option><option value="oldest">오래된순</option></select>',
            '</div>',
            '</div>',
            '<div class="cloudUsageCard">',
            '<div class="cloudUsageMeta">',
            '<strong class="cloudUsageTitle">내 저장공간</strong>',
            '<span class="cloudUsageValue">0 MB / 2 GB</span>',
            '</div>',
            '<div class="cloudUsageBar"><span class="cloudUsageFill" style="width:0%;"></span></div>',
            '<div class="cloudUsageScale"><span class="cloudUsageTick cloudUsageTick--current">0 MB</span><span class="cloudUsageTick cloudUsageTick--total">2 GB</span></div>',
            '</div>',
            '<div class="cloudActionBar">',
            '<div class="cloudActionGroup">',
            '<button type="button" class="cloudActionBtn cloudDownloadBtn">내려받기</button>',
            '<button type="button" class="cloudActionBtn cloudRenameBtn">이름 바꾸기</button>',
            '<button type="button" class="cloudActionBtn cloudDeleteBtn">삭제</button>',
            '<div class="cloudShareAction">',
            '<button type="button" class="cloudActionBtn cloudShareBtn">공유<ion-icon name="caret-down-outline"></ion-icon></button>',
            '<div class="cloudShareDropdown">',
            '<button type="button" class="cloudShareOptionBtn" data-share="link">링크 공유</button>',
            '<button type="button" class="cloudShareOptionBtn" data-share="mail">메일로 공유</button>',
            '</div>',
            '</div>',
            '</div>',
            '</div>',
            '<div class="cloudTable">',
            '<div class="cloudTableHead"><span class="cloudCheckHead"><input type="checkbox" class="cloudAllCheck" aria-label="전체 선택"></span><span>종류</span><span>이름</span><span>크기</span><span>수정한 날짜</span><span>생성한 날짜</span></div>',
            '<div class="cloudList"></div>',
            '</div>',
            '<div class="cloudFooter"><button type="button" class="boardWriteBtn">파일 업로드</button><input type="file" class="cloudFileInput" hidden multiple></div>',
            '</div>'
        ].join("");
    }

    function cacheElements() {
        elements.searchInput = page.querySelector(".boardSearchInput");
        elements.sortSelect = page.querySelector(".cloudSortSelect");
        elements.list = page.querySelector(".cloudList");
        elements.writeButton = page.querySelector(".boardWriteBtn");
        elements.usageValue = page.querySelector(".cloudUsageValue");
        elements.usageFill = page.querySelector(".cloudUsageFill");
        elements.usageCurrent = page.querySelector(".cloudUsageTick--current");
        elements.usageTotal = page.querySelector(".cloudUsageTick--total");
        elements.fileInput = page.querySelector(".cloudFileInput");
        elements.allCheck = page.querySelector(".cloudAllCheck");
        elements.downloadButton = page.querySelector(".cloudDownloadBtn");
        elements.renameButton = page.querySelector(".cloudRenameBtn");
        elements.deleteButton = page.querySelector(".cloudDeleteBtn");
        elements.shareAction = page.querySelector(".cloudShareAction");
        elements.shareButton = page.querySelector(".cloudShareBtn");
        elements.shareOptions = Array.prototype.slice.call(page.querySelectorAll(".cloudShareOptionBtn"));
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
                if (elements.fileInput) elements.fileInput.click();
            });
        }
        if (elements.fileInput) {
            elements.fileInput.addEventListener("change", handleFileChange);
        }
        if (elements.allCheck) {
            elements.allCheck.addEventListener("change", handleAllCheckChange);
        }
        if (elements.downloadButton) {
            elements.downloadButton.addEventListener("click", downloadSelectedFiles);
        }
        if (elements.renameButton) {
            elements.renameButton.addEventListener("click", renameSelectedFile);
        }
        if (elements.deleteButton) {
            elements.deleteButton.addEventListener("click", deleteSelectedFiles);
        }
        if (elements.shareButton && elements.shareAction) {
            elements.shareButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                elements.shareAction.classList.toggle("is-open");
            });
        }
        elements.shareOptions.forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                handleShareAction(button.getAttribute("data-share"));
            });
        });
        document.addEventListener("click", function (event) {
            if (!elements.shareAction) return;
            if (elements.shareAction.contains(event.target)) return;
            elements.shareAction.classList.remove("is-open");
        });
    }

    function render() {
        renderUsage();
        renderList();
        updateActionButtons();
    }

    function renderUsage() {
        if (elements.usageValue) {
            elements.usageValue.textContent = formatFileSize(state.usedBytes) + " / 2 GB";
        }
        if (elements.usageFill) {
            var percent = state.quotaBytes ? Math.min(100, Math.round((state.usedBytes / state.quotaBytes) * 1000) / 10) : 0;
            elements.usageFill.style.width = percent + "%";
        }
        if (elements.usageCurrent) {
            var currentPercent = Math.min(100, Math.max(0, state.quotaBytes ? (state.usedBytes / state.quotaBytes) * 100 : 0));
            elements.usageCurrent.textContent = formatFileSize(state.usedBytes);
            elements.usageCurrent.style.left = currentPercent + "%";
            elements.usageCurrent.style.transform = currentPercent <= 8 ? "translateX(0)" : (currentPercent >= 92 ? "translateX(-100%)" : "translateX(-50%)");
        }
        if (elements.usageTotal) {
            elements.usageTotal.textContent = "2 GB";
        }
    }

    function renderList() {
        var files = getFilteredFiles();
        if (!elements.list) return;
        if (!files.length) {
            elements.list.innerHTML = '<div class="boardEmpty">업로드된 파일이 없습니다.</div>';
            syncAllCheckState(files);
            return;
        }

        elements.list.innerHTML = files.map(function (item) {
            return [
                '<article class="cloudRow' + (isFileSelected(item.id) ? ' is-selected' : '') + '" data-id="' + escapeHtml(item.id) + '">',
                '<div class="cloudRowMain">',
                '<span class="cloudCheckCell"><input type="checkbox" class="cloudRowCheck" data-id="' + escapeHtml(item.id) + '" aria-label="' + escapeHtml(getCloudTitle(item)) + ' 선택"' + (isFileSelected(item.id) ? ' checked' : '') + '></span>',
                '<span class="cloudTypeCell">' + renderFileTypeIcon(item.name) + '</span>',
                '<div class="cloudNameCell">',
                '<span class="cloudRowName">' + escapeHtml(getCloudTitle(item)) + '</span>',
                '</div>',
                '<span class="cloudRowSize">' + escapeHtml(formatFileSize(item.size)) + '</span>',
                '<span class="cloudRowDate">' + escapeHtml(formatDate(item.updatedAt || item.createdAt)) + '</span>',
                '<span class="cloudRowDate">' + escapeHtml(formatDate(item.createdAt)) + '</span>',
                '</div>',
                '</article>'
            ].join("");
        }).join("");

        Array.prototype.slice.call(elements.list.querySelectorAll(".cloudRowCheck")).forEach(function (checkbox) {
            checkbox.addEventListener("change", function () {
                toggleFileSelection(checkbox.getAttribute("data-id"), checkbox.checked);
                syncAllCheckState(files);
                updateActionButtons();
            });
        });
        syncAllCheckState(files);
    }

    async function handleFileChange() {
        var files = Array.prototype.slice.call(elements.fileInput && elements.fileInput.files || []);
        if (!files.length) {
            return;
        }
        if (elements.fileInput) elements.fileInput.value = "";
        await saveFiles(files);
    }

    async function saveFiles(files) {
        try {
            var items = [];
            var reservedNames = buildCloudNameRegistry(state.files);

            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                var existing = findCloudFileByName(file.name);
                var nextName = file.name;
                var id = "cloud_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
                var createdAt = new Date().toISOString();
                var title = "";

                if (existing) {
                    var renamed = buildNextCloudName(file.name, reservedNames);
                    var shouldOverwrite = confirm('"' + file.name + '" 파일이 이미 있습니다.\n\n확인을 누르면 기존 파일을 덮어쓰고,\n취소를 누르면 "' + renamed + '" 이름으로 업로드합니다.');

                    if (shouldOverwrite) {
                        id = existing.id;
                        createdAt = existing.createdAt || createdAt;
                        title = existing.title || "";
                        nextName = existing.name || file.name;
                    } else {
                        nextName = renamed;
                    }
                } else if (reservedNames[getCloudNameKey(file.name)]) {
                    nextName = buildNextCloudName(file.name, reservedNames);
                }

                reservedNames[getCloudNameKey(nextName)] = true;

                items.push(await readFile(file).then(function (dataUrl) {
                    return {
                        id: id,
                        title: title,
                        name: nextName,
                        size: file.size || 0,
                        type: file.type || "",
                        dataUrl: dataUrl,
                        createdAt: createdAt
                    };
                }));
            }

            var result = await requestCloud(CLOUD_API_BASE + "/save", {
                method: "POST",
                body: JSON.stringify({
                    requesterId: state.user.id,
                    items: items
                })
            });

            state.files = Array.isArray(result.items) ? result.items : [];
            syncSelectedFiles();
            state.quotaBytes = Number(result.quotaBytes || state.quotaBytes);
            state.usedBytes = Number(result.usedBytes || 0);
            saveFilesToLocalStorage(state.files);
            render();
        } catch (error) {
            alert(error.message || "파일을 업로드하지 못했습니다.");
        }
    }

    async function deleteFile(id) {
        var item = getFileById(id);
        if (!item) return;
        if (!confirm("파일을 삭제할까요?")) return;

        try {
            var result = await requestCloud(CLOUD_API_BASE + "/delete", {
                method: "POST",
                body: JSON.stringify({
                    id: id,
                    requesterId: state.user.id
                })
            });
            state.files = Array.isArray(result.items) ? result.items : [];
            syncSelectedFiles();
            state.quotaBytes = Number(result.quotaBytes || state.quotaBytes);
            state.usedBytes = Number(result.usedBytes || 0);
            saveFilesToLocalStorage(state.files);
            render();
        } catch (error) {
            alert(error.message || "파일을 삭제하지 못했습니다.");
        }
    }

    function loadFiles() {
        return requestCloud(CLOUD_API_BASE + "?userId=" + encodeURIComponent(state.user.id), { method: "GET" }).then(function (data) {
            state.quotaBytes = Number(data.quotaBytes || state.quotaBytes);
            state.usedBytes = Number(data.usedBytes || 0);
            var files = Array.isArray(data.items) ? normalizeCloudItems(data.items) : [];
            state.selectedIds = {};
            saveFilesToLocalStorage(files);
            return files;
        }).catch(function () {
            return loadFilesFromLocalStorage();
        });
    }

    function loadFilesFromLocalStorage() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return [];
            return normalizeCloudItems(JSON.parse(saved));
        } catch (error) {
            return [];
        }
    }

    function saveFilesToLocalStorage(files) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
        } catch (error) {}
    }

    function normalizeCloudItems(items) {
        return Array.isArray(items) ? items.map(function (item) {
            return item;
        }) : [];
    }

    function getFilteredFiles() {
        var keyword = String(state.search || "").trim().toLowerCase();
        var sort = String(state.sort || "latest").trim().toLowerCase();
        return state.files.slice().filter(function (item) {
            if (!keyword) return true;
            var title = String(getCloudTitle(item) || "").toLowerCase();
            var name = String(item && item.name || "").toLowerCase();
            return title.indexOf(keyword) > -1 || name.indexOf(keyword) > -1;
        }).sort(function (a, b) {
            var compare = String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
            return sort === "oldest" ? -compare : compare;
        });
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

    function requestCloud(url, options) {
        options = options || {};
        return API.request(url, Object.assign({}, options, {
            errorMessage: "클라우드 요청을 처리하지 못했습니다."
        }));
    }

    function buildDownloadUrl(item) {
        return CLOUD_DOWNLOAD_BASE + "?id=" + encodeURIComponent(item.id) + "&userId=" + encodeURIComponent(state.user.id);
    }

    function getFileById(id) {
        return state.files.find(function (item) { return item.id === id; }) || null;
    }

    function handleAllCheckChange() {
        var files = getFilteredFiles();
        var shouldSelect = !!(elements.allCheck && elements.allCheck.checked);
        files.forEach(function (item) {
            toggleFileSelection(item.id, shouldSelect);
        });
        renderList();
        updateActionButtons();
    }

    function toggleFileSelection(id, checked) {
        var key = String(id || "").trim();
        if (!key) return;
        if (checked) {
            state.selectedIds[key] = true;
        } else {
            delete state.selectedIds[key];
        }
    }

    function isFileSelected(id) {
        return !!state.selectedIds[String(id || "").trim()];
    }

    function syncAllCheckState(files) {
        if (!elements.allCheck) return;
        var visibleFiles = Array.isArray(files) ? files : [];
        var selectedCount = visibleFiles.filter(function (item) { return isFileSelected(item.id); }).length;
        elements.allCheck.indeterminate = selectedCount > 0 && selectedCount < visibleFiles.length;
        elements.allCheck.checked = visibleFiles.length > 0 && selectedCount === visibleFiles.length;
    }

    function syncSelectedFiles() {
        var existingIds = state.files.reduce(function (map, item) {
            map[String(item && item.id || "").trim()] = true;
            return map;
        }, {});
        Object.keys(state.selectedIds).forEach(function (id) {
            if (!existingIds[id]) delete state.selectedIds[id];
        });
    }

    function getSelectedFiles() {
        return state.files.filter(function (item) {
            return isFileSelected(item && item.id);
        });
    }

    function updateActionButtons() {
        var selectedFiles = getSelectedFiles();
        var hasSelection = selectedFiles.length > 0;
        var singleSelection = selectedFiles.length === 1;

        if (elements.downloadButton) elements.downloadButton.disabled = !hasSelection;
        if (elements.renameButton) elements.renameButton.disabled = !singleSelection;
        if (elements.deleteButton) elements.deleteButton.disabled = !hasSelection;
        if (elements.shareButton) elements.shareButton.disabled = !hasSelection;
        if (!hasSelection && elements.shareAction) {
            elements.shareAction.classList.remove("is-open");
        }
    }

    function downloadSelectedFiles() {
        var selectedFiles = getSelectedFiles();
        if (!selectedFiles.length) {
            alert("파일을 선택해 주세요.");
            return;
        }

        selectedFiles.forEach(function (item) {
            var link = document.createElement("a");
            link.href = buildDownloadUrl(item);
            link.download = item.name || "download";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    async function renameSelectedFile() {
        var selectedFiles = getSelectedFiles();
        if (!selectedFiles.length) {
            alert("이름을 바꿀 파일을 선택해 주세요.");
            return;
        }
        if (selectedFiles.length > 1) {
            alert("이름 바꾸기는 파일 1개만 선택할 수 있습니다.");
            return;
        }

        var target = selectedFiles[0];
        var nextName = prompt("새 파일 이름을 입력해 주세요.", String(target.name || ""));
        if (nextName === null) return;
        nextName = String(nextName || "").trim();
        if (!nextName) {
            alert("파일 이름을 입력해 주세요.");
            return;
        }
        if (nextName === String(target.name || "")) return;

        var duplicate = state.files.find(function (item) {
            return item.id !== target.id && getCloudNameKey(item.name) === getCloudNameKey(nextName);
        });
        if (duplicate) {
            alert("같은 이름의 파일이 이미 있습니다.");
            return;
        }

        try {
            var result = await requestCloud(CLOUD_API_BASE + "/save", {
                method: "POST",
                body: JSON.stringify({
                    requesterId: state.user.id,
                    items: [{
                        id: target.id,
                        title: target.title || "",
                        name: nextName,
                        size: target.size || 0,
                        type: target.type || "",
                        createdAt: target.createdAt || new Date().toISOString()
                    }]
                })
            });
            state.files = Array.isArray(result.items) ? result.items : [];
            syncSelectedFiles();
            state.quotaBytes = Number(result.quotaBytes || state.quotaBytes);
            state.usedBytes = Number(result.usedBytes || 0);
            saveFilesToLocalStorage(state.files);
            render();
        } catch (error) {
            alert(error.message || "파일 이름을 바꾸지 못했습니다.");
        }
    }

    async function deleteSelectedFiles() {
        var selectedFiles = getSelectedFiles();
        if (!selectedFiles.length) {
            alert("삭제할 파일을 선택해 주세요.");
            return;
        }
        if (!confirm("선택한 파일을 삭제할까요?")) return;

        try {
            for (var i = 0; i < selectedFiles.length; i++) {
                await requestCloud(CLOUD_API_BASE + "/delete", {
                    method: "POST",
                    body: JSON.stringify({
                        id: selectedFiles[i].id,
                        requesterId: state.user.id
                    })
                });
            }
            state.files = state.files.filter(function (item) {
                return !isFileSelected(item.id);
            });
            state.selectedIds = {};
            var latest = await requestCloud(CLOUD_API_BASE + "?userId=" + encodeURIComponent(state.user.id), { method: "GET" });
            state.files = Array.isArray(latest.items) ? latest.items : [];
            state.quotaBytes = Number(latest.quotaBytes || state.quotaBytes);
            state.usedBytes = Number(latest.usedBytes || 0);
            saveFilesToLocalStorage(state.files);
            render();
        } catch (error) {
            alert(error.message || "파일을 삭제하지 못했습니다.");
        }
    }

    async function handleShareAction(type) {
        var selectedFiles = getSelectedFiles();
        if (!selectedFiles.length) {
            alert("파일을 선택해 주세요.");
            return;
        }

        if (type === "link") {
            shareLinks(selectedFiles);
        } else if (type === "mail") {
            await shareByMail(selectedFiles);
        }

        if (elements.shareAction) {
            elements.shareAction.classList.remove("is-open");
        }
    }

    function shareLinks(files) {
        var links = files.map(function (item) {
            return buildAbsoluteDownloadUrl(item);
        }).join("\n");

        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            navigator.clipboard.writeText(links).then(function () {
                alert("공유 링크를 복사했습니다.");
            }).catch(function () {
                prompt("아래 링크를 복사해 주세요.", links);
            });
            return;
        }

        prompt("아래 링크를 복사해 주세요.", links);
    }

    async function shareByMail(files) {
        var composeUrl = new URL("../mail/compose.html", window.location.href);
        try {
            var attachmentPayload = await Promise.all(files.map(function (item) {
                return fetch(buildDownloadUrl(item)).then(function (response) {
                    if (!response.ok) throw new Error("첨부파일을 불러오지 못했습니다.");
                    return response.blob();
                }).then(function (blob) {
                    return blobToDataUrl(blob).then(function (dataUrl) {
                        return {
                            name: item.name || "attachment",
                            type: blob.type || item.type || "application/octet-stream",
                            dataUrl: dataUrl
                        };
                    });
                });
            }));
            sessionStorage.setItem(MAIL_SHARE_ATTACHMENTS_KEY, JSON.stringify(attachmentPayload));
        } catch (error) {
            alert(error.message || "메일 첨부파일을 준비하지 못했습니다.");
            return;
        }
        window.location.href = composeUrl.toString();
    }

    function buildAbsoluteDownloadUrl(item) {
        return new URL(buildDownloadUrl(item), window.location.origin).toString();
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function findCloudFileByName(name) {
        var targetKey = getCloudNameKey(name);
        if (!targetKey) return null;
        return state.files.find(function (item) {
            return getCloudNameKey(item && item.name) === targetKey;
        }) || null;
    }

    function buildCloudNameRegistry(items) {
        return (Array.isArray(items) ? items : []).reduce(function (registry, item) {
            var key = getCloudNameKey(item && item.name);
            if (key) registry[key] = true;
            return registry;
        }, {});
    }

    function buildNextCloudName(name, registry) {
        var sourceName = String(name || "").trim();
        if (!sourceName) return "(2)";

        var parsed = splitCloudFileName(sourceName);
        var index = 2;
        var candidate = parsed.base + "(" + index + ")" + parsed.extension;

        while (registry[getCloudNameKey(candidate)]) {
            index += 1;
            candidate = parsed.base + "(" + index + ")" + parsed.extension;
        }

        return candidate;
    }

    function splitCloudFileName(name) {
        var sourceName = String(name || "").trim();
        var dotIndex = sourceName.lastIndexOf(".");
        if (dotIndex <= 0) {
            return { base: sourceName, extension: "" };
        }
        return {
            base: sourceName.slice(0, dotIndex),
            extension: sourceName.slice(dotIndex)
        };
    }

    function getCloudNameKey(name) {
        return String(name || "").trim().toLowerCase();
    }

    function getCloudTitle(item) {
        return String(item && (item.title || item.name) || "").trim();
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

    function renderFileTypeIcon(name) {
        var kind = getFileTypeKind(name);
        var labelMap = { ppt: "P", xls: "X", hwp: "한", zip: "ZIP", pdf: "PDF", img: "IMG", file: "FILE" };
        return '<span class="cloudFileIcon cloudFileIcon--' + kind + '" aria-label="' + escapeHtml(getFileExtension(name).toUpperCase()) + '">' + escapeHtml(labelMap[kind] || "FILE") + '</span>';
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

    function getDownloadIcon() {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17zM5 19h14v2H5z"></path></svg>';
    }

    function formatFileSize(bytes) {
        var size = Number(bytes || 0);
        if (!size) return "0 B";
        if (size >= 1024 * 1024 * 1024) return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
        if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
        if (size >= 1024) return (size / 1024).toFixed(1) + " KB";
        return size + " B";
    }

    function formatDate(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
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
