'use strict';
class SoundtrackManager {
constructor() {
// --- DOSTOSUJ TĘ LISTĘ ---
// Dodaj tutaj swoje utwory. Upewnij się, że ścieżki są poprawne.
this.playlist = [
{ src: 'sound/music/191970.mp3', artist: 'Mekill', title: '191970' },
{ src: 'sound/music/solace.mp3', artist: 'Mekill', title: 'solace' },


];

this.audioElement = new Audio();
    this.audioElement.volume = 1; // Domyślna głośność muzyki
    this.currentTrackIndex = -1;
    this.isStarted = false;

    // Powiązanie eventu `ended` na stałe z metodą klasy
    this.audioElement.addEventListener('ended', () => this.playRandomSong());

    this.setupStyles();
}

/**
 * Dodaje do strony niezbędne style CSS do wyświetlania informacji o utworze.
 */
setupStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        #song-notification {
            position: fixed;
            /* === ZMIANA 1: Pozycjonowanie od dołu zamiast od góry === */
            bottom: 40px; 
            left: 50%;
            /* Usunięto transform, ponieważ animacja będzie nim zarządzać */
            z-index: 10001; /* Wysoki z-index, aby być na wierzchu */
            padding: 12px 20px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            animation: fadeInOutNotification 5s ease-in-out forwards;
            pointer-events: none; /* Ignoruj kliknięcia */
        }

        #song-notification-text {
            font-family: 'Segoe UI', sans-serif;
            font-size: 20px;
            font-weight: 400;
            color: white;
            /* Czarna obramówka tekstu */
            text-shadow: 
                -1.5px -1.5px 0 #000,  
                 1.5px -1.5px 0 #000,
                -1.5px  1.5px 0 #000,
                 1.5px  1.5px 0 #000;
        }
        
        #song-notification-text i {
            font-style: italic;
            font-weight: normal;
        }

        #song-notification img {
            width: 24px;
            height: 24px;
            filter: drop-shadow(0 0 2px black);
        }

        /* === ZMIANA 2: Dostosowanie animacji do nowej pozycji === */
        @keyframes fadeInOutNotification {
            0% { 
                opacity: 0; 
                transform: translate(-50%, 30px); /* Start niżej */
            }
            15% { 
                opacity: 1; 
                transform: translate(-50%, 0); /* Wsuń się na pozycję docelową */
            }
            85% { 
                opacity: 1; 
                transform: translate(-50%, 0); /* Pozostań na miejscu */
            }
            100% { 
                opacity: 0; 
                transform: translate(-50%, 30px); /* Wysuń się w dół */
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Wyświetla na ekranie animowany panel z informacją o bieżącym utworze.
 * @param {object} song - Obiekt utworu z playlisty.
 */
displaySongInfo(song) {
    // Usuń poprzednie powiadomienie, jeśli istnieje
    const oldNotification = document.getElementById('song-notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    const container = document.createElement('div');
    container.id = 'song-notification';

    const textSpan = document.createElement('span');
    textSpan.id = 'song-notification-text';
    textSpan.innerHTML = `<i>${song.title}</i> - ${song.artist}`;

    const noteImg1 = document.createElement('img');
    noteImg1.src = 'img/ui/note.png';

    const noteImg2 = document.createElement('img');
    noteImg2.src = 'img/ui/note.png';
    
    container.appendChild(noteImg1);
    container.appendChild(textSpan);
    container.appendChild(noteImg2);

    document.body.appendChild(container);

    // Usuń element po zakończeniu animacji, aby utrzymać czystość w DOM
    setTimeout(() => {
        if (container) container.remove();
    }, 5000); // Czas musi być zgodny z czasem trwania animacji
}

/**
 * Losuje i odtwarza następny utwór z playlisty.
 */
playRandomSong() {
    if (!this.isStarted || this.playlist.length === 0) {
        return;
    }

    let nextTrackIndex;
    // Pętla zapewnia, że następny utwór nie będzie taki sam jak poprzedni (jeśli playlista ma więcej niż 1 utwór)
    do {
        nextTrackIndex = Math.floor(Math.random() * this.playlist.length);
    } while (this.playlist.length > 1 && nextTrackIndex === this.currentTrackIndex);
    
    this.currentTrackIndex = nextTrackIndex;
    const song = this.playlist[this.currentTrackIndex];

    this.audioElement.src = song.src;
    this.audioElement.play().catch(error => {
        console.error(`Soundtrack error: Could not play audio. User interaction might be required.`, error);
    });
    
    this.displaySongInfo(song);
}

/**
 * Rozpoczyna odtwarzanie ścieżki dźwiękowej.
 */
start() {
    if (this.isStarted) return;
    this.isStarted = true;
    console.log('Starting soundtrack...');
    this.playRandomSong();
}

/**
 * Zatrzymuje odtwarzanie ścieżki dźwiękowej.
 */
stop() {
    if (!this.isStarted) return;
    this.isStarted = false;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.currentTrackIndex = -1;
    console.log('Soundtrack stopped.');
}

/**
 * Umożliwia zewnętrzną kontrolę głośności.
 * @param {number} volume - Głośność w zakresie od 0.0 do 1.0.
 */
setVolume(volume) {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
}
}