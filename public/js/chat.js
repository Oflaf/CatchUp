'use strict';

class ChatManager {
    constructor() {
        this.isFocused = false;
        this.isVisible = false;
        this.messages = [];
        this.visiblePassiveMessages = [];
        this.maxPassiveMessages = 8;
        this.passiveMessageTimeout = 14000;
        this.canSendMessage = true;
        this.sentMessages = [];
        this.historyIndex = -1;

        this._createDOMElements();
        this._addEventListeners();
        this._updateUI();
    }

    show() {
        this.isVisible = true;
        this.chatContainer.style.display = 'flex';
    }

    hide() {
        this.isVisible = false;
        this.chatContainer.style.display = 'none';
        if (this.isFocused) {
            this.toggleFocus(false);
        }
    }

    focusChat() {
        if (!this.isFocused && this.isVisible && !window.isCustomizationMenuOpen) {
            this.toggleFocus(true);
        }
    }

    _createDOMElements() {
        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'chat-container';
        this.messageList = document.createElement('ul');
        this.messageList.id = 'chat-messages';

        // === NOWOŚĆ: Wrapper dla pola input i przycisku ===
        this.inputWrapper = document.createElement('div');
        this.inputWrapper.className = 'chat-input-wrapper';

        this.chatInput = document.createElement('input');
        this.chatInput.id = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Press ENTER to send message...';
        this.chatInput.maxLength = 100;

        // === NOWOŚĆ: Przycisk wysyłania ===
        this.sendButton = document.createElement('button');
        this.sendButton.id = 'chat-send-btn';
        const sendImg = document.createElement('img');
        sendImg.src = 'img/ui/arrow.png';
        this.sendButton.appendChild(sendImg);
        
        this.inputWrapper.appendChild(this.chatInput);
        this.inputWrapper.appendChild(this.sendButton);

        this.chatContainer.appendChild(this.messageList);
        this.chatContainer.appendChild(this.inputWrapper);

        document.body.appendChild(this.chatContainer);

        const style = document.createElement('style');
        style.innerHTML = `
            #chat-container {
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 500px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                font-family: 'Segoe UI', sans-serif;
                font-size: 14px;
                border-radius: 5px;
                transition: background-color 0.3s ease;
            }
            #chat-messages {
                list-style: none;
                padding: 0 10px;
                margin: 0;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }
            #chat-container.focused #chat-messages {
                padding: 10px;
                max-height: 250px;
                overflow-y: auto;
            }
            #chat-messages::-webkit-scrollbar { width: 8px; }
            #chat-messages::-webkit-scrollbar-track { background: #2c2c2c; }
            #chat-messages::-webkit-scrollbar-thumb { background-color: #6b6b6b; border-radius: 4px; }
            #chat-messages li {
                word-break: break-word;
                color: white;
                text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
            }
            #chat-messages .username { font-weight: bold; }
            #chat-messages .notification { color: #FFD700; font-weight: bold; font-size: 14px; font-style: italic; }
            #chat-messages .dm-prefix { color: #87CEEB; font-style: italic; font-weight: bold; }
            #chat-messages .me-message { color: #8e36d1ff; font-style: italic;font-weight: bold; }
            
            /* === NOWE STYLE === */
            .chat-input-wrapper {
                display: none; /* Domyślnie ukryty */
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                background-color: rgba(0, 0, 0, 0.5);
            }
            #chat-input {
                flex-grow: 1; /* Input zajmuje całą dostępną przestrzeń */
                border: none;
                padding: 8px 10px;
                background-color: transparent;
                color: white;
                outline: none;
            }
            #chat-send-btn {
                background: #44444400;
                border: none;
                padding: 0 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
            }
            #chat-send-btn:hover { background: #5555553b; }
            #chat-send-btn img {
                width: 16px;
                transform: scaleX(-1); /* Lustrzane odbicie */
            }
        `;
        document.head.appendChild(style);
    }

