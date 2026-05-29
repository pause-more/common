(function () {
    var CUSTOM_FOLDER_SLOTS = ["my1", "my2", "my3"];
    var DEFAULT_CUSTOM_FOLDER_NAMES = { my1: "나의메일함 1", my2: "나의메일함 2", my3: "나의메일함 3" };
    var MODULE_MENU_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path></svg>';

    function normalizePath(value) {
        var path = String(value || "").split("?")[0].split("#")[0].trim().toLowerCase();
        if (!path || path === "#") return "";
        return path.charAt(0) === "/" ? path : "/" + path;
    }

    function getCurrentUserKey() {
        return String(localStorage.getItem("userId") || localStorage.getItem("userEmail") || "guest").trim().toLowerCase();
    }

    function getStorageKey() {
        return "myMailFolders:" + getCurrentUserKey();
    }

    function getDefaultFolderName(id) {
        return DEFAULT_CUSTOM_FOLDER_NAMES[id] || "";
    }

    function normalizeFolderRecord(item) {
        if (!item) return null;
        var id = String(item.id || "").trim();
        if (CUSTOM_FOLDER_SLOTS.indexOf(id) < 0) return null;
        return {
            id: id,
            name: String(item.name || getDefaultFolderName(id)).trim() || getDefaultFolderName(id),
            deleted: item.deleted === true
        };
    }

    function readFolderRecords() {
        try {
            var parsed = JSON.parse(localStorage.getItem(getStorageKey()) || "[]");
            if (!Array.isArray(parsed)) return [];
            return parsed.map(normalizeFolderRecord).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    function writeFolders(items) {
        var seen = {};
        var normalized = (Array.isArray(items) ? items : []).map(normalizeFolderRecord).filter(function (item) {
            if (!item || seen[item.id]) return false;
            seen[item.id] = true;
            return true;
        });
        localStorage.setItem(getStorageKey(), JSON.stringify(normalized));
    }

    function getStoredFolderRecord(id) {
        id = String(id || "").trim();
        return readFolderRecords().find(function (item) { return item.id === id; }) || null;
    }

    function getFolderById(id) {
        id = String(id || "").trim();
        if (CUSTOM_FOLDER_SLOTS.indexOf(id) < 0) return null;
        var stored = getStoredFolderRecord(id);
        if (stored && stored.deleted) return null;
        return {
            id: id,
            name: stored && stored.name ? stored.name : getDefaultFolderName(id)
        };
    }

    function readFolders() {
        return CUSTOM_FOLDER_SLOTS.map(getFolderById).filter(Boolean);
    }

    function upsertFolder(id, nextRecord) {
        id = String(id || "").trim();
        if (CUSTOM_FOLDER_SLOTS.indexOf(id) < 0) return null;
        var records = readFolderRecords().filter(function (item) { return item.id !== id; });
        var current = getStoredFolderRecord(id);
        var record = normalizeFolderRecord(Object.assign({}, current || { id: id, name: getDefaultFolderName(id) }, nextRecord || {}, { id: id }));
        records.push(record);
        writeFolders(records);
        return record;
    }

    window.MyMailFolderStore = {
        getFolders: function () {
            return readFolders();
        },
        getFolderById: function (id) {
            return getFolderById(id);
        },
        addFolder: function (name) {
            var nextName = String(name || "").trim();
            if (!nextName) throw new Error("메일함 이름을 입력해 주세요.");

            var emptySlot = CUSTOM_FOLDER_SLOTS.find(function (slot) {
                return !getFolderById(slot);
            });

            if (!emptySlot) throw new Error("메일함은 최대 3개까지 추가할 수 있습니다.");

            upsertFolder(emptySlot, { name: nextName, deleted: false });
            return { id: emptySlot, name: nextName };
        },
        renameFolder: function (id, name) {
            id = String(id || "").trim();
            var nextName = String(name || "").trim();
            if (!id || !nextName) throw new Error("메일함 이름을 입력해 주세요.");

            var target = getFolderById(id);
            if (!target) throw new Error("메일함을 찾을 수 없습니다.");
            upsertFolder(id, { name: nextName, deleted: false });
            return { id: id, name: nextName };
        },
        deleteFolder: function (id) {
            id = String(id || "").trim();
            if (CUSTOM_FOLDER_SLOTS.indexOf(id) < 0) return;
            upsertFolder(id, { deleted: true });
        }
    };

    function resolveMailMenuPath() {
        var currentPath = normalizePath(location.pathname || "");
        if (currentPath !== "/mail/read.html") return currentPath;

        var folder = String(new URLSearchParams(String(location.search || "")).get("folder") || "").trim().toLowerCase();
        if (folder === "sent") return "/mail/sent.html";
        if (folder === "draft") return "/mail/draft.html";
        if (folder === "spam") return "/mail/spam.html";
        if (folder === "trash") return "/mail/trash.html";
        if (folder === "my1") return "/mail/my1.html";
        if (folder === "my2") return "/mail/my2.html";
        if (folder === "my3") return "/mail/my3.html";
        return "/mail/inbox.html";
    }

    function renderCustomFolders() {
        var list = document.querySelector(".mailSubmenuList");
        if (!list) return;

        list.querySelectorAll(".mailSubmenuItem.is-custom").forEach(function (node) {
            node.remove();
        });
        document.querySelectorAll(".mailCustomSectionTitle").forEach(function (node) {
            node.remove();
        });

        var folders = readFolders();
        if (!folders.length) return;

        var sectionTitle = '<p class="mailCustomSectionTitle">내 메일함</p>';
        var html = folders.map(function (folder) {
            return ''
                + '<p class="mailSubmenuItem is-custom">'
                + '<a href="/mail/' + folder.id + '.html" data-folder-id="' + folder.id + '">'
                + '<span class="menu_ico">'
                + '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9c9c9c" viewBox="0 0 256 256"><path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,16V152h-28.7A15.86,15.86,0,0,0,168,156.69L148.69,176H107.31L88,156.69A15.86,15.86,0,0,0,76.69,152H48V48Zm0,160H48V168H76.69L96,187.31A15.86,15.86,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z"></path></svg>'
                + '</span>'
                + '<span class="menu_txt">' + escapeHtml(folder.name) + '</span>'
                + '</a>'
                + '<span class="mailSubmenuItemMore">'
                + '<button type="button" class="mailSubmenuMoreBtn" data-folder-id="' + folder.id + '" aria-label="메일함 더보기">⋮</button>'
                + '<span class="mailSubmenuMoreMenu">'
                + '<button type="button" data-folder-action="rename" data-folder-id="' + folder.id + '">이름 변경</button>'
                + '<button type="button" data-folder-action="delete" data-folder-id="' + folder.id + '">메일함 삭제</button>'
                + '</span>'
                + '</span>'
                + '</p>';
        }).join("");

        var actions = document.querySelector(".mailSubmenuActions");
        if (actions) {
            actions.insertAdjacentHTML("beforebegin", sectionTitle);
            actions.insertAdjacentHTML("beforebegin", html);
        } else {
            list.insertAdjacentHTML("beforeend", sectionTitle);
            list.insertAdjacentHTML("beforeend", html);
        }
    }

    function applyMailSidebarSelection() {
        var currentPath = resolveMailMenuPath();
        document.querySelectorAll(".mailSubmenuItem").forEach(function (item) {
            item.classList.remove("selected");
        });

        document.querySelectorAll(".mailSubmenuItem a[href]").forEach(function (link) {
            var href = normalizePath(link.getAttribute("href") || "");
            if (!href) return;
            if (currentPath !== href && currentPath.slice(-href.length) !== href) return;
            var item = link.closest(".mailSubmenuItem");
            if (item) item.classList.add("selected");
        });
    }

    function bindMyMailModal() {
        var modal = document.querySelector(".myMailModal");
        if (!modal || modal.getAttribute("data-mail-layout-bound") === "true") return;
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        var title = modal.querySelector(".myMailModalTitle");
        var input = modal.querySelector(".myMailSingleInput");
        var submitButton = modal.querySelector(".myMailSubmitBtn");
        var state = { mode: "add", folderId: "" };

        function openModal(mode, folderId) {
            state.mode = mode === "rename" ? "rename" : "add";
            state.folderId = String(folderId || "").trim();
            var initialValue = "";
            if (title) title.textContent = state.mode === "rename" ? "메일함 이름 변경" : "메일함 추가";
            if (submitButton) submitButton.textContent = state.mode === "rename" ? "변경" : "저장";
            if (input) {
                input.value = "";
                input.placeholder = "메일함 이름 입력";
                if (state.mode === "rename" && state.folderId) {
                    var current = window.MyMailFolderStore.getFolderById(state.folderId);
                    var currentLabelNode = document.querySelector('.is-custom-mail-folder[data-folder-id="' + state.folderId.replace(/"/g, '&quot;') + '"]');
                    var currentName = current && current.name ? current.name : (currentLabelNode ? currentLabelNode.textContent : "");
                    if (!current && !currentName) {
                        alert("메일함을 찾을 수 없습니다.");
                        return;
                    }
                    initialValue = String(currentName || "").trim();
                    input.value = initialValue;
                }
            }
            modal.style.display = "";
            modal.classList.remove("is-closing");
            modal.classList.add("is-open");
            document.documentElement.classList.add("mymailModalOpen");
            document.body.classList.add("mymailModalOpen");
            if (input) {
                if (state.mode === "rename") input.value = initialValue;
                else input.value = "";
                setTimeout(function () { input.focus(); }, 10);
                setTimeout(function () {
                    if (state.mode === "rename") input.value = initialValue;
                }, 0);
            }
        }

        function closeModal() {
            modal.classList.remove("is-open");
            modal.classList.add("is-closing");
            document.documentElement.classList.remove("mymailModalOpen");
            document.body.classList.remove("mymailModalOpen");
            setTimeout(function () {
                modal.style.display = "none";
                modal.classList.remove("is-closing");
            }, 220);
        }

        function handleKeydown(event) {
            if (!event || event.key !== "Escape") return;
            if (!modal.classList.contains("is-open")) return;
            event.preventDefault();
            closeModal();
        }

        document.querySelectorAll(".myMailAddBtn").forEach(function (button) {
            button.addEventListener("click", function () {
                openModal("add");
            });
        });

        modal.querySelectorAll(".mymailCloseBtn, .myMailCancelBtn, .mymailModalDim").forEach(function (button) {
            button.addEventListener("click", closeModal);
        });
        document.addEventListener("keydown", handleKeydown);

        if (submitButton) {
            submitButton.addEventListener("click", function () {
                try {
                    if (state.mode === "rename") {
                        window.MyMailFolderStore.renameFolder(state.folderId, input && input.value);
                        renderCustomFolders();
                        applyMailSidebarSelection();
                        bindCustomFolderMenus();
                        if (typeof window.syncMailSidebarState === "function") window.syncMailSidebarState();
                        syncCustomFolderTitle(state.folderId);
                        closeModal();
                        return;
                    }

                    var created = window.MyMailFolderStore.addFolder(input && input.value);
                    renderCustomFolders();
                    applyMailSidebarSelection();
                    closeModal();
                    if (created && created.id) {
                        location.href = "/mail/" + created.id + ".html";
                    }
                } catch (error) {
                    alert(error.message || (state.mode === "rename" ? "메일함 이름을 변경하지 못했습니다." : "메일함을 추가하지 못했습니다."));
                }
            });
        }

        window.openMyMailFolderModal = openModal;
        modal.setAttribute("data-mail-layout-bound", "true");
    }

    function bindCustomFolderMenus() {
        document.querySelectorAll(".mailSubmenuMoreBtn, .myMailMoreBtn").forEach(function (button) {
            if (button.getAttribute("data-folder-more-bound") === "true") return;
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var wrap = button.closest(".mailSubmenuItemMore, .myMailItem");
                document.querySelectorAll(".mailSubmenuItemMore.is-open").forEach(function (node) {
                    if (node !== wrap) node.classList.remove("is-open");
                });
                document.querySelectorAll(".myMailItem.is-open").forEach(function (node) {
                    if (node !== wrap) node.classList.remove("is-open");
                });
                if (wrap) wrap.classList.toggle("is-open");
            });
            button.setAttribute("data-folder-more-bound", "true");
        });

        document.querySelectorAll(".mailSubmenuMoreMenu button, .myMailMoreMenu button").forEach(function (button) {
            if (button.getAttribute("data-folder-action-bound") === "true") return;
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var action = String(button.getAttribute("data-folder-action") || "").trim();
                var folderId = String(button.getAttribute("data-folder-id") || "").trim();
                if (!folderId || !action) return;

                if (action === "rename") {
                    handleRenameFolder(folderId);
                    return;
                }
                if (action === "delete") {
                    handleDeleteFolder(folderId);
                }
            });
            button.setAttribute("data-folder-action-bound", "true");
        });

        if (document.body.getAttribute("data-custom-folder-dismiss-bound") === "true") return;
        document.addEventListener("click", function (event) {
            var target = event.target;
            if (target && target.closest && target.closest(".mailSubmenuItemMore, .myMailItem")) return;
            document.querySelectorAll(".mailSubmenuItemMore.is-open").forEach(function (node) {
                node.classList.remove("is-open");
            });
            document.querySelectorAll(".myMailItem.is-open").forEach(function (node) {
                node.classList.remove("is-open");
            });
        });
        document.body.setAttribute("data-custom-folder-dismiss-bound", "true");
    }

    function handleRenameFolder(folderId) {
        if (typeof window.openMyMailFolderModal === "function") {
            window.openMyMailFolderModal("rename", folderId);
            return;
        }
        alert("메일함 이름 변경 창을 열 수 없습니다.");
    }

    function handleDeleteFolder(folderId) {
        if (!confirm("메일함을 삭제하시겠어요?")) return;
        window.MyMailFolderStore.deleteFolder(folderId);
        renderCustomFolders();
        applyMailSidebarSelection();
        bindCustomFolderMenus();
        if (typeof window.syncMailSidebarState === "function") window.syncMailSidebarState();
        var path = normalizePath(location.pathname || "");
        if (path === "/mail/" + folderId + ".html") {
            location.href = "/mail/inbox.html";
        }
    }

    function syncCustomFolderTitle(folderId) {
        var path = normalizePath(location.pathname || "");
        if (path !== "/mail/" + folderId + ".html") return;
        var folder = window.MyMailFolderStore.getFolderById(folderId);
        if (!folder || !folder.name) return;
        document.querySelectorAll(".mailBoxLabel").forEach(function (node) {
            node.textContent = folder.name;
        });
        var title = document.querySelector(".titleArea h3");
        if (title) title.textContent = folder.name;
    }

    window.syncMailSidebarState = function () {
        document.querySelectorAll(".is-custom-mail-folder").forEach(function (item) {
            var folderId = String(item.getAttribute("data-folder-id") || "").trim();
            var folder = window.MyMailFolderStore.getFolderById(folderId);
            var container = item.closest && item.closest(".myMailItem");
            if (container) container.hidden = !folder;
            item.hidden = !folder;
            if (folder && folder.name) item.textContent = folder.name;
        });
        document.querySelectorAll('[data-move-folder="my1"], [data-move-folder="my2"], [data-move-folder="my3"]').forEach(function (button) {
            var folderId = String(button.getAttribute("data-move-folder") || "").trim();
            var folder = window.MyMailFolderStore.getFolderById(folderId);
            button.hidden = !folder;
            if (folder && folder.name) button.textContent = folder.name;
        });
        applyMailSidebarSelection();
    };

    function ensureComposeFloatingButton() {
        var path = normalizePath(location.pathname || "");
        if (path === "/mail/compose.html") return;
        if (document.querySelector(".mailComposeFab")) return;

        var button = document.createElement("a");
        button.href = "/mail/compose.html";
        button.className = "mailComposeFab";
        button.setAttribute("aria-label", "메일쓰기");
        button.textContent = "+";
        document.body.appendChild(button);
    }

    function ensureMobileMenuToggle() {
        var titleArea = document.querySelector(".titleArea");
        if (!titleArea || titleArea.querySelector(".mobileSubmenuToggleBtn")) return;

        var button = document.createElement("button");
        button.type = "button";
        button.className = "mobileSubmenuToggleBtn";
        button.setAttribute("aria-label", "메일 메뉴 열기");
        button.innerHTML = MODULE_MENU_ICON;
        button.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            document.body.classList.remove("mobileModuleSidebarClosing");
            document.body.classList.add("mobileSidebarOpen");
            document.body.classList.add("mobileModuleSidebarOpen");
        });
        titleArea.appendChild(button);
    }

    function getInitialPage() {
        var value = parseInt(new URLSearchParams(String(location.search || "")).get("page") || "1", 10);
        return value > 0 ? value : 1;
    }

    function getPagedItems(state, items) {
        var list = Array.isArray(items) ? items : [];
        state.total = list.length;
        state.totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
        if (state.page > state.totalPages) state.page = state.totalPages;
        if (state.page < 1) state.page = 1;
        var start = (state.page - 1) * state.pageSize;
        return list.slice(start, start + state.pageSize);
    }

    var ATTACHMENT_ICON_SVG = '<svg class="mailListIcon mailAttachSvg icon icon-tabler icons-tabler-outline icon-tabler-paperclip" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7f8287" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5"></path></svg>';
    var STAR_OUTLINE_SVG = '<svg class="mailListIcon mailStarSvg mailStarSvgOutline icon icon-tabler icons-tabler-outline icon-tabler-star" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7f8287" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245"></path></svg>';
    var STAR_FILLED_SVG = '<svg class="mailListIcon mailStarSvg mailStarSvgFilled icon icon-tabler icons-tabler-filled icon-tabler-star" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0373f0" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"></path></svg>';
    var UNREAD_MAIL_ICON_SVG = '<svg class="mailListIcon mailReadStateSvg mailReadStateSvgUnread icon icon-tabler icons-tabler-filled icon-tabler-mail" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#3394ff" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M22 7.535v9.465a3 3 0 0 1 -2.824 2.995l-.176 .005h-14a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-9.465l9.445 6.297l.116 .066a1 1 0 0 0 .878 0l.116 -.066l9.445 -6.297z"></path><path d="M19 4c1.08 0 2.027 .57 2.555 1.427l-9.555 6.37l-9.555 -6.37a2.999 2.999 0 0 1 2.354 -1.42l.201 -.007h14z"></path></svg>';
    var READ_MAIL_ICON_SVG = '<svg class="mailListIcon mailReadStateSvg mailReadStateSvgRead icon icon-tabler icons-tabler-outline icon-tabler-mail-opened" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7f8287" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M3 9l9 6l9 -6l-9 -6l-9 6"></path><path d="M21 9v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10"></path><path d="M3 19l6 -6"></path><path d="M15 13l6 6"></path></svg>';

    function hasMailAttachment(mail) {
        if (!mail) return false;
        if (Number(mail.attachmentCount || 0) > 0) return true;
        if (Array.isArray(mail.attachmentsMeta) && mail.attachmentsMeta.length > 0) return true;
        if (Array.isArray(mail.attachments) && mail.attachments.length > 0) return true;
        return false;
    }

    function renderAttachmentSlot(mail) {
        return '<div class="col attach">' + (hasMailAttachment(mail) ? '<span class="mailAttachSlot" title="첨부파일 있음">' + ATTACHMENT_ICON_SVG + '</span>' : '') + '</div>';
    }

    function renderReadStateSlot(mail) {
        var unread = !!(mail && mail.unread);
        return '<div class="col readState"><span class="mailReadStateIcon" title="' + (unread ? '읽지 않은 메일' : '읽은 메일') + '">' + (unread ? UNREAD_MAIL_ICON_SVG : READ_MAIL_ICON_SVG) + '</span></div>';
    }

    function renderStarIcon(starred) {
        return starred ? STAR_FILLED_SVG : STAR_OUTLINE_SVG;
    }

    function updateStarButton(button, starred) {
        if (!button) return;
        button.classList.toggle("active", !!starred);
        button.innerHTML = renderStarIcon(!!starred);
    }

    function renderPagination(container, state, onPageChange) {
        if (!container || !state) return;

        var page = Math.max(1, parseInt(state.page || "1", 10));
        var totalPages = Math.max(1, parseInt(state.totalPages || "1", 10));
        if (page > totalPages) page = totalPages;
        state.page = page;
        state.totalPages = totalPages;

        container.innerHTML = ''
            + '<button type="button" class="mailPageNav" data-page="1" aria-label="첫 페이지" ' + (page <= 1 ? 'disabled' : '') + '><i class="ph ph-caret-double-left"></i></button>'
            + '<button type="button" class="mailPageNav" data-page="' + (page - 1) + '" aria-label="이전 페이지" ' + (page <= 1 ? 'disabled' : '') + '><i class="ph ph-caret-left"></i></button>'
            + '<button type="button" class="mailPageCurrent" aria-current="page">' + page + '</button>'
            + '<button type="button" class="mailPageNav" data-page="' + (page + 1) + '" aria-label="다음 페이지" ' + (page >= totalPages ? 'disabled' : '') + '><i class="ph ph-caret-right"></i></button>'
            + '<button type="button" class="mailPageNav" data-page="' + totalPages + '" aria-label="마지막 페이지" ' + (page >= totalPages ? 'disabled' : '') + '><i class="ph ph-caret-double-right"></i></button>';

        container.querySelectorAll(".mailPageNav").forEach(function (button) {
            button.addEventListener("click", function () {
                var nextPage = parseInt(button.getAttribute("data-page") || "1", 10);
                if (!nextPage || nextPage < 1 || nextPage > totalPages || nextPage === state.page) return;
                state.page = nextPage;
                if (typeof onPageChange === "function") onPageChange(nextPage);
            });
        });
    }

    window.MailCommon = Object.assign({}, window.MailCommon || {}, {
        getInitialPage: getInitialPage,
        getPagedItems: getPagedItems,
        hasMailAttachment: hasMailAttachment,
        renderAttachmentSlot: renderAttachmentSlot,
        renderReadStateSlot: renderReadStateSlot,
        renderStarIcon: renderStarIcon,
        updateStarButton: updateStarButton,
        renderPagination: renderPagination
    });

    function initializeMailLayout() {
        renderCustomFolders();
        applyMailSidebarSelection();
        bindMyMailModal();
        bindCustomFolderMenus();
        if (typeof window.syncMailSidebarState === "function") window.syncMailSidebarState();
        ensureComposeFloatingButton();
        ensureMobileMenuToggle();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeMailLayout);
    } else {
        initializeMailLayout();
    }
    document.addEventListener("layout:includes-ready", initializeMailLayout);
})();


