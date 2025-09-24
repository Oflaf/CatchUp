'use strict';

class ChatManager {
    constructor() {
        this.isFocused = false;
        this.isVisible = false; // <<< NOWA WŁAŚCIWOŚĆ: śledzi, czy czat powinien być widoczny
        this.messages = []; 
        this.maxPassiveMessages = 8; // Możesz zostawić wyższą wartość

        this._createDOMElements();
        this._addEventListeners();
        this._updateUI();
    }

    show() {
        this.isVisible = true;
        this.chatContainer.style.display = 'flex'; // Używamy 'flex', bo tak jest w CSS
    }

    /**
     * Ukrywa czat i deaktywuje jego logikę.
     */
    hide() {
        this.isVisible = false;
        this.chatContainer.style.display = 'none';
        // Jeśli czat był aktywny, wyłączamy go, aby uniknąć "zawieszenia"
        if (this.isFocused) {
            this.toggleFocus(false);
        }
    }


    /**
     * Tworzy niezbędne elementy HTML i style CSS dla czatu.
     * @private
     */
    _createDOMElements() {
        // Kontener główny
        this.chatContainer = document.createElement('div');
        this.chatContainer.id = 'chat-container';

        // Lista wiadomości
        this.messageList = document.createElement('ul');
        this.messageList.id = 'chat-messages';

        // Pole do wpisywania tekstu
        this.chatInput = document.createElement('input');
        this.chatInput.id = 'chat-input';
        this.chatInput.type = 'text';
        this.chatInput.placeholder = 'Naciśnij Enter, aby wysłać...';
        this.chatInput.maxLength = 100; // Ograniczenie długości wiadomości

        this.chatContainer.appendChild(this.messageList);
        this.chatContainer.appendChild(this.chatInput);
        document.body.appendChild(this.chatContainer);

        // Dodanie stylów CSS
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
                max-height: 250px; /* Więcej miejsca na wiadomości w trybie focus */
                overflow-y: auto; /* Scrollowanie */
            }
            
            /* Stylowanie paska przewijania */
            #chat-messages::-webkit-scrollbar {
                width: 8px;
            }
            #chat-messages::-webkit-scrollbar-track {
                background: #2c2c2c;
            }
            #chat-messages::-webkit-scrollbar-thumb {
                background-color: #6b6b6b;
                border-radius: 4px;
            }

            #chat-messages li {
                word-break: break-word;
                /* Biały tekst z czarną obwódką */
                color: white;
                text-shadow: 
                    -1px -1px 0 #000,  
                     1px -1px 0 #000,
                    -1px  1px 0 #000,
                     1px  1px 0 #000;
            }

            #chat-messages .username {
                font-weight: bold;
            }

            #chat-messages .notification {
                color: #FFD700; /* Żółty */
                font-weight: bold;
                font-size: 12px;
                font-style: italic;
            }

            #chat-input {
                display: none; /* Domyślnie ukryte */
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

    /**
     * Dodaje nasłuchiwacze zdarzeń dla klawiatury.
     * @private
     */
    _addEventListeners() {
    document.addEventListener('keydown', (e) => {
        // ======================= POCZĄTEK KLUCZOWEJ ZMIANY =======================

        // --- SCENARIUSZ 1: Użytkownik jest w polu wpisywania wiadomości czatu ---
        if (document.activeElement === this.chatInput) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Zatrzymaj domyślną akcję (np. odświeżenie strony)
                this._sendMessage();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.toggleFocus(false);
            }
            // Dla wszystkich innych klawiszy (a, b, c...) nic nie rób, pozwól na pisanie
            return; // Zakończ działanie funkcji tutaj
        }
        
        // --- SCENARIUSZ 2: Użytkownik jest w JAKIMKOLWIEK INNYM polu input (np. nick) ---
        if (document.activeElement.tagName.toLowerCase() === 'input') {
            return; // Nic nie rób, pozwól na swobodne pisanie w innych polach
        }

        // ======================== KONIEC KLUCZOWEJ ZMIANY =========================

        // --- SCENARIUSZ 3: Użytkownik nie jest w żadnym polu input (biega po mapie) ---
        // Ta logika wykona się tylko, jeśli nie jesteśmy w żadnym inpucie.
        
        if (!this.isVisible) return;
        if (window.isCustomizationMenuOpen) return;

        if (e.key.toLowerCase() === 't' && !this.isFocused) {
            e.preventDefault();
            this.toggleFocus(true);
        } else if (e.key === 'Escape' && this.isFocused) {
            // Ten warunek jest na wypadek, gdyby czat był "focused", ale pole input nie (teoretycznie rzadkie)
            e.preventDefault();
            this.toggleFocus(false);
        }
    });
}

    /**
     * Zmienia stan skupienia czatu (aktywny do pisania / pasywny).
     * @param {boolean} focus - Czy czat ma być aktywny.
     */
    toggleFocus(focus) {
        this.isFocused = focus;
        this._updateUI();

        if (this.isFocused) {
            this.chatInput.focus();
        } else {
            this.chatInput.blur();
        }
    }
    
    /**
     * Dodaje nową wiadomość do czatu.
     * @param {string|null} username - Nazwa gracza. Null dla powiadomień.
     * @param {string} message - Treść wiadomości.
     * @param {boolean} [isNotification=false] - Czy to jest powiadomienie systemowe.
     */
    addMessage(username, message, isNotification = false) {
        this.messages.push({
            username: username,
            message: message,
            isNotification: isNotification
        });
        
        // Ogranicz historię czatu, aby nie rosła w nieskończoność
        if (this.messages.length > 100) {
            this.messages.shift();
        }

        this._updateMessageList();
    }
    
    /**
     * Aktualizuje listę wiadomości w DOM, uwzględniając stan pasywny/aktywny.
     * @private
     */
     _updateMessageList() {
        // 1. Wyczyść widok
        this.messageList.innerHTML = '';
        
        // 2. Wybierz, które dane pokazać
        const messagesToRender = this.isFocused ? this.messages : this.messages.slice(-this.maxPassiveMessages);
        
        // 3. Stwórz i dodaj nowe elementy dla każdych danych
        messagesToRender.forEach(msgData => {
            const li = document.createElement('li');

            if (msgData.isNotification) {
                li.innerHTML = `<span class="notification">* ${msgData.message} *</span>`;
            } else {
                const safeMessage = document.createTextNode(msgData.message).textContent;
                li.innerHTML = `<span class="username">${msgData.username}:</span> ${safeMessage}`;
            }
            
            this.messageList.appendChild(li);
        });

        // Automatyczne przewijanie do najnowszej wiadomości
        this.messageList.scrollTop = this.messageList.scrollHeight;
    }

    /**
     * Obsługuje wysłanie wiadomości przez gracza.
     * @private
     */
    _sendMessage() {
        // Ta funkcja zostaje bez zmian
        const messageText = this.chatInput.value.trim();
        if (messageText) {
            if (typeof window.sendPlayerAction === 'function') {
                window.sendPlayerAction('sendChatMessage', { message: messageText });
            }
            this.chatInput.value = '';
        }
        this.toggleFocus(false);
    }

    _updateUI() {
        // Ta funkcja zostaje bez zmian
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