    _addEventListeners() {
        // === NOWOŚĆ: Listener dla przycisku wysyłania ===
        this.sendButton.addEventListener('click', () => {
            this._sendMessage();
        });

        document.addEventListener('keydown', (e) => {
            if (document.activeElement === this.chatInput) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._sendMessage();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.toggleFocus(false);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.sentMessages.length > 0 && this.historyIndex > 0) {
                        this.historyIndex--;
                        this.chatInput.value = this.sentMessages[this.historyIndex];
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.historyIndex < this.sentMessages.length - 1) {
                        this.historyIndex++;
                        this.chatInput.value = this.sentMessages[this.historyIndex];
                    } else if (this.historyIndex === this.sentMessages.length - 1) {
                        this.historyIndex++;
                        this.chatInput.value = '';
                    }
                }
            }
        });
    }

    toggleFocus(focus) {
        this.isFocused = focus;
        this._updateUI();

        if (this.isFocused) {
            this.chatInput.focus();
            this.visiblePassiveMessages = [];
            this.historyIndex = this.sentMessages.length;
        } else {
            this.chatInput.blur();
        }
    }

    _updateUI() {
        if (this.isFocused) {
            this.chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            this.chatContainer.classList.add('focused');
            this.inputWrapper.style.display = 'flex'; // Pokaż wrapper
        } else {
            this.chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
            this.chatContainer.classList.remove('focused');
            this.inputWrapper.style.display = 'none'; // Ukryj wrapper
        }
        const singleMessageHeight = 22;
        this.messageList.style.maxHeight = `${this.maxPassiveMessages * singleMessageHeight}px`;
        this._updateMessageList();
    }
    
    // ... reszta funkcji (addMessage, _sendMessage, itp.) pozostaje bez zmian ...
    // Skopiuj je tutaj, jeśli ta odpowiedź ich nie zawiera.
    addMessage(username, message, isNotification = false, type = 'global', recipientName = null) {
        const newMessage = {
            id: Date.now() + Math.random(),
            username: username,
            message: message,
            isNotification: isNotification,
            type: type,
            recipientName: recipientName
        };
        
        this._processAndDisplayMessage(newMessage);
    }
    addMeActionMessage(username, actionText) {
        const newMessage = {
            id: Date.now() + Math.random(),
            username: username,
            message: actionText,
            isNotification: false,
            type: 'me',
            recipientName: null
        };

        this._processAndDisplayMessage(newMessage);
    }
    _processAndDisplayMessage(newMessage) {
        this.messages.push(newMessage);
        
        if (this.messages.length > 100) {
            this.messages.shift();
        }

        if (!this.isFocused) {
            this.visiblePassiveMessages.push(newMessage);
            
            if (this.visiblePassiveMessages.length > this.maxPassiveMessages) {
                this.visiblePassiveMessages.shift();
            }

            setTimeout(() => {
                this.visiblePassiveMessages = this.visiblePassiveMessages.filter(msg => msg.id !== newMessage.id);
                
                if (!this.isFocused) {
                    this._updateMessageList();
                }
            }, this.passiveMessageTimeout);
        }

        this._updateMessageList();
    }
     _updateMessageList() {
        this.messageList.innerHTML = '';
        
        const messagesToRender = this.isFocused ? this.messages : this.visiblePassiveMessages;
        
        messagesToRender.forEach(msgData => {
            const li = document.createElement('li');
            const safeMessage = document.createTextNode(msgData.message).textContent;

            if (msgData.isNotification) {
                li.innerHTML = `<span class="notification">* ${msgData.message} *</span>`;
            } else if (msgData.type === 'dm-sent') {
                li.innerHTML = `<span class="dm-prefix">[you whisper to ${msgData.recipientName}]:</span> ${safeMessage}`;
            } else if (msgData.type === 'dm-received') {
                li.innerHTML = `<span class="dm-prefix">[${msgData.username} whispers to you]:</span> ${safeMessage}`;
            } else if (msgData.type === 'me') {
                const safeUsername = document.createTextNode(msgData.username).textContent;
                li.innerHTML = `<span class="me-message">* ${safeUsername} ${safeMessage} *</span>`;
            } else {
                li.innerHTML = `<span class="username">${msgData.username}:</span> ${safeMessage}`;
            }
            this.messageList.appendChild(li);
        });

        this.messageList.scrollTop = this.messageList.scrollHeight;
    }
    _sendMessage() {
        const messageText = this.chatInput.value.trim();

        if (!this.canSendMessage) {
            if (typeof window.showNotification === 'function') {
                window.showNotification("Slow down!", 'warning');
            }
            return;
        }

        if (messageText) {
            this.canSendMessage = false;
            setTimeout(() => {
                this.canSendMessage = true;
            }, 2000);

            this.sentMessages.push(messageText);
            if (this.sentMessages.length > 50) {
                this.sentMessages.shift();
            }

            if (messageText.startsWith('/me ')) {
                const actionText = messageText.substring(4);
                if (actionText && typeof window.sendPlayerAction === 'function') {
                    window.sendPlayerAction('sendMeCommand', { action: actionText });
                }
            } else if (messageText.startsWith('/dm ')) {
                const parts = messageText.split(' ');
                const targetNickname = parts[1];
                const message = parts.slice(2).join(' ');

                if (targetNickname && message) {
                    if (typeof window.sendPlayerAction === 'function') {
                        window.sendPlayerAction('sendDirectMessage', { targetNickname, message });
                    }
                } else {
                    this.addMessage(null, 'you meant: /dm [nick] [message] ?', true);
                }
            } else {
                if (typeof window.sendPlayerAction === 'function') {
                    window.sendPlayerAction('sendChatMessage', { message: messageText });
                    window.sendPlayerAction('sendOverheadMessage', { message: messageText });
                }
            }
            this.chatInput.value = '';
        }
        this.toggleFocus(false);
    }
}