(function () {
    function syncCustomMailFolderLinks() {
        document.querySelectorAll(".is-custom-mail-folder").forEach(function (item) {
            var folderId = item.getAttribute("data-folder-id");
            var folder = window.MyMailFolderStore && window.MyMailFolderStore.getFolderById(folderId);
            var container = item.closest && item.closest(".myMailItem");
            if (container) container.hidden = !folder;
            item.hidden = !folder;
            if (folder && folder.name) item.textContent = folder.name;
        });
        document.querySelectorAll('[data-move-folder="my1"], [data-move-folder="my2"], [data-move-folder="my3"]').forEach(function (button) {
            var folderId = String(button.getAttribute("data-move-folder") || "").trim();
            var folder = window.MyMailFolderStore && window.MyMailFolderStore.getFolderById(folderId);
            button.hidden = !folder;
            if (folder && folder.name) button.textContent = folder.name;
        });
    }

    function syncWorkbenchSubmenuSelection() {
        var currentPath = location.pathname.toLowerCase();

        document.querySelectorAll(".workbenchAppSubitem[href], .myMailItem > a[href]").forEach(function (item) {
            var href = item.getAttribute("href").toLowerCase();
            var isActive = currentPath === href;
            item.classList.toggle("is-active", isActive);
            var myMailItem = item.closest && item.closest(".myMailItem");
            if (myMailItem) myMailItem.classList.toggle("selected", isActive);
        });
    }

    function syncMailSidebarState() {
        syncCustomMailFolderLinks();
        syncWorkbenchSubmenuSelection();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", syncMailSidebarState);
    } else {
        syncMailSidebarState();
    }

    document.addEventListener("layout:includes-ready", syncMailSidebarState);
})();
