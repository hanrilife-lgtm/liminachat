document.addEventListener('DOMContentLoaded', () => {
    // ========== ХРАНИЛИЩЕ ==========
    const USERS_KEY = 'limina_users';
    const CURRENT_USER_KEY = 'limina_current_user';
    let users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    let currentUser = null;
    let userData = { gates: [], messages: [] };

    // ========== ЭЛЕМЕНТЫ АВТОРИЗАЦИИ ==========
    const authScreen = document.getElementById('authScreen');
    const mainScreen = document.getElementById('mainScreen');
    const chatScreen = document.getElementById('chatScreen');
    const profileScreen = document.getElementById('profileScreen');
    const phoneInput = document.getElementById('phoneInput');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const codeSection = document.getElementById('codeSection');
    const codeInput = document.getElementById('codeInput');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const authError = document.getElementById('authError');
    const logoutBtn = document.getElementById('logoutBtn');

    const usernameModal = document.getElementById('usernameModal');
    const usernameInput = document.getElementById('usernameInput');
    const confirmUsernameBtn = document.getElementById('confirmUsernameBtn');
    const usernameError = document.getElementById('usernameError');

    // Остальные элементы (заполняются после входа)
    let body, chatListContainer, addThresholdBtn, searchInput, searchBtn, themeToggle, chatThemeToggle,
        backBtn, chatTitle, messagesContainer, messageInput, sendBtn,
        fileInput, attachBtn,
        timeModal, timeInput, cancelTimeBtn, confirmTimeBtn,
        memoriesBtn, gateSettingsBtn,
        gateModal, gateModalTitle, gateNameInput, gateIconInput,
        cancelGateBtn, confirmGateBtn, inviteModal, inviteUsername,
        cancelInviteBtn, confirmInviteBtn, membersBtn, membersModal,
        membersList, closeMembersBtn, replyPreview, replyPreviewText, cancelReplyBtn,
        soundToggle, contextMenu, ctxReply, ctxCopy, ctxForward, ctxPin, ctxEdit, ctxDelete,
        chatSearchBtn, chatSearchModal, chatSearchInput, searchResults, closeChatSearchBtn,
        forwardModal, forwardChatList, cancelForwardBtn,
        changeUsernameModal, newUsernameInput, cancelChangeUsernameBtn, confirmChangeUsernameBtn, changeUsernameError,
        changePasswordModal, oldPasswordInput, newPasswordInput, cancelChangePasswordBtn, confirmChangePasswordBtn, changePasswordError,
        deleteAccountModal, cancelDeleteAccountBtn, confirmDeleteAccountBtn,
        emojiBtn, emojiPicker, voiceBtn, typingIndicator, pinnedMessages;

    let isLight = false;
    let currentGateId = null;
    let showMemories = false;
    let replyToId = null;
    let soundEnabled = true;
    let suppressSound = false;
    let audioCtx = null;
    let contextMsgId = null;
    let generatedCode = '';
    let pendingPhone = '';
    let mediaRecorder = null;
    let audioChunks = [];

    // ========== ФУНКЦИИ АВТОРИЗАЦИИ ==========
    function saveUsers() { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    function showAuthError(msg) { authError.textContent = msg; }

    function login(phone) {
        currentUser = phone;
        userData = users[phone];
        if (!userData.gates) userData.gates = [];
        if (!userData.messages) userData.messages = [];
        if (!userData.theme) userData.theme = 'dark';
        if (!userData.lastRead) userData.lastRead = {};
        isLight = userData.theme === 'light';
        updateTheme();
        localStorage.setItem(CURRENT_USER_KEY, phone);
        authScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        chatScreen.classList.add('hidden');
        profileScreen.classList.add('hidden');
        initMainUI();
        renderChatList();
        updateProfileUI();
        authError.textContent = '';
        codeInput.value = '';
        generatedCode = '';
        codeSection.classList.add('hidden');
    }

    function logout() {
        if (currentUser) {
            users[currentUser].gates = userData.gates;
            users[currentUser].messages = userData.messages;
            users[currentUser].theme = isLight ? 'light' : 'dark';
            users[currentUser].lastRead = userData.lastRead;
            saveUsers();
        }
        currentUser = null;
        userData = { gates: [], messages: [] };
        currentGateId = null;
        localStorage.removeItem(CURRENT_USER_KEY);
        authScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
        chatScreen.classList.add('hidden');
        profileScreen.classList.add('hidden');
        phoneInput.value = '';
        authError.textContent = '';
    }

    function sendCode() {
        const phone = phoneInput.value.trim();
        if (!phone) { showAuthError('Введите номер телефона'); return; }
        pendingPhone = phone;
        generatedCode = '1234';
        alert(`Демо-код: ${generatedCode}`);
        codeSection.classList.remove('hidden');
        codeInput.focus();
        showAuthError('');
    }

    function verifyCode() {
        const phone = pendingPhone;
        const code = codeInput.value.trim();
        if (!phone || !code) { showAuthError('Введите код'); return; }
        if (code !== generatedCode) { showAuthError('Неверный код'); return; }

        if (!users[phone]) {
            usernameModal.classList.remove('hidden');
            usernameInput.focus();
            usernameError.textContent = '';
            return;
        }
        if (!users[phone].username) {
            usernameModal.classList.remove('hidden');
            usernameInput.focus();
            usernameError.textContent = '';
            return;
        }
        login(phone);
    }

    function confirmUsername() {
        const username = usernameInput.value.trim().toLowerCase();
        if (!username) { usernameError.textContent = 'Введите юзернейм'; return; }
        for (let phone in users) {
            if (users[phone].username === username && phone !== pendingPhone) {
                usernameError.textContent = 'Юзернейм занят';
                return;
            }
        }
        if (!users[pendingPhone]) {
            users[pendingPhone] = {
                username: username,
                gates: [],
                messages: [],
                theme: 'dark',
                bio: '',
                password: 'default',
                lastRead: {}
            };
        } else {
            users[pendingPhone].username = username;
        }
        saveUsers();
        usernameModal.classList.add('hidden');
        login(pendingPhone);
    }

    // ========== ЗВУК ==========
    function ensureAudioContext() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
    function playNotificationSound() { if (!soundEnabled || suppressSound) return; ensureAudioContext(); try { const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2); osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.2); } catch(e) {} }

    // ========== ПРОФИЛЬ ==========
    function openProfile() { mainScreen.classList.add('hidden'); chatScreen.classList.add('hidden'); profileScreen.classList.remove('hidden'); updateProfileUI(); }
    function updateProfileUI() {
        if (!currentUser) return;
        const user = users[currentUser];
        const initials = (user.username || currentUser).substring(0,2).toUpperCase();
        if (topAvatar) topAvatar.textContent = initials;
        if (profileAvatarBig) profileAvatarBig.textContent = initials;
        if (profileNameDisplay) profileNameDisplay.textContent = user.username || 'Неизвестный';
        if (profileUsernameDisplay) profileUsernameDisplay.textContent = '@' + (user.username || currentUser);
        if (profileBioInput) profileBioInput.value = user.bio || '';
        updateSoundIconProfile();
        updateThemeIconProfile();
    }
    function updateSoundIconProfile() { if (profileSoundToggle) profileSoundToggle.innerHTML = soundEnabled ? '<i class="bx bx-volume-full"></i>' : '<i class="bx bx-volume-mute"></i>'; }
    function updateThemeIconProfile() { if (profileThemeToggle) profileThemeToggle.innerHTML = isLight ? '<i class="bx bx-sun"></i>' : '<i class="bx bx-moon"></i>'; }

    // ========== ТЕМА ==========
    function toggleTheme() {
        isLight = !isLight;
        updateTheme();
        updateThemeIconProfile();
        if (currentUser) { users[currentUser].theme = isLight ? 'light' : 'dark'; saveUsers(); }
    }
    function updateTheme() {
        if (body) body.classList.toggle('light', isLight);
        const icon = isLight ? 'bx bx-sun' : 'bx bx-moon';
        if (themeToggle) themeToggle.innerHTML = `<i class='${icon}'></i>`;
        if (chatThemeToggle) chatThemeToggle.innerHTML = `<i class='${icon}'></i>`;
    }

    // ========== ИНИЦИАЛИЗАЦИЯ UI (с проверками на null) ==========
    function initMainUI() {
        body = document.body;
        chatListContainer = document.getElementById('chatListContainer');
        addThresholdBtn = document.getElementById('addThresholdBtn');
        searchInput = document.getElementById('searchInput');
        searchBtn = document.getElementById('searchBtn');
        themeToggle = document.getElementById('themeToggle');
        chatThemeToggle = document.getElementById('chatThemeToggle');
        backBtn = document.getElementById('backBtn');
        chatTitle = document.getElementById('chatTitle');
        messagesContainer = document.getElementById('messagesContainer');
        messageInput = document.getElementById('messageInput');
        sendBtn = document.getElementById('sendBtn');
        fileInput = document.getElementById('fileInput');
        attachBtn = document.querySelector('.attach-btn');
        timeModal = document.getElementById('timeModal');
        timeInput = document.getElementById('timeInput');
        cancelTimeBtn = document.getElementById('cancelTimeBtn');
        confirmTimeBtn = document.getElementById('confirmTimeBtn');
        memoriesBtn = document.getElementById('memoriesBtn');
        gateSettingsBtn = document.getElementById('gateSettingsBtn');
        gateModal = document.getElementById('gateModal');
        gateModalTitle = document.getElementById('gateModalTitle');
        gateNameInput = document.getElementById('gateNameInput');
        gateIconInput = document.getElementById('gateIconInput');
        cancelGateBtn = document.getElementById('cancelGateBtn');
        confirmGateBtn = document.getElementById('confirmGateBtn');
        inviteModal = document.getElementById('inviteModal');
        inviteUsername = document.getElementById('inviteUsername');
        cancelInviteBtn = document.getElementById('cancelInviteBtn');
        confirmInviteBtn = document.getElementById('confirmInviteBtn');
        membersBtn = document.getElementById('membersBtn');
        membersModal = document.getElementById('membersModal');
        membersList = document.getElementById('membersList');
        closeMembersBtn = document.getElementById('closeMembersBtn');
        replyPreview = document.getElementById('replyPreview');
        replyPreviewText = document.getElementById('replyPreviewText');
        cancelReplyBtn = document.getElementById('cancelReplyBtn');
        soundToggle = document.getElementById('soundToggle');
        contextMenu = document.getElementById('contextMenu');
        ctxReply = document.getElementById('ctxReply');
        ctxCopy = document.getElementById('ctxCopy');
        ctxForward = document.getElementById('ctxForward');
        ctxPin = document.getElementById('ctxPin');
        ctxEdit = document.getElementById('ctxEdit');
        ctxDelete = document.getElementById('ctxDelete');
        chatSearchBtn = document.getElementById('chatSearchBtn');
        chatSearchModal = document.getElementById('chatSearchModal');
        chatSearchInput = document.getElementById('chatSearchInput');
        searchResults = document.getElementById('searchResults');
        closeChatSearchBtn = document.getElementById('closeChatSearchBtn');
        forwardModal = document.getElementById('forwardModal');
        forwardChatList = document.getElementById('forwardChatList');
        cancelForwardBtn = document.getElementById('cancelForwardBtn');
        changeUsernameModal = document.getElementById('changeUsernameModal');
        newUsernameInput = document.getElementById('newUsernameInput');
        cancelChangeUsernameBtn = document.getElementById('cancelChangeUsernameBtn');
        confirmChangeUsernameBtn = document.getElementById('confirmChangeUsernameBtn');
        changeUsernameError = document.getElementById('changeUsernameError');
        changePasswordModal = document.getElementById('changePasswordModal');
        oldPasswordInput = document.getElementById('oldPasswordInput');
        newPasswordInput = document.getElementById('newPasswordInput');
        cancelChangePasswordBtn = document.getElementById('cancelChangePasswordBtn');
        confirmChangePasswordBtn = document.getElementById('confirmChangePasswordBtn');
        changePasswordError = document.getElementById('changePasswordError');
        deleteAccountModal = document.getElementById('deleteAccountModal');
        cancelDeleteAccountBtn = document.getElementById('cancelDeleteAccountBtn');
        confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');
        emojiBtn = document.getElementById('emojiBtn');
        emojiPicker = document.getElementById('emojiPicker');
        voiceBtn = document.getElementById('voiceBtn');
        typingIndicator = document.getElementById('typingIndicator');
        pinnedMessages = document.getElementById('pinnedMessages');

        // Привязка событий (с проверками)
        if (addThresholdBtn) addThresholdBtn.addEventListener('click', () => openGateModal());
        if (cancelGateBtn) cancelGateBtn.addEventListener('click', () => gateModal.classList.add('hidden'));
        if (confirmGateBtn) confirmGateBtn.addEventListener('click', handleGateSubmit);
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
        if (chatThemeToggle) chatThemeToggle.addEventListener('click', toggleTheme);
        if (backBtn) backBtn.addEventListener('click', closeGate);
        if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
        if (fileInput) fileInput.addEventListener('change', handleFileSelect);
        if (memoriesBtn) memoriesBtn.addEventListener('click', toggleMemories);
        if (gateSettingsBtn) gateSettingsBtn.addEventListener('click', () => { if (!currentGateId) return; const gate = userData.gates.find(g => g.id === currentGateId); if (gate) openGateModal(gate); });
        if (membersBtn) membersBtn.addEventListener('click', showMembers);
        if (closeMembersBtn) closeMembersBtn.addEventListener('click', () => membersModal.classList.add('hidden'));
        if (confirmInviteBtn) confirmInviteBtn.addEventListener('click', inviteUser);
        if (cancelInviteBtn) cancelInviteBtn.addEventListener('click', () => inviteModal.classList.add('hidden'));
        if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', cancelReply);
        if (messageInput) messageInput.addEventListener('input', () => { autoResize(); setTyping(); });
        if (messageInput) messageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
        if (soundToggle) soundToggle.addEventListener('click', toggleSound);
        updateSoundIcon();

        // Профиль
        if (profileAvatarBtn) profileAvatarBtn.addEventListener('click', openProfile);
        if (profileBackBtn) profileBackBtn.addEventListener('click', () => { profileScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); });
        if (profileToGatesBtn) profileToGatesBtn.addEventListener('click', () => { profileScreen.classList.add('hidden'); mainScreen.classList.remove('hidden'); });
        if (profileLogoutBtn) profileLogoutBtn.addEventListener('click', logout);
        if (profileThemeToggle) profileThemeToggle.addEventListener('click', toggleTheme);
        if (profileSoundToggle) profileSoundToggle.addEventListener('click', toggleSound);
        if (profileBioInput) profileBioInput.addEventListener('input', () => { if (currentUser) { users[currentUser].bio = profileBioInput.value; saveUsers(); } });
        if (profileChangeUsernameBtn) profileChangeUsernameBtn.addEventListener('click', () => { if (changeUsernameModal) changeUsernameModal.classList.remove('hidden'); });
        if (cancelChangeUsernameBtn) cancelChangeUsernameBtn.addEventListener('click', () => { if (changeUsernameModal) changeUsernameModal.classList.add('hidden'); });
        if (confirmChangeUsernameBtn) confirmChangeUsernameBtn.addEventListener('click', changeUsername);
        if (profileChangePasswordBtn) profileChangePasswordBtn.addEventListener('click', () => { if (changePasswordModal) changePasswordModal.classList.remove('hidden'); });
        if (cancelChangePasswordBtn) cancelChangePasswordBtn.addEventListener('click', () => { if (changePasswordModal) changePasswordModal.classList.add('hidden'); });
        if (confirmChangePasswordBtn) confirmChangePasswordBtn.addEventListener('click', changePassword);
        if (profileDeleteAccountBtn) profileDeleteAccountBtn.addEventListener('click', () => { if (deleteAccountModal) deleteAccountModal.classList.remove('hidden'); });
        if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.addEventListener('click', () => { if (deleteAccountModal) deleteAccountModal.classList.add('hidden'); });
        if (confirmDeleteAccountBtn) confirmDeleteAccountBtn.addEventListener('click', deleteAccount);

        // Поиск
        if (searchBtn) searchBtn.addEventListener('click', searchByUsername);
        if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchByUsername(); });

        // Поиск в чате
        if (chatSearchBtn) chatSearchBtn.addEventListener('click', () => { if (chatSearchModal) { chatSearchModal.classList.remove('hidden'); chatSearchInput?.focus(); } });
        if (closeChatSearchBtn) closeChatSearchBtn.addEventListener('click', () => { if (chatSearchModal) chatSearchModal.classList.add('hidden'); });
        if (chatSearchInput) chatSearchInput.addEventListener('input', performChatSearch);

        // Пересылка
        if (cancelForwardBtn) cancelForwardBtn.addEventListener('click', () => { if (forwardModal) forwardModal.classList.add('hidden'); });

        // Эмодзи
        if (emojiBtn) emojiBtn.addEventListener('click', toggleEmojiPicker);
        // Голосовые
        if (voiceBtn) {
            voiceBtn.addEventListener('mousedown', startRecording);
            voiceBtn.addEventListener('mouseup', stopRecording);
            voiceBtn.addEventListener('mouseleave', stopRecording);
            voiceBtn.addEventListener('touchstart', startRecording);
            voiceBtn.addEventListener('touchend', stopRecording);
        }
        initEmojiPicker();

        // Контекстное меню
        if (messagesContainer) {
            messagesContainer.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const msgEl = e.target.closest('.message');
                if (!msgEl) return;
                contextMsgId = msgEl.dataset.id;
                showContextMenu(e.clientX, e.clientY, contextMsgId);
            });
            let longPressTimer;
            messagesContainer.addEventListener('touchstart', (e) => {
                const msgEl = e.target.closest('.message');
                if (!msgEl) return;
                longPressTimer = setTimeout(() => {
                    contextMsgId = msgEl.dataset.id;
                    const touch = e.touches[0];
                    showContextMenu(touch.clientX, touch.clientY, contextMsgId);
                }, 600);
            });
            messagesContainer.addEventListener('touchend', () => clearTimeout(longPressTimer));
            messagesContainer.addEventListener('touchmove', () => clearTimeout(longPressTimer));
        }
        document.addEventListener('click', hideContextMenu);
        if (ctxReply) ctxReply.addEventListener('click', () => { if (contextMsgId) startReply(contextMsgId); hideContextMenu(); });
        if (ctxCopy) ctxCopy.addEventListener('click', () => { if (contextMsgId) copyMessageText(contextMsgId); hideContextMenu(); });
        if (ctxForward) ctxForward.addEventListener('click', () => { if (contextMsgId) openForwardModal(contextMsgId); hideContextMenu(); });
        if (ctxPin) ctxPin.addEventListener('click', () => { if (contextMsgId) togglePin(contextMsgId); hideContextMenu(); });
        if (ctxEdit) ctxEdit.addEventListener('click', () => { if (contextMsgId) editMessage(contextMsgId); hideContextMenu(); });
        if (ctxDelete) ctxDelete.addEventListener('click', () => { if (contextMsgId) deleteMessage(contextMsgId); hideContextMenu(); });

        window.addEventListener('storage', onStorageChange);
        document.body.addEventListener('click', ensureAudioContext, { once: true });
        document.body.addEventListener('touchstart', ensureAudioContext, { once: true });
    }

    // ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
    function setTyping() {
        if (!currentGateId) return;
        if (!userData.typing) userData.typing = {};
        userData.typing[currentGateId] = Date.now();
        saveUserData();
        localStorage.setItem('limina_typing', JSON.stringify({ user: currentUser, gate: currentGateId, time: Date.now() }));
    }

    function checkTyping() {
        if (!typingIndicator) return;
        const data = JSON.parse(localStorage.getItem('limina_typing') || '{}');
        if (data.gate === currentGateId && data.user !== currentUser && Date.now() - data.time < 3000) {
            typingIndicator.classList.remove('hidden');
            typingIndicator.textContent = `${data.user} печатает...`;
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

    // ========== РЕНДЕР СПИСКА ЧАТОВ ==========
    function renderChatList() {
        if (!chatListContainer) return;
        const myGates = userData.gates;
        chatListContainer.innerHTML = '';
        if (!myGates.length) { chatListContainer.innerHTML = '<p style="text-align:center;color:#888;padding:2rem;">Нет чатов</p>'; return; }
        myGates.forEach(gate => {
            const msgs = getMessagesForGate(gate.id);
            const lastMsg = msgs.length ? msgs[msgs.length-1] : null;
            const lastTime = lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
            const lastText = lastMsg ? (lastMsg.author === currentUser ? 'Вы: ' : '') + lastMsg.text : '';
            const unread = getUnreadCount(gate.id);
            const item = document.createElement('div');
            item.className = 'chat-item';
            item.innerHTML = `
                <div class="chat-item__icon"><i class='${gate.icon || 'bx bx-chat'}'></i></div>
                <div class="chat-item__info">
                    <div class="chat-item__name">${gate.name}</div>
                    <div class="chat-item__last-msg">${escapeHtml(lastText) || 'Нет сообщений'}</div>
                </div>
                <div class="chat-item__time">${lastTime}</div>
                ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
            `;
            item.addEventListener('click', () => { markRead(gate.id); openGate(gate.id); });
            item.addEventListener('contextmenu', (e) => { e.preventDefault(); const action = prompt(`Действие с "${gate.name}":\n1 - переименовать\n2 - удалить`); if (action === '1') renameGate(gate.id); else if (action === '2') deleteGate(gate.id); });
            chatListContainer.appendChild(item);
        });
    }

    function getUnreadCount(gateId) {
        const lastRead = userData.lastRead?.[gateId] || 0;
        return getMessagesForGate(gateId).filter(m => m.timestamp > lastRead && m.author !== currentUser).length;
    }

    function markRead(gateId) {
        if (!userData.lastRead) userData.lastRead = {};
        userData.lastRead[gateId] = Date.now();
        saveUserData();
    }

    // ========== СООБЩЕНИЯ ==========
    function renderMessages() {
        if (!currentGateId || !messagesContainer) return;
        const allMsgs = getMessagesForGate(currentGateId);
        const now = Date.now();
        const filtered = allMsgs.filter(m => {
            if (m.type === 'future' && new Date(m.deliverAt).getTime() > now) return false;
            if (m.type === 'past' && !showMemories) return false;
            return true;
        }).sort((a,b) => a.timestamp - b.timestamp);
        const pinned = filtered.filter(m => m.pinned);
        const unpinned = filtered.filter(m => !m.pinned);

        if (pinnedMessages) {
            pinnedMessages.innerHTML = '';
            if (pinned.length) {
                pinnedMessages.classList.remove('hidden');
                pinned.forEach(m => {
                    const el = document.createElement('div');
                    el.className = 'pinned-message';
                    el.textContent = `📌 ${m.author}: ${m.text}`;
                    el.addEventListener('click', () => scrollToMessage(m.id));
                    pinnedMessages.appendChild(el);
                });
            } else pinnedMessages.classList.add('hidden');
        }

        let html = '';
        unpinned.forEach(msg => {
            const isMine = msg.author === currentUser;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            let replyHtml = '';
            if (msg.replyTo) {
                const replied = allMsgs.find(m => m.id === msg.replyTo);
                if (replied) replyHtml = `<div class="message__reply">↪ ${replied.author}: ${replied.text}</div>`;
                else replyHtml = `<div class="message__reply">↪ (удалено)</div>`;
            }
            let content = '';
            if (msg.type === 'image') {
                content = `<div class="message__attachment"><i class="bx bx-image"></i> Фотография</div>
                           <img src="${msg.text}" class="chat-media" alt="photo">`;
            } else if (msg.type === 'video') {
                content = `<div class="message__attachment"><i class="bx bx-video"></i> Видео</div>
                           <video src="${msg.text}" class="chat-media" controls></video>`;
            } else if (msg.type === 'audio') {
                content = `<div class="message__attachment"><i class="bx bx-microphone"></i> Голосовое сообщение</div>
                           <audio src="${msg.text}" class="chat-media" controls></audio>`;
            } else {
                content = `<div class="message__text">${escapeHtml(msg.text)}</div>`;
            }
            html += `<div class="message ${isMine ? 'message--mine' : 'message--theirs'}" data-id="${msg.id}">
                <div class="message__author">${escapeHtml(msg.author)}</div>${replyHtml}${content}
                <div class="message__meta">${timeStr}</div></div>`;
        });
        messagesContainer.innerHTML = html || '<div style="text-align:center;color:#666;padding:40px;">Нет сообщений</div>';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        checkTyping();
    }

    function togglePin(id) {
        const msg = getGlobalMessages().find(m => m.id === id);
        if (!msg) return;
        msg.pinned = !msg.pinned;
        saveUserData();
        renderMessages();
    }

    function copyMessageText(id) {
        const msg = getGlobalMessages().find(m => m.id === id);
        if (msg) navigator.clipboard.writeText(msg.text);
    }

    function openForwardModal(msgId) {
        if (!forwardChatList || !forwardModal) return;
        forwardChatList.innerHTML = '';
        userData.gates.forEach(gate => {
            if (gate.id === currentGateId) return;
            const el = document.createElement('div');
            el.className = 'chat-item';
            el.innerHTML = `<div class="chat-item__icon"><i class='${gate.icon || 'bx bx-chat'}'></i></div><div class="chat-item__info"><div class="chat-item__name">${gate.name}</div></div>`;
            el.addEventListener('click', () => { forwardMessage(msgId, gate.id); forwardModal.classList.add('hidden'); });
            forwardChatList.appendChild(el);
        });
        forwardModal.classList.remove('hidden');
    }

    function forwardMessage(msgId, targetGateId) {
        const original = getGlobalMessages().find(m => m.id === msgId);
        if (!original) return;
        const newMsg = { ...original, id: Date.now().toString(), gateId: targetGateId, author: currentUser, timestamp: Date.now(), replyTo: null };
        userData.messages.push(newMsg);
        saveUserData();
        if (targetGateId === currentGateId) renderMessages();
    }

    function startRecording() {
        if (!navigator.mediaDevices) return;
        navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.addEventListener('dataavailable', e => audioChunks.push(e.data));
            mediaRecorder.addEventListener('stop', () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => sendMessage({ type: 'audio', text: reader.result });
                reader.readAsDataURL(blob);
            });
            mediaRecorder.start();
            if (voiceBtn) voiceBtn.innerHTML = '<i class="bx bx-stop-circle"></i>';
        }).catch(() => {});
    }
    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
            if (voiceBtn) voiceBtn.innerHTML = '<i class="bx bx-microphone"></i>';
        }
    }

    function initEmojiPicker() {
        if (!emojiPicker) return;
        const emojis = ['😀','😂','❤️','👍','😢','😡','🎉','🔥','✅','❌','⭐','💬','🤔','😎','🙏','💪','🤝','🍕','🚀','🌍','📌','🔔'];
        emojiPicker.innerHTML = emojis.map(e => `<span>${e}</span>`).join('');
        emojiPicker.querySelectorAll('span').forEach(el => el.addEventListener('click', () => {
            if (messageInput) { messageInput.value += el.textContent; messageInput.focus(); }
        }));
    }
    function toggleEmojiPicker() { if (emojiPicker) emojiPicker.classList.toggle('hidden'); }

    function performChatSearch() {
        if (!chatSearchInput || !searchResults) return;
        const query = chatSearchInput.value.toLowerCase();
        const msgs = getMessagesForGate(currentGateId).filter(m => m.text && m.text.toLowerCase().includes(query));
        searchResults.innerHTML = msgs.length ? msgs.map(m => `<div class="search-result" data-id="${m.id}">${escapeHtml(m.author)}: ${escapeHtml(m.text)}</div>`).join('') : '<p style="color:#888;">Ничего не найдено</p>';
        searchResults.querySelectorAll('.search-result').forEach(el => el.addEventListener('click', () => {
            scrollToMessage(el.dataset.id);
            if (chatSearchModal) chatSearchModal.classList.add('hidden');
        }));
    }

    function scrollToMessage(id) {
        const el = document.querySelector(`.message[data-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (!files.length) return;
        for (let file of files) {
            readFileAsDataURL(file).then(dataUrl => {
                const type = file.type.startsWith('image/') ? 'image' : (file.type.startsWith('video/') ? 'video' : 'file');
                sendMessage({ type, text: dataUrl, fileName: file.name });
            });
        }
        e.target.value = '';
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    // ========== БАЗОВЫЕ ФУНКЦИИ ЧАТА ==========
    function saveUserData() { if (!currentUser) return; users[currentUser].gates = userData.gates; users[currentUser].messages = userData.messages; saveUsers(); }
    function getGlobalMessages() { let all = []; for (let u in users) { if (users[u].messages) all = all.concat(users[u].messages); } return all; }
    function getMessagesForGate(gateId) { return getGlobalMessages().filter(m => m.gateId === gateId); }

    function openGateModal(gate = null) {
        if (!gateModal) return;
        editingGateId = gate ? gate.id : null;
        gateModalTitle.textContent = gate ? 'Редактировать чат' : 'Новый чат';
        gateNameInput.value = gate ? gate.name : '';
        gateIconInput.value = gate ? gate.icon || 'bx bx-chat' : 'bx bx-chat';
        gateModal.classList.remove('hidden');
    }
    function handleGateSubmit() {
        const name = gateNameInput.value.trim();
        const icon = gateIconInput.value.trim() || 'bx bx-chat';
        if (!name) return;
        if (editingGateId) {
            const gate = userData.gates.find(g => g.id === editingGateId);
            if (gate) { gate.name = name; gate.icon = icon; }
        } else {
            userData.gates.push({ id: Date.now().toString(), name, icon, members: [currentUser] });
        }
        saveUserData();
        gateModal.classList.add('hidden');
        renderChatList();
        if (currentGateId && editingGateId === currentGateId) chatTitle.textContent = name;
    }
    function renameGate(gateId) {
        const gate = userData.gates.find(g => g.id === gateId);
        if (!gate) return;
        const newName = prompt('Новое название:', gate.name);
        if (newName && newName.trim()) { gate.name = newName.trim(); saveUserData(); renderChatList(); if (currentGateId === gateId) chatTitle.textContent = gate.name; }
    }
    function deleteGate(gateId) {
        if (!confirm('Удалить чат и все его сообщения?')) return;
        userData.gates = userData.gates.filter(g => g.id !== gateId);
        for (let u in users) { if (users[u].messages) users[u].messages = users[u].messages.filter(m => m.gateId !== gateId); }
        saveUserData(); saveUsers();
        if (currentGateId === gateId) closeGate();
        renderChatList();
    }
    function openGate(gateId) {
        const gate = userData.gates.find(g => g.id === gateId);
        if (!gate) return;
        currentGateId = gateId;
        chatTitle.textContent = gate.name;
        mainScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        replyToId = null;
        hideReplyPreview();
        renderMessages();
    }
    function closeGate() {
        chatScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        currentGateId = null;
        showMemories = false;
        renderChatList();
    }
    function handleSendMessage() {
        const text = messageInput.value.trim();
        if (!text && fileInput && !fileInput.files.length) return;
        if (text) {
            sendMessage({ type: 'text', text });
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    }
    function sendMessage(msgObj) {
        if (!currentGateId) return;
        const msg = { id: Date.now().toString(), gateId: currentGateId, ...msgObj, author: currentUser, timestamp: Date.now(), replyTo: replyToId || null };
        userData.messages.push(msg);
        saveUserData();
        replyToId = null;
        hideReplyPreview();
        renderMessages();
        suppressSound = true;
        setTimeout(() => suppressSound = false, 500);
        localStorage.setItem('limina_storage_trigger', Date.now());
    }
    function startReply(id) {
        const msg = getGlobalMessages().find(m => m.id === id);
        if (!msg) return;
        replyToId = id;
        if (replyPreviewText) replyPreviewText.textContent = `В ответ на: ${msg.author}: ${msg.text}`;
        if (replyPreview) replyPreview.classList.remove('hidden');
        if (messageInput) messageInput.focus();
    }
    function cancelReply() { replyToId = null; hideReplyPreview(); }
    function hideReplyPreview() { if (replyPreview) replyPreview.classList.add('hidden'); }
    function editMessage(id) {
        const msg = userData.messages.find(m => m.id === id);
        if (!msg || msg.author !== currentUser) return;
        const newText = prompt('Отредактируйте сообщение:', msg.text);
        if (newText !== null && newText.trim() !== '') { msg.text = newText.trim(); saveUserData(); renderMessages(); }
    }
    function deleteMessage(id) {
        const msg = userData.messages.find(m => m.id === id);
        if (!msg || msg.author !== currentUser) return;
        if (confirm('Удалить сообщение?')) { userData.messages = userData.messages.filter(m => m.id !== id); saveUserData(); renderMessages(); }
    }
    function toggleMemories() { showMemories = !showMemories; if (memoriesBtn) memoriesBtn.style.color = showMemories ? '#ffd700' : ''; renderMessages(); }
    function showMembers() {
        const gate = userData.gates.find(g => g.id === currentGateId);
        if (!gate || !membersList) return;
        membersList.innerHTML = '';
        gate.members.forEach(member => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${member}</span>${member !== currentUser ? `<button class="remove-member" data-username="${member}">Удалить</button>` : ''}`;
            li.querySelector('.remove-member')?.addEventListener('click', () => removeMember(member));
            membersList.appendChild(li);
        });
        membersModal.classList.remove('hidden');
    }
    function removeMember(username) {
        const gate = userData.gates.find(g => g.id === currentGateId);
        if (!gate || gate.members[0] !== currentUser) return;
        gate.members = gate.members.filter(m => m !== username);
        if (users[username]?.gates) users[username].gates = users[username].gates.filter(g => g.id !== currentGateId);
        saveUserData(); saveUsers();
        showMembers();
    }
    function inviteUser() {
        const username = inviteUsername.value.trim().toLowerCase();
        if (!username || username === currentUser) return;
        let foundPhone = null;
        for (let phone in users) { if (users[phone].username === username) { foundPhone = phone; break; } }
        if (!foundPhone) { alert('Пользователь не найден'); return; }
        const gate = userData.gates.find(g => g.id === currentGateId);
        if (!gate || gate.members.includes(foundPhone)) return;
        gate.members.push(foundPhone);
        if (!users[foundPhone].gates) users[foundPhone].gates = [];
        if (!users[foundPhone].gates.find(g => g.id === gate.id)) users[foundPhone].gates.push({ ...gate, members: gate.members });
        saveUserData(); saveUsers();
        inviteModal.classList.add('hidden');
        inviteUsername.value = '';
        localStorage.setItem('limina_storage_trigger', Date.now());
    }
    function searchByUsername() {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;
        const foundPhone = Object.keys(users).find(phone => users[phone].username === query && phone !== currentUser);
        if (foundPhone) {
            const existing = userData.gates.find(g => g.members.includes(foundPhone) && g.members.includes(currentUser));
            if (existing) { openGate(existing.id); }
            else {
                const newGate = { id: Date.now().toString(), name: users[foundPhone].username, icon: 'bx bx-user', members: [currentUser, foundPhone] };
                userData.gates.push(newGate);
                if (users[foundPhone]?.gates) users[foundPhone].gates.push({ ...newGate, members: [foundPhone, currentUser] });
                saveUserData(); saveUsers();
                renderChatList();
                openGate(newGate.id);
            }
        } else alert('Пользователь не найден');
    }

    function changeUsername() {
        const newUsername = newUsernameInput.value.trim().toLowerCase();
        if (!newUsername) { if (changeUsernameError) changeUsernameError.textContent = 'Введите юзернейм'; return; }
        for (let phone in users) { if (users[phone].username === newUsername && phone !== currentUser) { if (changeUsernameError) changeUsernameError.textContent = 'Юзернейм занят'; return; } }
        users[currentUser].username = newUsername;
        saveUsers();
        updateProfileUI();
        if (changeUsernameModal) changeUsernameModal.classList.add('hidden');
        if (newUsernameInput) newUsernameInput.value = '';
        if (changeUsernameError) changeUsernameError.textContent = '';
    }

    function changePassword() {
        const oldPass = oldPasswordInput.value;
        const newPass = newPasswordInput.value;
        if (!oldPass || !newPass) { if (changePasswordError) changePasswordError.textContent = 'Заполните оба поля'; return; }
        users[currentUser].password = newPass;
        saveUsers();
        if (changePasswordModal) changePasswordModal.classList.add('hidden');
        oldPasswordInput.value = '';
        newPasswordInput.value = '';
        if (changePasswordError) changePasswordError.textContent = '';
    }

    function deleteAccount() {
        delete users[currentUser];
        saveUsers();
        logout();
        if (deleteAccountModal) deleteAccountModal.classList.add('hidden');
    }

    function toggleSound() { soundEnabled = !soundEnabled; updateSoundIcon(); updateSoundIconProfile(); }
    function updateSoundIcon() { if (soundToggle) soundToggle.innerHTML = soundEnabled ? '<i class="bx bx-volume-full"></i>' : '<i class="bx bx-volume-mute"></i>'; }

    function onStorageChange(e) {
        if (e.key === 'limina_storage_trigger' || e.key === USERS_KEY) {
            if (suppressSound) {
                users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};
                if (currentUser && users[currentUser]) { userData = users[currentUser]; if (!mainScreen.classList.contains('hidden')) renderChatList(); if (!chatScreen.classList.contains('hidden') && currentGateId) renderMessages(); }
                return;
            }
            users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};
            if (currentUser && users[currentUser]) {
                userData = users[currentUser];
                if (!mainScreen.classList.contains('hidden')) renderChatList();
                if (!chatScreen.classList.contains('hidden') && currentGateId) { renderMessages(); playNotificationSound(); }
            }
        }
    }

    function autoResize() { if (messageInput) { messageInput.style.height = 'auto'; messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px'; } }
    function escapeHtml(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

    function showContextMenu(x, y, msgId) {
        if (!contextMenu) return;
        const msg = getGlobalMessages().find(m => m.id === msgId);
        if (!msg) return;
        const isMine = msg.author === currentUser;
        if (ctxEdit) ctxEdit.classList.toggle('hidden', !isMine);
        if (ctxDelete) ctxDelete.classList.toggle('hidden', !isMine);
        contextMenu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
        contextMenu.style.top = Math.min(y, window.innerHeight - 150) + 'px';
        contextMenu.classList.remove('hidden');
    }
    function hideContextMenu() { if (contextMenu) contextMenu.classList.add('hidden'); contextMsgId = null; }

    // ========== ОБРАБОТЧИКИ АВТОРИЗАЦИИ ==========
    sendCodeBtn.addEventListener('click', sendCode);
    verifyCodeBtn.addEventListener('click', verifyCode);
    confirmUsernameBtn.addEventListener('click', confirmUsername);
    logoutBtn.addEventListener('click', logout);

    // ========== АВТОВХОД ==========
    const savedPhone = localStorage.getItem(CURRENT_USER_KEY);
    if (savedPhone && users[savedPhone]) {
        if (!users[savedPhone].username) {
            pendingPhone = savedPhone;
            usernameModal.classList.remove('hidden');
        } else {
            login(savedPhone);
        }
    } else {
        authScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
        chatScreen.classList.add('hidden');
        profileScreen.classList.add('hidden');
    }
});