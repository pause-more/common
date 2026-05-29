(function () {
    var NEWS_API_BASE = getGroupwareApiBase("/api/board/news");
    var API = window.GroupwareApi;
    var STORAGE_KEY = "gw-board-news";
    var LIST_CACHE_KEY = STORAGE_KEY + "-list";
    var DB_NAME = "gw-groupware-board";
    var DB_VERSION = 1;
    var STORE_NAME = "boardState";
    var page = document.querySelector(".boardPage--news");
    if (!page) return;

    var state = {
        user: getCurrentUser(),
        posts: [],
        selectedId: "",
        search: "",
        pendingAttachments: []
    };
    var elements = {};

    initialize();

    function initialize() {
        renderShell();
        cacheElements();
        bindEvents();
        state.posts = loadPostsFromLocalStorage();
        render();
        loadPosts().then(function (posts) {
            state.posts = posts;
            render();
        });
    }

    function renderShell() {
        page.innerHTML = [
            '<div class="newsBoard">',
            '<div class="newsBoardHead">',
            '<div class="newsBoardTitleWrap"><strong class="newsBoardTitle">공지사항</strong></div>',
            '<div class="newsBoardTools">',
            '<div class="newsBoardSearch"><div class="boardSearchField"><input type="search" class="boardSearchInput" placeholder="제목이나 내용을 검색하세요"></div></div>',
            '<select class="boardFormSelect newsSortSelect"><option value="latest">최신순</option><option value="oldest">오래된순</option></select>',
            '<button type="button" class="boardWriteBtn">작성하기</button>',
            '</div>',
            '</div>',
            '<div class="newsBoardList"></div>',
            '</div>',
            '<div class="newsDrawer">',
            '<div class="newsDrawerBackdrop"></div>',
            '<div class="newsDrawerInner">',
            '<div class="newsDrawerHead"><button type="button" class="newsDrawerClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></div>',
            '<div class="newsDrawerBody"></div>',
            '</div>',
            '</div>',
            '<div class="boardModal" style="display:none;">',
            '<div class="boardModalDim"></div>',
            '<div class="boardModalDialog">',
            '<div class="boardModalHead"><strong class="boardModalTitle">공지 작성</strong><button type="button" class="boardModalClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></div>',
            '<div class="boardModalBody">',
            '<input type="hidden" class="boardFormId">',
            '<div class="boardFormGrid">',
            '<div class="boardFormRow"><label class="boardFormLabel">제목</label><div><input type="text" class="boardFormInput boardFormTitle" placeholder="공지 제목을 입력하세요"><div class="boardFormInline fix"><label class="boardCheck"><input type="checkbox" class="boardFormPinned"><span>상단 고정</span></label></div></div></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">내용</label><div><textarea class="boardFormTextarea boardFormBody" placeholder="공지 내용을 입력하세요"></textarea></div></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">첨부파일</label><div><div class="boardFormInline boardFormFileRow"><label for="boardNewsFileInput" class="boardGhostBtn">파일 첨부</label><input type="file" id="boardNewsFileInput" class="boardFormFile" multiple hidden><div class="boardFileList boardFormAttachmentList"></div></div></div></div>',
            '</div>',
            '<div class="boardModalActions"><button type="button" class="boardCancelBtn">취소</button><button type="button" class="boardSubmitBtn">등록하기</button></div>',
            '</div>',
            '</div>',
            '</div>'
        ].join("");
    }

    function cacheElements() {
        elements.totalStat = page.querySelector('[data-stat="total"]');
        elements.pinnedStat = page.querySelector('[data-stat="pinned"]');
        elements.searchInput = page.querySelector(".boardSearchInput");
        elements.sortSelect = page.querySelector(".newsSortSelect");
        elements.writeButton = page.querySelector(".boardWriteBtn");
        elements.list = page.querySelector(".newsBoardList");
        elements.drawer = page.querySelector(".newsDrawer");
        elements.drawerBackdrop = page.querySelector(".newsDrawerBackdrop");
        elements.drawerInner = page.querySelector(".newsDrawerInner");
        elements.drawerBody = page.querySelector(".newsDrawerBody");
        elements.drawerClose = page.querySelector(".newsDrawerClose");
        elements.modal = page.querySelector(".boardModal");
        elements.modalDim = page.querySelector(".boardModalDim");
        elements.modalDialog = page.querySelector(".boardModalDialog");
        elements.modalTitle = page.querySelector(".boardModalTitle");
        elements.modalClose = page.querySelector(".boardModalClose");
        elements.formId = page.querySelector(".boardFormId");
        elements.formTitle = page.querySelector(".boardFormTitle");
        elements.formBody = page.querySelector(".boardFormBody");
        elements.formPinned = page.querySelector(".boardFormPinned");
        elements.formFile = page.querySelector(".boardFormFile");
        elements.formAttachmentList = page.querySelector(".boardFormAttachmentList");
        elements.cancelButton = page.querySelector(".boardCancelBtn");
        elements.submitButton = page.querySelector(".boardSubmitBtn");
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", function () {
                state.search = String(elements.searchInput.value || "").trim().toLowerCase();
                render();
            });
        }
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener("change", render);
        }
        if (elements.writeButton) {
            elements.writeButton.addEventListener("click", function () {
                if (!canWrite()) {
                    alert("공지사항은 관리자 또는 대표만 작성할 수 있습니다.");
                    return;
                }
                openModal();
            });
        }
        [elements.modalDim, elements.modalClose, elements.cancelButton].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeModal);
        });
        [elements.drawerClose, elements.drawerBackdrop].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeDrawer);
        });
        if (elements.formFile) {
            elements.formFile.addEventListener("change", function () {
                if (!elements.formFile.files || !elements.formFile.files.length) {
                    state.pendingAttachments = [];
                    renderAttachmentSummary();
                    return;
                }
                readAttachments(elements.formFile.files).then(function (files) {
                    state.pendingAttachments = files;
                    renderAttachmentSummary();
                }).catch(function () {
                    state.pendingAttachments = [];
                    renderAttachmentSummary();
                    alert("파일을 불러오지 못했습니다.");
                });
            });
        }
        if (elements.formAttachmentList) {
            elements.formAttachmentList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-remove-index]");
                if (!button) return;
                removePendingAttachment(Number(button.getAttribute("data-remove-index")));
            });
        }
        if (elements.submitButton) elements.submitButton.addEventListener("click", savePost);
    }

    function render() {
        var posts = getFilteredPosts();
        if (elements.writeButton) elements.writeButton.classList.toggle("is-hidden", !canWrite());
        renderList(posts);
        renderDrawer(posts);
    }

    function renderList(posts) {
        if (!elements.list) return;
        if (!posts.length) {
            elements.list.innerHTML = '<div class="boardEmpty">등록된 공지사항이 없습니다.</div>';
            return;
        }
        elements.list.innerHTML = posts.map(function (item) {
            return [
                '<button type="button" class="newsRow' + (item.pinned ? ' is-pinned' : '') + (item.id === state.selectedId ? ' is-active' : '') + '" data-id="' + escapeHtml(item.id) + '">',
                '<span class="newsRowContent">',
                '<span class="newsRowTitleLine">',
                item.pinned ? '<span class="newsRowNoticeBadge">공지</span>' : '',
                '<span class="newsRowTitle">' + escapeHtml(item.title) + '</span>',
                '</span>',
                (item.pinned ? '' : '<span class="newsRowDate">' + escapeHtml(formatDateTime(item.updatedAt || item.createdAt)) + '</span>'),
                '</span>',
                '</button>'
            ].join("");
        }).join("");
        Array.prototype.slice.call(elements.list.querySelectorAll(".newsRow")).forEach(function (button) {
            button.addEventListener("click", function () {
                selectPost(button.getAttribute("data-id"));
            });
        });
    }

    function renderDrawer(posts) {
        if (!elements.drawerBody || !elements.drawer) return;
        var active = state.selectedId ? posts.find(function (item) { return item.id === state.selectedId; }) : null;
        if (!active) {
            closeDrawer();
            return;
        }
        var editable = canEdit(active);
        elements.drawerBody.innerHTML = [
            '<div class="newsDrawerTitle">' + escapeHtml(active.title) + '</div>',
            //'<div class="newsDrawerAuthor">' + escapeHtml(active.authorName) + '</div>',
            '<div class="newsDrawerMeta">' + escapeHtml(formatDateTime(active.updatedAt || active.createdAt)) + '</div>',
            '<div class="newsDrawerContent">' + escapeHtml(active.body).replace(/\n/g, "<br>") + '</div>',
            renderAttachmentBlock(active.attachments),
            editable ? '<div class="boardDetailActions"><button type="button" class="boardGhostBtn" data-action="edit">수정</button><button type="button" class="boardDangerBtn" data-action="delete">삭제</button></div>' : ''
        ].join("");
        elements.drawer.classList.add("is-open");
        Array.prototype.slice.call(elements.drawerBody.querySelectorAll("[data-action]")).forEach(function (button) {
            button.addEventListener("click", function () {
                if (button.getAttribute("data-action") === "edit") {
                    closeDrawer();
                    openModal(active);
                }
                if (button.getAttribute("data-action") === "delete") deletePost(active.id);
            });
        });
    }

    function openModal(post) {
        if (!elements.modal) return;
        var editing = !!(post && post.id);
        if (elements.modalTitle) elements.modalTitle.textContent = editing ? "공지 수정" : "공지 작성";
        if (elements.submitButton) elements.submitButton.textContent = editing ? "수정하기" : "등록하기";
        if (elements.formId) elements.formId.value = editing ? post.id : "";
        if (elements.formTitle) elements.formTitle.value = editing ? post.title || "" : "";
        if (elements.formBody) elements.formBody.value = editing ? post.body || "" : "";
        if (elements.formPinned) elements.formPinned.checked = editing ? post.pinned === true : false;
        state.pendingAttachments = editing ? [].concat(post.attachments || []) : [];
        if (elements.formFile) elements.formFile.value = "";
        renderAttachmentSummary();
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

    function closeDrawer() {
        if (!elements.drawer) return;
        state.selectedId = "";
        elements.drawer.classList.remove("is-open");
        renderList(getFilteredPosts());
    }

    async function savePost() {
        if (!canWrite()) {
            alert("공지사항은 관리자 또는 대표만 작성할 수 있습니다.");
            return;
        }
        var id = String(elements.formId && elements.formId.value || "").trim();
        var title = String(elements.formTitle && elements.formTitle.value || "").trim();
        var body = String(elements.formBody && elements.formBody.value || "").trim();
        var attachments = state.pendingAttachments.slice();
        if (!title) {
            alert("제목을 입력해 주세요.");
            return;
        }
        if (!body) {
            alert("내용을 입력해 주세요.");
            return;
        }
        var existing = id ? state.posts.find(function (item) { return item.id === id; }) : null;
        var now = new Date().toISOString();
        var post = {
            id: id || ("news_" + Date.now()),
            title: title,
            body: body,
            pinned: !!(elements.formPinned && elements.formPinned.checked),
            attachments: attachments,
            authorId: existing && existing.authorId || state.user.id,
            authorName: existing && existing.authorName || state.user.name,
            authorDepartment: existing && existing.authorDepartment || state.user.department,
            createdAt: existing && existing.createdAt || now,
            updatedAt: now,
            views: existing && existing.views || 0
        };
        try {
            var result = await requestNews(NEWS_API_BASE + "/save", {
                method: "POST",
                body: JSON.stringify({
                    requesterId: state.user.id,
                    post: post
                })
            });
            state.posts = Array.isArray(result.items) ? result.items : state.posts;
            savePostsToLocalStorage(state.posts);
            state.selectedId = "";
            closeModal();
            render();
        } catch (error) {
            alert(error.message || "공지사항을 저장하지 못했습니다.");
        }
    }

    async function deletePost(id) {
        var post = state.posts.find(function (item) { return item.id === id; });
        if (!post || !canEdit(post)) return;
        if (!confirm("공지사항을 삭제할까요?")) return;
        try {
            var result = await requestNews(NEWS_API_BASE + "/delete", {
                method: "POST",
                body: JSON.stringify({
                    id: id,
                    requesterId: state.user.id
                })
            });
            state.posts = Array.isArray(result.items) ? result.items : [];
            savePostsToLocalStorage(state.posts);
            state.selectedId = "";
            closeDrawer();
            render();
        } catch (error) {
            alert(error.message || "공지사항을 삭제하지 못했습니다.");
        }
    }

    function selectPost(id) {
        var post = state.posts.find(function (item) { return item.id === id; });
        if (!post) return;
        state.selectedId = id;
        post.views = Number(post.views || 0) + 1;
        post.updatedAt = post.updatedAt || post.createdAt;
        render();
    }

    function upsertPost(post) {
        var index = state.posts.findIndex(function (item) { return item.id === post.id; });
        if (index > -1) state.posts[index] = post;
        else state.posts.push(post);
        savePosts();
    }

    function getFilteredPosts() {
        var search = state.search;
        return state.posts.filter(function (item) {
            if (!search) return true;
            var haystack = (item.title + " " + item.body + " " + item.authorName).toLowerCase();
            return haystack.indexOf(search) > -1;
        }).sort(function (a, b) {
            var direction = elements.sortSelect && elements.sortSelect.value === "oldest" ? 1 : -1;
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            return String(a.updatedAt || a.createdAt).localeCompare(String(b.updatedAt || b.createdAt)) * -direction;
        });
    }

    function getSelectedPost(posts) {
        var list = Array.isArray(posts) ? posts : getFilteredPosts();
        var selected = list.find(function (item) { return item.id === state.selectedId; });
        if (selected) return selected;
        state.selectedId = "";
        return null;
    }

    function loadPosts() {
        return requestNews(NEWS_API_BASE, { method: "GET" }).then(function (data) {
            var posts = Array.isArray(data.items) ? data.items.filter(isNotSeedPost) : [];
            savePostsToLocalStorage(posts);
            return posts;
        }).catch(function () {
            return loadPostsFromLocalStorage();
        });
    }

    function loadPostsFromLocalStorage() {
        try {
            var saved = localStorage.getItem(LIST_CACHE_KEY) || localStorage.getItem(STORAGE_KEY);
            if (!saved) return [];
            var parsed = JSON.parse(saved);
            return Array.isArray(parsed) && parsed.length ? parsed.filter(isNotSeedPost) : [];
        } catch (error) {
            return [];
        }
    }

    function savePostsToLocalStorage(posts) {
        try {
            localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(compactPostList(posts)));
        } catch (error) {}
    }

    function compactPostList(posts) {
        return (Array.isArray(posts) ? posts : []).filter(isNotSeedPost).map(function (item) {
            return {
                id: item.id,
                title: item.title,
                body: item.body,
                pinned: item.pinned,
                authorId: item.authorId,
                authorName: item.authorName,
                authorDepartment: item.authorDepartment,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                views: item.views,
                attachments: []
            };
        });
    }

    function isNotSeedPost(item) {
        return String(item && item.id || "") !== "news_seed_1";
    }

    function requestNews(url, options) {
        options = options || {};
        return API.request(url, Object.assign({}, options, {
            errorMessage: "공지사항 요청을 처리하지 못했습니다."
        }));
    }

    function canWrite() {
        return window.AuthStore && typeof window.AuthStore.canManageContent === "function"
            ? window.AuthStore.canManageContent()
            : state.user.role === "admin" || state.user.role === "ceo";
    }

    function canEdit(post) {
        return canWrite() || String(post.authorId || "") === state.user.id;
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

    function formatDate(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "-";
        return date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
    }

    function formatDateTime(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "-";
        var hour = date.getHours();
        var minute = pad(date.getMinutes());
        var meridiem = hour >= 12 ? "오후" : "오전";
        var displayHour = hour % 12 || 12;
        return (date.getMonth() + 1) + "월 " + date.getDate() + "일(" + ["일", "월", "화", "수", "목", "금", "토"][date.getDay()] + ") " + meridiem + " " + displayHour + ":" + minute;
    }

    function renderAttachmentSummary() {
        if (elements.formAttachmentList) {
            elements.formAttachmentList.innerHTML = state.pendingAttachments.map(function (item, index) {
                return [
                    '<span class="boardFileItem">',
                    '<span>' + escapeHtml(getAttachmentName(item)) + '</span>',
                    '<button type="button" class="boardFileRemove" data-remove-index="' + index + '" aria-label="첨부파일 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>',
                    '</span>'
                ].join("");
            }).join("");
        }
    }

    function removePendingAttachment(index) {
        if (isNaN(index) || index < 0 || index >= state.pendingAttachments.length) return;
        state.pendingAttachments.splice(index, 1);
        if (!state.pendingAttachments.length && elements.formFile) {
            elements.formFile.value = "";
        }
        renderAttachmentSummary();
    }

    function renderAttachmentBlock(attachments) {
        var items = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
        if (!items.length) return "";
        return [
            '<div class="boardFileBox">',
            '<strong class="boardFileTitle">첨부 파일</strong>',
            '<div class="boardFileList">',
            items.map(function (item) {
                if (item && typeof item === "object" && item.dataUrl) {
                    return '<a class="boardFileItem boardLinkItem" href="' + escapeHtml(item.dataUrl) + '" download="' + escapeHtml(item.name || "첨부파일") + '">' + escapeHtml(item.name || "첨부파일") + '</a>';
                }
                return '<span class="boardFileItem">' + escapeHtml(getAttachmentName(item)) + '</span>';
            }).join(""),
            '</div>',
            '</div>'
        ].join("");
    }

    function readAttachments(fileList) {
        return Promise.all(Array.prototype.slice.call(fileList || []).map(function (file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () {
                    resolve({
                        name: file.name,
                        type: file.type || "",
                        size: file.size || 0,
                        dataUrl: String(reader.result || "")
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }));
    }

    function getAttachmentName(item) {
        if (item && typeof item === "object") return String(item.name || "");
        return String(item || "");
    }

    function openDatabase() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB not supported"));
                return;
            }
            var request = window.indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = function () {
                reject(request.error || new Error("DB open failed"));
            };
            request.onupgradeneeded = function () {
                var db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: "key" });
                }
            };
            request.onsuccess = function () {
                resolve(request.result);
            };
        });
    }

    function readBoardState() {
        return openDatabase().then(function (db) {
            return new Promise(function (resolve, reject) {
                var transaction = db.transaction(STORE_NAME, "readonly");
                var store = transaction.objectStore(STORE_NAME);
                var request = store.get(STORAGE_KEY);
                request.onerror = function () {
                    db.close();
                    reject(request.error || new Error("DB read failed"));
                };
                request.onsuccess = function () {
                    db.close();
                    resolve(request.result && Array.isArray(request.result.posts) ? request.result.posts : null);
                };
            });
        });
    }

    function writeBoardState(posts) {
        return openDatabase().then(function (db) {
            return new Promise(function (resolve, reject) {
                var transaction = db.transaction(STORE_NAME, "readwrite");
                var store = transaction.objectStore(STORE_NAME);
                var request = store.put({ key: STORAGE_KEY, posts: posts });
                request.onerror = function () {
                    db.close();
                    reject(request.error || new Error("DB write failed"));
                };
                transaction.oncomplete = function () {
                    db.close();
                    resolve();
                };
                transaction.onerror = function () {
                    db.close();
                    reject(transaction.error || new Error("DB transaction failed"));
                };
            });
        });
    }

    function trimPreview(value) {
        var text = String(value || "").replace(/\s+/g, " ").trim();
        return text.length > 42 ? text.slice(0, 42) + "..." : text;
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
