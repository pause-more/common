(function () {
    var CHAT_API_BASE = getGroupwareApiBase("/api/chat");
    var API = window.GroupwareApi;
    var CHAT_WS_BASE = "wss://autone-mail-api.autone1team.workers.dev/api/chat/ws";
    var CHAT_REACTIONS = [
        { key: "emoji_1", image: "./img/emoji_1.png", label: "오케이" },
        { key: "emoji_2", image: "./img/emoji_2.png", label: "엄지" },
        { key: "emoji_3", image: "./img/emoji_3.png", label: "하트눈" },
        { key: "emoji_4", image: "./img/emoji_4.png", label: "슬픈표정" }
    ];
    var CHAT_EMOJIS = Array.from({ length: 10 }, function (_, index) {
        var id = index + 1;
        return {
            token: "[emoticon-" + id + "]",
            image: "./img/emoticon-" + id + ".png",
            label: "이모티콘 " + id
        };
    });
    var CHAT_REACTION_STORAGE_PREFIX = "chatMessageReactions:";
    var CHAT_ROOM_PREF_STORAGE_PREFIX = "chatRoomPrefs:";
    var CHAT_FAST_CACHE_PREFIX = "chatFastCache:";
    var CHAT_LAST_TAB_STORAGE_PREFIX = "chatLastActiveTab:";
    var CHAT_PRESENCE_STORAGE_PREFIX = "chatPresenceStatus:";
    var CHAT_FAST_CACHE_MAX_AGE = 6 * 60 * 60 * 1000;
    var CHAT_COMPANY_DEFAULT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#0373ef" viewBox="0 0 256 256"><path d="M248,208H232V96a8,8,0,0,0,0-16H184V48a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16V208H24a8,8,0,0,0,0,16H248a8,8,0,0,0,0-16ZM80,72H96a8,8,0,0,1,0,16H80a8,8,0,0,1,0-16Zm-8,48a8,8,0,0,1,8-8H96a8,8,0,0,1,0,16H80A8,8,0,0,1,72,120Zm64,88H88V160h48Zm8-80H128a8,8,0,0,1,0-16h16a8,8,0,0,1,0,16Zm0-40H128a8,8,0,0,1,0-16h16a8,8,0,0,1,0,16Zm72,120H184V96h32Z"></path></svg>';
    var CHAT_REPLY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M221.66,181.66l-48,48a8,8,0,0,1-11.32-11.32L196.69,184H72a8,8,0,0,1-8-8V32a8,8,0,0,1,16,0V168H196.69l-34.35-34.34a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,221.66,181.66Z"></path></svg>';
    var CHAT_PIN_ICON = '<span class="chatPinnedIcon" aria-label="고정"><svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#fe5a12" viewBox="0 0 256 256"><path d="M136,127.42V232a8,8,0,0,1-16,0V127.42a56,56,0,1,1,16,0Z"></path></svg></span>';
    var CHAT_POLL_MAX_OPTIONS = 20;
    var page = document.querySelector("[data-chat-page]");
    if (!page) return;

    var currentUser = getCurrentUser();
    var state = {
        user: currentUser,
        rooms: [],
        contacts: [],
        activeTab: readLastActiveTab(currentUser.id),
        activeRoom: null,
        messages: [],
        messageReactions: {},
        expandedReactionMessageId: null,
        composerEmoticon: null,
        composerMentionDraftActive: false,
        composerFiles: [],
        clipboardFiles: [],
        imageViewerAttachment: null,
        pendingAttachmentShare: null,
        pendingMessageShare: null,
        selectedMessageShareTargets: [],
        replyTarget: null,
        inviteRoom: null,
        messageContextTarget: null,
        roomContextTarget: null,
        roomPrefs: loadRoomPrefs(),
        userStatus: readPresenceStatus(currentUser.id, true),
        statusMenuOpen: false,
        shareSearch: "",
        sending: false,
        search: "",
        memberSearch: "",
        selectedMemberIds: [],
        memberModalMode: "select",
        roomMembersRoom: null,
        editingRoom: null,
        groupRoomName: "",
        groupAvatarData: "",
        socket: null,
        socketReady: false,
        composing: false,
        manualSocketClose: false,
        reconnectTimer: null,
        roomRefreshTimerId: null,
        localReadRooms: {},
        pendingLeaveRoomIds: {},
        votingPollIds: {},
        renderedRoomsSignature: "",
        urlRoomOpened: false
    };
    var CHAT_LOCAL_READ_MS = 30000;
    var elements = {};

    initialize();

    function initialize() {
        if (!state.user || !state.user.id) {
            location.href = "/login.html";
            return;
        }
        cleanupLegacyFastCache();
        cacheElements();
        bindEvents();
        loadInitialData();
        startRoomRefreshTimer();
    }

    function cacheElements() {
        elements.searchInput = page.querySelector(".chatSearchInput");
        elements.titleMenu = page.querySelector(".chatTitleMenu");
        elements.titleToggle = page.querySelector(".chatTitleToggle");
        elements.titleText = page.querySelector(".chatTitleText");
        elements.titleDropdown = page.querySelector(".chatTitleDropdown");
        elements.tabs = Array.prototype.slice.call(page.querySelectorAll("[data-chat-menu-tab]"));
        elements.panels = Array.prototype.slice.call(page.querySelectorAll(".chatListPanel"));
        elements.roomList = page.querySelector(".chatRoomList");
        elements.contactList = page.querySelector(".chatContactList");
        elements.emptyState = page.querySelector(".chatEmptyState");
        elements.roomView = page.querySelector(".chatRoomView");
        elements.backButton = page.querySelector(".chatBackBtn");
        elements.roomCloseButton = page.querySelector(".chatRoomCloseBtn");
        elements.roomInviteButton = page.querySelector(".chatRoomInviteBtn");
        elements.roomAvatar = page.querySelector(".chatRoomAvatar");
        elements.roomTitle = page.querySelector(".chatRoomTitle");
        elements.roomMeta = page.querySelector(".chatRoomMeta");
        elements.roomMembersModal = document.querySelector(".chatRoomMembersModal");
        elements.roomMembersDim = document.querySelector(".chatRoomMembersDim");
        elements.roomMembersDialog = document.querySelector(".chatRoomMembersDialog");
        elements.roomMembersClose = document.querySelector(".chatRoomMembersClose");
        elements.roomMembersTitle = document.querySelector("#chatRoomMembersModalTitle");
        elements.roomMembersCount = document.querySelector(".chatRoomMembersCount");
        elements.roomMembersList = document.querySelector(".chatRoomMembersList");
        elements.messages = page.querySelector(".chatMessages");
        elements.composer = page.querySelector(".chatComposer");
        elements.composerBox = page.querySelector(".chatComposerBox");
        elements.replyPreview = page.querySelector(".chatReplyPreview");
        elements.replyPreviewMeta = page.querySelector(".chatReplyPreviewMeta");
        elements.replyPreviewText = page.querySelector(".chatReplyPreviewText");
        elements.emoticonPreview = page.querySelector(".chatComposerEmoticonPreview");
        elements.highlight = page.querySelector(".chatComposerHighlight");
        elements.input = page.querySelector(".chatComposerInput");
        elements.sendButton = page.querySelector(".chatSendBtn");
        elements.emojiButton = page.querySelector(".chatEmojiBtn");
        elements.mentionButton = page.querySelector(".chatMentionBtn");
        elements.attachButton = page.querySelector(".chatAttachBtn");
        elements.pollButton = page.querySelector(".chatPollBtn");
        elements.fileInput = page.querySelector(".chatFileInput");
        elements.fileList = page.querySelector(".chatComposerFileList");
        elements.emojiPanel = page.querySelector(".chatEmojiPanel");
        elements.mentionPanel = page.querySelector(".chatMentionPanel");
        elements.composeButton = document.querySelector(".chatComposeFab");
        elements.memberModal = document.querySelector(".chatMemberModal");
        elements.memberModalDim = document.querySelector(".chatMemberModalDim");
        elements.memberModalClose = document.querySelector(".chatMemberModalClose");
        elements.memberModalTitle = document.querySelector("#chatMemberModalTitle");
        elements.memberBackButton = document.querySelector(".chatMemberBackBtn");
        elements.memberSelectStep = document.querySelector(".chatMemberSelectStep");
        elements.groupSetupStep = document.querySelector(".chatGroupSetupStep");
        elements.groupAvatarInput = document.querySelector(".chatGroupAvatarInput");
        elements.groupAvatarPicker = document.querySelector(".chatGroupAvatarPicker");
        elements.groupAvatarPreview = document.querySelector(".chatGroupAvatarPreview");
        elements.groupNameInput = document.querySelector(".chatGroupNameInput");
        elements.groupNameCount = document.querySelector(".chatGroupNameCount");
        elements.memberSearchInput = document.querySelector(".chatMemberSearchInput");
        elements.selectedMembers = document.querySelector(".chatSelectedMembers");
        elements.memberList = document.querySelector(".chatMemberList");
        elements.memberStartButton = document.querySelector(".chatMemberStartBtn");
        elements.clipboardModal = document.querySelector(".chatClipboardModal");
        elements.clipboardDim = document.querySelector(".chatClipboardDim");
        elements.clipboardPreview = document.querySelector(".chatClipboardPreview");
        elements.clipboardInput = document.querySelector(".chatClipboardInput");
        elements.clipboardCount = document.querySelector(".chatClipboardCount");
        elements.clipboardCancel = document.querySelector(".chatClipboardCancel");
        elements.clipboardSend = document.querySelector(".chatClipboardSend");
        elements.imageViewerModal = document.querySelector(".chatImageViewerModal");
        elements.imageViewerDim = document.querySelector(".chatImageViewerDim");
        elements.imageViewerClose = document.querySelector(".chatImageViewerClose");
        elements.imageViewerStage = document.querySelector(".chatImageViewerStage");
        elements.imageViewerFileList = document.querySelector(".chatImageViewerFileList");
        elements.imageViewerAll = document.querySelector(".chatImageViewerAll");
        elements.imageViewerDownload = document.querySelector(".chatImageViewerDownload");
        elements.imageViewerShare = document.querySelector(".chatImageViewerShare");
        elements.imageViewerForward = document.querySelector(".chatImageViewerForward");
        elements.messageContextMenu = createMessageContextMenu();
        elements.roomContextMenu = createRoomContextMenu();
        elements.messageShareModal = createMessageShareModal();
        elements.messageShareDim = elements.messageShareModal ? elements.messageShareModal.querySelector(".chatMessageShareDim") : null;
        elements.messageShareSearchInput = elements.messageShareModal ? elements.messageShareModal.querySelector(".chatMessageShareSearchInput") : null;
        elements.messageShareList = elements.messageShareModal ? elements.messageShareModal.querySelector(".chatMessageShareList") : null;
        elements.messageShareCancel = elements.messageShareModal ? elements.messageShareModal.querySelector(".chatMessageShareCancel") : null;
        elements.messageShareConfirm = elements.messageShareModal ? elements.messageShareModal.querySelector(".chatMessageShareConfirm") : null;
        elements.pollModal = document.querySelector(".chatPollModal");
        elements.pollDim = document.querySelector(".chatPollDim");
        elements.pollClose = document.querySelector(".chatPollClose");
        elements.pollAuthor = document.querySelector(".chatPollAuthor");
        elements.pollTitleInput = document.querySelector(".chatPollTitleInput");
        elements.pollOptionList = document.querySelector(".chatPollOptionList");
        elements.pollAddOption = document.querySelector(".chatPollAddOption");
        elements.pollAnonymous = document.querySelector(".chatPollAnonymous");
        elements.pollMultiple = document.querySelector(".chatPollMultiple");
        elements.pollDeadlinePicker = document.querySelector(".chatPollDeadlinePicker");
        elements.pollDeadlineDate = document.querySelector(".chatPollDeadlineDate");
        elements.pollDeadlineTime = document.querySelector(".chatPollDeadlineTime");
        elements.pollDeadlineInput = document.querySelector(".chatPollDeadlineInput");
        elements.pollCreateButton = document.querySelector(".chatPollCreateBtn");
    }

    function bindEvents() {
        if (elements.searchInput) {
            elements.searchInput.addEventListener("input", function () {
                state.search = normalizeSearch(elements.searchInput.value);
                renderCurrentList();
            });
        }
        if (elements.titleToggle) {
            elements.titleToggle.addEventListener("click", function () {
                toggleChatTitleMenu();
            });
        }
        elements.tabs.forEach(function (button) {
            button.addEventListener("click", function () {
                setActiveTab(button.getAttribute("data-chat-menu-tab") || "contacts");
                closeChatTitleMenu();
            });
        });
        if (elements.backButton) {
            elements.backButton.addEventListener("click", function () {
                page.classList.remove("is-room-open");
            });
        }
        if (elements.roomCloseButton) elements.roomCloseButton.addEventListener("click", closeActiveRoom);
        if (elements.roomInviteButton) elements.roomInviteButton.addEventListener("click", openInviteMemberModal);
        if (elements.roomMeta) {
            elements.roomMeta.addEventListener("click", handleRoomMetaClick);
            elements.roomMeta.addEventListener("keydown", function (event) {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                handleRoomMetaClick();
            });
        }
        if (elements.composer) elements.composer.addEventListener("submit", handleSubmit);
        if (elements.composeButton) elements.composeButton.addEventListener("click", openMemberModal);
        window.addEventListener("groupware:chat-message", handleSharedChatMessage);
        window.addEventListener("groupware:chat-message-replace", handleSharedChatMessageReplace);
        window.addEventListener("groupware:chat-message-delete", handleSharedChatMessageDelete);
        window.addEventListener("groupware:chat-read", handleSharedChatRead);
        if (elements.memberModalDim) elements.memberModalDim.addEventListener("click", closeMemberModal);
        if (elements.memberModalClose) elements.memberModalClose.addEventListener("click", closeMemberModal);
        if (elements.memberBackButton) elements.memberBackButton.addEventListener("click", showMemberSelectStep);
        if (elements.roomMembersDim) elements.roomMembersDim.addEventListener("click", closeRoomMembersModal);
        if (elements.roomMembersClose) elements.roomMembersClose.addEventListener("click", closeRoomMembersModal);
        if (elements.clipboardDim) elements.clipboardDim.addEventListener("click", closeClipboardModal);
        if (elements.clipboardCancel) elements.clipboardCancel.addEventListener("click", closeClipboardModal);
        if (elements.clipboardSend) elements.clipboardSend.addEventListener("click", sendClipboardImages);
        if (elements.imageViewerDim) elements.imageViewerDim.addEventListener("click", closeImageViewer);
        if (elements.imageViewerClose) elements.imageViewerClose.addEventListener("click", closeImageViewer);
        if (elements.imageViewerDownload) elements.imageViewerDownload.addEventListener("click", downloadCurrentImageAttachment);
        if (elements.imageViewerShare) elements.imageViewerShare.addEventListener("click", shareCurrentImageAttachment);
        if (elements.imageViewerForward) elements.imageViewerForward.addEventListener("click", forwardCurrentImageAttachment);
        window.addEventListener("pagehide", clearActiveRoomPresence);
        window.addEventListener("beforeunload", clearActiveRoomPresence);
        if (elements.messages) {
            elements.messages.addEventListener("contextmenu", handleMessageContextMenu);
        }
        if (elements.messageContextMenu) {
            elements.messageContextMenu.addEventListener("click", handleMessageContextAction);
        }
        if (elements.roomContextMenu) {
            elements.roomContextMenu.addEventListener("click", handleRoomContextAction);
        }
        if (elements.roomList) {
            elements.roomList.addEventListener("contextmenu", handleRoomContextMenu);
        }
        if (elements.messageShareDim) elements.messageShareDim.addEventListener("click", closeMessageShareModal);
        if (elements.messageShareSearchInput) {
            elements.messageShareSearchInput.addEventListener("input", function () {
                state.shareSearch = normalizeSearch(elements.messageShareSearchInput.value);
                renderMessageShareTargets();
            });
        }
        if (elements.messageShareList) {
            elements.messageShareList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-share-target-type]");
                if (!button) return;
                toggleMessageShareTarget(button.getAttribute("data-share-target-type"), button.getAttribute("data-share-target-id"));
            });
        }
        if (elements.messageShareCancel) elements.messageShareCancel.addEventListener("click", closeMessageShareModal);
        if (elements.messageShareConfirm) elements.messageShareConfirm.addEventListener("click", sharePendingMessageToSelectedTargets);
        if (elements.imageViewerAll) elements.imageViewerAll.addEventListener("click", toggleImageViewerFileList);
        if (elements.imageViewerFileList) {
            elements.imageViewerFileList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-viewer-message-id]");
                if (!button) return;
                openImageViewer(button.getAttribute("data-viewer-message-id"), Number(button.getAttribute("data-viewer-attachment-index") || 0), true);
            });
        }
        if (elements.clipboardInput) {
            elements.clipboardInput.addEventListener("input", function () {
                updateClipboardCount();
            });
            elements.clipboardInput.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    sendClipboardImages();
                }
            });
        }
        if (elements.memberSearchInput) {
            elements.memberSearchInput.addEventListener("input", function () {
                state.memberSearch = normalizeSearch(elements.memberSearchInput.value);
                renderMemberPicker();
            });
        }
        if (elements.memberStartButton) elements.memberStartButton.addEventListener("click", startSelectedMemberChat);
        if (elements.groupAvatarPicker && elements.groupAvatarInput) {
            elements.groupAvatarPicker.addEventListener("click", function () {
                elements.groupAvatarInput.click();
            });
            elements.groupAvatarInput.addEventListener("change", handleGroupAvatarChange);
        }
        if (elements.groupNameInput) {
            elements.groupNameInput.addEventListener("input", function () {
                state.groupRoomName = String(elements.groupNameInput.value || "").trim();
                updateGroupNameCount();
                if (!state.groupAvatarData) updateGroupAvatarPreview();
            });
        }
        if (elements.selectedMembers) {
            elements.selectedMembers.addEventListener("click", function (event) {
                var button = event.target.closest("[data-remove-selected-member]");
                if (!button) return;
                event.preventDefault();
                toggleSelectedMember(button.getAttribute("data-remove-selected-member"));
            });
        }
        if (elements.input) {
            elements.input.addEventListener("compositionstart", function () {
                state.composing = true;
            });
            elements.input.addEventListener("compositionend", function () {
                state.composing = false;
                syncComposerHeight();
                syncMentionSuggestions();
                updateComposerState();
                updateComposerHighlight();
            });
            elements.input.addEventListener("keydown", function (event) {
                if (event.key === "Enter" && !event.shiftKey) {
                    if (state.composing || event.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    handleSubmit(event);
                    return;
                }
                handleMentionDeleteKey(event);
            });
            elements.input.addEventListener("keyup", expandMentionSelection);
            elements.input.addEventListener("mouseup", expandMentionSelection);
            elements.input.addEventListener("select", syncComposerSelectionState);
            elements.input.addEventListener("keyup", syncComposerSelectionState);
            elements.input.addEventListener("mouseup", syncComposerSelectionState);
            elements.input.addEventListener("touchend", syncComposerSelectionState);
            elements.input.addEventListener("blur", syncComposerSelectionState);
            elements.input.addEventListener("input", function () {
                syncComposerHeight();
                syncMentionSuggestions();
                updateComposerState();
                updateComposerHighlight();
            });
            elements.input.addEventListener("click", syncMentionSuggestions);
            elements.input.addEventListener("scroll", syncComposerHighlightScroll);
            elements.input.addEventListener("paste", handleComposerPaste);
            document.addEventListener("selectionchange", syncComposerSelectionState);
        }
        if (elements.emojiButton) elements.emojiButton.addEventListener("click", toggleEmojiPanel);
        if (elements.mentionButton) elements.mentionButton.addEventListener("click", openMentionPanel);
        if (elements.pollButton) elements.pollButton.addEventListener("click", openPollModal);
        if (elements.attachButton) elements.attachButton.addEventListener("click", function () {
            closeComposerPanels();
            if (elements.fileInput) elements.fileInput.click();
        });
        if (elements.fileInput) {
            elements.fileInput.addEventListener("change", function () {
                appendComposerFiles(elements.fileInput.files || []);
            });
        }
        if (elements.composerBox) {
            elements.composerBox.addEventListener("dragenter", handleComposerDragEnter);
            elements.composerBox.addEventListener("dragover", handleComposerDragOver);
            elements.composerBox.addEventListener("dragleave", handleComposerDragLeave);
            elements.composerBox.addEventListener("drop", handleComposerDrop);
        }
        if (elements.emojiPanel) {
            renderEmojiPanel();
            elements.emojiPanel.addEventListener("click", function (event) {
                var closeButton = event.target.closest("[data-close-chat-panel]");
                if (closeButton) {
                    closeComposerPanels();
                    return;
                }
                var button = event.target.closest("[data-chat-emoji]");
                if (!button) return;
                setComposerEmoticon(button.getAttribute("data-chat-emoji"));
                closeComposerPanels();
            });
        }
        if (elements.emoticonPreview) {
            elements.emoticonPreview.addEventListener("click", function (event) {
                var button = event.target.closest("[data-remove-chat-emoticon]");
                if (!button) return;
                state.composerEmoticon = null;
                renderComposerEmoticon();
                updateComposerState();
                if (elements.input) elements.input.focus();
            });
        }
        if (elements.mentionPanel) {
            elements.mentionPanel.addEventListener("click", function (event) {
                var closeButton = event.target.closest("[data-close-chat-panel]");
                if (closeButton) {
                    closeComposerPanels();
                    return;
                }
                var button = event.target.closest("[data-chat-mention]");
                if (!button) return;
                insertMention(button.getAttribute("data-chat-mention"));
            });
        }
        if (elements.fileList) {
            elements.fileList.addEventListener("click", function (event) {
                var button = event.target.closest("[data-remove-chat-file]");
                if (!button) return;
                state.composerFiles.splice(Number(button.getAttribute("data-remove-chat-file")), 1);
                if (elements.fileInput && !state.composerFiles.length) elements.fileInput.value = "";
                renderComposerFiles();
                updateComposerState();
            });
        }
        if (elements.pollDim) elements.pollDim.addEventListener("click", closePollModal);
        if (elements.pollClose) elements.pollClose.addEventListener("click", closePollModal);
        if (elements.pollTitleInput) elements.pollTitleInput.addEventListener("input", updatePollCreateState);
        if (elements.pollDeadlineInput) {
            elements.pollDeadlineInput.addEventListener("input", updatePollDeadlineDisplay);
            elements.pollDeadlineInput.addEventListener("change", updatePollDeadlineDisplay);
        }
        if (elements.pollDeadlineDate) elements.pollDeadlineDate.addEventListener("click", togglePollDatePicker);
        if (elements.pollDeadlineTime) elements.pollDeadlineTime.addEventListener("click", togglePollTimePicker);
        if (elements.pollAddOption) elements.pollAddOption.addEventListener("click", addPollOptionInput);
        if (elements.pollOptionList) {
            elements.pollOptionList.addEventListener("input", updatePollCreateState);
            elements.pollOptionList.addEventListener("click", function (event) {
                var button = event.target.closest(".chatPollOptionRemove");
                if (!button || button.disabled) return;
                removePollOptionInput(button);
            });
        }
        if (elements.pollCreateButton) elements.pollCreateButton.addEventListener("click", createPollMessage);
        if (elements.messages) {
            elements.messages.addEventListener("click", handlePollVoteClick);
        }
        document.addEventListener("click", function (event) {
            if (elements.titleMenu && elements.titleMenu.contains(event.target)) return;
            closeChatTitleMenu();
            if (elements.roomMembersModal && !elements.roomMembersModal.hidden && !event.target.closest(".chatRoomMembersDialog") && !event.target.closest(".chatRoomMeta")) closeRoomMembersModal();
            if (!event.target.closest(".chatSelfProfile") && !event.target.closest(".chatStatusMenu")) closeContactStatusMenu();
            if (elements.pollDeadlinePicker && elements.pollDeadlinePicker.contains(event.target)) return;
            closePollInlinePickers();
            if (elements.messageContextMenu && elements.messageContextMenu.contains(event.target)) return;
            if (elements.roomContextMenu && elements.roomContextMenu.contains(event.target)) return;
            if (!event.target.closest(".chatMessageActions")) closeExpandedMessageActions();
            hideMessageContextMenu();
            closeRoomContextMenu();
            if (elements.composer && elements.composer.contains(event.target)) return;
            closeComposerPanels();
        });
        updateComposerState();
        updateComposerHighlight();
        setActiveTab(state.activeTab);
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && elements.imageViewerModal && !elements.imageViewerModal.hidden) {
                closeImageViewer();
                return;
            }
            if (event.key === "Escape" && elements.clipboardModal && !elements.clipboardModal.hidden) {
                closeClipboardModal();
                return;
            }
            if (event.key === "Escape" && elements.messageShareModal && !elements.messageShareModal.hidden) {
                closeMessageShareModal();
                return;
            }
            if (event.key === "Escape" && elements.roomMembersModal && !elements.roomMembersModal.hidden) {
                closeRoomMembersModal();
                return;
            }
            if (event.key === "Escape") closeChatTitleMenu();
            if (event.key === "Escape") hideMessageContextMenu();
            if (event.key === "Escape") closeRoomContextMenu();
            if (event.key === "Escape") closeMemberModal();
        });
        window.addEventListener("resize", function () {
            hideMessageContextMenu();
            closeRoomContextMenu();
            positionRoomMembersPopover();
        });
        window.addEventListener("scroll", function () {
            hideMessageContextMenu();
            closeRoomContextMenu();
        }, true);
        window.addEventListener("chat:rooms-updated", handleGlobalRoomsUpdated);
        window.addEventListener("beforeunload", closeSocket);
    }

    async function loadInitialData() {
        hydrateCachedChatData();

        try {
            await loadRooms();
            if (getTotalUnreadRoomCount() > 0 && !getUrlRoomId()) {
                setActiveTab("rooms");
            }
            if (state.activeTab === "contacts") {
                await loadContacts();
                renderContacts();
            }
            if (state.activeRoom) {
                var refreshedRoom = state.rooms.find(function (room) { return room.id === state.activeRoom.id; });
                if (refreshedRoom) {
                    state.activeRoom = refreshedRoom;
                } else {
                    closeActiveRoom();
                }
            }
            renderRooms();
            if (!state.urlRoomOpened) openRoomFromUrl();
            if (state.activeTab !== "contacts") {
                scheduleLowPriority(function () {
                    loadContacts().then(function () {
                        renderContacts();
                    }).catch(function () {});
                });
            }
        } catch (error) {
            renderListError(error.message || "채팅 정보를 불러오지 못했습니다.");
        }
    }

    async function loadContacts() {
        var data = await fetchJson(CHAT_API_BASE + "/contacts?userId=" + encodeURIComponent(state.user.id));
        syncCurrentChatUser(data && data.me);
        state.contacts = (Array.isArray(data.items) ? data.items : []).map(normalizeChatContact).filter(isVisibleChatContact);
        saveFastCache("contacts", state.contacts);
    }

    async function loadRooms() {
        var data = await fetchJson(CHAT_API_BASE + "/rooms?userId=" + encodeURIComponent(state.user.id));
        state.rooms = applyLocalReadOverrides(dedupeChatRoomsForDisplay((Array.isArray(data.items) ? data.items : []).filter(function (room) {
            return isVisibleChatRoom(room) && !state.pendingLeaveRoomIds[String(room && room.id || "").trim()];
        })));
        saveFastCache("rooms", state.rooms);
        syncChatMenuUnreadBadgeFromRooms();
    }

    function refreshRoomsInBackground() {
        loadRooms().then(function () {
            renderRooms();
        }).catch(function () {});
    }

    function startRoomRefreshTimer() {
        if (state.roomRefreshTimerId) clearInterval(state.roomRefreshTimerId);
        state.roomRefreshTimerId = setInterval(function () {
            if (localStorage.getItem("isLogin") !== "true") return;
            refreshRoomsInBackground();
        }, 15000);
        window.addEventListener("focus", refreshRoomsInBackground);
        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) refreshRoomsInBackground();
        });
    }

    function hydrateCachedChatData() {
        var rooms = readFastCache("rooms");
        var contacts = readFastCache("contacts");
        var rendered = false;

        if (Array.isArray(rooms) && rooms.length) {
            state.rooms = applyLocalReadOverrides(dedupeChatRoomsForDisplay(rooms.filter(isVisibleChatRoom)));
            syncChatMenuUnreadBadgeFromRooms();
            renderRooms();
            rendered = true;
        }

        if (Array.isArray(contacts) && contacts.length) {
            state.contacts = contacts.map(normalizeChatContact).filter(isVisibleChatContact);
            renderContacts();
            rendered = true;
        }

        return rendered;
    }

    function getFastCacheKey(type) {
        return CHAT_FAST_CACHE_PREFIX + state.user.id + ":" + type;
    }

    function dedupeChatRoomsForDisplay(rooms) {
        var directRoomIndex = {};
        var dedupedRooms = [];
        (Array.isArray(rooms) ? rooms : []).forEach(function (room) {
            if (!room || room.type !== "direct") {
                dedupedRooms.push(room);
                return;
            }
            var memberKey = getDirectRoomMemberKey(room);
            var existingIndex = Object.prototype.hasOwnProperty.call(directRoomIndex, memberKey) ? directRoomIndex[memberKey] : -1;
            if (existingIndex === -1) {
                directRoomIndex[memberKey] = dedupedRooms.length;
                dedupedRooms.push(room);
                return;
            }
            var existingRoom = dedupedRooms[existingIndex];
            var existingStamp = String(existingRoom && (existingRoom.createdAt || existingRoom.updatedAt || existingRoom.lastMessageAt) || "");
            var currentStamp = String(room.createdAt || room.updatedAt || room.lastMessageAt || "");
            if (!existingStamp || currentStamp < existingStamp) dedupedRooms[existingIndex] = room;
        });
        return dedupedRooms;
    }

    function getDirectRoomMemberKey(room) {
        if (!room || room.type !== "direct") return "";
        return (Array.isArray(room.memberIds) ? room.memberIds : []).map(normalizeId).filter(Boolean).sort().join("__");
    }

    function isSameDirectRoom(left, right) {
        var leftKey = getDirectRoomMemberKey(left);
        var rightKey = getDirectRoomMemberKey(right);
        return !!leftKey && leftKey === rightKey;
    }

    function cleanupLegacyFastCache() {
        try {
            ["rooms", "contacts"].forEach(function (type) {
                localStorage.removeItem(CHAT_FAST_CACHE_PREFIX + type);
            });
        } catch (error) {}
    }

    function readFastCache(type) {
        try {
            var raw = localStorage.getItem(getFastCacheKey(type));
            var parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || Date.now() - Number(parsed.savedAt || 0) > CHAT_FAST_CACHE_MAX_AGE) return [];
            return Array.isArray(parsed.items) ? parsed.items : [];
        } catch (error) {
            return [];
        }
    }

    function saveFastCache(type, items) {
        try {
            localStorage.setItem(getFastCacheKey(type), JSON.stringify({
                savedAt: Date.now(),
                items: Array.isArray(items) ? items.slice(0, 200) : []
            }));
        } catch (error) {}
    }

    function scheduleLowPriority(callback) {
        if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(callback, { timeout: 1200 });
            return;
        }
        setTimeout(callback, 80);
    }

    function renderAllLists() {
        renderRooms();
        renderContacts();
    }

    function renderCurrentList() {
        if (state.activeTab === "contacts") renderContacts();
        else renderRooms();
    }

    function handleGlobalRoomsUpdated(event) {
        var rooms = Array.isArray(event && event.detail && event.detail.rooms) ? event.detail.rooms : [];
        if (!rooms.length) return;
        state.rooms = applyLocalReadOverrides(dedupeChatRoomsForDisplay(rooms.filter(isVisibleChatRoom)));
        if (state.activeRoom) {
            var activeRoom = state.rooms.find(function (room) {
                return room.id === state.activeRoom.id || isSameDirectRoom(room, state.activeRoom);
            });
            if (activeRoom) {
                state.activeRoom = activeRoom;
                updateRoomHeader();
                renderMessages();
            }
        }
        renderRooms();
    }

    function emitSharedChatMessage(detail) {
        if (!detail || typeof window.dispatchEvent !== "function") return;
        try {
            window.dispatchEvent(new CustomEvent("groupware:chat-message", { detail: detail }));
        } catch (error) {}
    }

    function emitSharedChatActiveRoom(roomId) {
        if (typeof window.dispatchEvent !== "function") return;
        try {
            window.dispatchEvent(new CustomEvent("groupware:chat-active-room", {
                detail: { roomId: String(roomId || "").trim(), source: "chat" }
            }));
        } catch (error) {}
    }

    function syncChatMenuUnreadBadgeFromRooms() {
        var total = getTotalUnreadRoomCount();
        if (window.ChatMenuUnread && typeof window.ChatMenuUnread.set === "function") {
            window.ChatMenuUnread.set(total);
        }
    }

    function getTotalUnreadRoomCount() {
        return state.rooms.reduce(function (sum, room) {
            return sum + Math.max(0, Number(room && room.unreadCount || 0));
        }, 0);
    }

    function renderRooms() {
        if (!elements.roomList) return;
        var rooms = state.rooms.filter(hasRoomMessages).filter(matchesRoomSearch).sort(compareRoomsForList);
        var signature = getRoomsRenderSignature(rooms);
        if (state.renderedRoomsSignature === signature) return;
        state.renderedRoomsSignature = signature;
        if (!rooms.length) {
            elements.roomList.innerHTML = '<div class="chatEmptyList">대화방이 없습니다.</div>';
            return;
        }
        elements.roomList.innerHTML = rooms.map(function (room) {
            var active = !!(state.activeRoom && (state.activeRoom.id === room.id || isSameDirectRoom(state.activeRoom, room)));
            var unread = Number(room.unreadCount || 0);
            var roomTitle = formatRoomTitle(room);
            var roomCount = getRoomMemberCount(room);
            var roomLastMessageText = formatRoomLastMessageText(room);
            var prefs = getRoomPref(room.id);
            var itemClass = "chatListItem" + (active ? " is-active" : "") + (prefs.pinned ? " is-pinned" : "") + (prefs.muted ? " is-muted" : "");
            return [
                '<button type="button" class="' + itemClass + '" data-room-id="' + escapeHtml(room.id) + '">',
                renderRoomAvatar(room, roomTitle, "chatAvatar" + (room.type === "department" || room.type === "group" ? " chatAvatar--dept" : "")),
                '<span class="chatListMain">',
                '<span class="chatListTop">' + renderRoomTitleInline(room, roomTitle, roomCount) + (prefs.pinned ? CHAT_PIN_ICON : '') + (prefs.muted ? renderMutedIcon() : '') + '</span>',
                '<span class="chatListSub">' + escapeHtml(roomLastMessageText || "메시지가 없습니다.") + '</span>',
                '</span>',
                '<span class="chatListAside">',
                '<span class="chatListTime">' + escapeHtml(formatChatTime(room.lastMessageAt || room.updatedAt)) + '</span>',
                unread ? '<span class="chatUnreadBadge">' + escapeHtml(String(Math.min(unread, 99))) + '</span>' : '',
                '</span>',
                '</button>'
            ].join("");
        }).join("");
        Array.prototype.slice.call(elements.roomList.querySelectorAll("[data-room-id]")).forEach(function (button) {
            button.addEventListener("click", function () {
                var room = state.rooms.find(function (item) { return item.id === button.getAttribute("data-room-id"); });
                if (room) openRoom(room);
            });
        });
    }

    function getRoomsRenderSignature(rooms) {
        var activeId = state.activeRoom && state.activeRoom.id || "";
        return JSON.stringify({
            activeId: activeId,
            search: state.search,
            items: (Array.isArray(rooms) ? rooms : []).map(function (room) {
                return {
                    id: room.id || "",
                    active: activeId && room.id === activeId,
                    unread: Math.max(0, Number(room.unreadCount || 0)),
                    title: formatRoomTitle(room),
                    memberCount: getRoomMemberCount(room),
                    text: formatRoomLastMessageText(room),
                    time: room.lastMessageAt || room.updatedAt || "",
                    pinned: getRoomPref(room.id).pinned === true,
                    muted: getRoomPref(room.id).muted === true,
                    type: room.type || "",
                    avatarData: room.avatarData || ""
                };
            })
        });
    }

    function compareRoomsForList(a, b) {
        var aPinned = getRoomPref(a && a.id).pinned === true;
        var bPinned = getRoomPref(b && b.id).pinned === true;
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return String(b && (b.lastMessageAt || b.updatedAt) || "").localeCompare(String(a && (a.lastMessageAt || a.updatedAt) || ""));
    }

    function renderMutedIcon() {
        return '<span class="chatListMutedIcon" aria-label="알림 끔"><svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#aeaeae" viewBox="0 0 256 256"><path d="M221.84,192v0a1.85,1.85,0,0,1-3,.28L83.27,43.19a4,4,0,0,1,.8-6A79.55,79.55,0,0,1,129.17,24C173,24.66,207.8,61.1,208,104.92c.14,34.88,8.31,61.54,13.82,71A15.89,15.89,0,0,1,221.84,192ZM160,216H96.22A8.19,8.19,0,0,0,88,223.47,8,8,0,0,0,96,232h63.74a8.19,8.19,0,0,0,8.26-7.47A8,8,0,0,0,160,216ZM53.84,34.62A8,8,0,1,0,42,45.38L58.79,63.85A79.42,79.42,0,0,0,47.93,104c0,35.09-8.15,62-13.7,71.73a16.42,16.42,0,0,0,.09,16.68A15.78,15.78,0,0,0,47.91,200H182.62l19.45,21.38a8,8,0,0,0,11.85-10.76Z"></path></svg></span>';
    }

    function renderRoomTitleInline(room, title, count) {
        return [
            isCompanyChatRoom(room) ? '<span class="chatListAllLabel">ALL</span>' : '',
            '<strong class="chatListName">' + escapeHtml(title) + '</strong>',
            count ? '<span class="chatListCount">' + escapeHtml(String(count)) + '</span>' : ''
        ].join("");
    }

    function renderContacts() {
        if (!elements.contactList) return;
        var contacts = getContactsWithSelf().filter(matchesContactSearch).sort(compareContactsForDepartmentList);
        var html = renderSelfProfile();
        if (contacts.length) {
            html += renderDepartmentContactGroups(contacts);
        } else {
            html += '<div class="chatEmptyList">표시할 멤버가 없습니다.</div>';
        }
        elements.contactList.innerHTML = html;
        Array.prototype.slice.call(elements.contactList.querySelectorAll("[data-self-profile]")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                state.statusMenuOpen = !state.statusMenuOpen;
                renderContacts();
            });
        });
        Array.prototype.slice.call(elements.contactList.querySelectorAll("[data-chat-status]")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                setOwnPresenceStatus(button.getAttribute("data-chat-status"));
            });
        });
        Array.prototype.slice.call(elements.contactList.querySelectorAll("[data-self-contact]")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                state.statusMenuOpen = !state.statusMenuOpen;
                renderContacts();
            });
        });
        Array.prototype.slice.call(elements.contactList.querySelectorAll("[data-contact-id]")).forEach(function (button) {
            button.addEventListener("click", function () {
                openDirectRoom(button.getAttribute("data-contact-id"));
            });
        });
    }

    function renderSelfProfile() {
        var name = String(state.user && state.user.name || state.user && state.user.id || "").trim() || "내 프로필";
        var status = normalizePresenceStatus(state.userStatus);
        return [
            '<div class="chatSelfProfileWrap">',
            '<button type="button" class="chatSelfProfile" data-self-profile aria-haspopup="true" aria-expanded="' + (state.statusMenuOpen ? "true" : "false") + '">',
            renderContactAvatar(state.user.id || name, name),
            '<span class="chatListMain">',
            '<span class="chatListTop"><strong class="chatListName">' + escapeHtml(name) + '</strong>' + renderSelfBadge() + renderStatusPill(status) + '</span>',
            '</span>',
            '</button>',
            state.statusMenuOpen ? renderStatusMenu(status) : '',
            '</div>'
        ].join("");
    }

    function renderDepartmentContactGroups(contacts) {
        var groups = [];
        var groupMap = {};
        contacts.forEach(function (contact) {
            var department = getContactDepartment(contact);
            if (!groupMap[department]) {
                groupMap[department] = [];
                groups.push(department);
            }
            groupMap[department].push(contact);
        });
        groups.sort(compareContactDepartments);
        return groups.map(function (department) {
            var items = groupMap[department].sort(compareContactsByName);
            return [
                '<div class="chatContactSection">',
                '<div class="chatContactSectionTitle">' + escapeHtml(department) + '<span>' + escapeHtml(String(items.length)) + '</span></div>',
                items.map(renderContactItem).join(""),
                '</div>'
            ].join("");
        }).join("");
    }

    function renderContactItem(contact) {
        var isSelf = isSelfContact(contact);
        var status = isSelf ? state.userStatus : readPresenceStatus(contact.id);
        return [
            '<button type="button" class="chatListItem chatContactItem' + (isSelf ? ' is-self' : '') + '"' + (isSelf ? ' data-self-contact' : ' data-contact-id="' + escapeHtml(contact.id) + '"') + '>',
            renderContactAvatar(contact.id || contact.name, contact.name || contact.id),
            '<span class="chatListMain">',
            '<span class="chatListTop"><strong class="chatListName">' + escapeHtml(contact.name || contact.id) + '</strong>' + (isSelf ? renderSelfBadge() : '') + renderStatusPill(status) + '</span>',
            '</span>',
            '</button>'
        ].join("");
    }

    function renderSelfBadge() {
        return '<span class="chatSelfBadge">나</span>';
    }

    function renderContactAvatar(key, name) {
        var status = normalizePresenceStatus(normalizeId(key) === normalizeId(state.user && state.user.id) ? state.userStatus : readPresenceStatus(key));
        return [
            '<span class="chatContactAvatarWrap">',
            '<span class="chatAvatar" style="' + escapeHtml(getAvatarStyle(key || name)) + '">' + escapeHtml(getInitial(name || key)) + '</span>',
            '<span class="chatStatusDot chatStatusDot--' + escapeHtml(status) + '"></span>',
            '</span>'
        ].join("");
    }

    function renderMemberPicker() {
        if (!elements.memberList) return;
        var contacts = state.contacts.filter(isInviteSelectableContact).filter(matchesMemberModalSearch).sort(compareContactsByName);
        if (!contacts.length) {
            elements.memberList.innerHTML = '<div class="chatEmptyList">표시할 멤버가 없습니다.</div>';
            return;
        }
        elements.memberList.innerHTML = contacts.map(function (contact) {
            var selected = state.selectedMemberIds.indexOf(normalizeId(contact.id)) > -1;
            return [
                '<button type="button" class="chatMemberItem' + (selected ? ' is-selected' : '') + '" data-member-id="' + escapeHtml(contact.id) + '">',
                '<span class="chatAvatar" style="' + escapeHtml(getAvatarStyle(contact.id || contact.name)) + '">' + escapeHtml(getInitial(contact.name || contact.id)) + '</span>',
                '<span class="chatMemberMain">',
                '<strong class="chatMemberName">' + escapeHtml(contact.name || contact.id) + '</strong>',
                '<span class="chatMemberMeta">' + escapeHtml(formatContactMeta(contact)) + '</span>',
                '</span>',
                state.pendingAttachmentShare ? '' : '<span class="chatMemberCheck" aria-hidden="true"><i class="xi-check"></i></span>',
                '</button>'
            ].join("");
        }).join("");
        Array.prototype.slice.call(elements.memberList.querySelectorAll("[data-member-id]")).forEach(function (button) {
            button.addEventListener("click", function () {
                if (state.pendingAttachmentShare) {
                    sendAttachmentToMember(button.getAttribute("data-member-id"));
                    return;
                }
                toggleSelectedMember(button.getAttribute("data-member-id"));
            });
        });
        updateMemberSelectionUi();
    }

    function isInviteSelectableContact(contact) {
        if (state.memberModalMode !== "invite" || !state.inviteRoom) return true;
        var id = normalizeId(contact && contact.id || "");
        if (!id) return false;
        var roomMemberIds = (Array.isArray(state.inviteRoom.memberIds) ? state.inviteRoom.memberIds : []).map(normalizeId);
        return roomMemberIds.indexOf(id) === -1;
    }

    function openMemberModal() {
        if (!elements.memberModal) return;
        ensureContactsReady();
        state.memberSearch = "";
        state.selectedMemberIds = [];
        state.memberModalMode = "select";
        state.editingRoom = null;
        state.inviteRoom = null;
        state.groupRoomName = "";
        state.groupAvatarData = "";
        if (elements.memberSearchInput) elements.memberSearchInput.value = "";
        renderMemberPicker();
        showMemberSelectStep();
        elements.memberModal.hidden = false;
        document.documentElement.classList.add("chatMemberModalOpen");
        document.body.classList.add("chatMemberModalOpen");
        if (elements.memberSearchInput) elements.memberSearchInput.focus();
    }

    function closeMemberModal() {
        if (!elements.memberModal || elements.memberModal.hidden) return;
        elements.memberModal.hidden = true;
        state.pendingAttachmentShare = null;
        state.selectedMemberIds = [];
        state.memberModalMode = "select";
        state.roomMembersRoom = null;
        if (elements.memberModal) elements.memberModal.classList.remove("is-room-members");
        state.editingRoom = null;
        state.inviteRoom = null;
        state.groupRoomName = "";
        state.groupAvatarData = "";
        updateMemberSelectionUi();
        document.documentElement.classList.remove("chatMemberModalOpen");
        document.body.classList.remove("chatMemberModalOpen");
    }

    function handleRoomMetaClick() {
        if (!state.activeRoom) return;
        if (state.activeRoom.type === "direct") return;
        if (!getRoomMemberCount(state.activeRoom)) return;
        openRoomMembersModal(state.activeRoom);
    }

    function openRoomMembersModal(room) {
        if (!room || !elements.roomMembersModal) return;
        ensureContactsReady();
        state.roomMembersRoom = room;
        renderRoomMembersList(room);
        if (elements.roomMembersTitle) elements.roomMembersTitle.textContent = formatRoomTitle(room);
        if (elements.roomMembersCount) elements.roomMembersCount.textContent = String(getRoomMemberCount(room)) + "명";
        elements.roomMembersModal.hidden = false;
        positionRoomMembersPopover();
    }

    function closeRoomMembersModal() {
        if (!elements.roomMembersModal || elements.roomMembersModal.hidden) return;
        elements.roomMembersModal.hidden = true;
        state.roomMembersRoom = null;
        if (elements.roomMembersDialog) {
            elements.roomMembersDialog.style.left = "";
            elements.roomMembersDialog.style.top = "";
            elements.roomMembersDialog.style.maxHeight = "";
        }
    }

    function positionRoomMembersPopover() {
        if (!elements.roomMembersModal || elements.roomMembersModal.hidden || !elements.roomMembersDialog || !elements.roomMeta) return;
        var anchorRect = elements.roomMeta.getBoundingClientRect();
        var dialogWidth = 240;
        var margin = 12;
        var left = Math.max(margin, Math.min(anchorRect.left, window.innerWidth - dialogWidth - margin));
        var top = Math.max(margin, anchorRect.bottom + 8);
        var maxHeight = Math.max(180, window.innerHeight - top - margin);
        elements.roomMembersDialog.style.left = left + "px";
        elements.roomMembersDialog.style.top = top + "px";
        elements.roomMembersDialog.style.maxHeight = Math.min(360, maxHeight) + "px";
    }

    function getRoomMembersForDisplay(room) {
        var memberIds = Array.from(new Set((Array.isArray(room && room.memberIds) ? room.memberIds : []).map(normalizeId).filter(Boolean)));
        var memberNames = room && room.memberNames && typeof room.memberNames === "object" ? room.memberNames : {};
        return memberIds.map(function (memberId) {
            var contact = state.contacts.find(function (item) { return normalizeId(item.id) === memberId; }) || null;
            var isSelf = memberId === normalizeId(state.user && state.user.id || "");
            var name = isSelf
                ? String(state.user && state.user.name || "").trim()
                : contact && contact.name ? String(contact.name || "").trim() : String(memberNames[memberId] || memberId || "").trim();
            return {
                id: memberId,
                name: name || memberId,
                meta: isSelf ? String(state.user && state.user.department || "").trim() : (contact ? getContactDepartment(contact) : "")
            };
        }).sort(function (a, b) {
            return String(a.name || "").localeCompare(String(b.name || ""), "ko", { sensitivity: "base" });
        });
    }

    function renderRoomMembersList(room) {
        if (!elements.roomMembersList) return;
        var members = getRoomMembersForDisplay(room);
        if (!members.length) {
            elements.roomMembersList.innerHTML = '<div class="chatEmptyList">표시할 멤버가 없습니다.</div>';
            return;
        }
        elements.roomMembersList.innerHTML = members.map(function (member) {
            var avatarText = getInitial(member.name || member.id);
            var avatarStyle = getAvatarStyle(member.id || member.name);
            return [
                '<div class="chatMemberItem is-readonly">',
                '<span class="chatAvatar" style="' + escapeHtml(avatarStyle) + '">' + escapeHtml(avatarText) + '</span>',
                '<span class="chatMemberMain">',
                '<strong class="chatMemberName">' + escapeHtml(member.name || member.id) + '</strong>',
                '<span class="chatMemberMeta">' + escapeHtml(member.meta || "") + '</span>',
                '</span>',
                '</div>'
            ].join("");
        }).join("");
    }

    function toggleSelectedMember(memberId) {
        var id = normalizeId(memberId);
        if (!id) return;
        if (state.selectedMemberIds.indexOf(id) > -1) {
            state.selectedMemberIds = state.selectedMemberIds.filter(function (item) { return item !== id; });
        } else {
            state.selectedMemberIds = state.selectedMemberIds.concat(id);
        }
        renderMemberPicker();
    }

    function updateMemberSelectionUi() {
        var count = state.pendingAttachmentShare ? 0 : state.selectedMemberIds.length;
        if (elements.memberStartButton) {
            elements.memberStartButton.disabled = state.memberModalMode === "setup" ? false : count < 1;
            elements.memberStartButton.textContent = state.memberModalMode === "setup" ? "확인" : (state.memberModalMode === "invite" ? "초대" : (count > 1 ? "다음" : "확인"));
        }
        if (elements.memberStartButton) elements.memberStartButton.hidden = !!state.pendingAttachmentShare;
        renderSelectedMemberChips();
    }

    function renderSelectedMemberChips() {
        if (!elements.selectedMembers) return;
        var selectedContacts = state.selectedMemberIds.map(function (memberId) {
            return state.contacts.find(function (contact) { return normalizeId(contact.id) === memberId; }) || { id: memberId, name: memberId };
        }).filter(Boolean);
        elements.selectedMembers.hidden = !!state.pendingAttachmentShare || !selectedContacts.length;
        elements.selectedMembers.innerHTML = selectedContacts.map(function (contact) {
            var id = normalizeId(contact.id);
            return [
                '<button type="button" class="chatSelectedMemberChip" data-remove-selected-member="' + escapeHtml(id) + '">',
                '<span>' + escapeHtml(contact.name || id) + '</span>',
                '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>',
                '</button>'
            ].join("");
        }).join("");
    }

    function showMemberSelectStep() {
        state.memberModalMode = "select";
        if (elements.memberModalTitle) elements.memberModalTitle.textContent = "멤버 선택";
        if (elements.memberBackButton) elements.memberBackButton.hidden = true;
        if (elements.memberSelectStep) elements.memberSelectStep.hidden = false;
        if (elements.groupSetupStep) elements.groupSetupStep.hidden = true;
        updateMemberSelectionUi();
        if (elements.memberSearchInput) elements.memberSearchInput.focus();
    }

    function showInviteSelectStep() {
        state.memberModalMode = "invite";
        if (elements.memberModalTitle) elements.memberModalTitle.textContent = "멤버 초대";
        if (elements.memberBackButton) elements.memberBackButton.hidden = true;
        if (elements.memberSelectStep) elements.memberSelectStep.hidden = false;
        if (elements.groupSetupStep) elements.groupSetupStep.hidden = true;
        renderMemberPicker();
        updateMemberSelectionUi();
        if (elements.memberSearchInput) elements.memberSearchInput.focus();
    }

    function openInviteMemberModal() {
        if (!canInviteToRoom(state.activeRoom) || !elements.memberModal) return;
        ensureContactsReady();
        state.pendingAttachmentShare = null;
        state.selectedMemberIds = [];
        state.memberSearch = "";
        state.editingRoom = null;
        state.inviteRoom = state.activeRoom;
        state.groupRoomName = "";
        state.groupAvatarData = "";
        if (elements.memberSearchInput) elements.memberSearchInput.value = "";
        elements.memberModal.hidden = false;
        document.documentElement.classList.add("chatMemberModalOpen");
        document.body.classList.add("chatMemberModalOpen");
        showInviteSelectStep();
    }

    function showGroupSetupStep() {
        state.memberModalMode = "setup";
        if (!state.editingRoom) {
            state.groupRoomName = "";
            state.groupAvatarData = "";
        }
        if (elements.memberModalTitle) elements.memberModalTitle.textContent = "그룹 채팅 설정";
        if (elements.memberBackButton) elements.memberBackButton.hidden = !!state.editingRoom;
        if (elements.memberSelectStep) elements.memberSelectStep.hidden = true;
        if (elements.groupSetupStep) elements.groupSetupStep.hidden = false;
        if (elements.groupNameInput) elements.groupNameInput.value = state.groupRoomName;
        if (elements.groupNameInput) elements.groupNameInput.placeholder = getGroupNamePlaceholder();
        if (elements.groupAvatarInput) elements.groupAvatarInput.value = "";
        updateGroupNameCount();
        updateGroupAvatarPreview();
        updateMemberSelectionUi();
        if (elements.groupNameInput) elements.groupNameInput.focus();
    }

    function openGroupInfoEditor(room) {
        if (!room || room.type !== "group" || !elements.memberModal) return;
        state.pendingAttachmentShare = null;
        state.selectedMemberIds = [];
        state.memberSearch = "";
        state.editingRoom = room;
        state.groupRoomName = String(room.customTitle || "").trim();
        state.groupAvatarData = String(room.avatarData || "").trim();
        if (elements.memberSearchInput) elements.memberSearchInput.value = "";
        elements.memberModal.hidden = false;
        document.documentElement.classList.add("chatMemberModalOpen");
        document.body.classList.add("chatMemberModalOpen");
        showGroupSetupStep();
    }

    function updateGroupAvatarPreview() {
        if (!elements.groupAvatarPreview) return;
        if (state.groupAvatarData) {
            elements.groupAvatarPreview.innerHTML = '<img src="' + escapeHtml(state.groupAvatarData) + '" alt="">';
            elements.groupAvatarPreview.removeAttribute("style");
            return;
        }
        elements.groupAvatarPreview.textContent = getInitial(getGroupNamePlaceholder());
        elements.groupAvatarPreview.setAttribute("style", getAvatarStyle(getGroupNamePlaceholder()));
    }

    function updateGroupNameCount() {
        if (!elements.groupNameCount) return;
        elements.groupNameCount.textContent = String(String(state.groupRoomName || "").length) + "/30";
    }

    function getGroupNamePlaceholder() {
        if (state.editingRoom) return formatRoomTitle(state.editingRoom);
        var names = state.selectedMemberIds.map(function (memberId) {
            var contact = state.contacts.find(function (item) { return normalizeId(item.id) === memberId; });
            return String(contact && contact.name || memberId || "").trim();
        }).filter(Boolean);
        return names.length ? names.join(", ") : "채팅방 이름";
    }

    function renderRoomAvatar(room, title, className) {
        var avatarData = String(room && room.avatarData || "").trim();
        var classes = className || "chatAvatar";
        if (avatarData) {
            return '<span class="' + escapeHtml(classes) + ' is-image"><img src="' + escapeHtml(avatarData) + '" alt=""></span>';
        }
        if (isCompanyChatRoom(room)) {
            return '<span class="' + escapeHtml(classes + " chatAvatar--company") + '">' + CHAT_COMPANY_DEFAULT_ICON + '</span>';
        }
        return '<span class="' + escapeHtml(classes) + '" style="' + escapeHtml(getAvatarStyle(getRoomAvatarKey(room, title))) + '">' + escapeHtml(getInitial(title)) + '</span>';
    }

    function getRoomAvatarKey(room, title) {
        if (room && room.type === "direct") {
            var otherId = (Array.isArray(room.memberIds) ? room.memberIds : []).map(normalizeId).find(function (memberId) {
                return memberId && memberId !== state.user.id;
            });
            if (otherId) return otherId;
        }
        return room && room.id || title;
    }

    function handleGroupAvatarChange() {
        var file = elements.groupAvatarInput && elements.groupAvatarInput.files && elements.groupAvatarInput.files[0];
        if (!file) return;
        if (String(file.type || "").indexOf("image/") !== 0) {
            alert("이미지 파일만 선택해주세요.");
            return;
        }
        readImageFileAsDataUrl(file).then(function (dataUrl) {
            state.groupAvatarData = dataUrl;
            updateGroupAvatarPreview();
        }).catch(function (error) {
            alert(error.message || "프로필 사진을 읽지 못했습니다.");
        });
    }

    async function startSelectedMemberChat() {
        if (state.memberModalMode === "invite") {
            inviteMembersToRoom(state.selectedMemberIds.slice());
            return;
        }
        if (state.memberModalMode === "setup") {
            if (state.editingRoom) {
                updateGroupRoomInfo();
                return;
            }
            openGroupRoom(state.selectedMemberIds.slice());
            return;
        }
        var memberIds = state.selectedMemberIds.slice();
        if (!memberIds.length) return;
        if (memberIds.length === 1) {
            openDirectRoom(memberIds[0]);
            return;
        }
        showGroupSetupStep();
    }

    async function openDirectRoom(targetUserId) {
        try {
            var data = await postJson(CHAT_API_BASE + "/rooms/direct", {
                userId: state.user.id,
                targetUserId: targetUserId
            });
            upsertRoom(data.item);
            setActiveTab("rooms");
            closeMemberModal();
            openRoom(data.item);
            refreshRoomsInBackground();
        } catch (error) {
            alert(error.message || "대화방을 만들지 못했습니다.");
        }
    }

    async function inviteMembersToRoom(memberIds) {
        if (!state.inviteRoom || !state.inviteRoom.id || !memberIds.length) return;
        try {
            var data = await postJson(CHAT_API_BASE + "/rooms/invite", {
                userId: state.user.id,
                roomId: state.inviteRoom.id,
                targetUserIds: memberIds
            });
            closeMemberModal();
            if (data.room) {
                state.activeRoom = applyLocalReadOverrides([data.room])[0] || data.room;
                upsertRoom(state.activeRoom);
                updateRoomHeader();
            }
            if (data.item) {
                handleSocketMessage(JSON.stringify({ type: "message", item: data.item, room: data.room || state.activeRoom }));
            } else if (state.activeRoom) {
                await loadMessages(state.activeRoom.id);
            }
        } catch (error) {
            alert(error.message || "멤버를 초대하지 못했습니다.");
        }
    }

    async function openGroupRoom(targetUserIds) {
        try {
            var data = await postJson(CHAT_API_BASE + "/rooms/group", {
                userId: state.user.id,
                targetUserIds: targetUserIds,
                title: state.groupRoomName,
                avatarData: state.groupAvatarData
            });
            upsertRoom(data.item);
            setActiveTab("rooms");
            closeMemberModal();
            openRoom(data.item);
            refreshRoomsInBackground();
        } catch (error) {
            alert(error.message || "그룹 채팅방을 만들지 못했습니다.");
        }
    }

    async function updateGroupRoomInfo() {
        if (!state.editingRoom || !state.editingRoom.id) return;
        try {
            var data = await postJson(CHAT_API_BASE + "/rooms/update", {
                userId: state.user.id,
                roomId: state.editingRoom.id,
                title: state.groupRoomName,
                avatarData: state.groupAvatarData
            });
            upsertRoom(data.item);
            if (state.activeRoom && state.activeRoom.id === data.item.id) {
                state.activeRoom = Object.assign({}, state.activeRoom, data.item);
                updateRoomHeader();
            }
            closeMemberModal();
        } catch (error) {
            alert(error.message || "채팅방 정보를 수정하지 못했습니다.");
        }
    }

    async function openRoom(room) {
        if (state.activeTab !== "rooms") setActiveTab("rooms");
        noteLocalRoomRead(room && room.id);
        state.activeRoom = markRoomObjectRead(room);
        state.messages = [];
        state.messageReactions = {};
        resetComposer();
        state.rooms = applyLocalReadOverrides(state.rooms);
        page.classList.add("is-room-open");
        if (elements.emptyState) elements.emptyState.style.display = "none";
        if (elements.roomView) elements.roomView.hidden = false;
        updateRoomHeader();
        renderMessages();
        renderRooms();
        updateUrlRoom(room.id);
        emitSharedChatActiveRoom(room.id);
        closeSocket();
        await loadMessages(room.id);
        emitSharedChatActiveRoom(state.activeRoom && state.activeRoom.id);
        if (state.activeRoom && state.activeRoom.id) connectSocket(state.activeRoom.id);
    }

    function closeActiveRoom() {
        closeSocket();
        state.activeRoom = null;
        state.urlRoomOpened = false;
        state.messages = [];
        state.messageReactions = {};
        resetComposer();
        page.classList.remove("is-room-open");
        if (elements.emptyState) elements.emptyState.style.display = "";
        if (elements.roomView) elements.roomView.hidden = true;
        if (elements.roomInviteButton) elements.roomInviteButton.hidden = true;
        if (elements.messages) elements.messages.innerHTML = "";
        clearUrlRoom();
        emitSharedChatActiveRoom("");
        renderRooms();
    }

    function clearActiveRoomPresence() {
        emitSharedChatActiveRoom("");
    }

    async function loadMessages(roomId) {
        try {
            var data = await fetchJson(CHAT_API_BASE + "/messages?userId=" + encodeURIComponent(state.user.id) + "&roomId=" + encodeURIComponent(roomId));
            var returnedRoomId = data && data.room ? String(data.room.id || "") : "";
            if (!state.activeRoom) return;
            if (
                state.activeRoom.id !== roomId
                && (!returnedRoomId || state.activeRoom.id !== returnedRoomId)
                && (!data.room || !isSameDirectRoom(state.activeRoom, data.room))
            ) return;
            state.messages = mergeChatMessages(Array.isArray(data.items) ? data.items : [], []);
            if (data.room) {
                var roomSummary = syncRoomSummaryFromMessages(data.room, state.messages);
                state.activeRoom = applyLocalReadOverrides([roomSummary])[0] || roomSummary;
                upsertRoom(state.activeRoom);
            }
            var effectiveRoomId = String(state.activeRoom && state.activeRoom.id || roomId);
            if (effectiveRoomId && effectiveRoomId !== roomId) updateUrlRoom(effectiveRoomId);
            emitSharedChatActiveRoom(effectiveRoomId);
            loadMessageReactions(effectiveRoomId);
            updateRoomHeader();
            renderMessages();
            markRoomRead(effectiveRoomId);
        } catch (error) {
            state.messages = [];
            renderMessages(error.message || "메시지를 불러오지 못했습니다.");
        }
    }

    function connectSocket(roomId) {
        closeSocket();
        state.manualSocketClose = false;
        var url = CHAT_WS_BASE + "?userId=" + encodeURIComponent(state.user.id) + "&roomId=" + encodeURIComponent(roomId);
        try {
            state.socket = new WebSocket(url);
        } catch (error) {
            return;
        }
        state.socket.addEventListener("open", function () {
            state.socketReady = true;
            if (state.activeRoom && state.activeRoom.id === roomId) {
                sendChatReadReceipt(roomId);
            }
        });
        state.socket.addEventListener("message", function (event) {
            handleSocketMessage(event.data, { fromActiveSocket: true });
        });
        state.socket.addEventListener("close", function () {
            state.socketReady = false;
            if (state.manualSocketClose) return;
            if (state.activeRoom && state.activeRoom.id === roomId) {
                state.reconnectTimer = setTimeout(function () { connectSocket(roomId); }, 1500);
            }
        });
        state.socket.addEventListener("error", function () {
            state.socketReady = false;
        });
    }

    function closeSocket() {
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        if (state.socket) {
            state.manualSocketClose = true;
            try { state.socket.close(); } catch (error) {}
        }
        state.socket = null;
        state.socketReady = false;
    }

    function handleSocketMessage(raw, options) {
        options = options || {};
        var payload = null;
        try {
            payload = JSON.parse(String(raw || ""));
        } catch (error) {
            return;
        }
        if (!payload || payload.type === "ready") return;
        if (payload.type === "error") {
            alert(payload.message || "채팅 오류가 발생했습니다.");
            return;
        }
        if (payload.type === "read") {
            handleSocketRead(payload);
            return;
        }
        if (payload.type !== "message" || !payload.item) return;
        var message = normalizeMessage(payload.item);
        var payloadRoom = payload.room || null;
        var payloadRoomId = payloadRoom ? String(payloadRoom.id || "") : "";
        if (
            !state.activeRoom
            || (message.roomId !== state.activeRoom.id && payloadRoomId !== state.activeRoom.id && !isSameDirectRoom(state.activeRoom, payloadRoom))
        ) return;
        emitSharedChatMessage({
            message: message,
            room: payload.room || state.activeRoom,
            source: "chat-socket"
        });
    }

    function handleSharedChatMessage(event) {
        applyIncomingChatUpdate(event && event.detail ? event.detail : {});
    }

    function handleSharedChatMessageReplace(event) {
        applyIncomingChatReplace(event && event.detail ? event.detail : {});
    }

    function handleSharedChatMessageDelete(event) {
        applyIncomingChatDelete(event && event.detail ? event.detail : {});
    }

    function handleSharedChatRead(event) {
        handleSocketRead(event && event.detail ? event.detail : {});
    }

    function applyIncomingChatDelete(detail) {
        if (!detail || typeof detail !== "object") return;
        var deletedId = String(detail.deletedId || "").trim();
        var room = detail.room && typeof detail.room === "object" ? detail.room : null;
        var roomId = String((room && room.id) || detail.roomId || "").trim();
        var activeRoomId = String(state.activeRoom && state.activeRoom.id || "").trim();
        var activeRoomMatch = !!(state.activeRoom && (roomId === activeRoomId || isSameDirectRoom(state.activeRoom, room)));
        if (!deletedId || !roomId) return;

        if (activeRoomMatch) {
            state.messages = state.messages.filter(function (item) {
                return String(item && item.id || "") !== deletedId;
            });
            if (room) {
                state.activeRoom = applyLocalReadOverrides([room])[0] || room;
                updateRoomHeader();
                upsertRoom(state.activeRoom);
            }
            renderMessages();
            return;
        }

        if (room) {
            upsertRoom(room);
            renderRooms();
            syncChatMenuUnreadBadgeFromRooms();
        }
    }

    function applyIncomingChatReplace(detail) {
        if (!detail || typeof detail !== "object") return;
        var message = detail.message && typeof detail.message === "object" ? normalizeMessage(detail.message) : null;
        var room = detail.room && typeof detail.room === "object" ? detail.room : null;
        var roomId = String((room && room.id) || (message && message.roomId) || "").trim();
        var activeRoomId = String(state.activeRoom && state.activeRoom.id || "").trim();
        var activeRoomMatch = !!(state.activeRoom && (roomId === activeRoomId || isSameDirectRoom(state.activeRoom, room)));
        if (!message || !message.id || !roomId) return;

        if (activeRoomMatch) {
            var existingIndex = state.messages.findIndex(function (item) {
                return String(item && item.id || "") === String(message.id || "");
            });
            if (existingIndex > -1) {
                state.messages[existingIndex] = message;
            } else {
                state.messages.push(message);
            }
            if (room) {
                var nextRoom = Object.assign({}, room, { unreadCount: 0 });
                state.activeRoom = applyLocalReadOverrides([nextRoom])[0] || nextRoom;
                upsertRoom(state.activeRoom);
            }
            updateRoomHeader();
            renderMessages();
            markRoomRead(roomId);
            return;
        }

        if (room) {
            upsertRoom(room);
            renderRooms();
            syncChatMenuUnreadBadgeFromRooms();
        }
    }

    function applyIncomingChatUpdate(detail) {
        if (!detail || typeof detail !== "object") return;
        var message = detail.message && typeof detail.message === "object" ? normalizeMessage(detail.message) : null;
        var room = detail.room && typeof detail.room === "object" ? detail.room : null;
        var roomId = String((room && room.id) || (message && message.roomId) || "").trim();
        var activeRoomId = String(state.activeRoom && state.activeRoom.id || "").trim();
        var currentUserId = normalizeId(state.user && state.user.id || "");
        var activeRoomMatch = !!(state.activeRoom && (roomId === activeRoomId || isSameDirectRoom(state.activeRoom, room)));
        var deletedMessage = isDeletedMessage(message);

        if (!roomId) return;

        if (room && message) {
            room = Object.assign({}, room, {
                lastMessageText: getMessageListPreview(message, room.lastMessageText),
                lastMessageAt: String(message.createdAt || room.lastMessageAt || "").trim(),
                lastSenderId: String(message.senderId || room.lastSenderId || "").trim(),
                lastSenderName: String(message.senderName || room.lastSenderName || "").trim(),
                hasHistory: true,
                unreadCount: activeRoomMatch || deletedMessage || normalizeId(message.senderId || "") === currentUserId
                    ? 0
                    : Math.max(0, Number(room.unreadCount || 0)) || 1
            });
        } else if (!room && message) {
            var existingRoom = state.rooms.find(function (item) { return item.id === roomId; }) || state.activeRoom || { id: roomId };
            room = Object.assign({}, existingRoom, {
                id: roomId,
                lastMessageText: getMessageListPreview(message, existingRoom.lastMessageText),
                lastMessageAt: String(message.createdAt || existingRoom.lastMessageAt || "").trim(),
                lastSenderId: String(message.senderId || existingRoom.lastSenderId || "").trim(),
                lastSenderName: String(message.senderName || existingRoom.lastSenderName || "").trim(),
                hasHistory: true,
                unreadCount: activeRoomMatch || deletedMessage || normalizeId(message.senderId || "") === currentUserId
                    ? 0
                    : Math.max(0, Number(existingRoom.unreadCount || 0)) + 1
            });
        }

        if (activeRoomMatch) {
            if (message && message.id) {
                removeMatchingPendingMessages(message);
                var existingIndex = state.messages.findIndex(function (item) { return item && item.id === message.id; });
                if (existingIndex > -1) {
                    state.messages[existingIndex] = message;
                } else {
                    state.messages.push(message);
                }
            }
            state.activeRoom = applyLocalReadOverrides([room])[0] || room;
            updateRoomHeader();
            renderMessages();
            upsertRoom(room);
            markRoomRead(roomId);
            return;
        }

        upsertRoom(room);
        renderRooms();
        syncChatMenuUnreadBadgeFromRooms();
    }

    function showChatSystemNotification(message, room) {
        if (!shouldShowChatSystemNotification(message)) return;
        if (!markChatNotificationMessageSeen(message.id)) {
            logDesktopNotificationDebug("chat page notification skipped: duplicate message=" + String(message && message.id || ""));
            return;
        }
        var title = buildChatNotificationTitle(message, room);
        var body = buildChatNotificationBody(message);
        var url = "/chat.html?roomId=" + encodeURIComponent(message.roomId || "");
        var options = {
            body: body,
            icon: "/img/app-icon-192.png",
            badge: "/img/app-icon-192.png",
            tag: "chat-" + String(message.roomId || ""),
            renotify: true,
            data: { url: url }
        };
        if (isDesktopNotificationBridgeAvailable()) {
            try {
                logDesktopNotificationDebug("chat page notification requested: message=" + String(message.id || "") + " room=" + String(message.roomId || ""));
                var desktopResult = window.groupwareDesktop.showNotification({
                    title: title,
                    body: body,
                    url: url,
                    tag: options.tag,
                    notificationId: String(message.id || ""),
                    type: "chat_message"
                });
                if (desktopResult && typeof desktopResult.catch === "function") {
                    desktopResult.catch(function () {});
                }
            } catch (error) {}
            return;
        }
        logDesktopNotificationDebug("chat page notification skipped: desktop bridge unavailable");
    }

    function shouldShowChatSystemNotification(message) {
        if (!message || !message.id) {
            logDesktopNotificationDebug("chat page notification skipped: missing message/id");
            return false;
        }
        if (message.senderId === state.user.id) {
            logDesktopNotificationDebug("chat page notification skipped: own message=" + String(message.id || ""));
            return false;
        }
        if (isSystemChatMessage(message)) {
            logDesktopNotificationDebug("chat page notification skipped: system message=" + String(message.id || ""));
            return false;
        }
        logDesktopNotificationDebug("chat page notification skipped: desktop bridge unavailable");
        return false;
    }

    function getChatNotificationSeenMessageKey() {
        return "autoneChatNotificationSeenMessages:" + String(state.user && state.user.id || "").trim().toLowerCase();
    }

    function markChatNotificationMessageSeen(messageId) {
        var id = String(messageId || "").trim();
        if (!id) return false;
        var key = getChatNotificationSeenMessageKey();
        var seen = {};
        try {
            var parsed = JSON.parse(localStorage.getItem(key) || "{}");
            seen = parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            seen = {};
        }
        if (seen[id]) return false;
        seen[id] = Date.now();
        var keys = Object.keys(seen).sort(function (a, b) {
            return Number(seen[b] || 0) - Number(seen[a] || 0);
        }).slice(0, 200);
        var next = {};
        keys.forEach(function (item) { next[item] = seen[item]; });
        try {
            localStorage.setItem(key, JSON.stringify(next));
        } catch (error) {}
        return true;
    }

    function isDesktopNotificationBridgeAvailable() {
        return !!(window.groupwareDesktop && typeof window.groupwareDesktop.showNotification === "function");
    }

    function logDesktopNotificationDebug(message) {
        try {
            if (window.groupwareDesktop && typeof window.groupwareDesktop.debugLog === "function") {
                window.groupwareDesktop.debugLog(message);
            }
        } catch (error) {}
    }

    function buildChatNotificationTitle(message, room) {
        var sender = String(message && (message.senderName || message.senderId) || "").trim();
        return sender || "새 채팅 메시지";
    }

    function buildChatNotificationBody(message) {
        var text = String(message && message.text || "").trim();
        if (text) return text.length > 120 ? text.slice(0, 117) + "..." : text;
        var count = Array.isArray(message && message.attachmentsData) ? message.attachmentsData.length : 0;
        return count ? "첨부파일 " + count + "개" : "새 메시지가 도착했습니다.";
    }

    function handleSocketRead(payload) {
        var roomId = String(payload && payload.roomId || payload && payload.room && payload.room.id || "").trim();
        var userId = normalizeId(payload && payload.userId || "");
        var readAt = String(payload && payload.readAt || new Date().toISOString());
        if (!roomId || !userId) return;
        state.rooms = state.rooms.map(function (room) {
            if (!room || room.id !== roomId) return room;
            return mergeRoomReadState(room, userId, readAt, payload.room);
        });
        if (state.activeRoom && state.activeRoom.id === roomId) {
            state.activeRoom = mergeRoomReadState(state.activeRoom, userId, readAt, payload.room);
            updateRoomHeader();
            renderMessages();
        }
        renderRooms();
        syncChatMenuUnreadBadgeFromRooms();
    }

    function mergeRoomReadState(room, userId, readAt, readRoom) {
        var next = Object.assign({}, room || {});
        var serverLastReadBy = readRoom && readRoom.lastReadBy && typeof readRoom.lastReadBy === "object" ? readRoom.lastReadBy : null;
        var serverUnreadBy = readRoom && readRoom.unreadBy && typeof readRoom.unreadBy === "object" ? readRoom.unreadBy : null;
        next.lastReadBy = Object.assign({}, next.lastReadBy || {}, serverLastReadBy || {});
        next.lastReadBy[userId] = readAt;
        next.unreadBy = Object.assign({}, next.unreadBy || {}, serverUnreadBy || {});
        next.unreadBy[userId] = 0;
        if (userId === state.user.id) next.unreadCount = 0;
        return next;
    }

    function appendOptimisticMessage(text, attachmentsData, poll) {
        if (!state.activeRoom || !state.user) return;
        var now = new Date().toISOString();
        var message = normalizeMessage({
            id: "chat_pending_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
            roomId: state.activeRoom.id,
            text: text,
            senderId: state.user.id,
            senderName: state.user.name || state.user.id,
            senderDepartment: state.user.department || "",
            attachmentsData: attachmentsData,
            poll: poll,
            createdAt: now,
            pending: true
        });
        state.messages.push(message);
        state.activeRoom = Object.assign({}, state.activeRoom, {
            lastMessageText: getMessageListPreview(message, state.activeRoom.lastMessageText),
            lastMessageAt: now,
            lastSenderId: state.user.id,
            lastSenderName: state.user.name || state.user.id,
            unreadCount: 0,
            hasHistory: true
        });
        upsertRoom(state.activeRoom);
        updateRoomHeader();
        renderMessages();
    }

    function removeMatchingPendingMessages(message) {
        if (!message || normalizeId(message.senderId || "") !== normalizeId(state.user && state.user.id || "")) return;
        var messageText = String(message.text || "").trim();
        var createdAt = Date.parse(String(message.createdAt || ""));
        var attachmentCount = Array.isArray(message.attachmentsData) ? message.attachmentsData.length : 0;
        var pollTitle = String(message && message.poll && message.poll.title || "").trim();
        state.messages = state.messages.filter(function (item) {
            if (!item || !item.pending || String(item.id || "").indexOf("chat_pending_") !== 0) return true;
            if (String(item.text || "").trim() !== messageText) return true;
            if ((Array.isArray(item.attachmentsData) ? item.attachmentsData.length : 0) !== attachmentCount) return true;
            if (String(item && item.poll && item.poll.title || "").trim() !== pollTitle) return true;
            var pendingAt = Date.parse(String(item.createdAt || ""));
            if (createdAt && pendingAt && Math.abs(createdAt - pendingAt) > 120000) return true;
            return false;
        });
    }

    function mergeChatMessages(baseItems, extraItems) {
        var map = {};
        var merged = [];
        function append(message) {
            message = normalizeMessage(message);
            if (!message.id || map[message.id]) return;
            map[message.id] = true;
            merged.push(message);
        }
        (Array.isArray(baseItems) ? baseItems : []).forEach(append);
        (Array.isArray(extraItems) ? extraItems : []).forEach(append);
        merged.sort(function (a, b) {
            return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        });
        return merged;
    }

    async function handleSubmit(event) {
        if (event) event.preventDefault();
        if (!state.activeRoom || !elements.input) return;
        closeComposerPanels();
        var text = String(elements.input.value || "").trim();
        if (!text && !state.composerFiles.length && !state.composerEmoticon) return;
        var messageText = buildComposerMessageText(text);
        state.sending = true;
        setSendDisabled(true);
        try {
            var attachmentsData = state.composerFiles.length ? await readComposerAttachments() : [];
            if (attachmentsData.length) {
                await sendChatMessagePayload("", attachmentsData);
                if (messageText) await sendChatMessagePayload(messageText, []);
            } else {
                await sendChatMessagePayload(messageText, []);
            }
            resetComposer();
        } catch (error) {
            alert(error.message || "메시지를 보내지 못했습니다.");
        } finally {
            state.sending = false;
            updateComposerState();
            updateComposerHighlight();
            if (elements.input) elements.input.focus();
        }
    }

    async function sendChatMessagePayload(text, attachmentsData, poll) {
        var messageText = String(text || "").trim();
        var files = Array.isArray(attachmentsData) ? attachmentsData : [];
        var pollData = normalizePollData(poll);
        if (!messageText && !files.length && !pollData) return null;
        if (state.socket && state.socketReady && state.socket.readyState === WebSocket.OPEN) {
            appendOptimisticMessage(messageText, files, pollData);
            state.socket.send(JSON.stringify({ type: "message", text: messageText, attachmentsData: files, poll: pollData }));
            return null;
        }
        var data = await postJson(CHAT_API_BASE + "/messages/send", {
            userId: state.user.id,
            roomId: state.activeRoom.id,
            text: messageText,
            attachmentsData: files,
            poll: pollData
        });
        emitSharedChatMessage({ message: data.item, room: data.room, source: "chat-rest" });
        return data;
    }

    async function handleComposerPaste(event) {
        if (!state.activeRoom || !event || !event.clipboardData) return;
        var files = Array.prototype.slice.call(event.clipboardData.items || []).map(function (item) {
            if (!item || String(item.type || "").indexOf("image/") !== 0) return null;
            var file = item.getAsFile && item.getAsFile();
            if (!file) return null;
            var extension = String(file.type || "").split("/").pop() || "png";
            return new File([file], "screenshot_" + formatPasteImageTimestamp() + "." + extension, { type: file.type || "image/png" });
        }).filter(Boolean);
        if (!files.length) return;
        event.preventDefault();
        openClipboardModal(files);
    }

    function appendComposerFiles(files) {
        var nextFiles = Array.prototype.slice.call(files || []).filter(function (file) {
            return file && typeof file.name === "string";
        });
        if (!nextFiles.length) return;
        state.composerFiles = state.composerFiles.concat(nextFiles);
        renderComposerFiles();
        updateComposerState();
        if (elements.input) elements.input.focus();
    }

    function hasDraggedFiles(event) {
        var types = event && event.dataTransfer && event.dataTransfer.types;
        return Array.prototype.slice.call(types || []).indexOf("Files") > -1;
    }

    function handleComposerDragEnter(event) {
        if (!state.activeRoom || !hasDraggedFiles(event)) return;
        event.preventDefault();
        if (elements.composerBox) elements.composerBox.classList.add("is-dragging-file");
    }

    function handleComposerDragOver(event) {
        if (!state.activeRoom || !hasDraggedFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        if (elements.composerBox) elements.composerBox.classList.add("is-dragging-file");
    }

    function handleComposerDragLeave(event) {
        if (!elements.composerBox) return;
        if (event.relatedTarget && elements.composerBox.contains(event.relatedTarget)) return;
        elements.composerBox.classList.remove("is-dragging-file");
    }

    function handleComposerDrop(event) {
        if (!state.activeRoom || !event || !event.dataTransfer) return;
        var files = Array.prototype.slice.call(event.dataTransfer.files || []);
        if (!files.length) return;
        event.preventDefault();
        if (elements.composerBox) elements.composerBox.classList.remove("is-dragging-file");
        appendComposerFiles(files);
    }

    function openClipboardModal(files) {
        if (!elements.clipboardModal || !elements.clipboardPreview) return;
        state.clipboardFiles = Array.prototype.slice.call(files || []);
        elements.clipboardPreview.innerHTML = state.clipboardFiles.map(function (file) {
            return '<img src="' + escapeHtml(URL.createObjectURL(file)) + '" alt="클립보드 이미지 미리보기">';
        }).join("");
        if (elements.clipboardInput) elements.clipboardInput.value = "";
        updateClipboardCount();
        elements.clipboardModal.hidden = false;
        document.documentElement.classList.add("chatClipboardModalOpen");
        document.body.classList.add("chatClipboardModalOpen");
        if (elements.clipboardInput) elements.clipboardInput.focus();
    }

    function closeClipboardModal() {
        if (!elements.clipboardModal) return;
        elements.clipboardModal.hidden = true;
        state.clipboardFiles = [];
        if (elements.clipboardPreview) elements.clipboardPreview.innerHTML = "";
        if (elements.clipboardInput) elements.clipboardInput.value = "";
        updateClipboardCount();
        document.documentElement.classList.remove("chatClipboardModalOpen");
        document.body.classList.remove("chatClipboardModalOpen");
    }

    function updateClipboardCount() {
        if (!elements.clipboardCount || !elements.clipboardInput) return;
        elements.clipboardCount.textContent = String(elements.clipboardInput.value.length) + "/50";
    }

    async function sendClipboardImages() {
        var files = state.clipboardFiles.slice();
        if (!state.activeRoom || state.sending) return;
        if (!files.length) {
            closeClipboardModal();
            return;
        }
        state.sending = true;
        setSendDisabled(true);
        try {
            var attachmentsData = await readFilesAsAttachments(files);
            var data = await postJson(CHAT_API_BASE + "/messages/send", {
                userId: state.user.id,
                roomId: state.activeRoom.id,
                text: "",
                attachmentsData: attachmentsData
            });
            closeClipboardModal();
            handleSocketMessage(JSON.stringify({ type: "message", item: data.item, room: data.room }));
        } catch (error) {
            alert(error.message || "캡쳐 이미지를 보내지 못했습니다.");
        } finally {
            state.sending = false;
            updateComposerState();
            if (elements.input) elements.input.focus();
        }
    }

    function renderMessages(errorMessage) {
        if (!elements.messages) return;
        if (errorMessage) {
            elements.messages.innerHTML = '<div class="chatEmptyList">' + escapeHtml(errorMessage) + '</div>';
            return;
        }
        if (!state.messages.length) {
            elements.messages.innerHTML = '<div class="chatEmptyList">아직 메시지가 없습니다.</div>';
            return;
        }
        var lastDate = "";
        var renderedSystemIntro = false;
        var renderedUserMessage = false;
        elements.messages.innerHTML = state.messages.map(function (message, index) {
            message = normalizeMessage(message);
            if (isIntroSystemMessage(message) && renderedSystemIntro) return "";
            if (isIntroSystemMessage(message) && renderedUserMessage) return "";
            var dateKey = formatDateKey(message.createdAt);
            var divider = "";
            if (dateKey && dateKey !== lastDate) {
                lastDate = dateKey;
                divider = '<div class="chatDayDivider"><span>' + escapeHtml(formatDateLabel(message.createdAt)) + '</span></div>';
            }
            if (isSystemChatMessage(message)) {
                if (isIntroSystemMessage(message)) renderedSystemIntro = true;
                return divider + renderSystemChatMessage(message);
            }
            renderedUserMessage = true;
            var previousMessage = index > 0 ? normalizeMessage(state.messages[index - 1]) : null;
            var firstInGroup = !previousMessage ||
                previousMessage.senderId !== message.senderId ||
                formatDateKey(previousMessage.createdAt) !== dateKey;
            var mine = message.senderId === state.user.id;
            var readCount = getMessageUnreadCount(message);
            var deletedMessage = isDeletedMessage(message);
            var messageText = deletedMessage ? "삭제된 메시지입니다." : String(message.text || "").trim();
            var imageOnly = isImageOnlyMessage(message);
            var visibleMessageText = imageOnly ? "" : messageText;
            var emoticonOnly = isEmoticonOnlyMessageText(visibleMessageText);
            var messageMeta = '<span class="chatMessageMeta">' +
                (readCount ? '<span class="chatMessageReadCount">' + escapeHtml(String(readCount)) + '</span>' : '') +
                '<span class="chatMessageMetaLine">' +
                '<span class="chatMessageTime">' + escapeHtml(formatMessageTime(message.createdAt)) + '</span>' +
                renderMessageActions(message) +
                '</span>' +
                '</span>';
            var reactionSummary = renderMessageReactionSummary(message);
            return divider + [
                '<div class="chatMessageRow' + (mine ? ' is-mine' : '') + '">',
                mine ? '' : '<span class="chatMessageAvatar" style="' + escapeHtml(getAvatarStyle(message.senderId || message.senderName)) + '">' + escapeHtml(getInitial(message.senderName || message.senderId)) + '</span>',
                '<div class="chatMessageBody">',
                mine ? '' : '<span class="chatMessageSender">' + escapeHtml(message.senderName || message.senderId) + '</span>',
                '<span class="chatMessageLine">',
                mine ? messageMeta : '',
                '<span class="chatBubbleWrap" data-message-id="' + escapeHtml(message.id) + '">',
                '<span class="chatBubble' + (firstInGroup ? ' is-first' : ' is-follow') + (imageOnly ? ' is-image-only' : '') + (emoticonOnly ? ' is-emoticon-only' : '') + (deletedMessage ? ' is-deleted' : '') + '">',
                visibleMessageText ? '<span class="chatBubbleText">' + (deletedMessage ? renderDeletedMessageIcon() : '') + renderChatBubbleText(visibleMessageText) + '</span>' : '',
                deletedMessage ? '' : renderMessagePoll(message),
                deletedMessage ? '' : renderMessageAttachments(message),
                reactionSummary,
                '</span>',
                '</span>',
                mine ? '' : messageMeta,
                '</span>',
                '</div>',
                '</div>'
            ].join("");
        }).join("");
        bindMessageActionButtons();
        elements.messages.scrollTop = elements.messages.scrollHeight;
    }

    function renderSystemChatMessage(message) {
        return '<div class="chatDayDivider chatSystemDivider"><span>' + escapeHtml(getSystemChatMessageText(message)) + '</span></div>';
    }

    function renderDeletedMessageIcon() {
        return '<svg class="chatDeletedIcon" xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9c9c9c" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"></path></svg>';
    }

    function getSystemChatMessageText(message) {
        var text = String(message && message.text || "").trim();
        return isInviteSystemMessage(message) && text ? text : "채팅방이 개설되었습니다.";
    }

    function isSystemChatMessage(message) {
        return isIntroSystemMessage(message) || isInviteSystemMessage(message);
    }

    function isIntroSystemMessage(message) {
        var senderId = normalizeId(message && message.senderId || "");
        var messageId = String(message && message.id || "");
        var text = String(message && message.text || "").trim();
        return messageId.indexOf("chat_intro_") === 0 || text === "채팅방이 개설되었습니다." || (senderId === "system" && !isInviteSystemMessage(message));
    }

    function isInviteSystemMessage(message) {
        var messageId = String(message && message.id || "");
        var text = String(message && message.text || "").trim();
        return messageId.indexOf("chat_invite_") === 0 || /님이 초대되었습니다\.$/.test(text) || /명.*초대되었습니다\.$/.test(text);
    }

    function renderMessageActions(message) {
        var messageId = String(message && message.id || "").trim();
        if (!messageId || isDeletedMessage(message)) return "";
        var expanded = String(state.expandedReactionMessageId || "") === messageId;
        return '<span class="chatMessageActions' + (expanded ? ' is-visible is-expanded' : '') + '" data-message-id="' + escapeHtml(messageId) + '" aria-label="메시지 작업">' +
            '<button type="button" class="chatMessageReactionToggle" data-chat-reaction-toggle="true" aria-label="' + (expanded ? '이모지 닫기' : '이모지 열기') + '">' +
            '<svg class="chatReactionToggleSmile" xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9c9c9c" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216ZM80,108a12,12,0,1,1,12,12A12,12,0,0,1,80,108Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,176,108Zm-1.07,48c-10.29,17.79-27.4,28-46.93,28s-36.63-10.2-46.92-28a8,8,0,1,1,13.84-8c7.47,12.91,19.21,20,33.08,20s25.61-7.1,33.07-20a8,8,0,0,1,13.86,8Z"></path></svg>' +
            '<svg class="chatReactionToggleClose" xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9c9c9c" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg>' +
            '</button>' +
            '<span class="chatMessageReactionList">' +
            CHAT_REACTIONS.map(function (reaction) {
                var active = isMessageReactionActive(messageId, reaction.key);
                return '<button type="button" class="chatMessageReactionBtn' + (active ? ' is-active' : '') + '" data-chat-reaction="' + escapeHtml(reaction.key) + '" data-message-id="' + escapeHtml(messageId) + '" aria-label="' + escapeHtml(reaction.label) + '"><img src="' + escapeHtml(reaction.image) + '" alt=""></button>';
            }).join("") +
            '</span>' +
            '</span>';
    }

    function renderMessageReactionSummary(message) {
        var messageId = String(message && message.id || "").trim();
        var reactions = getMessageReactionState(messageId);
        var buttons = CHAT_REACTIONS.map(function (reaction) {
            var users = reactions[reaction.key] || [];
            if (!users.length) return "";
            return '<button type="button" class="chatReactionSummaryBtn' + (isMessageReactionActive(messageId, reaction.key) ? ' is-active' : '') + '" data-chat-reaction="' + escapeHtml(reaction.key) + '" data-message-id="' + escapeHtml(messageId) + '"><img src="' + escapeHtml(reaction.image) + '" alt=""><span>' + escapeHtml(String(users.length)) + '</span></button>';
        }).filter(Boolean).join("");
        return buttons ? '<span class="chatReactionSummary">' + buttons + '</span>' : "";
    }

    function renderMessageAttachments(message) {
        var items = Array.isArray(message && message.attachmentsData) ? message.attachmentsData : [];
        if (!items.length) return "";
        return '<span class="chatAttachmentList">' + items.map(function (file, index) {
            var name = String(file && (file.filename || file.name) || ("첨부파일 " + (index + 1))).trim();
            var href = CHAT_API_BASE + "/attachment?userId=" + encodeURIComponent(state.user.id) + "&roomId=" + encodeURIComponent(message.roomId) + "&id=" + encodeURIComponent(message.id) + "&index=" + encodeURIComponent(String(index));
            if (isImageAttachment(file)) {
                var source = getAttachmentImageSource(file, href);
                return '<a class="chatAttachmentImageLink" href="' + escapeHtml(href) + '" data-chat-image-preview="' + escapeHtml(message.id) + '" data-attachment-index="' + escapeHtml(String(index)) + '"><img class="chatAttachmentImage" src="' + escapeHtml(source) + '" alt="' + escapeHtml(name) + '"></a>';
            }
            return '<a class="chatAttachmentItem" href="' + escapeHtml(href) + '" target="_blank" rel="noopener"><span>' + escapeHtml(name) + '</span></a>';
        }).join("") + '</span>';
    }

    function renderMessagePoll(message) {
        var poll = normalizePollData(message && message.poll);
        if (!poll) return "";
        var votes = poll.votes || {};
        var totalVotes = getPollTotalVotes(poll);
        var myVotes = getPollUserVotes(poll, state.user && state.user.id);
        return '<span class="chatPollCard" data-poll-message-id="' + escapeHtml(message.id) + '">' +
            '<strong class="chatPollCardTitle">' + escapeHtml(poll.title) + '</strong>' +
            '<span class="chatPollCardMeta">' + (poll.multiple ? '복수 선택' : '단일 선택') + (poll.anonymous ? ' · 익명' : '') + '</span>' +
            poll.options.map(function (option) {
                var count = (votes[option.id] || []).length;
                var selected = myVotes.indexOf(option.id) > -1;
                var percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                return '<button type="button" class="chatPollOptionBtn' + (selected ? ' is-selected' : '') + '" data-poll-option-id="' + escapeHtml(option.id) + '"' + (selected ? ' style="border-color:#707070;background:#707070;color:#fff;"' : '') + (state.votingPollIds[message.id] ? ' disabled' : '') + '>' +
                    '<span class="chatPollOptionFill" style="width:' + escapeHtml(String(percent)) + '%"></span>' +
                    '<span class="chatPollOptionText"' + (selected ? ' style="color:#fff;"' : '') + '>' + escapeHtml(option.text) + '</span>' +
                    '<span class="chatPollOptionCount"' + (selected ? ' style="color:#fff;"' : '') + '>' + escapeHtml(String(count)) + '표</span>' +
                    '</button>';
            }).join("") +
            '<span class="chatPollCardFoot">' + escapeHtml(String(totalVotes)) + '명 참여</span>' +
            '</span>';
    }

    function isImageAttachment(file) {
        var type = String(file && file.type || "").toLowerCase();
        var name = String(file && (file.filename || file.name) || "").toLowerCase();
        var content = String(file && file.content || "").trim().toLowerCase();
        return type.indexOf("image/") === 0 ||
            content.indexOf("data:image/") === 0 ||
            /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
    }

    function isImageOnlyMessage(message) {
        var text = String(message && message.text || "").trim();
        var items = Array.isArray(message && message.attachmentsData) ? message.attachmentsData : [];
        var legacyImageText = text === "캡쳐 이미지" || text === "캡처 이미지" || text === "첨부파일";
        return items.length > 0 &&
            items.every(isImageAttachment) &&
            (!text || legacyImageText);
    }

    function getAttachmentImageSource(file, fallbackHref) {
        var content = String(file && file.content || "").trim();
        if (!content) return fallbackHref;
        if (content.indexOf("data:") === 0) return content;
        return "data:" + String(file && file.type || "image/png") + ";base64," + content;
    }

    function openPollModal() {
        if (!state.activeRoom || !elements.pollModal) return;
        closeComposerPanels();
        resetPollModal();
        elements.pollModal.hidden = false;
        document.documentElement.classList.add("chatPollModalOpen");
        document.body.classList.add("chatPollModalOpen");
        if (elements.pollTitleInput) elements.pollTitleInput.focus();
    }

    function closePollModal() {
        if (!elements.pollModal || elements.pollModal.hidden) return;
        elements.pollModal.hidden = true;
        document.documentElement.classList.remove("chatPollModalOpen");
        document.body.classList.remove("chatPollModalOpen");
    }

    function resetPollModal() {
        if (elements.pollAuthor) elements.pollAuthor.textContent = String(state.user && (state.user.name || state.user.id) || "");
        if (elements.pollTitleInput) elements.pollTitleInput.value = "";
        if (elements.pollAnonymous) elements.pollAnonymous.checked = false;
        if (elements.pollMultiple) elements.pollMultiple.checked = false;
        if (elements.pollDeadlineInput) elements.pollDeadlineInput.value = getDefaultPollDeadlineValue();
        if (elements.pollOptionList) {
            elements.pollOptionList.innerHTML = "";
            addPollOptionInput();
            addPollOptionInput();
        }
        updatePollDeadlineDisplay();
        updatePollCreateState();
    }

    function addPollOptionInput() {
        if (!elements.pollOptionList) return;
        var count = elements.pollOptionList.querySelectorAll(".chatPollOptionRow").length;
        if (count >= CHAT_POLL_MAX_OPTIONS) return;
        var row = document.createElement("div");
        row.className = "chatPollOptionRow";
        row.innerHTML = '<button type="button" class="chatPollOptionRemove" aria-label="항목 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" fill="#9c9c9c" viewBox="0 0 256 256"><path d="M176,128a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,128Zm56,0A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path></svg></button><input type="text" maxlength="80">';
        elements.pollOptionList.appendChild(row);
        refreshPollOptionInputs();
        var input = row.querySelector("input");
        if (input && count >= 2) input.focus();
    }

    function removePollOptionInput(button) {
        var row = button && button.closest(".chatPollOptionRow");
        if (!row || !elements.pollOptionList) return;
        if (elements.pollOptionList.querySelectorAll(".chatPollOptionRow").length <= 2) return;
        row.parentNode.removeChild(row);
        refreshPollOptionInputs();
        updatePollCreateState();
    }

    function refreshPollOptionInputs() {
        if (!elements.pollOptionList) return;
        var rows = Array.prototype.slice.call(elements.pollOptionList.querySelectorAll(".chatPollOptionRow"));
        rows.forEach(function (row, index) {
            var input = row.querySelector("input");
            var button = row.querySelector(".chatPollOptionRemove");
            if (input) input.placeholder = String(index + 1) + ". 항목을 입력하세요";
            if (button) button.disabled = rows.length <= 2;
        });
        if (elements.pollAddOption) elements.pollAddOption.disabled = rows.length >= CHAT_POLL_MAX_OPTIONS;
    }

    function updatePollCreateState() {
        if (!elements.pollCreateButton) return;
        var title = String(elements.pollTitleInput && elements.pollTitleInput.value || "").trim();
        var options = getPollModalOptions();
        elements.pollCreateButton.disabled = !title || options.length < 2 || state.sending;
    }

    function updatePollDeadlineDisplay() {
        var parts = getPollDeadlineParts(elements.pollDeadlineInput && elements.pollDeadlineInput.value);
        if (elements.pollDeadlineDate) elements.pollDeadlineDate.textContent = parts.date;
        if (elements.pollDeadlineTime) elements.pollDeadlineTime.textContent = parts.time;
    }

    function togglePollDatePicker(event) {
        if (event) event.preventDefault();
        if (event) event.stopPropagation();
        closePollTimePicker();
        if (!elements.pollDeadlinePicker) return;
        var opened = elements.pollDeadlinePicker.querySelector(".chatPollDatePicker");
        if (opened) {
            closePollDatePicker();
            return;
        }
        openPollDatePicker();
    }

    function togglePollTimePicker(event) {
        if (event) event.preventDefault();
        if (event) event.stopPropagation();
        closePollDatePicker();
        if (!elements.pollDeadlinePicker) return;
        var opened = elements.pollDeadlinePicker.querySelector(".chatPollTimePicker");
        if (opened) {
            closePollTimePicker();
            return;
        }
        openPollTimePicker();
    }

    function openPollDatePicker() {
        var value = parsePollDeadlineValue(elements.pollDeadlineInput && elements.pollDeadlineInput.value) || new Date();
        var panel = document.createElement("div");
        panel.className = "chatPollDatePicker";
        panel.setAttribute("data-view-year", String(value.getFullYear()));
        panel.setAttribute("data-view-month", String(value.getMonth()));
        renderPollDatePicker(panel);
        panel.addEventListener("click", handlePollDatePickerClick);
        elements.pollDeadlinePicker.appendChild(panel);
    }

    function renderPollDatePicker(panel) {
        var viewYear = Number(panel.getAttribute("data-view-year"));
        var viewMonth = Number(panel.getAttribute("data-view-month"));
        var selected = parsePollDeadlineValue(elements.pollDeadlineInput && elements.pollDeadlineInput.value) || new Date();
        var first = new Date(viewYear, viewMonth, 1);
        var start = new Date(viewYear, viewMonth, 1 - first.getDay());
        var days = [];
        var selectedKey = formatPollDateKey(selected);
        for (var index = 0; index < 42; index += 1) {
            var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
            var key = formatPollDateKey(date);
            var className = "chatPollDatePickerDay";
            if (date.getDay() === 0) className += " is-sunday";
            if (date.getMonth() !== viewMonth) className += " is-outside";
            if (key === selectedKey) className += " is-selected";
            days.push('<button type="button" class="' + className + '" data-date="' + key + '">' + String(date.getDate()) + '</button>');
        }
        panel.innerHTML = '<div class="chatPollDatePickerHead">'
            + '<button type="button" class="chatPollDatePickerNav" data-action="prev-year" aria-label="이전 해">&laquo;</button>'
            + '<button type="button" class="chatPollDatePickerNav" data-action="prev-month" aria-label="이전 달">&lsaquo;</button>'
            + '<strong class="chatPollDatePickerTitle">' + String(viewYear) + "년 " + String(viewMonth + 1) + '월</strong>'
            + '<button type="button" class="chatPollDatePickerNav" data-action="next-month" aria-label="다음 달">&rsaquo;</button>'
            + '<button type="button" class="chatPollDatePickerNav" data-action="next-year" aria-label="다음 해">&raquo;</button>'
            + '</div>'
            + '<div class="chatPollDatePickerWeek"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>'
            + '<div class="chatPollDatePickerGrid">' + days.join("") + '</div>';
    }

    function handlePollDatePickerClick(event) {
        event.stopPropagation();
        var nav = event.target.closest(".chatPollDatePickerNav");
        var panel = event.currentTarget;
        if (nav) {
            var action = nav.getAttribute("data-action");
            var year = Number(panel.getAttribute("data-view-year"));
            var month = Number(panel.getAttribute("data-view-month"));
            if (action === "prev-year") year -= 1;
            if (action === "next-year") year += 1;
            if (action === "prev-month") month -= 1;
            if (action === "next-month") month += 1;
            var view = new Date(year, month, 1);
            panel.setAttribute("data-view-year", String(view.getFullYear()));
            panel.setAttribute("data-view-month", String(view.getMonth()));
            renderPollDatePicker(panel);
            return;
        }
        var day = event.target.closest(".chatPollDatePickerDay");
        if (!day) return;
        setPollDeadlineDate(day.getAttribute("data-date"));
        closePollDatePicker();
    }

    function openPollTimePicker() {
        var current = parsePollDeadlineValue(elements.pollDeadlineInput && elements.pollDeadlineInput.value) || new Date();
        var selected = pad2(current.getHours()) + ":" + pad2(current.getMinutes());
        var panel = document.createElement("div");
        panel.className = "chatPollTimePicker";
        var html = [];
        for (var hour = 0; hour < 24; hour += 1) {
            for (var minute = 0; minute < 60; minute += 30) {
                var value = pad2(hour) + ":" + pad2(minute);
                html.push('<button type="button" class="chatPollTimeOption' + (value === selected ? ' is-selected' : '') + '" data-time="' + value + '">' + formatPollTimeLabel(value) + '</button>');
            }
        }
        panel.innerHTML = html.join("");
        panel.addEventListener("click", function (event) {
            event.stopPropagation();
            var button = event.target.closest(".chatPollTimeOption");
            if (!button) return;
            setPollDeadlineTime(button.getAttribute("data-time"));
            closePollTimePicker();
        });
        elements.pollDeadlinePicker.appendChild(panel);
        var selectedButton = panel.querySelector(".chatPollTimeOption.is-selected");
        if (selectedButton) panel.scrollTop = Math.max(0, selectedButton.offsetTop - 8);
    }

    function setPollDeadlineDate(dateKey) {
        var current = parsePollDeadlineValue(elements.pollDeadlineInput && elements.pollDeadlineInput.value) || new Date();
        var parts = String(dateKey || "").split("-");
        if (parts.length !== 3) return;
        current.setFullYear(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        setPollDeadlineValue(current);
    }

    function setPollDeadlineTime(timeValue) {
        var current = parsePollDeadlineValue(elements.pollDeadlineInput && elements.pollDeadlineInput.value) || new Date();
        var parts = String(timeValue || "").split(":");
        if (parts.length < 2) return;
        current.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
        setPollDeadlineValue(current);
    }

    function setPollDeadlineValue(date) {
        if (!elements.pollDeadlineInput) return;
        elements.pollDeadlineInput.value = formatPollDeadlineInputValue(date);
        updatePollDeadlineDisplay();
    }

    function closePollInlinePickers() {
        closePollDatePicker();
        closePollTimePicker();
    }

    function closePollDatePicker() {
        if (!elements.pollDeadlinePicker) return;
        Array.prototype.slice.call(elements.pollDeadlinePicker.querySelectorAll(".chatPollDatePicker")).forEach(function (picker) {
            picker.parentNode.removeChild(picker);
        });
    }

    function closePollTimePicker() {
        if (!elements.pollDeadlinePicker) return;
        Array.prototype.slice.call(elements.pollDeadlinePicker.querySelectorAll(".chatPollTimePicker")).forEach(function (picker) {
            picker.parentNode.removeChild(picker);
        });
    }

    function getDefaultPollDeadlineValue() {
        var date = new Date();
        date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0);
        if (date.getMinutes() === 60) {
            date.setHours(date.getHours() + 1, 0, 0, 0);
        }
        return formatPollDeadlineInputValue(date);
    }

    function getPollDeadlineParts(value) {
        var raw = String(value || "").trim();
        var date = parsePollDeadlineValue(raw);
        if (!date) return { date: "-", time: "-" };
        var weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        var hour = date.getHours();
        var minute = date.getMinutes();
        var period = hour < 12 ? "오전" : "오후";
        var displayHour = hour % 12 || 12;
        return {
            date: date.getFullYear() + ". " + pad2(date.getMonth() + 1) + ". " + pad2(date.getDate()) + ". (" + weekdays[date.getDay()] + ")",
            time: period + " " + displayHour + ":" + pad2(minute)
        };
    }

    function formatPollDeadlineInputValue(date) {
        return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
    }

    function parsePollDeadlineValue(value) {
        var parts = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (!parts) return null;
        var date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]));
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatPollDateKey(date) {
        return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    }

    function formatPollTimeLabel(value) {
        var parts = String(value || "").split(":");
        var hour = Number(parts[0] || 0);
        var minute = Number(parts[1] || 0);
        var period = hour < 12 ? "오전" : "오후";
        var displayHour = hour % 12 || 12;
        return period + " " + displayHour + ":" + pad2(minute);
    }

    function pad2(value) {
        return String(value).padStart(2, "0");
    }

    function getPollModalOptions() {
        if (!elements.pollOptionList) return [];
        return Array.prototype.slice.call(elements.pollOptionList.querySelectorAll("input")).map(function (input) {
            return String(input.value || "").trim();
        }).filter(Boolean);
    }

    async function createPollMessage() {
        if (!state.activeRoom || state.sending) return;
        var poll = normalizePollData({
            title: String(elements.pollTitleInput && elements.pollTitleInput.value || "").trim(),
            options: getPollModalOptions().map(function (text, index) {
                return { id: "option_" + (index + 1), text: text };
            }),
            anonymous: !!(elements.pollAnonymous && elements.pollAnonymous.checked),
            multiple: !!(elements.pollMultiple && elements.pollMultiple.checked),
            allowAdd: false,
            autoClose: true,
            deadline: String(elements.pollDeadlineInput && elements.pollDeadlineInput.value || "").trim(),
            votes: {}
        });
        if (!poll) {
            updatePollCreateState();
            return;
        }
        state.sending = true;
        updatePollCreateState();
        try {
            await sendChatMessagePayload("", [], poll);
            closePollModal();
        } catch (error) {
            alert(error.message || "투표를 만들지 못했습니다.");
        } finally {
            state.sending = false;
            updatePollCreateState();
            updateComposerState();
        }
    }

    async function handlePollVoteClick(event) {
        var button = event.target.closest(".chatPollOptionBtn");
        if (!button || !elements.messages || !elements.messages.contains(button)) return;
        var card = button.closest(".chatPollCard");
        var messageId = card && card.getAttribute("data-poll-message-id");
        var optionId = button.getAttribute("data-poll-option-id");
        var message = state.messages.find(function (item) { return String(item && item.id || "") === String(messageId || ""); });
        var poll = normalizePollData(message && message.poll);
        if (!message || !poll || !optionId || state.votingPollIds[messageId]) return;
        var currentVotes = getPollUserVotes(poll, state.user && state.user.id);
        var nextVotes = [];
        if (poll.multiple) {
            nextVotes = currentVotes.indexOf(optionId) > -1
                ? currentVotes.filter(function (id) { return id !== optionId; })
                : currentVotes.concat(optionId);
        } else {
            nextVotes = currentVotes.length === 1 && currentVotes[0] === optionId ? [] : [optionId];
        }
        state.votingPollIds[messageId] = true;
        renderMessages();
        try {
            var data = await postJson(CHAT_API_BASE + "/messages/poll-vote", {
                userId: state.user.id,
                roomId: message.roomId,
                messageId: message.id,
                optionIds: nextVotes
            });
            if (data && data.item) {
                state.messages = mergeChatMessages(state.messages.filter(function (item) {
                    return String(item && item.id || "") !== String(data.item.id || "");
                }), [data.item]);
                if (data.room) {
                    state.activeRoom = applyLocalReadOverrides([data.room])[0] || data.room;
                    upsertRoom(state.activeRoom);
                }
            }
        } catch (error) {
            alert(error.message || "투표에 참여하지 못했습니다.");
        } finally {
            delete state.votingPollIds[messageId];
            renderMessages();
        }
    }

    function normalizePollData(value) {
        var source = value && typeof value === "object" ? value : null;
        if (!source) return null;
        var title = String(source.title || "").replace(/\s+/g, " ").trim().slice(0, 80);
        var options = (Array.isArray(source.options) ? source.options : []).map(function (option, index) {
            var text = String(option && option.text || option || "").replace(/\s+/g, " ").trim().slice(0, 80);
            if (!text) return null;
            return {
                id: String(option && option.id || "option_" + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "option_" + (index + 1),
                text: text
            };
        }).filter(Boolean).slice(0, CHAT_POLL_MAX_OPTIONS);
        if (!title || options.length < 2) return null;
        var optionIds = {};
        options.forEach(function (option) { optionIds[option.id] = true; });
        var rawVotes = source.votes && typeof source.votes === "object" ? source.votes : {};
        var votes = {};
        options.forEach(function (option) {
            votes[option.id] = Array.from(new Set((Array.isArray(rawVotes[option.id]) ? rawVotes[option.id] : []).map(normalizeId).filter(Boolean)));
        });
        return {
            title: title,
            options: options,
            anonymous: source.anonymous === true,
            multiple: source.multiple === true,
            allowAdd: source.allowAdd === true,
            autoClose: source.autoClose === true,
            deadline: String(source.deadline || "").trim(),
            votes: votes
        };
    }

    function getPollUserVotes(poll, userId) {
        userId = normalizeId(userId);
        if (!poll || !userId) return [];
        var votes = poll.votes || {};
        return poll.options.map(function (option) {
            var voters = Array.isArray(votes[option.id]) ? votes[option.id].map(normalizeId) : [];
            return voters.indexOf(userId) > -1 ? option.id : "";
        }).filter(Boolean);
    }

    function getPollTotalVotes(poll) {
        if (!poll) return 0;
        var voters = {};
        (poll.options || []).forEach(function (option) {
            (poll.votes && Array.isArray(poll.votes[option.id]) ? poll.votes[option.id] : []).forEach(function (userId) {
                userId = normalizeId(userId);
                if (userId) voters[userId] = true;
            });
        });
        return Object.keys(voters).length;
    }

    function bindMessageActionButtons() {
        if (!elements.messages) return;
        Array.prototype.slice.call(elements.messages.querySelectorAll("[data-chat-reaction-toggle]")).forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var actions = button.closest(".chatMessageActions");
                if (!actions) return;
                var messageId = actions.getAttribute("data-message-id") || "";
                holdMessageActions(actions);
                if (actions.classList.contains("is-expanded")) {
                    state.expandedReactionMessageId = null;
                    actions.classList.remove("is-expanded");
                } else {
                    state.expandedReactionMessageId = messageId;
                    closeExpandedMessageActions(actions);
                    actions.classList.add("is-expanded");
                }
            });
        });
        Array.prototype.slice.call(elements.messages.querySelectorAll("[data-chat-reaction]")).forEach(function (button) {
            button.addEventListener("click", function () {
                var actions = button.closest(".chatMessageActions");
                toggleMessageReaction(button.getAttribute("data-message-id"), button.getAttribute("data-chat-reaction"));
                state.expandedReactionMessageId = null;
                if (actions) {
                    actions.classList.remove("is-expanded");
                    scheduleMessageActionsClose(actions, 450);
                }
            });
        });
        Array.prototype.slice.call(elements.messages.querySelectorAll(".chatMessageActions")).forEach(function (actions) {
            bindMessageActionHover(actions, actions);
        });
        Array.prototype.slice.call(elements.messages.querySelectorAll(".chatBubbleWrap")).forEach(function (wrap) {
            var line = wrap.closest(".chatMessageLine");
            bindMessageActionHover(wrap, line ? line.querySelector(".chatMessageActions") : null);
        });
        Array.prototype.slice.call(elements.messages.querySelectorAll(".chatMessageMeta")).forEach(function (meta) {
            var line = meta.closest(".chatMessageLine");
            bindMessageActionHover(meta, line ? line.querySelector(".chatMessageActions") : null);
        });
        Array.prototype.slice.call(elements.messages.querySelectorAll("[data-chat-image-preview]")).forEach(function (link) {
            link.addEventListener("click", function (event) {
                event.preventDefault();
                openImageViewer(link.getAttribute("data-chat-image-preview"), Number(link.getAttribute("data-attachment-index") || 0), false);
            });
        });
    }

    function bindMessageActionHover(target, actions) {
        if (!target || !actions) return;
        target.addEventListener("mouseenter", function () {
            holdMessageActions(actions);
        });
        target.addEventListener("mouseleave", function () {
            scheduleMessageActionsClose(actions, 900);
        });
        target.addEventListener("focusin", function () {
            holdMessageActions(actions);
        });
        target.addEventListener("focusout", function () {
            scheduleMessageActionsClose(actions, 800);
        });
    }

    function holdMessageActions(actions) {
        if (!actions) return;
        if (actions._chatActionCloseTimer) {
            clearTimeout(actions._chatActionCloseTimer);
            actions._chatActionCloseTimer = null;
        }
        actions.classList.add("is-visible");
    }

    function scheduleMessageActionsClose(actions, delay) {
        if (!actions) return;
        if (actions.classList.contains("is-expanded")) {
            holdMessageActions(actions);
            return;
        }
        if (actions._chatActionCloseTimer) clearTimeout(actions._chatActionCloseTimer);
        actions._chatActionCloseTimer = setTimeout(function () {
            actions.classList.remove("is-visible");
            actions._chatActionCloseTimer = null;
        }, delay || 800);
    }

    function closeExpandedMessageActions(except) {
        if (!elements.messages) return;
        if (!except) state.expandedReactionMessageId = null;
        Array.prototype.slice.call(elements.messages.querySelectorAll(".chatMessageActions.is-expanded")).forEach(function (actions) {
            if (actions === except) return;
            if (actions._chatActionCloseTimer) {
                clearTimeout(actions._chatActionCloseTimer);
                actions._chatActionCloseTimer = null;
            }
            actions.classList.remove("is-expanded");
            actions.classList.remove("is-visible");
        });
    }

    function createMessageContextMenu() {
        var menu = document.createElement("div");
        menu.className = "chatMessageContextMenu";
        menu.hidden = true;
        menu.innerHTML = [
            '<button type="button" class="chatMessageContextBtn" data-message-context-action="reply"><span>메시지 답장</span></button>',
            '<button type="button" class="chatMessageContextBtn" data-message-context-action="share"><span>메시지 공유</span></button>',
            '<button type="button" class="chatMessageContextBtn" data-message-context-action="copy"><span>메시지 복사</span></button>',
            '<button type="button" class="chatMessageContextBtn danger" data-message-context-action="delete"><span>메시지 삭제</span></button>'
        ].join("");
        document.body.appendChild(menu);
        return menu;
    }

    function createRoomContextMenu() {
        var menu = document.createElement("div");
        menu.className = "chatRoomContextMenu";
        menu.hidden = true;
        menu.innerHTML = [
            '<button type="button" class="chatRoomContextBtn" data-room-context-action="open"><span>채팅방 열기</span></button>',
            '<button type="button" class="chatRoomContextBtn" data-room-context-action="read"><span>읽음 처리</span></button>',
            '<button type="button" class="chatRoomContextBtn" data-room-context-action="mute"><span>알림 끄기</span></button>',
            '<button type="button" class="chatRoomContextBtn" data-room-context-action="pin"><span>채팅방 상단 고정</span></button>',
            '<button type="button" class="chatRoomContextBtn" data-room-context-action="edit"><span>채팅방 정보 수정</span></button>',
            '<button type="button" class="chatRoomContextBtn danger" data-room-context-action="leave"><span>채팅방 나가기</span></button>'
        ].join("");
        document.body.appendChild(menu);
        return menu;
    }

    function shouldHideRoomEditAndLeaveMenu(room) {
        if (!room) return false;
        var roomId = String(room.id || "").trim();
        if (roomId === "chat_company_all" || roomId.indexOf("chat_company_all") > -1) return true;
        if (roomId.indexOf("chat_department_") === 0) return true;
        if (room.type === "department") return true;
        if (String(room.department || "").trim()) return true;

        var userDepartment = String(state.user && state.user.department || "").trim();
        var departmentNames = getKnownChatDepartmentNames();
        var titleValues = [
            room.title,
            room.customTitle,
            formatRoomTitle(room)
        ];
        return titleValues.some(function (value) {
            var title = String(value || "").replace(/\s*채팅방\s*$/, "").trim();
            if (!title) return false;
            if (title === "오토원" || title === "전직원" || title === "전체" || title === "오토원 전사") return true;
            if (departmentNames.indexOf(title) > -1) return true;
            return !!userDepartment && title === userDepartment;
        });
    }

    function getKnownChatDepartmentNames() {
        var names = [];
        function append(value) {
            var text = String(value || "").trim();
            if (!text || text === "부서 미지정" || text === "대표") return;
            if (names.indexOf(text) === -1) names.push(text);
        }
        append(state.user && state.user.department);
        state.contacts.forEach(function (contact) {
            append(contact && contact.department);
        });
        return names;
    }

    function setRoomContextButtonHidden(button, hidden) {
        if (!button) return;
        button.hidden = !!hidden;
        button.style.display = hidden ? "none" : "";
    }

    function createMessageShareModal() {
        var modal = document.createElement("div");
        modal.className = "chatMessageShareModal";
        modal.hidden = true;
        modal.innerHTML = [
            '<div class="chatMessageShareDim"></div>',
            '<div class="chatMessageShareDialog" role="dialog" aria-modal="true" aria-label="메시지 공유 선택">',
            '<div class="chatMessageShareHead">',
            '<strong>메시지 공유 선택</strong>',
            '</div>',
            '<div class="chatMessageShareBody">',
            '<div class="chatMessageShareSearchField"><i class="xi-search"></i><input type="search" class="chatMessageShareSearchInput" placeholder="채팅방 또는 멤버 검색"></div>',
            '<div class="chatMessageShareList"></div>',
            '</div>',
            '<div class="chatMessageShareFoot">',
            '<button type="button" class="chatMessageShareCancel">취소</button>',
            '<button type="button" class="chatMessageShareConfirm" disabled>확인</button>',
            '</div>',
            '</div>'
        ].join("");
        document.body.appendChild(modal);
        return modal;
    }

    function handleMessageContextMenu(event) {
        var target = event.target.closest("[data-message-id]");
        if (!target) return;
        var messageId = target.getAttribute("data-message-id");
        var message = findMessageById(messageId);
        if (!message) return;
        if (isDeletedMessage(message)) return;
        event.preventDefault();
        state.messageContextTarget = message;
        showMessageContextMenu(event.clientX, event.clientY, message);
    }

    function showMessageContextMenu(x, y, message) {
        if (!elements.messageContextMenu) return;
        var deleteButton = elements.messageContextMenu.querySelector('[data-message-context-action="delete"]');
        if (deleteButton) deleteButton.hidden = !(message && message.senderId === state.user.id);
        elements.messageContextMenu.hidden = false;
        elements.messageContextMenu.style.left = "0px";
        elements.messageContextMenu.style.top = "0px";
        var rect = elements.messageContextMenu.getBoundingClientRect();
        var left = Math.min(Math.max(8, x), window.innerWidth - rect.width - 8);
        var top = Math.min(Math.max(8, y), window.innerHeight - rect.height - 8);
        elements.messageContextMenu.style.left = left + "px";
        elements.messageContextMenu.style.top = top + "px";
    }

    function hideMessageContextMenu() {
        if (!elements.messageContextMenu) return;
        elements.messageContextMenu.hidden = true;
        state.messageContextTarget = null;
    }

    function handleRoomContextMenu(event) {
        var target = event.target.closest("[data-room-id]");
        if (!target) return;
        var roomId = target.getAttribute("data-room-id");
        var room = state.rooms.find(function (item) { return item.id === roomId; });
        if (!room) return;
        event.preventDefault();
        state.roomContextTarget = room;
        showRoomContextMenu(event.clientX, event.clientY, room);
    }

    function showRoomContextMenu(x, y, room) {
        if (!elements.roomContextMenu) return;
        var prefs = getRoomPref(room && room.id);
        var muteButton = elements.roomContextMenu.querySelector('[data-room-context-action="mute"] span');
        var pinButton = elements.roomContextMenu.querySelector('[data-room-context-action="pin"] span');
        var editButton = elements.roomContextMenu.querySelector('[data-room-context-action="edit"]');
        var leaveButton = elements.roomContextMenu.querySelector('[data-room-context-action="leave"]');
        var hideEditAndLeave = shouldHideRoomEditAndLeaveMenu(room);
        if (muteButton) muteButton.textContent = prefs.muted ? "알림 켜기" : "알림 끄기";
        if (pinButton) pinButton.textContent = prefs.pinned ? "채팅방 상단 고정 해제" : "채팅방 상단 고정";
        setRoomContextButtonHidden(editButton, hideEditAndLeave || !(room && room.type === "group"));
        setRoomContextButtonHidden(leaveButton, hideEditAndLeave);
        elements.roomContextMenu.hidden = false;
        elements.roomContextMenu.style.left = "0px";
        elements.roomContextMenu.style.top = "0px";
        var rect = elements.roomContextMenu.getBoundingClientRect();
        var left = Math.min(Math.max(8, x), window.innerWidth - rect.width - 8);
        var top = Math.min(Math.max(8, y), window.innerHeight - rect.height - 8);
        elements.roomContextMenu.style.left = left + "px";
        elements.roomContextMenu.style.top = top + "px";
    }

    function closeRoomContextMenu() {
        if (!elements.roomContextMenu) return;
        elements.roomContextMenu.hidden = true;
        state.roomContextTarget = null;
    }

    function handleRoomContextAction(event) {
        var button = event.target.closest("[data-room-context-action]");
        if (!button || !state.roomContextTarget) return;
        var action = button.getAttribute("data-room-context-action");
        var room = state.roomContextTarget;
        closeRoomContextMenu();
        if ((action === "edit" || action === "leave") && shouldHideRoomEditAndLeaveMenu(room)) return;
        if (action === "open") {
            openRoom(room);
            return;
        }
        if (action === "read") {
            markRoomRead(room.id);
            applyRoomReadInList(room.id);
            return;
        }
        if (action === "mute") {
            toggleRoomPref(room.id, "muted");
            return;
        }
        if (action === "pin") {
            toggleRoomPref(room.id, "pinned");
            return;
        }
        if (action === "edit") {
            openGroupInfoEditor(room);
            return;
        }
        if (action === "leave") {
            leaveRoom(room);
        }
    }

    function handleMessageContextAction(event) {
        var button = event.target.closest("[data-message-context-action]");
        if (!button || !state.messageContextTarget) return;
        var action = button.getAttribute("data-message-context-action");
        var message = state.messageContextTarget;
        hideMessageContextMenu();
        if (action === "reply") {
            replyToMessage(message.id);
            return;
        }
        if (action === "share") {
            openMessageShareModal(message);
            return;
        }
        if (action === "copy") {
            copyMessageText(message);
            return;
        }
        if (action === "delete") deleteMessage(message);
    }

    async function copyMessageText(message) {
        var text = String(message && message.text || "").trim();
        if (!text) {
            alert("복사할 메시지 내용이 없습니다.");
            return;
        }
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                await navigator.clipboard.writeText(text);
            } else {
                fallbackCopyText(text);
            }
            alert("메시지를 복사했습니다.");
        } catch (error) {
            try {
                fallbackCopyText(text);
                alert("메시지를 복사했습니다.");
            } catch (fallbackError) {
                alert("메시지를 복사하지 못했습니다.");
            }
        }
    }

    function fallbackCopyText(text) {
        var textarea = document.createElement("textarea");
        textarea.value = String(text || "");
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    }

    function openMessageShareModal(message) {
        if (!message || !elements.messageShareModal) return;
        state.pendingMessageShare = cloneMessageForShare(message);
        state.selectedMessageShareTargets = [];
        state.shareSearch = "";
        if (elements.messageShareSearchInput) elements.messageShareSearchInput.value = "";
        renderMessageShareTargets();
        updateMessageShareConfirmState();
        ensureMessageShareContactsReady();
        elements.messageShareModal.hidden = false;
        document.documentElement.classList.add("chatMessageShareModalOpen");
        document.body.classList.add("chatMessageShareModalOpen");
        if (elements.messageShareSearchInput) elements.messageShareSearchInput.focus();
    }

    function closeMessageShareModal() {
        if (!elements.messageShareModal || elements.messageShareModal.hidden) return;
        elements.messageShareModal.hidden = true;
        state.pendingMessageShare = null;
        state.selectedMessageShareTargets = [];
        document.documentElement.classList.remove("chatMessageShareModalOpen");
        document.body.classList.remove("chatMessageShareModalOpen");
    }

    function ensureMessageShareContactsReady() {
        if (state.contacts.length) return;
        loadContacts().then(function () {
            if (elements.messageShareModal && !elements.messageShareModal.hidden) renderMessageShareTargets();
        }).catch(function () {});
    }

    function renderMessageShareTargets() {
        if (!elements.messageShareList) return;
        var query = state.shareSearch;
        var rooms = state.rooms.filter(hasRoomMessages).filter(function (room) {
            if (state.activeRoom && room.id === state.activeRoom.id) return false;
            return !query || normalizeSearch(formatRoomTitle(room) + " " + (room.lastMessageText || "")).indexOf(query) > -1;
        });
        var contacts = state.contacts.filter(function (contact) {
            return !query || normalizeSearch((contact.name || "") + " " + (contact.id || "") + " " + formatContactMeta(contact)).indexOf(query) > -1;
        });
        var html = "";
        if (rooms.length) {
            html += '<div class="chatMessageShareSection">채팅방</div>' + rooms.map(function (room) {
                var title = formatRoomTitle(room);
                return renderMessageShareTarget("room", room.id, title, room.type === "department" ? "부서 채팅방" : "채팅방", room.id || title, room.type === "department");
            }).join("");
        }
        if (contacts.length) {
            html += '<div class="chatMessageShareSection">멤버</div>' + contacts.map(function (contact) {
                return renderMessageShareTarget("member", contact.id, contact.name || contact.id, formatContactMeta(contact), contact.id || contact.name, false);
            }).join("");
        }
        elements.messageShareList.innerHTML = html || '<div class="chatEmptyList">공유할 대상을 찾을 수 없습니다.</div>';
    }

    function renderMessageShareTarget(type, id, title, meta, avatarKey, department) {
        var room = type === "room" ? { id: id, title: title, type: department ? "department" : "" } : null;
        var selected = isMessageShareTargetSelected(type, id);
        var avatarHtml = room
            ? renderRoomAvatar(room, title || id, "chatAvatar" + (department ? " chatAvatar--dept" : ""))
            : '<span class="chatAvatar" style="' + escapeHtml(getAvatarStyle(avatarKey || title)) + '">' + escapeHtml(getInitial(title || id)) + '</span>';
        return [
            '<button type="button" class="chatMessageShareItem' + (selected ? ' is-selected' : '') + '" data-share-target-type="' + escapeHtml(type) + '" data-share-target-id="' + escapeHtml(id) + '">',
            avatarHtml,
            '<span class="chatMessageShareMain">',
            '<strong>' + escapeHtml(title || id) + '</strong>',
            '<span>' + escapeHtml(meta || "") + '</span>',
            '</span>',
            '<span class="chatMessageShareCheck" aria-hidden="true"><i class="xi-check"></i></span>',
            '</button>'
        ].join("");
    }

    function getMessageShareTargetKey(type, id) {
        return String(type || "") + ":" + String(id || "");
    }

    function isMessageShareTargetSelected(type, id) {
        var key = getMessageShareTargetKey(type, id);
        return state.selectedMessageShareTargets.some(function (target) {
            return getMessageShareTargetKey(target.type, target.id) === key;
        });
    }

    function toggleMessageShareTarget(type, id) {
        type = type === "member" ? "member" : "room";
        id = String(id || "").trim();
        if (!id) return;
        var key = getMessageShareTargetKey(type, id);
        var nextTargets = [];
        var removed = false;
        state.selectedMessageShareTargets.forEach(function (target) {
            if (getMessageShareTargetKey(target.type, target.id) === key) {
                removed = true;
                return;
            }
            nextTargets.push(target);
        });
        if (!removed) nextTargets.push({ type: type, id: id });
        state.selectedMessageShareTargets = nextTargets;
        renderMessageShareTargets();
        updateMessageShareConfirmState();
    }

    function updateMessageShareConfirmState() {
        if (elements.messageShareConfirm) {
            elements.messageShareConfirm.disabled = !state.pendingMessageShare || state.selectedMessageShareTargets.length < 1;
        }
    }

    async function sharePendingMessageToSelectedTargets() {
        var targets = state.selectedMessageShareTargets.slice();
        if (!targets.length || !state.pendingMessageShare) return;
        if (elements.messageShareConfirm) elements.messageShareConfirm.disabled = true;
        try {
            for (var index = 0; index < targets.length; index += 1) {
                await sharePendingMessage(targets[index].type, targets[index].id);
            }
            closeMessageShareModal();
            await loadRooms();
            renderRooms();
            alert("메시지를 공유했습니다.");
        } catch (error) {
            updateMessageShareConfirmState();
            alert(error.message || "메시지를 공유하지 못했습니다.");
        }
    }

    async function sharePendingMessage(targetType, targetId) {
        var shared = state.pendingMessageShare;
        if (!shared || !targetId) return;
        var roomId = "";
        var room = null;
        if (targetType === "member") {
            var roomData = await postJson(CHAT_API_BASE + "/rooms/direct", {
                userId: state.user.id,
                targetUserId: targetId
            });
            room = roomData.item;
            roomId = room.id;
        } else {
            roomId = targetId;
            room = state.rooms.find(function (item) { return item.id === roomId; }) || null;
        }
        var data = await postJson(CHAT_API_BASE + "/messages/send", {
            userId: state.user.id,
            roomId: roomId,
            text: shared.text,
            attachmentsData: shared.attachmentsData,
            poll: shared.poll
        });
        if (room && state.activeRoom && room.id === state.activeRoom.id) {
            handleSocketMessage(JSON.stringify({ type: "message", item: data.item, room: data.room }));
        }
    }

    async function deleteMessage(message) {
        if (!message) return;
        if (message.senderId !== state.user.id) {
            alert("내가 발송한 메시지만 삭제 가능합니다.");
            return;
        }
        if (!confirm(getDeleteMessageConfirmText(message))) return;
        try {
            var data = await postJson(CHAT_API_BASE + "/messages/delete", {
                userId: state.user.id,
                roomId: message.roomId,
                messageId: message.id
            });
            if (data.deleteForMe === true) {
                state.messages = state.messages.filter(function (item) {
                    return String(item && item.id || "") !== String(message.id || "");
                });
            } else if (data.deleteMode === "everyone" && data.item) {
                state.messages = state.messages.map(function (item) {
                    return String(item && item.id || "") === String(message.id || "") ? normalizeMessage(data.item) : item;
                });
            } else {
                state.messages = state.messages.filter(function (item) {
                    return String(item && item.id || "") !== String(message.id || "");
                });
            }
            if (data.room) {
                state.activeRoom = data.room;
                upsertRoom(data.room);
            } else {
                await loadRooms();
                renderRooms();
            }
            renderMessages();
        } catch (error) {
            alert(error.message || "메시지를 삭제하지 못했습니다.");
        }
    }

    function getDeleteMessageConfirmText(message) {
        var sentAt = Date.parse(String(message && message.createdAt || ""));
        if (sentAt && Date.now() - sentAt > 60000) {
            return "전송 후 1분이 지난 메시지는 내 채팅방에서만 삭제됩니다. 삭제하시겠습니까?";
        }
        return "메시지를 삭제할까요?";
    }

    function openImageViewer(messageId, attachmentIndex, keepListOpen) {
        var attachment = getMessageAttachment(messageId, attachmentIndex);
        if (!attachment || !elements.imageViewerModal || !elements.imageViewerStage) return;
        state.imageViewerAttachment = attachment;
        elements.imageViewerStage.innerHTML = '<img src="' + escapeHtml(getAttachmentImageSource(attachment.file, attachment.href)) + '" alt="' + escapeHtml(attachment.name) + '">';
        if (elements.imageViewerFileList) {
            renderImageViewerFileList();
            elements.imageViewerFileList.hidden = keepListOpen !== true;
        }
        syncImageViewerAllButton();
        elements.imageViewerModal.hidden = false;
        document.documentElement.classList.add("chatImageViewerOpen");
        document.body.classList.add("chatImageViewerOpen");
    }

    function closeImageViewer() {
        if (!elements.imageViewerModal) return;
        elements.imageViewerModal.hidden = true;
        state.imageViewerAttachment = null;
        if (elements.imageViewerStage) elements.imageViewerStage.innerHTML = "";
        if (elements.imageViewerFileList) {
            elements.imageViewerFileList.innerHTML = "";
            elements.imageViewerFileList.hidden = true;
        }
        syncImageViewerAllButton();
        document.documentElement.classList.remove("chatImageViewerOpen");
        document.body.classList.remove("chatImageViewerOpen");
    }

    function getMessageAttachment(messageId, attachmentIndex) {
        var message = state.messages.find(function (item) {
            return String(item && item.id || "") === String(messageId || "");
        });
        var items = Array.isArray(message && message.attachmentsData) ? message.attachmentsData : [];
        var file = items[attachmentIndex];
        if (!message || !file) return null;
        var name = String(file.filename || file.name || ("첨부파일 " + (attachmentIndex + 1))).trim();
        var href = CHAT_API_BASE + "/attachment?userId=" + encodeURIComponent(state.user.id) + "&roomId=" + encodeURIComponent(message.roomId) + "&id=" + encodeURIComponent(message.id) + "&index=" + encodeURIComponent(String(attachmentIndex));
        return { message: message, file: file, index: attachmentIndex, name: name, href: href };
    }

    async function downloadCurrentImageAttachment() {
        var attachment = state.imageViewerAttachment;
        if (!attachment) return;
        if (window.showSaveFilePicker && window.isSecureContext) {
            try {
                var blob = getAttachmentBlob(attachment.file);
                var handle = await window.showSaveFilePicker({
                    suggestedName: attachment.name,
                    types: [{
                        description: "이미지 파일",
                        accept: buildFilePickerAccept(attachment.file)
                    }]
                });
                var writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (error) {
                if (error && error.name === "AbortError") return;
            }
        }
        var link = document.createElement("a");
        link.href = attachment.href;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function shareCurrentImageAttachment() {
        var attachment = state.imageViewerAttachment;
        if (!attachment) return;
        state.pendingAttachmentShare = cloneAttachmentForSend(attachment.file);
        closeImageViewer();
        openMemberModal();
    }

    function forwardCurrentImageAttachment() {
        var attachment = state.imageViewerAttachment;
        if (!attachment) return;
        state.pendingAttachmentShare = cloneAttachmentForSend(attachment.file);
        closeImageViewer();
        openMemberModal();
    }

    async function sendAttachmentToMember(targetUserId) {
        if (!state.pendingAttachmentShare) return;
        try {
            var roomData = await postJson(CHAT_API_BASE + "/rooms/direct", {
                userId: state.user.id,
                targetUserId: targetUserId
            });
            var messageData = await postJson(CHAT_API_BASE + "/messages/send", {
                userId: state.user.id,
                roomId: roomData.item.id,
                text: "",
                attachmentsData: [state.pendingAttachmentShare]
            });
            state.pendingAttachmentShare = null;
            closeMemberModal();
            await loadRooms();
            renderRooms();
            openRoom(roomData.item);
            handleSocketMessage(JSON.stringify({ type: "message", item: messageData.item, room: messageData.room }));
        } catch (error) {
            alert(error.message || "첨부파일을 전달하지 못했습니다.");
        }
    }

    function cloneAttachmentForSend(file) {
        return {
            filename: String(file && (file.filename || file.name) || "image.png"),
            type: String(file && file.type || "image/png"),
            size: Number(file && file.size || 0),
            content: String(file && file.content || "")
        };
    }

    function getAttachmentBlob(file) {
        var type = String(file && file.type || "application/octet-stream").trim() || "application/octet-stream";
        var content = String(file && file.content || "").trim();
        if (content.indexOf("data:") === 0) {
            var parts = content.split(",");
            var meta = parts[0] || "";
            var body = parts.slice(1).join(",");
            var mimeMatch = meta.match(/^data:([^;,]+)/);
            return new Blob([base64ToUint8Array(body)], { type: mimeMatch ? mimeMatch[1] : type });
        }
        return new Blob([base64ToUint8Array(content)], { type: type });
    }

    function base64ToUint8Array(value) {
        var binary = atob(String(value || ""));
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }

    function buildFilePickerAccept(file) {
        var type = String(file && file.type || "image/png").trim() || "image/png";
        var filename = String(file && (file.filename || file.name) || "").trim().toLowerCase();
        var extension = filename.match(/\.([0-9a-z]+)$/i);
        var ext = extension ? "." + extension[1] : "." + (type.split("/")[1] || "png");
        var accept = {};
        accept[type] = [ext];
        return accept;
    }

    function cloneMessageForShare(message) {
        var text = String(message && message.text || "").trim();
        var attachmentsData = (Array.isArray(message && message.attachmentsData) ? message.attachmentsData : []).map(cloneAttachmentForSend);
        var poll = normalizePollData(message && message.poll);
        return {
            text: text,
            attachmentsData: attachmentsData,
            poll: poll
        };
    }

    function findMessageById(messageId) {
        return state.messages.find(function (item) {
            return String(item && item.id || "") === String(messageId || "");
        }) || null;
    }

    function toggleImageViewerFileList() {
        if (!elements.imageViewerFileList) return;
        renderImageViewerFileList();
        elements.imageViewerFileList.hidden = !elements.imageViewerFileList.hidden;
        syncImageViewerAllButton();
    }

    function syncImageViewerAllButton() {
        if (!elements.imageViewerAll || !elements.imageViewerFileList) return;
        var opened = elements.imageViewerFileList.hidden !== true;
        elements.imageViewerAll.classList.toggle("is-active", opened);
        elements.imageViewerAll.setAttribute("aria-pressed", opened ? "true" : "false");
    }

    function renderImageViewerFileList() {
        if (!elements.imageViewerFileList) return;
        var items = [];
        state.messages.forEach(function (message) {
            (Array.isArray(message.attachmentsData) ? message.attachmentsData : []).forEach(function (file, index) {
                items.push({ message: message, file: file, index: index });
            });
        });
        elements.imageViewerFileList.innerHTML = items.length ? items.map(function (item) {
            var name = String(item.file.filename || item.file.name || "첨부파일");
            var href = CHAT_API_BASE + "/attachment?userId=" + encodeURIComponent(state.user.id) + "&roomId=" + encodeURIComponent(item.message.roomId) + "&id=" + encodeURIComponent(item.message.id) + "&index=" + encodeURIComponent(String(item.index));
            if (isImageAttachment(item.file)) {
                return '<button type="button" class="chatImageViewerFileItem" data-viewer-message-id="' + escapeHtml(item.message.id) + '" data-viewer-attachment-index="' + escapeHtml(String(item.index)) + '"><img src="' + escapeHtml(getAttachmentImageSource(item.file, "")) + '" alt=""><span>' + escapeHtml(name) + '</span></button>';
            }
            return '<a class="chatImageViewerFileItem" href="' + escapeHtml(href) + '" target="_blank" rel="noopener"><span class="chatImageViewerFileIcon">FILE</span><span>' + escapeHtml(name) + '</span></a>';
        }).join("") : '<div class="chatImageViewerEmpty">첨부파일이 없습니다.</div>';
    }

    function replyToMessage(messageId) {
        var message = state.messages.find(function (item) {
            return String(item && item.id || "") === String(messageId || "");
        });
        if (!message || !elements.input) return;
        var sender = String(message.senderName || message.senderId || "메시지").trim();
        var text = String(message.text || "").trim().replace(/\s+/g, " ");
        if (text.length > 60) text = text.slice(0, 60) + "...";
        state.replyTarget = { sender: sender, text: text };
        elements.input.value = "";
        elements.input.placeholder = "답장을 입력하세요.";
        renderReplyPreview();
        syncComposerHeight();
        updateComposerState();
        updateComposerHighlight();
        syncComposerHighlightScroll();
        elements.input.focus();
    }

    function buildComposerMessageText(text) {
        text = String(text || "").trim();
        if (state.composerEmoticon) {
            text = [state.composerEmoticon.token, text].filter(Boolean).join("\n");
        }
        if (!state.replyTarget) return text;
        return "↪ " + state.replyTarget.sender + ": " + state.replyTarget.text + "\n" + text;
    }

    function toggleMessageReaction(messageId, reactionKey) {
        messageId = String(messageId || "").trim();
        reactionKey = String(reactionKey || "").trim();
        if (!messageId || !reactionKey) return;
        var reactions = getMessageReactionState(messageId);
        var users = reactions[reactionKey] || [];
        var userId = state.user.id;
        if (users.indexOf(userId) > -1) {
            users = users.filter(function (id) { return id !== userId; });
        } else {
            users = users.concat(userId);
        }
        reactions[reactionKey] = users;
        state.messageReactions[messageId] = reactions;
        saveMessageReactions();
        renderMessages();
    }

    function getMessageReactionState(messageId) {
        var source = state.messageReactions[String(messageId || "").trim()] || {};
        var normalized = {};
        CHAT_REACTIONS.forEach(function (reaction) {
            normalized[reaction.key] = Array.isArray(source[reaction.key])
                ? source[reaction.key].map(normalizeId).filter(Boolean).filter(function (id, index, list) {
                    return list.indexOf(id) === index;
                })
                : [];
        });
        return normalized;
    }

    function isMessageReactionActive(messageId, reactionKey) {
        var users = getMessageReactionState(messageId)[reactionKey] || [];
        return users.indexOf(state.user.id) > -1;
    }

    function loadRoomPrefs() {
        try {
            var user = getCurrentUser();
            var key = CHAT_ROOM_PREF_STORAGE_PREFIX + String(user && user.id || "");
            var raw = localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function saveRoomPrefs() {
        try {
            localStorage.setItem(CHAT_ROOM_PREF_STORAGE_PREFIX + state.user.id, JSON.stringify(state.roomPrefs || {}));
        } catch (error) {}
    }

    function getRoomPref(roomId) {
        var id = String(roomId || "").trim();
        var source = id && state.roomPrefs && state.roomPrefs[id] ? state.roomPrefs[id] : {};
        return {
            pinned: source.pinned === true,
            muted: source.muted === true
        };
    }

    function toggleRoomPref(roomId, key) {
        var id = String(roomId || "").trim();
        if (!id || (key !== "pinned" && key !== "muted")) return;
        var current = getRoomPref(id);
        state.roomPrefs[id] = Object.assign({}, current, { [key]: current[key] !== true });
        if (!state.roomPrefs[id].pinned && !state.roomPrefs[id].muted) delete state.roomPrefs[id];
        saveRoomPrefs();
        state.renderedRoomsSignature = "";
        renderRooms();
    }

    function loadMessageReactions(roomId) {
        try {
            var raw = localStorage.getItem(CHAT_REACTION_STORAGE_PREFIX + String(roomId || ""));
            var parsed = raw ? JSON.parse(raw) : {};
            state.messageReactions = parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            state.messageReactions = {};
        }
    }

    function saveMessageReactions() {
        if (!state.activeRoom || !state.activeRoom.id) return;
        try {
            localStorage.setItem(CHAT_REACTION_STORAGE_PREFIX + state.activeRoom.id, JSON.stringify(state.messageReactions || {}));
        } catch (error) {}
    }

    async function markRoomRead(roomId) {
        applyLocalRoomRead(roomId);
        try {
            if (sendChatReadReceipt(roomId)) return;
            await postJson(CHAT_API_BASE + "/rooms/read", { userId: state.user.id, roomId: roomId });
            applyLocalRoomRead(roomId);
        } catch (error) {}
    }

    function applyRoomReadInList(roomId) {
        var id = String(roomId || "").trim();
        if (!id) return;
        state.rooms = state.rooms.map(function (room) {
            if (!room || room.id !== id) return room;
            var next = Object.assign({}, room);
            next.unreadCount = 0;
            next.unreadBy = Object.assign({}, next.unreadBy || {});
            next.unreadBy[state.user.id] = 0;
            return next;
        });
        if (state.activeRoom && state.activeRoom.id === id) {
            state.activeRoom = markRoomObjectRead(state.activeRoom);
            renderMessages();
        }
        state.renderedRoomsSignature = "";
        renderRooms();
        syncChatMenuUnreadBadgeFromRooms();
    }

    async function leaveRoom(room) {
        var roomId = String(room && room.id || "").trim();
        if (!roomId) return;
        var confirmed = confirm("채팅방을 나가시겠습니까? 나가시면 해당 채팅방에서 나눈 대화와 파일은 모두 삭제되며 복구되지 않습니다.");
        if (!confirmed) return;
        state.pendingLeaveRoomIds[roomId] = true;
        if (state.activeRoom && state.activeRoom.id === roomId) closeActiveRoom();
        state.rooms = state.rooms.filter(function (item) { return item.id !== roomId; });
        saveFastCache("rooms", state.rooms);
        delete state.roomPrefs[roomId];
        saveRoomPrefs();
        state.renderedRoomsSignature = "";
        renderRooms();
        syncChatMenuUnreadBadgeFromRooms();
        try {
            await postJson(CHAT_API_BASE + "/rooms/leave", { userId: state.user.id, roomId: roomId });
            delete state.pendingLeaveRoomIds[roomId];
            await loadRooms().catch(function () {});
            renderRooms();
            syncChatMenuUnreadBadgeFromRooms();
        } catch (error) {
            delete state.pendingLeaveRoomIds[roomId];
            await refreshRoomsInBackground();
            alert(error.message || "채팅방을 나가지 못했습니다.");
        }
    }

    function sendChatReadReceipt(roomId) {
        var id = String(roomId || "").trim();
        if (!id || !state.socket || !state.socketReady || state.socket.readyState !== WebSocket.OPEN) return false;
        try {
            state.socket.send(JSON.stringify({ type: "read" }));
            return true;
        } catch (error) {
            return false;
        }
    }

    function applyLocalRoomRead(roomId) {
        var id = String(roomId || "").trim();
        if (!id) return;
        noteLocalRoomRead(id);
        state.rooms = applyLocalReadOverrides(state.rooms);
        if (state.activeRoom && state.activeRoom.id === id) {
            state.activeRoom = markRoomObjectRead(state.activeRoom);
            renderMessages();
        }
        if (window.ChatMenuUnread && typeof window.ChatMenuUnread.markRead === "function") {
            window.ChatMenuUnread.markRead(id);
        }
        renderRooms();
        syncChatMenuUnreadBadgeFromRooms();
    }

    function noteLocalRoomRead(roomId) {
        var id = String(roomId || "").trim();
        if (!id) return;
        state.localReadRooms[id] = Date.now();
    }

    function applyLocalReadOverrides(rooms) {
        var now = Date.now();
        Object.keys(state.localReadRooms).forEach(function (roomId) {
            if (now - state.localReadRooms[roomId] > CHAT_LOCAL_READ_MS) {
                delete state.localReadRooms[roomId];
            }
        });
        return (Array.isArray(rooms) ? rooms : []).map(function (room) {
            var roomId = String(room && room.id || "").trim();
            if (!roomId || !state.localReadRooms[roomId]) return room;
            return markRoomObjectRead(room);
        });
    }

    function markRoomObjectRead(room) {
        if (!room) return room;
        var now = new Date().toISOString();
        var next = Object.assign({}, room);
        next.unreadCount = 0;
        next.lastReadBy = Object.assign({}, next.lastReadBy || {});
        next.lastReadBy[state.user.id] = now;
        next.unreadBy = Object.assign({}, next.unreadBy || {});
        next.unreadBy[state.user.id] = 0;
        return next;
    }

    function setActiveTab(tab) {
        state.activeTab = tab === "contacts" ? "contacts" : "rooms";
        saveLastActiveTab(state.activeTab);
        if (state.activeTab === "contacts") ensureContactsReady();
        syncChatTitleMenu();
        elements.tabs.forEach(function (button) {
            var isActive = button.getAttribute("data-chat-menu-tab") === state.activeTab;
            button.classList.toggle("is-active", isActive);
        });
        elements.panels.forEach(function (panel) {
            panel.classList.toggle("is-active", panel.getAttribute("data-chat-panel") === state.activeTab);
        });
        renderCurrentList();
    }

    function getChatTabLabel(tab) {
        return tab === "rooms" ? "채팅" : "멤버";
    }

    function syncChatTitleMenu() {
        if (elements.titleText) elements.titleText.textContent = getChatTabLabel(state.activeTab);
        if (elements.titleToggle) elements.titleToggle.setAttribute("aria-expanded", isChatTitleMenuOpen() ? "true" : "false");
    }

    function isChatTitleMenuOpen() {
        return !!(elements.titleDropdown && !elements.titleDropdown.hidden);
    }

    function toggleChatTitleMenu() {
        if (!elements.titleDropdown) return;
        if (isChatTitleMenuOpen()) closeChatTitleMenu();
        else openChatTitleMenu();
    }

    function openChatTitleMenu() {
        if (!elements.titleDropdown) return;
        elements.titleDropdown.hidden = false;
        if (elements.titleToggle) elements.titleToggle.setAttribute("aria-expanded", "true");
    }

    function closeChatTitleMenu() {
        if (!elements.titleDropdown) return;
        elements.titleDropdown.hidden = true;
        if (elements.titleToggle) elements.titleToggle.setAttribute("aria-expanded", "false");
    }

    function ensureContactsReady() {
        if (state.contacts.length) return;
        loadContacts().then(function () {
            renderContacts();
            if (elements.memberModal && !elements.memberModal.hidden) renderMemberPicker();
            if (elements.roomMembersModal && !elements.roomMembersModal.hidden && state.roomMembersRoom) {
                renderRoomMembersList(state.roomMembersRoom);
            }
        }).catch(function () {});
    }

    function openRoomFromUrl() {
        var roomId = getUrlRoomId();
        if (!roomId) return;
        if (state.urlRoomOpened && state.activeRoom && state.activeRoom.id === roomId) return;
        var room = state.rooms.find(function (item) { return item.id === roomId; });
        if (room) {
            state.urlRoomOpened = true;
            openRoom(room);
            return;
        }
        clearUrlRoom();
    }

    function getUrlRoomId() {
        try {
            var params = new URLSearchParams(location.search);
            return String(params.get("roomId") || "").trim();
        } catch (error) {
            return "";
        }
    }

    function updateUrlRoom(roomId) {
        if (!history || !history.replaceState) return;
        var url = new URL(location.href);
        url.searchParams.set("roomId", roomId);
        history.replaceState(null, "", url.pathname + url.search);
    }

    function clearUrlRoom() {
        if (!history || !history.replaceState) return;
        var url = new URL(location.href);
        url.searchParams.delete("roomId");
        history.replaceState(null, "", url.pathname + url.search);
    }

    function upsertRoom(room) {
        room = applyLocalReadOverrides([room])[0] || room;
        var found = false;
        state.rooms = state.rooms.map(function (item) {
            if (item.id !== room.id) return item;
            found = true;
            return room;
        });
        if (!found) state.rooms.unshift(room);
        state.rooms = dedupeChatRoomsForDisplay(state.rooms);
        state.rooms.sort(function (a, b) {
            return String(b.updatedAt || b.lastMessageAt || "").localeCompare(String(a.updatedAt || a.lastMessageAt || ""));
        });
        renderRooms();
    }

    function setRoomMeta(text) {
        if (elements.roomMeta) elements.roomMeta.textContent = text || "";
    }

    function updateRoomHeader() {
        if (!state.activeRoom) return;
        var contact = getRoomContact(state.activeRoom);
        var title = contact && contact.name ? contact.name : formatRoomTitle(state.activeRoom);
        var meta = state.activeRoom.type === "direct"
            ? ""
            : contact
                ? formatContactMeta(contact)
                : formatRoomMeta(state.activeRoom);
        if (elements.roomTitle) {
            elements.roomTitle.classList.toggle("is-company", isCompanyChatRoom(state.activeRoom));
            if (isCompanyChatRoom(state.activeRoom)) {
                elements.roomTitle.innerHTML = '<span class="chatRoomAllLabel">ALL</span><span>' + escapeHtml(title || "대화방") + '</span>';
            } else {
                elements.roomTitle.textContent = title || "대화방";
            }
        }
        if (elements.roomView) {
            elements.roomView.classList.toggle("is-direct-room", state.activeRoom.type === "direct");
        }
        if (elements.roomMeta) {
            var roomCount = getRoomMemberCount(state.activeRoom);
            var roomMetaClickable = state.activeRoom.type !== "direct" && roomCount > 0;
            elements.roomMeta.hidden = state.activeRoom.type === "direct";
            elements.roomMeta.classList.toggle("is-clickable", roomMetaClickable);
            elements.roomMeta.setAttribute("tabindex", roomMetaClickable ? "0" : "-1");
            elements.roomMeta.setAttribute("role", roomMetaClickable ? "button" : "text");
            if (roomMetaClickable) elements.roomMeta.setAttribute("aria-label", "참여 멤버 보기");
            else elements.roomMeta.removeAttribute("aria-label");
            elements.roomMeta.textContent = meta;
        }
        if (elements.roomInviteButton) elements.roomInviteButton.hidden = !canInviteToRoom(state.activeRoom);
        if (elements.roomAvatar) {
            var avatarData = String(state.activeRoom.avatarData || "").trim();
            elements.roomAvatar.classList.toggle("is-image", !!avatarData);
            elements.roomAvatar.classList.toggle("chatAvatar--group", false);
            elements.roomAvatar.classList.toggle("chatAvatar--company", !avatarData && isCompanyChatRoom(state.activeRoom));
            if (avatarData) {
                elements.roomAvatar.innerHTML = '<img src="' + escapeHtml(avatarData) + '" alt="">';
                elements.roomAvatar.removeAttribute("style");
            } else if (isCompanyChatRoom(state.activeRoom)) {
                elements.roomAvatar.innerHTML = CHAT_COMPANY_DEFAULT_ICON;
                elements.roomAvatar.removeAttribute("style");
            } else {
                elements.roomAvatar.textContent = getInitial(title);
                elements.roomAvatar.setAttribute("style", getAvatarStyle(contact && (contact.id || contact.name) || title));
            }
        }
    }

    function getRoomContact(room) {
        if (!room || room.type === "department" || room.type === "group") return null;
        var otherId = (Array.isArray(room.memberIds) ? room.memberIds : []).map(normalizeId).find(function (memberId) {
            return memberId && memberId !== state.user.id;
        });
        var contact = otherId ? state.contacts.find(function (item) { return normalizeId(item.id) === otherId; }) : null;
        if (contact) return contact;
        var title = formatRoomTitle(room);
        return state.contacts.find(function (item) { return String(item.name || "").trim() === title; }) || null;
    }

    function getMessageUnreadCount(message) {
        if (!state.activeRoom || !message) return 0;
        var senderId = normalizeId(message.senderId || "");
        var memberIds = (Array.isArray(state.activeRoom.memberIds) ? state.activeRoom.memberIds : []).map(normalizeId).filter(function (memberId) {
            return memberId && memberId !== senderId;
        });
        if (!memberIds.length) return 0;
        var readMap = state.activeRoom.lastReadBy || {};
        var createdAt = String(message.createdAt || "");
        return memberIds.filter(function (memberId) {
            var readAt = String(readMap[memberId] || "");
            return !readAt || readAt < createdAt;
        }).length;
    }

    function setSendDisabled(disabled) {
        if (elements.sendButton) elements.sendButton.disabled = disabled === true;
    }

    function updateComposerState() {
        var hasText = !!String(elements.input && elements.input.value || "").trim();
        var hasFiles = state.composerFiles.length > 0;
        var hasEmoticon = !!state.composerEmoticon;
        setSendDisabled(state.sending || (!hasText && !hasFiles && !hasEmoticon));
    }

    function resetComposer() {
        if (elements.input) elements.input.value = "";
        state.replyTarget = null;
        renderReplyPreview();
        state.composerEmoticon = null;
        renderComposerEmoticon();
        state.composerFiles = [];
        if (elements.fileInput) elements.fileInput.value = "";
        renderComposerFiles();
        closeComposerPanels();
        syncComposerHeight();
        updateComposerHighlight();
        syncComposerHighlightScroll();
        syncComposerSelectionState();
        updateComposerState();
    }

    function renderReplyPreview() {
        if (elements.composerBox) elements.composerBox.classList.toggle("is-replying", !!state.replyTarget);
        if (!elements.replyPreview) return;
        elements.replyPreview.hidden = !state.replyTarget;
        if (!state.replyTarget) {
            if (elements.replyPreviewMeta) elements.replyPreviewMeta.textContent = "";
            if (elements.replyPreviewText) elements.replyPreviewText.textContent = "";
            return;
        }
        if (elements.replyPreviewMeta) elements.replyPreviewMeta.textContent = state.replyTarget.sender + "님 메시지에 답장하기";
        if (elements.replyPreviewText) elements.replyPreviewText.textContent = state.replyTarget.text || "메시지";
    }

    function syncComposerHeight() {
        if (!elements.input) return;
        elements.input.style.height = "auto";
        elements.input.style.height = Math.min(elements.input.scrollHeight, 132) + "px";
    }

    function syncComposerSelectionState() {
        if (!elements.composerBox || !elements.input) return;
        var start = typeof elements.input.selectionStart === "number" ? elements.input.selectionStart : 0;
        var end = typeof elements.input.selectionEnd === "number" ? elements.input.selectionEnd : start;
        var isSelecting = document.activeElement === elements.input && start !== end;
        elements.composerBox.classList.toggle("is-selecting-text", isSelecting);
    }

    function renderEmojiPanel() {
        if (!elements.emojiPanel) return;
        elements.emojiPanel.innerHTML = ''
            + '<div class="chatComposerPanelHead">'
            + '<span class="chatComposerPanelTitle">이모티콘</span>'
            + '<button type="button" class="chatComposerPanelClose" data-close-chat-panel="emoji" aria-label="팝업 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</div>'
            + '<div class="chatEmojiPanelGrid">'
            + CHAT_EMOJIS.map(function (item) {
                return '<button type="button" class="chatEmojiItem" data-chat-emoji="' + escapeHtml(item.token) + '" aria-label="' + escapeHtml(item.label) + '"><img src="' + escapeHtml(item.image) + '" alt=""></button>';
            }).join("")
            + '</div>';
    }

    function setComposerEmoticon(token) {
        var item = getChatEmoticonByToken(token);
        if (!item) return;
        state.composerEmoticon = item;
        renderComposerEmoticon();
        updateComposerState();
        syncComposerHeight();
        updateComposerHighlight();
        if (elements.input) elements.input.focus();
    }

    function getChatEmoticonByToken(token) {
        token = String(token || "").trim();
        return CHAT_EMOJIS.find(function (item) {
            return item && item.token === token;
        }) || null;
    }

    function renderComposerEmoticon() {
        if (elements.composerBox) elements.composerBox.classList.toggle("has-emoticon", !!state.composerEmoticon);
        if (!elements.emoticonPreview) return;
        elements.emoticonPreview.hidden = !state.composerEmoticon;
        if (!state.composerEmoticon) {
            elements.emoticonPreview.innerHTML = "";
            return;
        }
        elements.emoticonPreview.innerHTML = ''
            + '<span class="chatComposerEmoticonThumb">'
            + '<img src="' + escapeHtml(state.composerEmoticon.image) + '" alt="' + escapeHtml(state.composerEmoticon.label) + '">'
            + '<button type="button" class="chatComposerEmoticonRemove" data-remove-chat-emoticon="true" aria-label="이모티콘 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</span>';
    }

    function toggleEmojiPanel(event) {
        if (event) event.stopPropagation();
        if (!elements.emojiPanel) return;
        var nextHidden = !elements.emojiPanel.hidden;
        closeComposerPanels();
        elements.emojiPanel.hidden = nextHidden;
    }

    function openMentionPanel(event) {
        if (event) event.stopPropagation();
        if (!elements.input) return;
        if (elements.mentionPanel && !elements.mentionPanel.hidden) {
            closeComposerPanels();
            updateComposerState();
            updateComposerHighlight();
            return;
        }
        closeComposerPanels();
        if (!hasMentionTriggerAtCaret()) insertComposerText("@");
        state.composerMentionDraftActive = true;
        renderMentionPanel(getMentionItems());
        if (elements.mentionPanel) elements.mentionPanel.hidden = false;
    }

    function closeComposerPanels() {
        if (state.composerMentionDraftActive) {
            removeComposerMentionTrigger();
        }
        state.composerMentionDraftActive = false;
        if (elements.emojiPanel) elements.emojiPanel.hidden = true;
        if (elements.mentionPanel) elements.mentionPanel.hidden = true;
    }

    function insertComposerText(value) {
        if (!elements.input) return;
        var text = String(value || "");
        var current = String(elements.input.value || "");
        var start = Number(elements.input.selectionStart || current.length);
        var end = Number(elements.input.selectionEnd || start);
        elements.input.value = current.slice(0, start) + text + current.slice(end);
        var nextCaret = start + text.length;
        elements.input.focus();
        elements.input.setSelectionRange(nextCaret, nextCaret);
        syncComposerHeight();
        syncMentionSuggestions();
        updateComposerState();
        updateComposerHighlight();
    }

    function renderMentionPanel(items) {
        if (!elements.mentionPanel) return;
        var list = Array.isArray(items) ? items : [];
        if (!list.length) {
            elements.mentionPanel.hidden = true;
            return;
        }
        elements.mentionPanel.innerHTML = ''
            + '<div class="chatComposerPanelHead">'
            + '<span class="chatComposerPanelTitle">멘션</span>'
            + '<button type="button" class="chatComposerPanelClose" data-close-chat-panel="mention" aria-label="팝업 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button>'
            + '</div>'
            + '<div class="chatMentionPanelList">'
            + list.map(function (item) {
                return '<button type="button" class="chatMentionItem" data-chat-mention="' + escapeHtml(item.value) + '"><span class="chatMentionIcon">@</span><span class="chatMentionText"><strong>' + escapeHtml(item.label) + '</strong><span>' + escapeHtml(item.meta) + '</span></span></button>';
            }).join("")
            + '</div>';
        elements.mentionPanel.hidden = false;
    }

    function getMentionItems() {
        var seen = {};
        var items = [{ value: "@all", label: "all", meta: "멤버 전체 멘션" }];
        state.contacts.forEach(function (contact) {
            var label = String(contact.name || contact.id || "").trim();
            var id = normalizeId(contact.id || "");
            var email = String(contact.email || "").trim().toLowerCase();
            if (!label
                || id === "admin"
                || id === "work"
                || id === "test"
                || /^test/i.test(id)
                || label === "관리자"
                || label === "홍길동"
                || email === "admin@autone.co.kr"
                || /^test@/i.test(email)
                || seen[label]) return;
            seen[label] = true;
            items.push({
                value: "@" + label,
                label: label,
                meta: formatContactMeta(contact)
            });
        });
        return items;
    }

    function syncMentionSuggestions() {
        if (!elements.input || !elements.mentionPanel) return;
        var current = String(elements.input.value || "");
        var caret = Number(elements.input.selectionStart || current.length);
        var before = current.slice(0, caret);
        var triggerIndex = before.lastIndexOf("@");
        if (triggerIndex < 0) {
            elements.mentionPanel.hidden = true;
            return;
        }
        var query = before.slice(triggerIndex + 1).trim().toLowerCase();
        if (/\s/.test(before.slice(triggerIndex + 1))) {
            elements.mentionPanel.hidden = true;
            return;
        }
        var matches = getMentionItems().filter(function (item) {
            return !query || item.label.toLowerCase().indexOf(query) > -1 || item.value.toLowerCase().indexOf("@" + query) > -1;
        });
        renderMentionPanel(matches);
    }

    function insertMention(value) {
        if (!elements.input) return;
        var current = String(elements.input.value || "");
        var caret = Number(elements.input.selectionStart || current.length);
        var before = current.slice(0, caret);
        var after = current.slice(caret);
        var triggerIndex = before.lastIndexOf("@");
        var next = triggerIndex > -1
            ? before.slice(0, triggerIndex) + String(value || "") + " " + after
            : before + String(value || "") + " " + after;
        elements.input.value = next;
        elements.input.focus();
        elements.input.setSelectionRange((triggerIndex > -1 ? before.slice(0, triggerIndex).length : before.length) + String(value || "").length + 1, (triggerIndex > -1 ? before.slice(0, triggerIndex).length : before.length) + String(value || "").length + 1);
        state.composerMentionDraftActive = false;
        closeComposerPanels();
        syncComposerHeight();
        updateComposerState();
        updateComposerHighlight();
    }

    function hasMentionTriggerAtCaret() {
        if (!elements.input) return false;
        var current = String(elements.input.value || "");
        var caret = Number(elements.input.selectionStart || current.length);
        return current.slice(Math.max(0, caret - 1), caret) === "@";
    }

    function removeComposerMentionTrigger() {
        if (!elements.input) return;
        var current = String(elements.input.value || "");
        var caret = Number(elements.input.selectionStart || current.length);
        var before = current.slice(0, caret);
        var after = current.slice(caret);
        var triggerIndex = before.lastIndexOf("@");
        if (triggerIndex < 0 || /\s/.test(before.slice(triggerIndex + 1))) return;
        elements.input.value = before.slice(0, triggerIndex) + after;
        elements.input.focus();
        elements.input.setSelectionRange(triggerIndex, triggerIndex);
        syncComposerHeight();
        updateComposerState();
        updateComposerHighlight();
        state.composerMentionDraftActive = false;
    }

    function updateComposerHighlight() {
        if (!elements.highlight || !elements.input) return;
        var value = String(elements.input.value || "");
        if (!value) {
            var placeholder = state.replyTarget ? "답장을 입력하세요." : "메시지 입력";
            elements.highlight.innerHTML = '<span class="chatComposerPlaceholder">' + escapeHtml(placeholder) + '</span>';
        } else {
            elements.highlight.innerHTML = renderComposerHighlightText(value);
        }
        syncComposerHighlightScroll();
    }

    function renderComposerHighlightText(value) {
        return renderMentionText(value || "").replace(/^↪\s/, '<span class="chatComposerReplyIcon">' + CHAT_REPLY_ICON + '</span>');
    }

    function syncComposerHighlightScroll() {
        if (!elements.highlight || !elements.input) return;
        elements.highlight.scrollTop = elements.input.scrollTop;
    }

    function renderMentionText(value) {
        return renderInlineEmoticons(escapeHtml(value).replace(/(^|[\s\n])(@[0-9A-Za-z가-힣_]+)/g, function (_, prefix, mention) {
            return prefix + '<span class="chatMentionTextColor">' + mention + '</span>';
        }));
    }

    function renderInlineEmoticons(value) {
        return String(value || "").replace(/\[emoticon-(10|[1-9])\]/g, function (_, id) {
            return '<img class="chatInlineEmoticon" src="./img/emoticon-' + id + '.png" alt="이모티콘 ' + id + '">';
        });
    }

    function isEmoticonOnlyMessageText(value) {
        return /^\[emoticon-(10|[1-9])\]$/.test(String(value || "").trim());
    }

    function renderChatBubbleText(value) {
        var reply = parseReplyMessageText(value);
        if (!reply) return renderMentionText(value);
        return '<span class="chatBubbleReplyMeta">' + escapeHtml(getReplyRecipientText(reply.sender)) + '</span>' +
            '<span class="chatBubbleReplyDivider"></span>' +
            '<span class="chatBubbleReplyBody">' + renderMentionText(reply.body) + '</span>';
    }

    function parseReplyMessageText(value) {
        var match = String(value || "").match(/^↪\s*([^:\n]+):\s*[^\n]*\n([\s\S]*)$/);
        if (!match) return null;
        return {
            sender: String(match[1] || "").trim(),
            body: String(match[2] || "").trim()
        };
    }

    function getReplyRecipientText(sender) {
        sender = String(sender || "메시지").trim().replace(/님$/, "");
        return sender + "님에게 답장";
    }

    function handleMentionDeleteKey(event) {
        if (!elements.input || (event.key !== "Backspace" && event.key !== "Delete")) return;
        var current = String(elements.input.value || "");
        var start = Number(elements.input.selectionStart || 0);
        var end = Number(elements.input.selectionEnd || start);
        var range = findMentionDeleteRange(current, start, end, event.key);
        if (!range) return;
        event.preventDefault();
        elements.input.value = current.slice(0, range.start) + current.slice(range.end);
        elements.input.setSelectionRange(range.start, range.start);
        syncComposerHeight();
        syncMentionSuggestions();
        updateComposerState();
        updateComposerHighlight();
    }

    function expandMentionSelection() {
        if (!elements.input) return;
        var current = String(elements.input.value || "");
        var start = Number(elements.input.selectionStart || 0);
        var end = Number(elements.input.selectionEnd || start);
        if (start === end) return;
        var expanded = expandRangeToMentions(current, start, end);
        if (!expanded || (expanded.start === start && expanded.end === end)) return;
        elements.input.setSelectionRange(expanded.start, expanded.end);
    }

    function findMentionDeleteRange(value, start, end, key) {
        if (start !== end) return expandRangeToMentions(value, start, end);
        var ranges = getMentionRanges(value);
        for (var index = 0; index < ranges.length; index += 1) {
            var range = ranges[index];
            if (key === "Backspace" && start > range.start && start <= range.end) return range;
            if (key === "Delete" && start >= range.start && start < range.end) return range;
        }
        return null;
    }

    function expandRangeToMentions(value, start, end) {
        var ranges = getMentionRanges(value);
        var nextStart = start;
        var nextEnd = end;
        var changed = false;
        ranges.forEach(function (range) {
            if (end <= range.start || start >= range.end) return;
            nextStart = Math.min(nextStart, range.start);
            nextEnd = Math.max(nextEnd, range.end);
            changed = true;
        });
        return changed ? { start: nextStart, end: nextEnd } : null;
    }

    function getMentionRanges(value) {
        var ranges = [];
        String(value || "").replace(/(^|[\s\n])(@[0-9A-Za-z가-힣_]+)/g, function (match, prefix, mention, offset) {
            var start = offset + String(prefix || "").length;
            ranges.push({ start: start, end: start + String(mention || "").length });
            return match;
        });
        return ranges;
    }

    function renderComposerFiles() {
        if (!elements.fileList) return;
        elements.fileList.innerHTML = state.composerFiles.map(function (file, index) {
            return '<span class="chatComposerFileItem"><span>' + escapeHtml(file.name || "첨부파일") + '</span><button type="button" data-remove-chat-file="' + index + '" aria-label="첨부 삭제"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="#1b1b1b" viewBox="0 0 256 256"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path></svg></button></span>';
        }).join("");
    }

    function readComposerAttachments() {
        return readFilesAsAttachments(state.composerFiles);
    }

    function readFilesAsAttachments(files) {
        return Promise.all(Array.prototype.slice.call(files || []).map(function (file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () {
                    var result = String(reader.result || "");
                    resolve({
                        filename: file.name || "attachment",
                        type: file.type || "application/octet-stream",
                        size: file.size || 0,
                        content: result.indexOf(",") > -1 ? result.split(",").pop() : result
                    });
                };
                reader.onerror = function () {
                    reject(new Error("첨부파일을 읽지 못했습니다."));
                };
                reader.readAsDataURL(file);
            });
        }));
    }

    function formatPasteImageTimestamp() {
        var date = new Date();
        return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + "_" + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
    }

    function readImageFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
                resolve(String(reader.result || ""));
            };
            reader.onerror = function () {
                reject(new Error("이미지를 읽지 못했습니다."));
            };
            reader.readAsDataURL(file);
        });
    }

    function fetchJson(url) {
        return API.get(url, null, {
            errorMessage: "요청을 처리하지 못했습니다."
        });
    }

    function postJson(url, payload) {
        return API.post(url, payload || {}, {
            errorMessage: "요청을 처리하지 못했습니다."
        });
    }

    function getCurrentUser() {
        return {
            id: normalizeId(localStorage.getItem("userId") || ""),
            name: String(localStorage.getItem("userName") || "").trim(),
            role: String(localStorage.getItem("userRole") || "").trim(),
            department: String(localStorage.getItem("userDepartment") || "").trim()
        };
    }

    function getLastActiveTabKey(userId) {
        return CHAT_LAST_TAB_STORAGE_PREFIX + String(userId || "").trim().toLowerCase();
    }

    function readLastActiveTab(userId) {
        try {
            return localStorage.getItem(getLastActiveTabKey(userId)) === "rooms" ? "rooms" : "contacts";
        } catch (error) {
            return "contacts";
        }
    }

    function saveLastActiveTab(tab) {
        try {
            localStorage.setItem(getLastActiveTabKey(state.user.id), tab === "rooms" ? "rooms" : "contacts");
        } catch (error) {}
    }

    function matchesRoomSearch(room) {
        if (!state.search) return true;
        return normalizeSearch([formatRoomTitle(room), formatRoomLastMessageText(room)].join(" ")).indexOf(state.search) > -1;
    }

    function formatRoomTitle(room) {
        var title = String(room && room.title || "").trim();
        if (isCompanyChatRoom(room)) return "오토원";
        if (room && room.type === "department") {
            title = title || String(room.department || "").trim();
            return title.replace(/\s*채팅방\s*$/, "").trim() || "부서";
        }
        if (room && room.type === "direct") {
            return getDirectRoomDisplayName(room) || "대화방";
        }
        if (!title) return "대화방";
        if (room && room.type === "group") return title;
        return title.split(" · ")[0].trim() || title;
    }

    function getDirectRoomDisplayName(room) {
        var memberIds = (Array.isArray(room && room.memberIds) ? room.memberIds : []).map(normalizeId).filter(Boolean);
        var currentUserId = normalizeId(state.user && state.user.id || "");
        var currentUserName = String(state.user && state.user.name || "").trim();
        var otherId = memberIds.find(function (memberId) {
            return memberId && memberId !== currentUserId;
        }) || "";
        var memberNames = room && room.memberNames && typeof room.memberNames === "object" ? room.memberNames : {};
        var otherName = String(memberNames[otherId] || "").trim();
        if (otherName) return otherName;
        var contact = state.contacts.find(function (item) {
            return normalizeId(item && item.id || "") === otherId;
        });
        if (contact && contact.name) return String(contact.name || "").trim();
        var roomTitle = String(room && room.title || "").trim();
        if (roomTitle && roomTitle !== currentUserName && normalizeId(roomTitle) !== currentUserId) {
            return roomTitle.split(" · ")[0].trim();
        }
        return "";
    }

    function formatRoomMeta(room) {
        if (!room) return "";
        var count = getRoomMemberCount(room);
        if (count) return count + "명";
        if (room.type === "group") return "그룹 채팅방";
        if (room.type === "department") return "0명";
        return "";
    }

    function formatRoomLastMessageText(room) {
        var text = String(room && room.lastMessageText || "").trim();
        if (isLegacyChatRoomIntroText(text)) return "채팅방이 개설되었습니다.";
        return formatPlainEmoticonText(getReplyMessageBodyText(text) || text);
    }

    function getReplyMessageBodyText(text) {
        var match = String(text || "").match(/^↪\s*[^:\n]+:\s*[^\n]*\n([\s\S]*)$/);
        return match ? String(match[1] || "").trim() : "";
    }

    function formatPlainEmoticonText(text) {
        return String(text || "").replace(/\[emoticon-(10|[1-9])\]/g, "이모티콘").trim();
    }

    function getMessageListPreview(message, fallback) {
        var poll = normalizePollData(message && message.poll);
        if (isDeletedMessage(message)) return "삭제된 메시지입니다.";
        if (poll) return "투표: " + poll.title;
        var text = String(message && message.text || "").trim();
        if (text) return text;
        var attachments = Array.isArray(message && message.attachmentsData) ? message.attachmentsData : [];
        return attachments.length ? "사진" : String(fallback || "").trim();
    }

    function syncRoomSummaryFromMessages(room, messages) {
        if (!room) return room;
        var latest = (Array.isArray(messages) ? messages : []).slice().reverse().find(function (message) {
            return message && !isIntroSystemMessage(message);
        });
        if (!latest) return room;
        return Object.assign({}, room, {
            lastMessageText: getMessageListPreview(latest, room.lastMessageText),
            lastMessageAt: String(latest.createdAt || room.lastMessageAt || "").trim(),
            lastSenderId: String(latest.senderId || room.lastSenderId || "").trim(),
            lastSenderName: String(latest.senderName || room.lastSenderName || "").trim(),
            hasHistory: true
        });
    }

    function isDeletedMessage(message) {
        return !!String(message && message.deletedAt || "").trim();
    }

    function isLegacyChatRoomIntroText(text) {
        return /^(오토원 전사|.+ 단체) 채팅방입니다\.$/.test(String(text || "").trim());
    }

    function isCompanyChatRoomExcludedMember(memberId) {
        return normalizeId(memberId) === "test";
    }

    function getRoomMemberCount(room) {
        var memberIds = Array.isArray(room && room.memberIds) ? room.memberIds : [];
        if (String(room && room.id || "").trim() === "chat_company_all") {
            memberIds = memberIds.filter(function (memberId) {
                return !isCompanyChatRoomExcludedMember(memberId);
            });
        }
        return memberIds.map(normalizeId).filter(Boolean).length;
    }

    function hasRoomMessages(room) {
        if (!room || !room.id) return false;
        if (room.type === "department" || room.id === "chat_company_all") return true;
        if (room.hasHistory === true) return true;
        var lastSenderId = normalizeId(room.lastSenderId || "");
        if (lastSenderId && lastSenderId !== "system") return true;
        var text = String(room.lastMessageText || "").trim();
        return !!text && !isLegacyChatRoomIntroText(text);
    }

    function isCompanyChatRoom(room) {
        return String(room && room.id || "").trim() === "chat_company_all";
    }

    function canInviteToRoom(room) {
        if (!room || !room.id) return false;
        if (isCompanyChatRoom(room)) return false;
        if (room.type === "department") return false;
        return room.type === "direct" || room.type === "group";
    }

    function isVisibleChatContact(contact) {
        var id = normalizeId(contact && contact.id || "");
        var name = String(contact && contact.name || "").trim();
        return id !== "admin" && id !== "work" && name !== "관리자";
    }

    function isVisibleChatRoom(room) {
        var memberIds = (Array.isArray(room && room.memberIds) ? room.memberIds : []).map(normalizeId);
        return memberIds.indexOf("admin") === -1 && memberIds.indexOf("work") === -1;
    }

    function matchesContactSearch(contact) {
        if (!state.search) return true;
        return normalizeSearch([contact.id, contact.name, contact.department, contact.position, contact.jobGrade, formatContactMeta(contact)].join(" ")).indexOf(state.search) > -1;
    }

    function matchesMemberModalSearch(contact) {
        if (!state.memberSearch) return true;
        return normalizeSearch([contact.id, contact.name, contact.department, contact.position, contact.jobGrade, formatContactMeta(contact)].join(" ")).indexOf(state.memberSearch) > -1;
    }

    function compareContactsByName(a, b) {
        var aName = String(a && a.name || a && a.id || "").trim();
        var bName = String(b && b.name || b && b.id || "").trim();
        return aName.localeCompare(bName, "ko", { sensitivity: "base" });
    }

    function compareContactsForDepartmentList(a, b) {
        var departmentCompare = compareContactDepartments(getContactDepartment(a), getContactDepartment(b));
        if (departmentCompare) return departmentCompare;
        return compareContactsByName(a, b);
    }

    function compareContactDepartments(a, b) {
        a = String(a || "").trim();
        b = String(b || "").trim();
        if (a === "대표" && b !== "대표") return -1;
        if (b === "대표" && a !== "대표") return 1;
        if (a === "부서 미지정" && b !== "부서 미지정") return 1;
        if (b === "부서 미지정" && a !== "부서 미지정") return -1;
        return a.localeCompare(b, "ko", { sensitivity: "base" });
    }

    function getPresenceStatuses() {
        return [
            { key: "online", label: "온라인" },
            { key: "away", label: "자리비움" },
            { key: "meeting", label: "회의중" },
            { key: "vacation", label: "휴가중" },
            { key: "outside", label: "외근중" },
            { key: "offline", label: "오프라인" }
        ];
    }

    function normalizePresenceStatus(value) {
        var status = normalizeId(value || "");
        return getPresenceStatuses().some(function (item) { return item.key === status; }) ? status : "offline";
    }

    function getPresenceStatusLabel(status) {
        status = normalizePresenceStatus(status);
        var item = getPresenceStatuses().find(function (option) { return option.key === status; });
        return item ? item.label : "오프라인";
    }

    function getPresenceStatusKey(userId) {
        return CHAT_PRESENCE_STORAGE_PREFIX + normalizeId(userId || "");
    }

    function readPresenceStatus(userId, isSelf) {
        try {
            return normalizePresenceStatus(localStorage.getItem(getPresenceStatusKey(userId)) || (isSelf || normalizeId(userId) === normalizeId(state && state.user && state.user.id) ? "online" : "offline"));
        } catch (error) {
            return isSelf || normalizeId(userId) === normalizeId(state && state.user && state.user.id) ? "online" : "offline";
        }
    }

    function savePresenceStatus(userId, status) {
        try {
            localStorage.setItem(getPresenceStatusKey(userId), normalizePresenceStatus(status));
        } catch (error) {}
    }

    function setOwnPresenceStatus(status) {
        state.userStatus = normalizePresenceStatus(status);
        state.statusMenuOpen = false;
        savePresenceStatus(state.user.id, state.userStatus);
        renderContacts();
    }

    function closeContactStatusMenu() {
        if (!state.statusMenuOpen) return;
        state.statusMenuOpen = false;
        if (state.activeTab === "contacts") renderContacts();
    }

    function renderStatusPill(status) {
        status = normalizePresenceStatus(status);
        return '<span class="chatStatusPill chatStatusPill--' + escapeHtml(status) + '">' + escapeHtml(getPresenceStatusLabel(status)) + '</span>';
    }

    function renderStatusMenu(activeStatus) {
        activeStatus = normalizePresenceStatus(activeStatus);
        return [
            '<div class="chatStatusMenu" role="menu">',
            getPresenceStatuses().map(function (item) {
                return [
                    '<button type="button" class="chatStatusMenuItem' + (item.key === activeStatus ? ' is-active' : '') + '" data-chat-status="' + escapeHtml(item.key) + '" role="menuitem">',
                    '<span class="chatStatusDot chatStatusDot--' + escapeHtml(item.key) + '"></span>',
                    '<span>' + escapeHtml(item.label) + '</span>',
                    '</button>'
                ].join("");
            }).join(""),
            '</div>'
        ].join("");
    }

    function formatContactMeta(contact) {
        var department = getContactDepartment(contact);
        var position = String(contact && contact.position || "").trim();
        var duty = String(contact && (contact.jobGrade || contact.duty || contact.responsibility || contact.jobTitle || "") || "").trim();
        var positionText = position || duty;
        var dutyText = duty || "팀원";

        if (department === "대표") return "대표";
        if (!positionText) return department;
        return department + " · " + positionText + "(" + dutyText + ")";
    }

    function getContactDepartment(contact) {
        var department = normalizeChatContactDepartment(contact, contact && contact.department || "");
        if (department && department !== "부서 미지정") return department;
        if (isRepresentativeContact(contact)) return "대표";
        return "부서 미지정";
    }

    function normalizeChatContact(contact) {
        var item = contact || {};
        return {
            id: normalizeId(item.id || item.loginId || ""),
            name: String(item.name || item.id || "").trim(),
            role: String(item.role || "").trim(),
            department: normalizeChatContactDepartment(item, item.department || ""),
            position: String(item.position || "").trim(),
            jobGrade: String(item.jobGrade || item.duty || item.responsibility || item.jobTitle || "").trim()
        };
    }

    function normalizeChatContactDepartment(contact, department) {
        var name = String(contact && contact.name || "").trim();
        var id = normalizeId(contact && contact.id || contact && contact.loginId || "");
        if (id === "jinzero" || name === "박진영") return "경영지원";
        return String(department || "").trim();
    }

    function syncCurrentChatUser(me) {
        if (!me) return;
        var normalized = normalizeChatContact(me);
        if (normalized.id && normalizeId(state.user.id) === normalized.id) {
            state.user.name = normalized.name || state.user.name;
            state.user.role = normalized.role || state.user.role;
            state.user.department = normalized.department || state.user.department;
        }
    }

    function getContactsWithSelf() {
        var selfContact = normalizeChatContact({
            id: state.user && state.user.id || "",
            name: state.user && state.user.name || "",
            role: state.user && state.user.role || "",
            department: state.user && state.user.department || ""
        });
        var byId = {};
        var list = [];
        [selfContact].concat(state.contacts || []).forEach(function (contact) {
            var item = normalizeChatContact(contact);
            var id = normalizeId(item.id || "");
            if (!id || byId[id] || !isVisibleChatContact(item)) return;
            byId[id] = true;
            list.push(item);
        });
        return list;
    }

    function isSelfContact(contact) {
        return normalizeId(contact && contact.id || "") === normalizeId(state.user && state.user.id || "");
    }

    function isRepresentativeContact(contact) {
        var name = String(contact && contact.name || "").trim();
        var id = normalizeId(contact && contact.id || "");
        var role = normalizeId(contact && contact.role || "");
        var position = String(contact && contact.position || "").trim();

        return name === "최재성" ||
            id === "jschoi" ||
            role === "admin" ||
            role === "ceo" ||
            position === "대표" ||
            id === "ceo";
    }

    function normalizeMessage(message) {
        return {
            id: String(message && message.id || ""),
            roomId: String(message && message.roomId || ""),
            text: String(message && message.text || ""),
            senderId: normalizeId(message && message.senderId || ""),
            senderName: String(message && message.senderName || "").trim(),
            senderDepartment: String(message && message.senderDepartment || "").trim(),
            attachmentsData: Array.isArray(message && message.attachmentsData) ? message.attachmentsData : [],
            poll: normalizePollData(message && message.poll),
            deletedAt: String(message && message.deletedAt || ""),
            deletedBy: normalizeId(message && message.deletedBy || ""),
            pending: message && message.pending === true,
            createdAt: String(message && message.createdAt || "")
        };
    }


    function normalizeId(value) {
        return String(value || "").trim().toLowerCase();
    }

    function normalizeSearch(value) {
        return String(value || "").trim().toLowerCase();
    }

    function getInitial(value) {
        var nameChars = Array.from(String(value || "").replace(/\s+/g, ""));
        if (!nameChars.length) return "?";
        return nameChars[Math.floor(nameChars.length / 2)] || "?";
    }

    function getAvatarStyle(value) {
        if (isRepresentativeAvatarValue(value)) {
            return "background-color:#0373ef;color:#fff;";
        }
        var colors = ["#f99790", "#f3c364", "#83c0f9", "#84c9a1", "#bda5ef"];
        var source = String(value || "").trim();
        var hash = 0;
        for (var index = 0; index < source.length; index += 1) {
            hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
        }
        return "background-color:" + colors[hash % colors.length] + ";color:#fff;";
    }

    function isRepresentativeAvatarValue(value) {
        var source = String(value || "").trim();
        var normalized = normalizeId(source);
        return normalized === "jschoi" ||
            normalized === "ceo" ||
            source === "최재성" ||
            source === "대표";
    }

    function formatChatTime(value) {
        if (!value) return "";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "";
        var now = new Date();
        var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var dayDiff = Math.round((startOfToday.getTime() - target.getTime()) / 86400000);
        if (dayDiff === 0) return formatKoreanClockTime(date);
        if (dayDiff === 1) return "어제";
        return String(date.getMonth() + 1) + "월 " + String(date.getDate()) + "일";
    }

    function formatMessageTime(value) {
        if (!value) return "";
        var date = new Date(value);
        if (isNaN(date.getTime())) return "";
        return formatKoreanClockTime(date);
    }

    function formatKoreanClockTime(date) {
        return (date.getHours() < 12 ? "오전 " : "오후 ") + String(date.getHours() % 12 || 12) + ":" + pad(date.getMinutes());
    }

    function refreshChatMenuUnreadBadge() {
        if (window.ChatMenuUnread && typeof window.ChatMenuUnread.refresh === "function") {
            window.ChatMenuUnread.refresh();
        }
    }

    function formatDateKey(value) {
        var date = new Date(value);
        if (isNaN(date.getTime())) return "";
        return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    }

    function formatDateLabel(value) {
        var date = new Date(value);
        if (isNaN(date.getTime())) return "";
        var weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
        return date.getFullYear() + "년 " + String(date.getMonth() + 1) + "월 " + String(date.getDate()) + "일 " + weekdays[date.getDay()];
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

    function renderListError(message) {
        var html = '<div class="chatEmptyList">' + escapeHtml(message || "채팅 정보를 불러오지 못했습니다.") + '</div>';
        if (elements.roomList) elements.roomList.innerHTML = html;
        if (elements.contactList) elements.contactList.innerHTML = html;
    }
})();
