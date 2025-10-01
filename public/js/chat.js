'use strict';



class ChatManager {
    constructor() {
        this.isFocused = false;
        this.isVisible = false; 
        this.messages = [];
        this.visiblePassiveMessages = [];
        this.maxPassiveMessages = 8;
        this.passiveMessageTimeout = 14000;
        this.canSendMessage = true; // <-- DODAJ TĘ LINIĘ

        // NOWOŚĆ: Przechowuje historię wysłanych wiadomości.
        this.sentMessages = [];
        // NOWOŚĆ: Śledzi pozycję w historii przeglądanych wiadomości.
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

    _createDOMElements() {
        // Ta funkcja pozostaje bez zmian.
        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'chat-container';
        this.messageList = document.createElement('ul');
        this.messageList.id = 'chat-messages';
        this.chatInput = document.createElement('input');
        this.chatInput.id = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Naciśnij Enter, aby wysłać...';
        this.chatInput.maxLength = 100;
        this.chatContainer.appendChild(this.messageList);
        this.chatContainer.appendChild(this.chatInput);
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
            /* ======================= POCZĄTEK ZMIAN ======================= */
            #chat-messages .me-message { color: #8e36d1ff; font-style: italic;font-weight: bold; }
            /* ======================== KONIEC ZMIAN ========================= */
            #chat-input {
                display: none;
                border: none;
                padding: 8px 10px;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                outline: none;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    _addEventListeners() {
        // ZMIANA: Dodano obsługę klawiszy strzałek.
        document.addEventListener('keydown', (e) => {
            if (document.activeElement === this.chatInput) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._sendMessage();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.toggleFocus(false);
                } 
                // NOWOŚĆ: Obsługa strzałki w górę.
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (this.sentMessages.length > 0 && this.historyIndex > 0) {
                        this.historyIndex--;
                        this.chatInput.value = this.sentMessages[this.historyIndex];
                    }
                } 
                // NOWOŚĆ: Obsługa strzałki w dół.
                else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (this.historyIndex < this.sentMessages.length - 1) {
                        this.historyIndex++;
                        this.chatInput.value = this.sentMessages[this.historyIndex];
                    } else if (this.historyIndex === this.sentMessages.length - 1) {
                        // Jeśli dojdziemy do końca, czyścimy pole
                        this.historyIndex++;
                        this.chatInput.value = '';
                    }
                }
                return;
            }
            if (document.activeElement.tagName.toLowerCase() === 'input') {
                return;
            }
            if (!this.isVisible) return;
            if (window.isCustomizationMenuOpen) return;
            if (e.key.toLowerCase() === 't' && !this.isFocused) {
                e.preventDefault();
                this.toggleFocus(true);
            } else if (e.key === 'Escape' && this.isFocused) {
                e.preventDefault();
                this.toggleFocus(false);
            }
        });
    }

    toggleFocus(focus) {
        this.isFocused = focus;
        this._updateUI();

        if (this.isFocused) {
            this.chatInput.focus();
            this.visiblePassiveMessages = [];
            // NOWOŚĆ: Resetujemy pozycję w historii po otwarciu czatu.
            this.historyIndex = this.sentMessages.length;
        } else {
            this.chatInput.blur();
        }
    }
    
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

    // ======================= POCZĄTEK ZMIAN =======================
    addMeActionMessage(username, actionText) {
        const newMessage = {
            id: Date.now() + Math.random(),
            username: username,
            message: actionText, // Tutaj `message` to tekst akcji
            isNotification: false,
            type: 'me',
            recipientName: null
        };

        this._processAndDisplayMessage(newMessage);
    }

    _processAndDisplayMessage(newMessage) {
    // ======================== KONIEC ZMIAN =========================
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
            // ======================= POCZĄTEK ZMIAN =======================
            } else if (msgData.type === 'me') {
                const safeUsername = document.createTextNode(msgData.username).textContent;
                li.innerHTML = `<span class="me-message">* ${safeUsername} ${safeMessage} *</span>`;
            // ======================== KONIEC ZMIAN =========================
            } else {
                li.innerHTML = `<span class="username">${msgData.username}:</span> ${safeMessage}`;
            }
            this.messageList.appendChild(li);
        });

        this.messageList.scrollTop = this.messageList.scrollHeight;
    }

    _sendMessage() {
        const messageText = this.chatInput.value.trim();

        // Sprawdź, czy gracz może wysłać wiadomość
        if (!this.canSendMessage) {
            // Użyj istniejącego systemu powiadomień z script.js
            if (typeof window.showNotification === 'function') {
                window.showNotification("Slow down!", 'warning');
            }
            return; // Zatrzymaj funkcję, jeśli cooldown jest aktywny
        }

        if (messageText) {
            // Ustaw cooldown natychmiast po wysłaniu wiadomości
            this.canSendMessage = false;
            setTimeout(() => {
                this.canSendMessage = true;
            }, 2000); // 3000 milisekund = 3 sekundy

            this.sentMessages.push(messageText);
            if (this.sentMessages.length > 50) {
                this.sentMessages.shift();
            }

            // ======================= POCZĄTEK ZMIAN =======================
            if (messageText.startsWith('/me ')) {
                const actionText = messageText.substring(4);
                if (actionText && typeof window.sendPlayerAction === 'function') {
                    window.sendPlayerAction('sendMeCommand', { action: actionText });
                }
            // ======================== KONIEC ZMIAN =========================
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
                }
            }
            this.chatInput.value = '';
        }
        this.toggleFocus(false);
    }

    _updateUI() {
        // Ta funkcja pozostaje bez zmian.
        if (this.isFocused) {
            this.chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            this.chatContainer.classList.add('focused');
            this.chatInput.style.display = 'block';
        } else {
            this.chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0)';
            this.chatContainer.classList.remove('focused');
            this.chatInput.style.display = 'none';
        }
        const singleMessageHeight = 22;
        this.messageList.style.maxHeight = `${this.maxPassiveMessages * singleMessageHeight}px`;
        this._updateMessageList();
    }
}