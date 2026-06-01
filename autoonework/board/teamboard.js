(function () {
    var STORAGE_KEY = "gw-board-teamboard";
    var TEAMBOARD_API_BASE = getGroupwareApiBase("/api/board/teamboard");
    var API = window.GroupwareApi;
    var TEAMBOARD_REACTIONS = [
        { key: "comm_1", image: "https://ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/comm_1.png", legacyKeys: ["😍"] },
        { key: "comm_2", image: "https://ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/comm_2.png", legacyKeys: ["🥲"] },
        { key: "comm_3", image: "https://ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/comm_3.png", legacyKeys: [] },
        { key: "comm_4", image: "https://ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/comm_4.png", legacyKeys: [] },
        { key: "comm_5", image: "https://ecimg.cafe24img.com/pg2594b64908626038/autonecar/data/icon/comm_5.png", legacyKeys: [] }
    ];
    var page = document.querySelector(".boardPage--teamboard");
    if (!page) return;

    var state = {
        user: getCurrentUser(),
        posts: [],
        selectedId: "",
        search: "",
        sort: "updated",
        employees: [],
        composerMentions: [],
        composerPinned: false,
        composerAttachments: []
    };
    var elements = {};

    initialize();

    function initialize() {
        renderShell();
        cacheElements();
        state.posts = loadPosts();
        bindEvents();
        renderComposerNoticeButton();
        renderComposerAttachments();
        render();
        loadRemotePosts();
        loadEmployees().then(function (employees) {
            state.employees = employees;
            renderMentionList(elements.composerMentionList);
            renderMentionList(elements.mentionList);
        });
    }

    function renderShell() {
        page.innerHTML = [
            '<div class="teamboardBoard">',
            '<div class="teamboardBoardHead">',
            '<div class="teamboardBoardTools">',
            '<div class="teamboardBoardSearch"><div class="boardSearchField"><input type="search" class="boardSearchInput teamboardSearchInput" placeholder="제목이나 내용을 검색하세요"></div></div>',
            '<select class="boardFormSelect teamboardSortSelect">',
            '<option value="updated">업데이트순</option>',
            '<option value="latest">최신순</option>',
            '<option value="oldest">오래된순</option>',
            '</select>',
            '</div>',
            '</div>',
            '<div class="teamboardNoticeList"></div>',
            '<div class="teamboardComposer">',
            '<div class="teamboardComposerField">',
            '<input type="text" class="teamboardComposerTitle" placeholder="글 제목을 입력하세요">',
            '<div class="teamboardComposerEditor">',
            '<textarea class="teamboardComposerTextarea" placeholder="멤버들과 공유할 내용을 입력해보세요"></textarea>',
            '<div class="teamboardMentionList teamboardComposerMentionList" style="display:none;"></div>',
            '</div>',
            '<div class="teamboardComposerFileList"></div>',
            '<div class="teamboardComposerFooter">',
            '<div class="teamboardComposerTools">',
            '<label for="teamboardComposerFile" class="teamboardComposerToolBtn teamboardComposerFileBtn">파일첨부</label>',
            '<input type="file" id="teamboardComposerFile" class="teamboardComposerFile" multiple hidden>',
            '<button type="button" class="teamboardComposerToolBtn teamboardComposerNoticeBtn">공지</button>',
            '</div>',
            '<button type="button" class="teamboardComposerSubmit">작성</button>',
            '</div>',
            '</div>',
            '</div>',
            '<div class="teamboardFeed"></div>',
            '</div>',
            '<div class="teamboardDetail" style="display:none;">',
            '<div class="boardModalDim"></div>',
            '<div class="teamboardDetailDialog">',
            '<div class="teamboardDetailHead"><button type="button" class="teamboardDetailClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></div>',
            '<div class="teamboardDetailBody"></div>',
            '</div>',
            '</div>',
            '<div class="boardModal" style="display:none;">',
            '<div class="boardModalDim"></div>',
            '<div class="boardModalDialog">',
            '<div class="boardModalHead"><strong class="boardModalTitle">작성하기</strong><button type="button" class="boardModalClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></div>',
            '<div class="boardModalBody">',
            '<input type="hidden" class="boardFormId">',
            '<div class="boardFormGrid">',
            '<div class="boardFormRow"><label class="boardFormLabel">제목</label><input type="text" class="boardFormInput boardFormTitle" placeholder="글 제목을 입력하세요"></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">공지</label><label class="boardCheck"><input type="checkbox" class="boardFormPinned"><span>상단 공지로 표시</span></label></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">부서</label><input type="text" class="boardFormInput boardFormDepartment" readonly></div>',
            '<div class="boardFormRow"><label class="boardFormLabel">내용</label><div class="teamboardEditorField"><div class="teamboardMentionWrap"><button type="button" class="teamboardMentionTrigger" aria-label="멘션 추가">@</button><div class="teamboardMentionList" style="display:none;"></div></div><textarea class="boardFormTextarea boardFormBody" placeholder="팀원들과 공유할 내용을 입력하세요"></textarea></div></div>',
            '</div>',
            '<div class="boardModalActions"><button type="button" class="boardCancelBtn">취소</button><button type="button" class="boardSubmitBtn">등록하기</button></div>',
            '</div>',
            '</div>',
            '</div>'
        ].join("");
    }

    function cacheElements() {
        elements.searchInput = page.querySelector(".teamboardSearchInput");
        elements.noticeList = page.querySelector(".teamboardNoticeList");
        elements.sortSelect = page.querySelector(".teamboardSortSelect");
        elements.composerTitle = page.querySelector(".teamboardComposerTitle");
        elements.composerTextarea = page.querySelector(".teamboardComposerTextarea");
        elements.composerMentionList = page.querySelector(".teamboardComposerMentionList");
        elements.composerFile = page.querySelector(".teamboardComposerFile");
        elements.composerFileList = page.querySelector(".teamboardComposerFileList");
        elements.composerNoticeButton = page.querySelector(".teamboardComposerNoticeBtn");
        elements.composerSubmit = page.querySelector(".teamboardComposerSubmit");
        elements.feed = page.querySelector(".teamboardFeed");
        elements.detail = page.querySelector(".teamboardDetail");
        elements.detailDim = page.querySelector(".teamboardDetail .boardModalDim");
        elements.detailClose = page.querySelector(".teamboardDetailClose");
        elements.detailBody = page.querySelector(".teamboardDetailBody");
        elements.modal = page.querySelector(".boardModal");
        elements.modalDim = page.querySelector(".boardModal .boardModalDim");
        elements.modalTitle = page.querySelector(".boardModalTitle");
        elements.modalClose = page.querySelector(".boardModalClose");
        elements.formId = page.querySelector(".boardFormId");
        elements.formTitle = page.querySelector(".boardFormTitle");
        elements.formPinned = page.querySelector(".boardFormPinned");
        elements.formDepartment = page.querySelector(".boardFormDepartment");
        elements.formBody = page.querySelector(".boardFormBody");
        elements.mentionTrigger = page.querySelector(".teamboardMentionTrigger");
        elements.mentionList = page.querySelector(".teamboardMentionList");
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
            elements.sortSelect.addEventListener("change", function () {
                state.sort = String(elements.sortSelect.value || "updated");
                render();
            });
        }
        if (elements.composerSubmit) {
            elements.composerSubmit.addEventListener("click", saveComposerPost);
        }
        if (elements.composerFile) {
            elements.composerFile.addEventListener("change", function () {
                if (!elements.composerFile.files || !elements.composerFile.files.length) {
                    state.composerAttachments = [];
                    renderComposerAttachments();
                    return;
                }
                readTeamboardAttachments(elements.composerFile.files).then(function (files) {
                    state.composerAttachments = files;
                    renderComposerAttachments();
                }).catch(function () {
                    state.composerAttachments = [];
                    renderComposerAttachments();
                    alert("파일을 불러오지 못했습니다.");
                });
            });
        }
        if (elements.composerFileList) {
            elements.composerFileList.addEventListener("click", function (event) {
                var removeButton = event.target.closest("[data-remove-composer-file]");
                if (!removeButton) return;
                removeComposerAttachment(Number(removeButton.getAttribute("data-remove-composer-file")));
            });
        }
        if (elements.composerNoticeButton) {
            elements.composerNoticeButton.addEventListener("click", function () {
                state.composerPinned = !state.composerPinned;
                renderComposerNoticeButton();
            });
        }
        if (elements.composerTextarea) {
            elements.composerTextarea.addEventListener("input", function () {
                syncMentionSuggestions(elements.composerTextarea, elements.composerMentionList);
            });
            elements.composerTextarea.addEventListener("click", function () {
                syncMentionSuggestions(elements.composerTextarea, elements.composerMentionList);
            });
        }
        [elements.modalDim, elements.modalClose, elements.cancelButton].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeModal);
        });
        [elements.detailDim, elements.detailClose].forEach(function (node) {
            if (!node) return;
            node.addEventListener("click", closeDetail);
        });
        if (elements.submitButton) {
            elements.submitButton.addEventListener("click", savePost);
        }
        if (elements.mentionTrigger) {
            elements.mentionTrigger.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleMentionList();
            });
        }
        if (elements.mentionList) {
            elements.mentionList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-mention-value]");
                if (!button) return;
                insertMention(elements.formBody, elements.mentionList, button.getAttribute("data-mention-value"));
            });
        }
        if (elements.composerMentionList) {
            elements.composerMentionList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-mention-value]");
                if (!button) return;
                insertMention(elements.composerTextarea, elements.composerMentionList, button.getAttribute("data-mention-value"));
            });
        }
        document.addEventListener("click", function (event) {
            if (elements.modal && elements.modal.style.display === "block") {
                if (elements.mentionList && elements.mentionList.contains(event.target)) return;
                if (elements.mentionTrigger && elements.mentionTrigger.contains(event.target)) return;
                closeMentionList(elements.mentionList);
            }
            if (elements.composerMentionList && elements.composerMentionList.contains(event.target)) return;
            if (elements.composerTextarea && elements.composerTextarea.contains && elements.composerTextarea.contains(event.target)) return;
            if (elements.detailBody && elements.detail && elements.detail.style.display === "block") {
                var commentMentionList = elements.detailBody.querySelector(".teamboardCommentMentionList");
                var commentTextarea = elements.detailBody.querySelector(".teamboardCommentTextarea");
                if (commentMentionList && commentMentionList.contains(event.target)) return;
                if (commentTextarea && commentTextarea.contains && commentTextarea.contains(event.target)) return;
                closeMentionList(commentMentionList);
            }
            closeMentionList(elements.composerMentionList);
        });
    }

    function render() {
        renderNotices();
        renderFeed();
    }

    function renderNotices() {
        if (!elements.noticeList) return;
        var notices = state.posts.filter(function (item) {
            return item.pinned && canRead(item);
        }).filter(function (item) {
            return matchesSearch(item);
        }).sort(function (a, b) {
            return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
        }).slice(0, 3);

        if (!notices.length) {
            elements.noticeList.innerHTML = "";
            return;
        }

        elements.noticeList.innerHTML = notices.map(function (item) {
            return [
                '<button type="button" class="teamboardNoticeCard" data-id="' + escapeHtml(item.id) + '">',
                '<span class="teamboardNoticeBadge">공지</span>',
                '<span class="teamboardNoticeTitle">' + escapeHtml(item.title) + '</span>',
                '</button>'
            ].join("");
        }).join("");

        Array.prototype.slice.call(elements.noticeList.querySelectorAll(".teamboardNoticeCard")).forEach(function (button) {
            button.addEventListener("click", function () {
                openDetail(button.getAttribute("data-id"));
            });
        });
    }

    function renderFeed() {
        if (!elements.feed) return;
        var posts = getFilteredPosts();
        if (!posts.length) {
            elements.feed.innerHTML = '<div class="boardEmpty">표시할 팀 글이 없습니다.</div>';
            return;
        }

        elements.feed.innerHTML = posts.map(function (item) {
            var editable = canEdit(item);
            return [
                '<article class="teamboardPostCard">',
                '<button type="button" class="teamboardPostMain" data-id="' + escapeHtml(item.id) + '">',
                '<div class="teamboardPostMeta">',
                '<span class="teamboardAvatar" style="' + escapeHtml(getAvatarStyle(item.authorId || item.authorName)) + '">' + escapeHtml(getAvatarText(item.authorName)) + '</span>',
                '<span class="teamboardPostAuthor">' + escapeHtml(item.authorName) + '</span>',
                '<span class="teamboardPostDot">·</span>',
                '<span class="teamboardPostTime">' + escapeHtml(formatRelativeTime(item.updatedAt || item.createdAt)) + '</span>',
                '</div>',
                '<div class="teamboardPostTitle">' + escapeHtml(item.title) + '</div>',
                '<div class="teamboardPostBody">' + escapeHtml(String(item.body || "").replace(/\s+/g, " ").trim()) + '</div>',
                '</button>',
                '<div class="teamboardPostActions teamboardPostActions--feed">',
                '<div class="teamboardReactionGroup">' + renderReactionButtons(item) + '</div>',
                '<div class="teamboardPostActionButtons">' +
                (editable ? '<button type="button" class="teamboardTextBtn" data-action="edit" data-id="' + escapeHtml(item.id) + '">수정</button>' : '') +
                (editable ? '<button type="button" class="teamboardTextBtn danger" data-action="delete" data-id="' + escapeHtml(item.id) + '">삭제</button>' : '') +
                '</div>',
                '</div>',
                '</article>'
            ].join("");
        }).join("");

        Array.prototype.slice.call(elements.feed.querySelectorAll(".teamboardPostMain")).forEach(function (button) {
            button.addEventListener("click", function () {
                openDetail(button.getAttribute("data-id"));
            });
        });

        Array.prototype.slice.call(elements.feed.querySelectorAll("[data-action]")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                var id = button.getAttribute("data-id");
                if (button.getAttribute("data-action") === "edit") {
                    openModal(getPostById(id));
                    return;
                }
                if (button.getAttribute("data-action") === "delete") {
                    deletePost(id);
                }
            });
        });
        bindReactionButtons(elements.feed);
    }

    function openDetail(id) {
        var post = getPostById(id);
        if (!post || !canRead(post)) return;
        state.selectedId = post.id;
        post.views = Number(post.views || 0) + 1;
        savePosts();
        if (!elements.detailBody || !elements.detail) return;
        elements.detailBody.innerHTML = [
            '<div class="teamboardDetailMeta">',
            '<span class="teamboardAvatar large" style="' + escapeHtml(getAvatarStyle(post.authorId || post.authorName)) + '">' + escapeHtml(getAvatarText(post.authorName)) + '</span>',
            '<div>',
            '<div class="teamboardDetailAuthor">' + escapeHtml(post.authorName) + '</div>',
            '<div class="teamboardDetailTime">' + escapeHtml(formatRelativeTime(post.updatedAt || post.createdAt)) + '</div>',
            '</div>',
            '</div>',
            '<div class="teamboardDetailTitle">' + escapeHtml(post.title) + '</div>',
            '<div class="teamboardDetailText">' + escapeHtml(post.body).replace(/\n/g, "<br>") + '</div>',
            renderTeamboardAttachmentBlock(post.attachments),
            '<div class="teamboardPostActions"><div class="teamboardReactionGroup">' + renderReactionButtons(post) + renderCommentSummary(post) + '</div><div class="teamboardPostActionButtons">' + (canEdit(post) ? '<button type="button" class="teamboardTextBtn" data-action="edit" data-id="' + escapeHtml(post.id) + '">수정</button><button type="button" class="teamboardTextBtn danger" data-action="delete" data-id="' + escapeHtml(post.id) + '">삭제</button>' : '') + '</div></div>',
            renderTeamboardComments(post)
        ].join("");
        elements.detail.classList.remove("is-closing");
        elements.detail.style.display = "block";
        requestAnimationFrame(function () {
            if (elements.detail) elements.detail.classList.add("is-open");
        });

        Array.prototype.slice.call(elements.detailBody.querySelectorAll("[data-action]")).forEach(function (button) {
            button.addEventListener("click", function () {
                if (button.getAttribute("data-action") === "edit") {
                    closeDetail();
                    openModal(post);
                    return;
                }
                if (button.getAttribute("data-action") === "delete") {
                    deletePost(post.id);
                }
            });
        });
        Array.prototype.slice.call(elements.detailBody.querySelectorAll("[data-comment-delete]")).forEach(function (button) {
            button.addEventListener("click", function () {
                deleteComment(post.id, button.getAttribute("data-comment-delete"));
            });
        });
        var commentMentionList = elements.detailBody.querySelector(".teamboardCommentMentionList");
        var commentTextarea = elements.detailBody.querySelector(".teamboardCommentTextarea");
        if (commentMentionList) {
            renderMentionList(commentMentionList);
            commentMentionList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-mention-value]");
                if (!button || !commentTextarea) return;
                insertMention(commentTextarea, commentMentionList, button.getAttribute("data-mention-value"));
            });
        }
        if (commentTextarea && commentMentionList) {
            ["input", "click", "keyup"].forEach(function (eventName) {
                commentTextarea.addEventListener(eventName, function () {
                    syncMentionSuggestions(commentTextarea, commentMentionList);
                });
            });
        }
        var commentSubmit = elements.detailBody.querySelector(".teamboardCommentSubmit");
        if (commentSubmit) {
            commentSubmit.addEventListener("click", function () {
                saveComment(post.id);
            });
        }
        bindReactionButtons(elements.detailBody);
    }

    function closeDetail() {
        if (!elements.detail) return;
        elements.detail.classList.remove("is-open");
        elements.detail.classList.add("is-closing");
        setTimeout(function () {
            if (!elements.detail) return;
            elements.detail.style.display = "none";
            elements.detail.classList.remove("is-closing");
        }, 320);
    }

    function openModal(post) {
        if (!elements.modal) return;
        var editing = !!(post && post.id);
        elements.modalTitle.textContent = editing ? "팀 글 수정" : "팀 글 작성";
        elements.submitButton.textContent = editing ? "수정하기" : "등록하기";
        elements.formId.value = editing ? post.id : "";
        elements.formTitle.value = editing ? post.title || "" : "";
        elements.formPinned.checked = editing ? post.pinned === true : false;
        elements.formDepartment.value = editing ? (post.department || getWritableDepartment()) : getWritableDepartment();
        elements.formBody.value = editing ? post.body || "" : "";
        renderMentionList(elements.mentionList);
        closeMentionList(elements.mentionList);
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

    async function savePost() {
        if (!canWrite()) {
            alert("팀 보드는 소속 부서가 있는 직원만 작성할 수 있습니다.");
            return;
        }
        var id = String(elements.formId.value || "").trim();
        var title = String(elements.formTitle.value || "").trim();
        var body = String(elements.formBody.value || "").trim();
        var department = String(elements.formDepartment.value || "").trim();
        if (!title) return alert("제목을 입력해 주세요.");
        if (!body) return alert("내용을 입력해 주세요.");

        var existing = id ? getPostById(id) : null;
        var now = new Date().toISOString();
        var post = {
            id: id || ("teamboard_" + Date.now()),
            title: title,
            body: body,
            type: "all",
            pinned: elements.formPinned.checked === true,
            attachments: existing && Array.isArray(existing.attachments) ? existing.attachments.slice() : [],
            comments: existing && Array.isArray(existing.comments) ? normalizeTeamboardComments(existing.comments) : [],
            department: existing && existing.department || department,
            authorId: existing && existing.authorId || state.user.id,
            authorName: existing && existing.authorName || state.user.name,
            authorDepartment: existing && existing.authorDepartment || state.user.department,
            createdAt: existing && existing.createdAt || now,
            updatedAt: now,
            views: existing && existing.views || 0,
            reactions: existing ? normalizeReactions(existing.reactions) : normalizeReactions()
        };
        try {
            var saved = await saveRemotePost(post);
            upsertPost(saved || post, { skipLocalSave: !!saved });
            closeModal();
            render();
            refreshNotifications();
        } catch (error) {
            alert(error.message || "팀 글을 저장하지 못했습니다.");
        }
    }

    async function saveComposerPost() {
        if (!canWrite()) {
            alert("팀 보드는 소속 부서가 있는 직원만 작성할 수 있습니다.");
            return;
        }
        var title = String(elements.composerTitle && elements.composerTitle.value || "").trim();
        var body = String(elements.composerTextarea && elements.composerTextarea.value || "").trim();
        if (!title) return alert("제목을 입력해 주세요.");
        if (!body) return alert("내용을 입력해 주세요.");

        var now = new Date().toISOString();
        var post = {
            id: "teamboard_" + Date.now(),
            title: title,
            body: body,
            type: "all",
            pinned: state.composerPinned === true,
            department: getWritableDepartment(),
            authorId: state.user.id,
            authorName: state.user.name,
            authorDepartment: state.user.department,
            createdAt: now,
            updatedAt: now,
            views: 0,
            attachments: state.composerAttachments.slice(),
            reactions: normalizeReactions()
        };
        try {
            var saved = await saveRemotePost(post);
            upsertPost(saved || post, { skipLocalSave: !!saved });
        } catch (error) {
            alert(error.message || "팀 글을 저장하지 못했습니다.");
            return;
        }
        if (elements.composerTitle) elements.composerTitle.value = "";
        if (elements.composerTextarea) elements.composerTextarea.value = "";
        if (elements.composerFile) elements.composerFile.value = "";
        state.composerPinned = false;
        state.composerAttachments = [];
        renderComposerNoticeButton();
        renderComposerAttachments();
        closeMentionList(elements.composerMentionList);
        render();
        refreshNotifications();
    }

    async function deletePost(id) {
        var post = getPostById(id);
        if (!post || !canEdit(post)) return;
        if (!confirm("글을 삭제할까요?")) return;
        try {
            var items = await deleteRemotePost(id);
            state.posts = Array.isArray(items) ? items.map(normalizePost) : state.posts.filter(function (item) { return item.id !== id; });
            savePosts();
            closeDetail();
            render();
        } catch (error) {
            alert(error.message || "팀 글을 삭제하지 못했습니다.");
        }
    }

    function upsertPost(post, options) {
        options = options || {};
        post = normalizePost(post);
        var index = state.posts.findIndex(function (item) { return item.id === post.id; });
        if (index > -1) state.posts[index] = post;
        else state.posts.unshift(post);
        if (!options.skipLocalSave) savePosts();
    }

    function getFilteredPosts() {
        return state.posts.filter(function (item) {
            if (!canRead(item)) return false;
            if (item.pinned) return false;
            if (!matchesSearch(item)) return false;
            return true;
        }).sort(function (a, b) {
            if (state.sort === "oldest") {
                return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
            }
            if (state.sort === "latest") {
                return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
            }
            return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
        });
    }

    function matchesSearch(item) {
        var keyword = String(state.search || "").trim().toLowerCase();
        if (!keyword) return true;
        var haystack = [
            item && item.title || "",
            item && item.body || "",
            item && item.authorName || "",
            item && item.authorDepartment || ""
        ].join(" ").toLowerCase();
        return haystack.indexOf(keyword) > -1;
    }

    function getPostById(id) {
        return state.posts.find(function (item) { return item.id === id; }) || null;
    }

    function loadPosts() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return [];
            var parsed = JSON.parse(saved);
            return Array.isArray(parsed) && parsed.length ? parsed.map(normalizePost).filter(isNotSeedPost) : [];
        } catch (error) {
            return [];
        }
    }

    function savePosts() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(compactTeamboardPostsForCache(state.posts)));
        } catch (error) {
            try { localStorage.removeItem(STORAGE_KEY); } catch (removeError) {}
        }
    }

    function compactTeamboardPostsForCache(posts) {
        return (Array.isArray(posts) ? posts : []).map(function (post) {
            post = normalizePost(post);
            return Object.assign({}, post, {
                attachments: normalizeTeamboardAttachments(post.attachments).map(compactTeamboardAttachmentForCache)
            });
        });
    }

    function compactTeamboardAttachmentForCache(item) {
        if (!item || typeof item !== "object") {
            return { name: String(item || "").trim(), type: "", size: 0 };
        }
        return {
            name: String(item.name || "").trim(),
            type: String(item.type || "").trim(),
            size: Number(item.size || 0)
        };
    }

    async function loadRemotePosts() {
        if (!state.user || !state.user.id || state.user.id === "guest") return;
        try {
            var data = await fetchJson(TEAMBOARD_API_BASE + "?userId=" + encodeURIComponent(state.user.id));
            state.posts = (Array.isArray(data.items) ? data.items : []).map(normalizePost);
            savePosts();
            render();
            openPostFromUrl();
        } catch (error) {
            openPostFromUrl();
        }
    }

    async function saveRemotePost(post) {
        var data = await postJson(TEAMBOARD_API_BASE + "/save", {
            requesterId: state.user.id,
            post: post
        });
        if (Array.isArray(data.items)) {
            state.posts = data.items.map(normalizePost);
            savePosts();
        }
        return data.item ? normalizePost(data.item) : null;
    }

    async function deleteRemotePost(id) {
        var data = await postJson(TEAMBOARD_API_BASE + "/delete", {
            requesterId: state.user.id,
            id: id
        });
        return Array.isArray(data.items) ? data.items : null;
    }

    async function fetchJson(url) {
        return API.get(url, null, {
            errorMessage: "요청을 처리하지 못했습니다."
        });
    }

    async function postJson(url, payload) {
        return API.post(url, payload || {}, {
            errorMessage: "요청을 처리하지 못했습니다."
        });
    }

    function refreshNotifications() {
        if (window.NotificationLayer && typeof window.NotificationLayer.refreshBadge === "function") {
            window.NotificationLayer.refreshBadge();
        }
        if (typeof window.CustomEvent === "function") {
            window.dispatchEvent(new CustomEvent("notifications:updated"));
        }
    }

    function openPostFromUrl() {
        var params = new URLSearchParams(location.search);
        var postId = String(params.get("postId") || "").trim();
        if (postId && getPostById(postId)) openDetail(postId);
    }

    function isNotSeedPost(item) {
        var id = String(item && item.id || "");
        return id !== "teamboard_notice_1" && id !== "teamboard_notice_2" && id !== "teamboard_seed_1";
    }

    function normalizePost(item) {
        item = item || {};
        return {
            id: String(item.id || ("teamboard_" + Date.now())),
            title: String(item.title || "").trim(),
            body: String(item.body || "").trim(),
            type: "all",
            pinned: item.pinned === true,
            attachments: normalizeTeamboardAttachments(item.attachments),
            comments: normalizeTeamboardComments(item.comments),
            department: String(item.department || "").trim(),
            authorId: String(item.authorId || "").trim().toLowerCase(),
            authorName: String(item.authorName || "").trim(),
            authorDepartment: String(item.authorDepartment || "").trim(),
            createdAt: String(item.createdAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
            views: Number(item.views || 0),
            reactions: normalizeReactions(item.reactions)
        };
    }

    function canRead(post) { return isExecutive() || normalizeDepartment(post.department) === normalizeDepartment(state.user.department); }
    function canWrite() { return isExecutive() || !!state.user.department; }
    function canEdit(post) { return isExecutive() || String(post.authorId || "") === state.user.id; }
    function canComment(post) { return !!post && canRead(post) && canWrite(); }
    function canDeleteComment(comment) { return isExecutive() || String(comment.authorId || "") === state.user.id; }
    function isExecutive() {
        return window.AuthStore && typeof window.AuthStore.isExecutive === "function"
            ? window.AuthStore.isExecutive()
            : state.user.role === "admin" || state.user.role === "ceo";
    }
    function getWritableDepartment() { return isExecutive() ? (state.user.department || "전체") : state.user.department; }
    function normalizeDepartment(value) { return String(value || "").trim(); }

    function getAvatarText(name) {
        var nameChars = Array.from(String(name || "").replace(/\s+/g, ""));
        if (!nameChars.length) return "팀";
        return nameChars[Math.floor(nameChars.length / 2)] || "팀";
    }

    function getAvatarStyle(value) {
        var colors = ["#f99790", "#f3c364", "#83c0f9", "#84c9a1", "#bda5ef"];
        var source = String(value || "").trim();
        var hash = 0;
        for (var index = 0; index < source.length; index += 1) {
            hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
        }
        return "background-color:" + colors[hash % colors.length] + ";color:#fff;";
    }

    function renderComposerNoticeButton() {
        if (!elements.composerNoticeButton) return;
        elements.composerNoticeButton.classList.toggle("is-active", state.composerPinned === true);
    }

    function renderComposerAttachments() {
        if (!elements.composerFileList) return;
        elements.composerFileList.innerHTML = state.composerAttachments.map(function (item, index) {
            return '<span class="teamboardComposerFileItem"><span>' + escapeHtml(getTeamboardAttachmentName(item)) + '</span><button type="button" class="teamboardComposerFileRemove" data-remove-composer-file="' + index + '" aria-label="첨부파일 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></span>';
        }).join("");
    }

    function removeComposerAttachment(index) {
        if (isNaN(index) || index < 0 || index >= state.composerAttachments.length) return;
        state.composerAttachments.splice(index, 1);
        if (!state.composerAttachments.length && elements.composerFile) elements.composerFile.value = "";
        renderComposerAttachments();
    }

    function renderTeamboardAttachmentBlock(attachments) {
        var items = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
        if (!items.length) return "";
        return '<div class="boardFileBox"><strong class="boardFileTitle">첨부 파일</strong><div class="boardFileList">' + items.map(function (item) {
            if (item && typeof item === "object" && item.dataUrl) {
                return '<a class="boardFileItem boardLinkItem" href="' + escapeHtml(item.dataUrl) + '" download="' + escapeHtml(item.name || "첨부파일") + '">' + escapeHtml(item.name || "첨부파일") + '</a>';
            }
            return '<span class="boardFileItem">' + escapeHtml(getTeamboardAttachmentName(item)) + '</span>';
        }).join("") + '</div></div>';
    }

    function renderTeamboardComments(post) {
        var comments = normalizeTeamboardComments(post && post.comments);
        return [
            '<div class="teamboardCommentSection">',
            comments.length ? '<div class="teamboardCommentList">' + comments.map(function (comment) {
                return [
                    '<div class="teamboardCommentItem">',
                    '<div class="teamboardCommentMeta">',
                    '<span class="teamboardAvatar teamboardAvatar--comment" style="' + escapeHtml(getAvatarStyle(comment.authorId || comment.authorName)) + '">' + escapeHtml(getAvatarText(comment.authorName)) + '</span>',
                    '<div class="teamboardCommentMetaText teamboardCommentMetaText--row">',
                    '<span class="teamboardCommentAuthor">' + escapeHtml(comment.authorName) + '</span>',
                    '<span class="teamboardCommentDot">·</span>',
                    '<span class="teamboardCommentTime">' + escapeHtml(formatRelativeTime(comment.createdAt)) + '</span>',
                    '</div>',
                    canDeleteComment(comment) ? '<button type="button" class="teamboardCommentDelete" data-comment-delete="' + escapeHtml(comment.id) + '">삭제</button>' : '',
                    '</div>',
                    '<div class="teamboardCommentText">' + escapeHtml(comment.body).replace(/\n/g, "<br>") + '</div>',
                    '</div>'
                ].join("");
            }).join("") + '</div>' : '',
            canComment(post) ? [
                '<div class="teamboardCommentComposer">',
                '<div class="teamboardCommentEditor">',
                '<textarea class="teamboardCommentTextarea" placeholder="해당 글에 댓글을 남겨보세요"></textarea>',
                '<div class="teamboardMentionList teamboardCommentMentionList" style="display:none;"></div>',
                '</div>',
                '<div class="teamboardCommentComposerFooter">',
                '<button type="button" class="teamboardCommentSubmit">댓글 등록</button>',
                '</div>',
                '</div>'
            ].join("") : "",
            '</div>'
        ].join("");
    }

    function renderCommentSummary(post) {
        var count = normalizeTeamboardComments(post && post.comments).length;
        return '<span class="teamboardCommentSummary"><i class="xi-comment-o" aria-hidden="true"></i><span>' + count + '</span></span>';
    }

    async function saveComment(postId) {
        var post = getPostById(postId);
        if (!post || !canComment(post) || !elements.detailBody) return;
        var textarea = elements.detailBody.querySelector(".teamboardCommentTextarea");
        if (!textarea) return;
        var body = String(textarea.value || "").trim();
        if (!body) return alert("댓글 내용을 입력해 주세요.");

        post.comments = normalizeTeamboardComments(post.comments);
        post.comments.push({
            id: "comment_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            body: body,
            authorId: state.user.id,
            authorName: state.user.name,
            authorDepartment: state.user.department,
            createdAt: new Date().toISOString()
        });
        closeMentionList(elements.detailBody.querySelector(".teamboardCommentMentionList"));
        try {
            var saved = await saveRemotePost(post);
            if (saved) post = saved;
        } catch (error) {
            savePosts();
        }
        render();
        openDetail(post.id);
    }

    async function deleteComment(postId, commentId) {
        var post = getPostById(postId);
        if (!post) return;
        post.comments = normalizeTeamboardComments(post.comments);
        var comment = post.comments.find(function (item) { return item.id === commentId; });
        if (!comment || !canDeleteComment(comment)) return;
        if (!confirm("댓글을 삭제할까요?")) return;
        post.comments = post.comments.filter(function (item) { return item.id !== commentId; });
        try {
            var saved = await saveRemotePost(post);
            if (saved) post = saved;
        } catch (error) {
            savePosts();
        }
        render();
        openDetail(post.id);
    }

    function readTeamboardAttachments(fileList) {
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

    function normalizeTeamboardAttachments(value) {
        return Array.isArray(value) ? value.filter(Boolean).map(function (item) {
            if (item && typeof item === "object") {
                return {
                    name: String(item.name || "").trim(),
                    type: String(item.type || "").trim(),
                    size: Number(item.size || 0),
                    dataUrl: String(item.dataUrl || "").trim()
                };
            }
            return { name: String(item || "").trim(), type: "", size: 0, dataUrl: "" };
        }) : [];
    }

    function normalizeTeamboardComments(value) {
        return Array.isArray(value) ? value.filter(Boolean).map(function (item) {
            item = item || {};
            return {
                id: String(item.id || ("comment_" + Date.now())),
                body: String(item.body || "").trim(),
                authorId: String(item.authorId || "").trim().toLowerCase(),
                authorName: String(item.authorName || "").trim(),
                authorDepartment: String(item.authorDepartment || "").trim(),
                createdAt: String(item.createdAt || new Date().toISOString())
            };
        }).filter(function (item) {
            return !!item.body;
        }) : [];
    }

    function getTeamboardAttachmentName(item) {
        if (item && typeof item === "object") return String(item.name || "");
        return String(item || "");
    }

    function formatRelativeTime(value) {
        var date = value ? new Date(value) : null;
        if (!date || isNaN(date.getTime())) return "-";
        var diff = Date.now() - date.getTime();
        if (diff < 0) diff = 0;
        var minute = 60 * 1000;
        var hour = 60 * minute;
        var day = 24 * hour;
        if (diff < minute) return "방금 전";
        if (diff < hour) return Math.max(1, Math.floor(diff / minute)) + "분 전";
        if (diff < day) return Math.floor(diff / hour) + "시간 전";
        if (diff < day * 7) return Math.floor(diff / day) + "일 전";
        return formatDate(value);
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
        return !date || isNaN(date.getTime()) ? "-" : date.getFullYear() + "." + pad(date.getMonth() + 1) + "." + pad(date.getDate());
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

    function renderReactionButtons(post) {
        var reactions = normalizeReactions(post && post.reactions);
        return TEAMBOARD_REACTIONS.slice(0, 3).map(function (reaction) {
            var users = reactions[reaction.key] || [];
            var isActive = users.indexOf(state.user.id) > -1;
            return '<button type="button" class="teamboardReactionBtn' + (isActive ? ' is-active' : '') + '" data-reaction="' + escapeHtml(reaction.key) + '" data-id="' + escapeHtml(post.id) + '"><img src="' + escapeHtml(reaction.image) + '" alt="" width="24" height="24"><span>' + users.length + '</span></button>';
        }).join("");
    }

    function bindReactionButtons(root) {
        Array.prototype.slice.call(root.querySelectorAll(".teamboardReactionBtn")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.stopPropagation();
                toggleReaction(button.getAttribute("data-id"), button.getAttribute("data-reaction"));
            });
        });
    }

    async function toggleReaction(id, reactionKey) {
        var post = getPostById(id);
        if (!post) return;
        post.reactions = normalizeReactions(post.reactions);
        var list = post.reactions[reactionKey] || [];
        var index = list.indexOf(state.user.id);
        if (index > -1) list.splice(index, 1);
        else list.push(state.user.id);
        post.reactions[reactionKey] = list;
        try {
            var saved = await saveRemotePost(post);
            if (saved) post = saved;
        } catch (error) {
            savePosts();
        }
        render();
        if (state.selectedId === post.id && elements.detail.style.display === "block") {
            openDetail(post.id);
        }
    }

    function normalizeReactions(value) {
        var source = value && typeof value === "object" ? value : {};
        var normalized = {};
        TEAMBOARD_REACTIONS.forEach(function (reaction) {
            var merged = [];
            [reaction.key].concat(reaction.legacyKeys || []).forEach(function (key) {
                if (!Array.isArray(source[key])) return;
                source[key].forEach(function (item) {
                    var userId = String(item || "").trim().toLowerCase();
                    if (userId && merged.indexOf(userId) === -1) merged.push(userId);
                });
            });
            normalized[reaction.key] = merged;
        });
        return normalized;
    }

    function renderMentionList(target) {
        if (!target) return;
        var items = getMentionItems();
        target.innerHTML = items.map(function (item) {
            return '<button type="button" class="teamboardMentionItem" data-mention-value="' + escapeHtml(item.value) + '"><span class="teamboardMentionIcon">@</span><span class="teamboardMentionText"><strong>' + escapeHtml(item.label) + '</strong><span>' + escapeHtml(item.meta) + '</span></span></button>';
        }).join("");
    }

    function getMentionItems() {
        var seen = {};
        var members = state.employees.filter(function (item) {
            var department = String(item.department || "").trim();
            var role = String(item.role || item.userRole || item.roleCode || "").trim().toLowerCase();
            var label = getMentionDisplayName(item.name);
            if (!label) return false;
            if (role === "admin" || role === "administrator") return false;
            if (role === "ceo" || department === "대표") {
                if (seen[label]) return false;
                seen[label] = true;
                return true;
            }
            if (department !== state.user.department) return false;
            if (seen[label]) return false;
            seen[label] = true;
            return true;
        });
        var items = [
            { value: "@all", label: "all", meta: "팀 멤버 모두 멘션" }
        ];
        members.forEach(function (item) {
            items.push({
                value: "@" + getMentionDisplayName(item.name),
                label: getMentionDisplayName(item.name),
                fullName: String(item.name || "").trim(),
                meta: (item.position || "") + (item.position && item.department ? " / " : "") + (item.department || "")
            });
        });
        return items;
    }

    function closeMentionList(target) {
        if (!target) return;
        target.style.display = "none";
    }

    function insertMention(textarea, list, value) {
        if (!textarea) return;
        var current = String(textarea.value || "");
        var caret = Number(textarea.selectionStart || current.length);
        var before = current.slice(0, caret);
        var after = current.slice(caret);
        var triggerIndex = before.lastIndexOf("@");
        if (triggerIndex < 0) return;
        var inserted = before.slice(0, triggerIndex) + String(value || "") + " " + after;
        textarea.value = inserted;
        textarea.focus();
        closeMentionList(list);
    }

    function syncMentionSuggestions(textarea, list) {
        if (!textarea || !list) return;
        var current = String(textarea.value || "");
        var caret = Number(textarea.selectionStart || current.length);
        var before = current.slice(0, caret);
        var triggerIndex = before.lastIndexOf("@");
        if (triggerIndex < 0) {
            closeMentionList(list);
            return;
        }
        var query = before.slice(triggerIndex + 1).trim().toLowerCase();
        var items = getMentionItems().filter(function (item) {
            var fullName = String(item.fullName || "").toLowerCase();
            return !query
                || item.label.toLowerCase().indexOf(query) > -1
                || item.value.toLowerCase().indexOf("@" + query) > -1
                || fullName.indexOf(query) > -1;
        });
        if (!items.length) {
            closeMentionList(list);
            return;
        }
        list.innerHTML = items.map(function (item) {
            return '<button type="button" class="teamboardMentionItem" data-mention-value="' + escapeHtml(item.value) + '"><span class="teamboardMentionIcon">@</span><span class="teamboardMentionText"><strong>' + escapeHtml(item.label) + '</strong><span>' + escapeHtml(item.meta) + '</span></span></button>';
        }).join("");
        list.style.display = "block";
    }

    function loadEmployees() {
        var authList = Promise.resolve().then(function () {
            if (!window.AuthStore || typeof window.AuthStore.getEmployees !== "function") return [];
            return window.AuthStore.getEmployees();
        }).catch(function () {
            return [];
        });

        return authList.then(function (items) {
            if (Array.isArray(items) && items.length > 1) {
                return normalizeEmployees(items);
            }
            return fetchEmployeeList().then(function (fetched) {
                if (fetched.length) return fetched;
                if (Array.isArray(items) && items.length) return normalizeEmployees(items);
                return buildFallbackEmployees();
            });
        }).catch(function () {
            return fetchEmployeeList().then(function (fetched) {
                return fetched.length ? fetched : buildFallbackEmployees();
            }).catch(function () {
                return buildFallbackEmployees();
            });
        });
    }

    function fetchEmployeeList() {
        if (!API || typeof AUTH_API_BASE === "undefined") {
            return Promise.resolve([]);
        }
        return API.get(AUTH_API_BASE + "/employees", { requesterRole: "admin" })
            .then(function (data) {
                return normalizeEmployees(data.items);
            })
            .catch(function () {
                return [];
            });
    }

    function normalizeEmployees(items) {
        return (Array.isArray(items) ? items : []).map(function (item) {
            return {
                id: String(item.id || item.userId || "").trim().toLowerCase(),
                name: String(item.name || item.userName || "").trim(),
                department: String(item.department || "").trim(),
                position: String(item.position || item.roleLabel || "").trim(),
                role: String(item.role || item.userRole || "").trim().toLowerCase()
            };
        }).filter(function (item) {
            return !!item.name && !isHiddenSelectableEmployee(item);
        });
    }

    function isHiddenSelectableEmployee(item) {
        var id = String(item && item.id || "").trim().toLowerCase();
        var name = String(item && item.name || "").trim();
        var email = String(item && item.email || "").trim().toLowerCase();
        var role = String(item && item.role || "").trim().toLowerCase();
        return id === "admin"
            || id === "work"
            || id === "test"
            || /^test/i.test(id)
            || role === "admin"
            || name === "관리자"
            || name === "홍길동"
            || email === "admin@autone.co.kr"
            || /^test@/i.test(email);
    }

    function buildFallbackEmployees() {
        var currentName = String(state.user && state.user.name || "").trim();
        if (!currentName) return [];
        return [{
            name: currentName,
            department: state.user.department || "",
            position: "",
            role: state.user.role || ""
        }];
    }

    function getMentionDisplayName(name) {
        var value = String(name || "").trim();
        if (!value) return "";
        return value.replace(/^[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류나진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모장온편경]/, "");
    }
})();
