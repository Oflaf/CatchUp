// scoreboard.js
'use strict';

class ScoreboardManager {
    constructor() {
        this.scores = []; // Przechowuje wyniki w formacie { username, fishName, size }
        this.isVisible = true;
    }

    /**
     * Aktualizuje lokalną tablicę wyników danymi z serwera.
     * @param {Array} newScores - Nowa tablica wyników.
     */
    updateScores(newScores) {
        if (Array.isArray(newScores)) {
            this.scores = newScores;
        }
    }

    /**
     * Rysuje scoreboard na canvasie w prawym dolnym rogu.
     * @param {CanvasRenderingContext2D} ctx - Kontekst rysowania canvas.
     */
    draw(ctx) {
        if (!this.isVisible || this.scores.length === 0) {
            return;
        }

        const margin = 25;
        const startY = ctx.canvas.height - margin; // Punkt odniesienia Y na dole
        const lineHeight = 22;
        const titleFontSize = 18;
        const entryFontSize = 16;
        const font = "'Segoe UI', sans-serif";
        const backgroundColor = 'rgba(0, 0, 0, 0.45)';
        const padding = 12;

        // Wstępne obliczenie wymiarów, aby dopasować tło
        let maxWidth = 0;
        ctx.font = `bold ${entryFontSize}px ${font}`;
        this.scores.forEach((score, index) => {
            const text = `${index + 1}. ${score.username} > ${score.fishName} > ${score.size}cm`;
            const textWidth = ctx.measureText(text).width;
            if (textWidth > maxWidth) {
                maxWidth = textWidth;
            }
        });

        ctx.font = `bold ${titleFontSize}px ${font}`;
        const title = "LEADERBOARD";
        const titleWidth = ctx.measureText(title).width;
        if (titleWidth > maxWidth) {
            maxWidth = titleWidth;
        }

        const boxWidth = maxWidth + padding * 2;
        const boxHeight = (this.scores.length * lineHeight) + titleFontSize + padding * 2 + 5; // +5 na dodatkowy odstęp
        
        // Oblicz startX po ustaleniu szerokości boxu, aby umieścić go po prawej stronie
        const startX = ctx.canvas.width - margin - boxWidth;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Używamy koordynatów ekranu


        // Ustawienia dla obramówki tekstu
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3.5; // Grubość obramówki
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Rysuj tytuł
        const titleX = startX + padding;
        const titleY = startY - boxHeight + padding;
        ctx.fillStyle = '#FFD700'; // Złoty kolor
        ctx.font = `bold ${titleFontSize}px ${font}`;
        ctx.strokeText(title, titleX, titleY); // Rysuj obramówkę
        ctx.fillText(title, titleX, titleY);   // Rysuj wypełnienie

        // Rysuj wyniki
        ctx.fillStyle = 'white';
        ctx.font = `bold ${entryFontSize}px ${font}`;
        this.scores.forEach((score, index) => {
            const text = `${index + 1}. ${score.username} | ${score.fishName} | ${score.size}cm`;
            const yPos = (startY - boxHeight) + padding + titleFontSize + 5 + (index * lineHeight);
            ctx.strokeText(text, titleX, yPos); // Rysuj obramówkę
            ctx.fillText(text, titleX, yPos);   // Rysuj wypełnienie
        });

        ctx.restore();
    }
}