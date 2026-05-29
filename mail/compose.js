(function () {
    var API_BASE = getGroupwareApiOrigin();
    var API = window.GroupwareApi;
    var AUTOSAVE_INTERVAL = 15000;
    var AUTOSAVE_DEBOUNCE = 5000;
    var REPLY_QUOTED_HTML_KEY = "mailComposeQuotedHtml";
    var SHARED_ATTACHMENTS_KEY = "gw-mail-share-attachments";

    var state = {
        editor: null,
        tiptapReady: false,
        quotedHtml: "",
        preservedQuotedHtml: "",
        draftId: "",
        mode: "",
        files: [],
        receivers: [],
        autocompleteEmails: [],
        isDirty: false,
        isSavingDraft: false,
        autoSaveTimer: null,
        autoSaveIntervalId: null,
        lastSavedSnapshot: "",
        isHydratingDraft: false
    };

    var elements = {};

    document.addEventListener("DOMContentLoaded", function () {
        cacheElements();
        bindEvents();
        applyPrefillFromQuery();
        hydrateSharedAttachments();
        initEditorWhenReady();
        renderFileTable();
        renderReceiverTags();
        initLocalAutocomplete();
        startAutoSaveWatcher();
    });

    document.addEventListener("compose:tiptap:ready", function () {
        state.tiptapReady = true;
        initEditorWhenReady();
    });

    function cacheElements() {
        elements.receiverInput = document.querySelector(".receiverInput");
        elements.receiverTags = document.querySelector(".receiverTags");
        elements.subjectInput = document.querySelector(".subjectInput");
        elements.bodyInput = document.querySelector(".bodyInput");
        elements.fileInput = document.querySelector(".fileInput");
        elements.fileAllCheck = document.querySelector(".fileAllCheck");
        elements.fileCount = document.querySelector(".fileCount");
        elements.fileSize = document.querySelector(".fileSize");
        elements.fileDeleteBtn = document.querySelector(".fileDeleteBtn");
        elements.fileTableBody = document.querySelector(".fileTableBody");
        elements.fileDropZone = document.querySelector(".fileDropZone");
        elements.sendBtn = document.querySelector(".sendBtn");
        elements.tempBtn = document.querySelector(".tempBtn");
        elements.cancelBtn = document.querySelector(".cancelBtn");
        elements.toolbar = document.querySelector(".composeToolbar");
        elements.editorShell = document.querySelector(".composeEditorWrap");
        elements.editorWrap = document.getElementById("composeEditor");
        elements.fontsizeSelect = document.querySelector(".composeFontsize");
        elements.editorPlaceholder = document.querySelector(".editorPlaceholder");
        elements.replyOriginalWrap = document.querySelector(".replyOriginalWrap");
        elements.replyOriginalHtml = document.querySelector(".replyOriginalHtml");
        elements.autocompleteBox = null;
        elements.receiverAutoWrap = null;
        elements.draftStatusText = document.querySelector(".draftStatusText");
    }

    function bindEvents() {
        if (elements.sendBtn) elements.sendBtn.addEventListener("click", sendMail);

        if (elements.tempBtn) {
            elements.tempBtn.addEventListener("click", function () {
                persistDraft({ manual: true, redirect: true });
            });
        }

        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener("click", function () {
                flushDraftOnUnload();
                history.back();
            });
        }

        if (elements.subjectInput) {
            elements.subjectInput.addEventListener("input", function () {
                markDirty();
            });
        }

        if (elements.fileInput) {
            elements.fileInput.addEventListener("change", function () {
                addFiles(Array.prototype.slice.call(this.files || []));
                this.value = "";
            });
        }

        bindFileDropEvents();

        if (elements.fileDeleteBtn) {
            elements.fileDeleteBtn.addEventListener("click", deleteCheckedFiles);
        }

        if (elements.fileAllCheck) {
            elements.fileAllCheck.addEventListener("change", function () {
                state.files.forEach(function (row) {
                    row.checked = elements.fileAllCheck.checked;
                });
                renderFileTable();
            });
        }

        if (elements.receiverInput) {
            elements.receiverInput.addEventListener("keydown", function (e) {
                if ((e.key === "Enter" || e.key === ",") && !isAutocompleteOpen()) {
                    e.preventDefault();
                    var value = normalizeEmail(elements.receiverInput.value);
                    if (value) {
                        addReceiver(value);
                        elements.receiverInput.value = "";
                        closeAutocomplete();
                    }
                } else if (e.key === "Backspace" && !elements.receiverInput.value.trim() && state.receivers.length > 0) {
                    removeReceiver(state.receivers[state.receivers.length - 1]);
                }
            });

            elements.receiverInput.addEventListener("blur", function () {
                setTimeout(function () {
                    var value = normalizeEmail(elements.receiverInput.value);
                    if (value) {
                        addReceiver(value);
                        elements.receiverInput.value = "";
                    }
                    closeAutocomplete();
                }, 120);
            });

            elements.receiverInput.addEventListener("focus", function () {
                renderAutocomplete(elements.receiverInput.value || "");
            });

            elements.receiverInput.addEventListener("input", function () {
                renderAutocomplete(elements.receiverInput.value || "");
                markDirty();
            });
        }

        document.addEventListener("click", function (e) {
            if (!elements.receiverInput) return;
            if (elements.receiverInput.contains(e.target)) return;
            if (elements.autocompleteBox && elements.autocompleteBox.contains(e.target)) return;
            closeAutocomplete();
        });

        window.addEventListener("beforeunload", flushDraftOnUnload);
    }

    function applyPrefillFromQuery() {
        var params = new URLSearchParams(location.search);
        state.mode = params.get("mode") || "";
        state.draftId = params.get("id") || "";
        state.quotedHtml = getQuotedHtmlFromParams(params);
        state.preservedQuotedHtml = state.quotedHtml || "";

        var toValue = params.get("to") || "";
        if (toValue) {
            splitReceiverValues(toValue).forEach(function (email) {
                addReceiver(email, true);
            });
        }

        if (elements.subjectInput) elements.subjectInput.value = params.get("subject") || "";
        renderQuotedOriginal();
    }

    function hydrateSharedAttachments() {
        try {
            var raw = sessionStorage.getItem(SHARED_ATTACHMENTS_KEY) || "";
            if (!raw) return;
            sessionStorage.removeItem(SHARED_ATTACHMENTS_KEY);

            var items = JSON.parse(raw);
            if (!Array.isArray(items) || !items.length) return;

            Promise.all(items.map(function (item, index) {
                var name = String(item && item.name || ("attachment_" + (index + 1))).trim();
                var type = String(item && item.type || "application/octet-stream").trim();
                var dataUrl = String(item && item.dataUrl || "").trim();
                var url = String(item && item.url || "").trim();
                if (url) return urlToFile(url, name, type);
                if (!dataUrl) return null;
                return dataUrlToFile(dataUrl, name, type);
            })).then(function (files) {
                addFiles(files.filter(Boolean));
            }).catch(function (error) {
                console.error("공유 첨부파일 복원 실패:", error);
            });
        } catch (error) {
            console.error("공유 첨부파일 로드 실패:", error);
        }
    }

    function getQuotedHtmlFromParams(params) {
        var quotedFromQuery = params.get("quotedHtml");
        if (quotedFromQuery) {
            return decodeURIComponent(quotedFromQuery);
        }

        var mode = String(params.get("mode") || "").trim().toLowerCase();
        if (mode !== "reply" && mode !== "forward") {
            return "";
        }

        try {
            var stored = sessionStorage.getItem(REPLY_QUOTED_HTML_KEY) || "";
            if (stored) {
                return stored;
            }
        } catch (error) {
            console.error("답장 원본 본문 복원 실패:", error);
        }

        return "";
    }

    function initEditorWhenReady() {
        if (!elements.editorWrap || state.editor) return;
        var bundle = window.ComposeTiptapBundle;
        if (!bundle || !bundle.Editor) return;

        state.editor = new bundle.Editor({
            element: elements.editorWrap,
            extensions: [
                bundle.StarterKit,
                bundle.Underline,
                bundle.TextStyle,
                bundle.Link.configure({ openOnClick: false }),
                bundle.TextAlign.configure({ types: ["heading", "paragraph"] }),
                bundle.FontSize
            ],
            content: getInitialContent(),
            editorProps: { attributes: { class: "mailProseMirror" } },
            onCreate: async function (ctx) {
                syncEditorToTextarea(ctx.editor);
                updateToolbarState();
                updatePlaceholderVisibility();
                await loadDraftIfNeeded();
                syncLastSavedSnapshot();
            },
            onUpdate: function (ctx) {
                syncEditorToTextarea(ctx.editor);
                updateToolbarState();
                updatePlaceholderVisibility();

                if (!state.isHydratingDraft) {
                    markDirty();
                }
            },
            onSelectionUpdate: function () {
                updateToolbarState();
            }
        });

        bindToolbarEvents();
        bindEditorInputEvents();
    }

    function getInitialContent() {
        return "<p></p>";
    }

    function getCurrentUserInfo() {
        var userId = String(localStorage.getItem("userId") || "").trim();
        var userName = String(localStorage.getItem("userName") || "").trim();
        var userEmail = String(localStorage.getItem("userEmail") || "").trim().toLowerCase();

        if (!userEmail && userId) {
            userEmail = userId.toLowerCase() + "@autonecar.kr";
        }

        return {
            userId: userId,
            userName: userName || userId || "사용자",
            userEmail: userEmail
        };
    }

    async function loadDraftIfNeeded() {
        if (state.mode !== "draft" || !state.draftId) return;

        var currentUser = getCurrentUserInfo();

        try {
            var data = await API.get(API_BASE + "/api/mail/draft/read", {
                id: state.draftId,
                userEmail: currentUser.userEmail || ""
            }, {
                errorMessage: "draft load failed"
            });
            if (!data.item) throw new Error("draft load failed");

            state.isHydratingDraft = true;

            splitReceiverValues(data.item.receiver || data.item.to || "").forEach(function (email) {
                addReceiver(email, true);
            });

            if (elements.subjectInput) elements.subjectInput.value = data.item.subject || "";
            if (state.editor) state.editor.commands.setContent(data.item.body || "<p></p>");
            updatePlaceholderVisibility();

            state.lastSavedSnapshot = serializeDraftPayload(buildDraftPayload());
            state.isDirty = false;

            if (data.item.updated_at) {
                setDraftStatus("마지막 저장 " + formatSavedTime(data.item.updated_at), "saved");
            } else {
                setDraftStatus("임시저장 메일을 불러왔습니다.", "saved");
            }
        } catch (e) {
            console.error(e);
            alert("임시저장 메일을 불러오지 못했습니다.");
        } finally {
            state.isHydratingDraft = false;
        }
    }

    function renderQuotedOriginal() {
        if (!elements.replyOriginalWrap || !elements.replyOriginalHtml) return;

        if (!state.preservedQuotedHtml) {
            elements.replyOriginalWrap.style.display = "none";
            elements.replyOriginalHtml.innerHTML = "";
            if (elements.editorShell) elements.editorShell.classList.remove("has-quoted-mail");
            return;
        }

        elements.replyOriginalHtml.innerHTML = state.preservedQuotedHtml;
        elements.replyOriginalWrap.style.display = "";
        if (elements.editorShell) elements.editorShell.classList.add("has-quoted-mail");
    }

    function bindToolbarEvents() {
        if (!elements.toolbar || !state.editor) return;

        Array.prototype.slice.call(elements.toolbar.querySelectorAll(".tt-btn")).forEach(function (btn) {
            btn.addEventListener("click", function () {
                runToolbarCommand(btn.getAttribute("data-cmd"));
            });
        });

        if (elements.fontsizeSelect) {
            elements.fontsizeSelect.addEventListener("change", function () {
                state.editor.chain().focus().setFontSize(this.value).run();
            });
        }
    }

    function runToolbarCommand(cmd) {
        if (!state.editor) return;

        if (cmd === "bold") state.editor.chain().focus().toggleBold().run();
        if (cmd === "italic") state.editor.chain().focus().toggleItalic().run();
        if (cmd === "underline") state.editor.chain().focus().toggleUnderline().run();
        if (cmd === "strike") state.editor.chain().focus().toggleStrike().run();
        if (cmd === "bulletList") state.editor.chain().focus().toggleBulletList().run();
        if (cmd === "orderedList") state.editor.chain().focus().toggleOrderedList().run();
        if (cmd === "alignLeft") state.editor.chain().focus().setTextAlign("left").run();
        if (cmd === "alignCenter") state.editor.chain().focus().setTextAlign("center").run();
        if (cmd === "alignRight") state.editor.chain().focus().setTextAlign("right").run();

        if (cmd === "link") {
            var previousUrl = state.editor.getAttributes("link").href || "";
            var url = prompt("링크 주소를 입력해 주세요.", previousUrl);
            if (url === null) return;
            if (!url.trim()) state.editor.chain().focus().unsetLink().run();
            else state.editor.chain().focus().setLink({ href: url.trim() }).run();
        }

        if (cmd === "clear") {
            state.editor.chain().focus().clearNodes().unsetAllMarks().run();
        }

        updateToolbarState();
    }

    function updateToolbarState() {
        if (!state.editor || !elements.toolbar) return;

        toggleButtonState("bold", state.editor.isActive("bold"));
        toggleButtonState("italic", state.editor.isActive("italic"));
        toggleButtonState("underline", state.editor.isActive("underline"));
        toggleButtonState("strike", state.editor.isActive("strike"));
        toggleButtonState("bulletList", state.editor.isActive("bulletList"));
        toggleButtonState("orderedList", state.editor.isActive("orderedList"));
        toggleButtonState("alignLeft", state.editor.isActive({ textAlign: "left" }));
        toggleButtonState("alignCenter", state.editor.isActive({ textAlign: "center" }));
        toggleButtonState("alignRight", state.editor.isActive({ textAlign: "right" }));

        if (elements.fontsizeSelect) {
            elements.fontsizeSelect.value = state.editor.getAttributes("textStyle").fontSize || "13px";
        }
    }

    function toggleButtonState(cmd, active) {
        var button = elements.toolbar.querySelector('.tt-btn[data-cmd="' + cmd + '"]');
        if (button) button.classList.toggle("is-active", !!active);
    }

    function syncEditorToTextarea(editor) {
        if (elements.bodyInput) elements.bodyInput.value = editor.getHTML();
    }

    function bindEditorInputEvents() {
        var editorElement = elements.editorWrap ? elements.editorWrap.querySelector(".mailProseMirror") : null;
        if (!editorElement || editorElement.dataset.placeholderBound === "1") return;

        editorElement.dataset.placeholderBound = "1";
        ["input", "keyup", "compositionend", "paste"].forEach(function (eventName) {
            editorElement.addEventListener(eventName, function () {
                setTimeout(updatePlaceholderVisibility, 0);
            });
        });
    }

    function updatePlaceholderVisibility() {
        if (!elements.editorPlaceholder || !state.editor) return;
        var text = state.editor.getText() || "";
        var editorText = elements.editorWrap ? (elements.editorWrap.textContent || "") : "";
        var marker = "----- Original Message -----";
        var markerIndex = text.indexOf(marker);
        var editorMarkerIndex = editorText.indexOf(marker);

        if (markerIndex > -1) text = text.slice(0, markerIndex);
        if (editorMarkerIndex > -1) editorText = editorText.slice(0, editorMarkerIndex);

        text = text.replace(/\u200B/g, "").trim();
        editorText = editorText.replace(/\u200B/g, "").trim();
        elements.editorPlaceholder.classList.toggle("is-hidden", text.length > 0 || editorText.length > 0);
    }

    function splitReceiverValues(value) {
        return String(value || "")
            .split(",")
            .map(function (item) { return normalizeEmail(item); })
            .filter(function (item) { return !!item; });
    }

    function normalizeEmail(value) {
        return String(value || "")
            .replace(/^\s+|\s+$/g, "")
            .replace(/^<|>$/g, "")
            .replace(/^.*<([^>]+)>.*$/, "$1")
            .replace(/,$/, "")
            .trim();
    }

    function getReceiverValue() {
        var receivers = state.receivers.slice();
        var inputValue = elements.receiverInput ? normalizeEmail(elements.receiverInput.value) : "";

        if (inputValue && receivers.indexOf(inputValue) === -1) {
            receivers.push(inputValue);
        }

        return receivers.join(",");
    }

    function addReceiver(email, skipDirty) {
        var normalized = normalizeEmail(email);
        if (!normalized) return;
        if (state.receivers.indexOf(normalized) > -1) return;
        state.receivers.push(normalized);
        renderReceiverTags();
        if (!skipDirty && !state.isHydratingDraft) markDirty();
    }

    function removeReceiver(email) {
        state.receivers = state.receivers.filter(function (item) {
            return item !== email;
        });
        renderReceiverTags();
        if (!state.isHydratingDraft) markDirty();
    }

    function renderReceiverTags() {
        if (!elements.receiverTags) return;

        var html = "";
        state.receivers.forEach(function (email) {
            html += '<div class="receiverTag">';
            html += '<span class="receiverTagText">' + escapeHtml(email) + '</span>';
            html += '<button type="button" class="receiverTagDelete" data-email="' + escapeHtml(email) + '"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>';
            html += '</div>';
        });

        elements.receiverTags.innerHTML = html;

        Array.prototype.slice.call(elements.receiverTags.querySelectorAll(".receiverTagDelete")).forEach(function (button) {
            button.addEventListener("click", function () {
                removeReceiver(button.getAttribute("data-email") || "");
                if (elements.receiverInput) elements.receiverInput.focus();
            });
        });
    }

    async function initLocalAutocomplete() {
        if (!elements.receiverInput) return;

        ensureAutocompleteBox();

        try {
            var nameMap = {};

            if (window.MailCommon && typeof MailCommon.getStoredContacts === "function") {
                var contacts = MailCommon.getStoredContacts() || [];
                contacts.forEach(function (item) {
                    var email = normalizeEmail(item && item.email || "");
                    var name = String(item && item.name || "").trim();
                    if (!email) return;
                    nameMap[email] = name;
                });
            }

            var data = await API.get(API_BASE + "/api/mail/sent", { page: 1, pageSize: 100 }, {
                errorMessage: "보낸메일함 불러오기 실패"
            });
            if (!data.success || !Array.isArray(data.items)) return;

            var map = {};
            data.items.forEach(function (mail) {
                String(mail.to || "").split(",").forEach(function (email) {
                    var normalized = normalizeEmail(email);
                    if (!normalized) return;
                    if (state.receivers.indexOf(normalized) > -1) return;

                    map[normalized] = {
                        name: nameMap[normalized] || "",
                        email: normalized
                    };
                });
            });

            state.autocompleteEmails = Object.keys(map).map(function (email) {
                return map[email];
            });
        } catch (e) {
            console.error("메일 자동완성 로드 실패", e);
        }
    }

    function ensureAutocompleteBox() {
        if (elements.autocompleteBox || !elements.receiverInput) return;

        var input = elements.receiverInput;
        var wrap = document.createElement("div");
        wrap.className = "receiverAutoWrap";

        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        var box = document.createElement("div");
        box.className = "receiverAutoList";
        box.style.display = "none";
        wrap.appendChild(box);

        elements.receiverAutoWrap = wrap;
        elements.autocompleteBox = box;
    }

    function buildAutocompleteLabel(item) {
        var name = String(item && item.name || "").trim();
        var email = String(item && item.email || "").trim();

        if (!email) return "";
        if (name) {
            return '<strong>' + escapeHtml(name) + '</strong> ' + escapeHtml(email);
        }
        return escapeHtml(email);
    }

    function renderAutocomplete(keyword) {
        if (!elements.autocompleteBox) return;

        var q = String(keyword || "").trim().toLowerCase();
        if (!q) {
            closeAutocomplete();
            return;
        }

        var list = state.autocompleteEmails.filter(function (item) {
            var email = String(item.email || "").toLowerCase();
            var name = String(item.name || "").toLowerCase();

            return state.receivers.indexOf(item.email) === -1 &&
                (email.indexOf(q) > -1 || name.indexOf(q) > -1);
        }).slice(0, 8);

        if (!list.length) {
            closeAutocomplete();
            return;
        }

        elements.autocompleteBox.innerHTML = list.map(function (item) {
            return ""
                + '<button type="button" class="receiverAutoItem" data-email="' + escapeHtml(item.email) + '">'
                + buildAutocompleteLabel(item)
                + '</button>';
        }).join("");

        elements.autocompleteBox.style.display = "block";

        Array.prototype.slice.call(elements.autocompleteBox.querySelectorAll(".receiverAutoItem")).forEach(function (button) {
            button.addEventListener("mousedown", function (e) {
                e.preventDefault();
                var email = button.getAttribute("data-email") || "";
                addReceiver(email);
                if (elements.receiverInput) elements.receiverInput.value = "";
                closeAutocomplete();
                if (elements.receiverInput) elements.receiverInput.focus();
            });
        });
    }

    function closeAutocomplete() {
        if (!elements.autocompleteBox) return;
        elements.autocompleteBox.innerHTML = "";
        elements.autocompleteBox.style.display = "none";
    }

    function isAutocompleteOpen() {
        return !!(
            elements.autocompleteBox &&
            elements.autocompleteBox.style.display !== "none" &&
            elements.autocompleteBox.innerHTML.trim()
        );
    }

    function addFiles(files) {
        var hasAdded = false;
        files.forEach(function (file) {
            if (state.files.length >= 10) return;
            state.files.push({
                id: "file_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
                file: file,
                checked: false
            });
            hasAdded = true;
        });
        if (hasAdded) {
            renderFileTable();
        }
    }

    function bindFileDropEvents() {
        if (!elements.fileDropZone) return;

        ["dragenter", "dragover"].forEach(function (eventName) {
            elements.fileDropZone.addEventListener(eventName, function (event) {
                if (!hasDraggedFiles(event)) return;
                event.preventDefault();
                event.stopPropagation();
                elements.fileDropZone.classList.add("is-dragover");
            });
        });

        ["dragleave", "dragend"].forEach(function (eventName) {
            elements.fileDropZone.addEventListener(eventName, function (event) {
                if (!hasDraggedFiles(event)) return;
                event.preventDefault();
                event.stopPropagation();

                if (event.relatedTarget && elements.fileDropZone.contains(event.relatedTarget)) {
                    return;
                }

                elements.fileDropZone.classList.remove("is-dragover");
            });
        });

        elements.fileDropZone.addEventListener("drop", function (event) {
            if (!hasDraggedFiles(event)) return;
            event.preventDefault();
            event.stopPropagation();
            elements.fileDropZone.classList.remove("is-dragover");

            var files = Array.prototype.slice.call(event.dataTransfer.files || []);
            if (!files.length) return;

            addFiles(files);
        });

        document.addEventListener("dragover", function (event) {
            if (!hasDraggedFiles(event)) return;
            event.preventDefault();
        });

        document.addEventListener("drop", function (event) {
            if (!hasDraggedFiles(event)) return;
            if (elements.fileDropZone && elements.fileDropZone.contains(event.target)) return;
            event.preventDefault();
            elements.fileDropZone.classList.remove("is-dragover");
        });
    }

    function hasDraggedFiles(event) {
        var types = event && event.dataTransfer && event.dataTransfer.types;
        if (!types) return false;
        return Array.prototype.indexOf.call(types, "Files") > -1;
    }

    function deleteCheckedFiles() {
        state.files = state.files.filter(function (row) { return !row.checked; });
        renderFileTable();
    }

    function renderFileTable() {
        if (!elements.fileTableBody) return;

        if (!state.files.length) {
            elements.fileTableBody.innerHTML = '<tr class="emptyFileRow"><td colspan="5">첨부된 파일이 없습니다.</td></tr>';
            if (elements.fileCount) elements.fileCount.textContent = "0";
            if (elements.fileSize) elements.fileSize.textContent = "0 KB";
            if (elements.fileAllCheck) elements.fileAllCheck.checked = false;
            return;
        }

        var totalBytes = 0;
        var html = "";

        state.files.forEach(function (row) {
            totalBytes += row.file.size || 0;
            var fileIconType = getFileIconType(row.file.name || "");
            html += '<tr data-id="' + row.id + '">'
                + '<td class="checkCol"><input type="checkbox" class="fileRowCheck" ' + (row.checked ? 'checked' : '') + '></td>'
                + '<td><div class="composeFileNameCell"><span class="composeFileIcon is-' + fileIconType + '"></span><span class="composeFileNameText">' + escapeHtml(row.file.name) + '</span></div></td>'
                + '<td class="sizeCol">' + formatBytes(row.file.size || 0) + '</td>'
                + '<td class="typeCol">일반</td>'
                + '<td class="deleteCol"><button type="button" class="fileDeleteItemBtn">삭제</button></td>'
                + '</tr>';
        });

        elements.fileTableBody.innerHTML = html;
        if (elements.fileCount) elements.fileCount.textContent = String(state.files.length);
        if (elements.fileSize) elements.fileSize.textContent = formatBytes(totalBytes);
        if (elements.fileAllCheck) {
            elements.fileAllCheck.checked = state.files.length > 0 && state.files.every(function (row) { return row.checked; });
        }

        bindFileTableEvents();
    }

    function bindFileTableEvents() {
        Array.prototype.slice.call(document.querySelectorAll(".fileRowCheck")).forEach(function (checkbox) {
            checkbox.addEventListener("change", function () {
                var row = checkbox.closest("tr");
                var id = row ? row.getAttribute("data-id") : "";
                state.files.forEach(function (fileRow) {
                    if (fileRow.id === id) fileRow.checked = checkbox.checked;
                });
                renderFileTable();
            });
        });

        Array.prototype.slice.call(document.querySelectorAll(".fileDeleteItemBtn")).forEach(function (button) {
            button.addEventListener("click", function () {
                var row = button.closest("tr");
                var id = row ? row.getAttribute("data-id") : "";
                state.files = state.files.filter(function (fileRow) {
                    return fileRow.id !== id;
                });
                renderFileTable();
            });
        });
    }

    function getFileIconType(filename) {
        var ext = String(filename || "").toLowerCase().split(".").pop();

        if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].indexOf(ext) > -1) return "image";
        if (["xls", "xlsx", "csv"].indexOf(ext) > -1) return "excel";
        if (ext === "pdf") return "pdf";
        if (["doc", "docx", "txt", "rtf", "hwp", "hwpx"].indexOf(ext) > -1) return "doc";
        if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) > -1) return "archive";
        if (["css", "js", "html", "htm", "json", "xml"].indexOf(ext) > -1) return "code";

        return "file";
    }

    function getEditorContent() {
        var html = state.editor ? state.editor.getHTML().trim() : "";
        if (!html || html === "<p></p>") html = "";
        return html;
    }

    function buildDraftPayload() {
        return {
            id: state.draftId || "",
            receiver: getReceiverValue(),
            subject: elements.subjectInput ? elements.subjectInput.value.trim() : "",
            body: buildBodyWithQuotedContent()
        };
    }

    function buildBodyWithQuotedContent() {
        var body = getEditorContent() || "<p></p>";

        if (!state.preservedQuotedHtml) {
            return body;
        }

        return body + state.preservedQuotedHtml;
    }

    function serializeDraftPayload(payload) {
        return JSON.stringify({
            receiver: payload.receiver || "",
            subject: payload.subject || "",
            body: payload.body || ""
        });
    }

    function hasDraftContent(payload) {
        return !!(
            String(payload.receiver || "").trim() ||
            String(payload.subject || "").trim() ||
            stripHtml(payload.body || "").trim()
        );
    }

    function syncLastSavedSnapshot() {
        state.lastSavedSnapshot = serializeDraftPayload(buildDraftPayload());
        state.isDirty = false;
    }

    function markDirty() {
        if (state.isHydratingDraft) return;
        state.isDirty = true;
        scheduleAutoSave();
    }

    function scheduleAutoSave() {
        clearAutoSaveTimer();
        state.autoSaveTimer = setTimeout(function () {
            persistDraft({ manual: false });
        }, AUTOSAVE_DEBOUNCE);
    }

    function clearAutoSaveTimer() {
        if (!state.autoSaveTimer) return;
        clearTimeout(state.autoSaveTimer);
        state.autoSaveTimer = null;
    }

    function startAutoSaveWatcher() {
        if (state.autoSaveIntervalId) return;
        state.autoSaveIntervalId = setInterval(function () {
            if (!state.isDirty) return;
            persistDraft({ manual: false });
        }, AUTOSAVE_INTERVAL);
    }

    function setDraftStatus(message, type) {
        if (!elements.draftStatusText) return;

        elements.draftStatusText.textContent = message || "";
        elements.draftStatusText.style.display = message ? "" : "none";

        elements.draftStatusText.classList.remove(
            "is-idle",
            "is-pending",
            "is-saving",
            "is-saved",
            "is-error"
        );

        if (type === "pending") elements.draftStatusText.classList.add("is-pending");
        else if (type === "saving") elements.draftStatusText.classList.add("is-saving");
        else if (type === "saved") elements.draftStatusText.classList.add("is-saved");
        else if (type === "error") elements.draftStatusText.classList.add("is-error");
        else elements.draftStatusText.classList.add("is-idle");
    }

    function formatSavedTime(value) {
        var date = value ? new Date(value) : new Date();
        if (isNaN(date.getTime())) date = new Date();

        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, "0");
        var day = String(date.getDate()).padStart(2, "0");
        var hour = String(date.getHours()).padStart(2, "0");
        var minute = String(date.getMinutes()).padStart(2, "0");

        return year + "." + month + "." + day + " " + hour + ":" + minute;
    }

    async function persistDraft(options) {
        var opts = options || {};
        var manual = !!opts.manual;
        var redirect = !!opts.redirect;
        var currentUser = getCurrentUserInfo();

        if (state.isSavingDraft) return false;

        var payload = buildDraftPayload();
        var snapshot = serializeDraftPayload(payload);

        if (!hasDraftContent(payload)) {
            if (manual) {
                alert("임시저장할 내용이 없습니다.");
            } else {
                setDraftStatus("", "idle");
            }
            return false;
        }

        if (!currentUser.userEmail) {
            if (manual) alert("로그인 사용자 메일주소를 확인할 수 없습니다.");
            return false;
        }

        if (!manual && snapshot === state.lastSavedSnapshot) {
            state.isDirty = false;
            return true;
        }

        state.isSavingDraft = true;
        setDraftStatus(manual ? "임시저장 중..." : "자동 저장 중...", "saving");

        try {
            var data = await API.post(API_BASE + "/api/mail/draft/save", {
                    id: payload.id,
                    receiver: payload.receiver,
                    subject: payload.subject,
                    body: payload.body,
                    savedBy: manual ? "manual" : "auto",
                    userEmail: currentUser.userEmail
                }, {
                    errorMessage: "임시저장 실패"
            });

            state.draftId = data.id || state.draftId;
            state.lastSavedSnapshot = snapshot;
            state.isDirty = false;

            var savedAt = data.updatedAt || new Date().toISOString();
            setDraftStatus("마지막 저장 " + formatSavedTime(savedAt), "saved");

            if (manual) {
                alert("임시저장되었습니다.");
                if (redirect) location.href = "/mail/draft.html";
            }

            return true;
        } catch (error) {
            console.error(error);
            setDraftStatus("자동저장 실패", "error");
            if (manual) {
                alert("임시저장 중 오류가 발생했습니다.\n" + error.message);
            }
            return false;
        } finally {
            state.isSavingDraft = false;
        }
    }

    function flushDraftOnUnload() {
        if (state.isSavingDraft || !state.isDirty) return;

        var payload = buildDraftPayload();
        var currentUser = getCurrentUserInfo();

        if (!hasDraftContent(payload)) return;
        if (!currentUser.userEmail) return;

        try {
            API.post(API_BASE + "/api/mail/draft/save", {
                    id: state.draftId || "",
                    receiver: payload.receiver,
                    subject: payload.subject,
                    body: payload.body,
                    savedBy: "auto",
                    userEmail: currentUser.userEmail
                }, {
                errorMessage: "임시저장 실패",
                keepalive: true
            });
        } catch (e) {}
    }

    function setSendButtonState(isSending) {
        if (!elements.sendBtn) return;
        elements.sendBtn.disabled = isSending;
        elements.sendBtn.textContent = isSending ? "발송 중..." : "보내기";
    }

    async function buildAttachmentPayload() {
        var rows = state.files.slice();
        var attachments = [];

        for (var i = 0; i < rows.length; i++) {
            var file = rows[i].file;
            if (!file) continue;

            var content = await readFileAsBase64(file);
            attachments.push({
                filename: file.name || ("file_" + i),
                type: file.type || "application/octet-stream",
                content: content,
                sizeBytes: Number(file.size || 0),
                sizeLabel: formatBytes(Number(file.size || 0))
            });
        }

        return attachments;
    }

    function readFileAsBase64(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                var result = String(reader.result || "");
                var base64 = result.indexOf(",") > -1 ? result.split(",")[1] : result;
                resolve(base64);
            };
            reader.onerror = function () {
                reject(new Error("파일을 읽는 중 오류가 발생했습니다."));
            };
            reader.readAsDataURL(file);
        });
    }

    function dataUrlToFile(dataUrl, name, type) {
        return fetch(String(dataUrl || "")).then(function (response) {
            return response.blob();
        }).then(function (blob) {
            return new File([blob], name || "attachment", {
                type: type || blob.type || "application/octet-stream"
            });
        });
    }

    function urlToFile(url, name, type) {
        return fetch(String(url || "")).then(function (response) {
            if (!response.ok) throw new Error("첨부파일을 불러오지 못했습니다.");
            return response.blob();
        }).then(function (blob) {
            return new File([blob], name || "attachment", {
                type: type || blob.type || "application/octet-stream"
            });
        });
    }

    async function sendMail() {
        var receiver = getReceiverValue();
        var subject = elements.subjectInput ? elements.subjectInput.value.trim() : "";
        var content = getEditorContent() || "<p></p>";
        var currentUser = getCurrentUserInfo();

        if (!receiver) {
            alert("받는사람을 입력해 주세요.");
            if (elements.receiverInput) elements.receiverInput.focus();
            return;
        }

        if (!subject) {
            alert("제목을 입력해 주세요.");
            if (elements.subjectInput) elements.subjectInput.focus();
            return;
        }

        if (!currentUser.userEmail) {
            alert("로그인 사용자 메일주소를 확인할 수 없습니다.");
            return;
        }

        setSendButtonState(true);

        try {
            var attachments = await buildAttachmentPayload();

            await API.post(API_BASE, {
                    to: receiver,
                    subject: subject,
                    content: content,
                    attachments: attachments,
                    fromEmail: currentUser.userEmail,
                    fromName: currentUser.userName
                }, {
                    errorMessage: "메일 발송 실패"
            });

            if (state.draftId) {
                try {
                    await API.post(API_BASE + "/api/mail/draft/delete", {
                            ids: [state.draftId],
                            userEmail: currentUser.userEmail
                        }, {
                            errorMessage: "임시저장 삭제 실패"
                    });
                } catch (e) {}
            }

            state.isDirty = false;
            state.lastSavedSnapshot = "";
            setDraftStatus("메일이 발송되었습니다.", "saved");

            alert("메일이 발송되었습니다.");
            location.href = "/mail/sent.html";
        } catch (error) {
            console.error(error);
            alert("메일 발송 중 오류가 발생했습니다.\n" + error.message);
        } finally {
            setSendButtonState(false);
        }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function stripHtml(html) {
        return String(html || "")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    window.ComposeAttachmentHelper = {
        buildAttachmentPayload: buildAttachmentPayload
    };
})();
