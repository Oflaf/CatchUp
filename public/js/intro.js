document.addEventListener('DOMContentLoaded', () => {
    // === Konfiguracja animacji ===
    const TEXT = "Solendz Caravan";
    const IMAGE_PATH = 'img/intro/';
    const FINAL_LETTER_HEIGHT = 80;
    const START_SCALE_MULTIPLIER = 35;
    const ANIMATION_DURATION_MS = 150;
    const IMPACT_BOUNCE_MS = 300;
    const DELAY_BETWEEN_LETTERS_MS = 10;
    const LETTER_SPACING = 0.2;
    const MAX_ROTATION_DEGREES = 4;
    const FADE_OUT_DELAY_MS = 800;
    const FADE_OUT_DURATION_MS = 800;

    // === Konfiguracja dla animacji "z", logo i rozsuwania ===
    const LOGO_PATH = 'img/intro/logo.png';
    const LOGO_FINAL_HEIGHT = FINAL_LETTER_HEIGHT * 3;
    const LOGO_VERTICAL_OFFSET_PX = -80;
    const Z_FALL_TRIGGER_CHAR_INDEX = 7;
    const Z_NUDGE_Y_PX = 5;
    const Z_NUDGE_ROTATION_DEG = 3;
    const Z_NUDGE_TRANSITION_MS = 200;
    const Z_FINAL_FALL_DELAY_MS = 150;
    const Z_FINAL_FALL_DURATION_MS = 400;
    const SPREAD_DURATION_MS = 600;
    const SPREAD_DELAY_MS = 100;

    // === Konfiguracja dla animacji końcowej: rozjazd i zoom logo ===
    const FINAL_SPLIT_DURATION_MS = 1200; // Czas rozjeżdżania się napisów
    const LOGO_ZOOM_DURATION_MS = 1200;   // Czas powiększania się logo
    const LOGO_ZOOM_HOLD_MS = 2000;       // Czas, przez który logo jest na pełnym ekranie
    const LOGO_WOBBLE_DEG = 2;            // Stopnie obrotu logo na boki

    // === Elementy DOM ===
    const introContainer = document.getElementById('intro-container');
    const lobby = document.getElementById('lobby');
    if (!introContainer || !lobby) {
        console.error("Intro container or lobby not found!");
        return;
    }
    
    const style = document.createElement('style');
    style.textContent = `
        .letter-z-inner {
            transition: transform ${Z_NUDGE_TRANSITION_MS}ms ease-out;
        }
        .intro-logo {
            /* Ta klasa będzie teraz na wrapperze logo */
            transition: width ${SPREAD_DURATION_MS}ms ease-in-out, 
                        left ${SPREAD_DURATION_MS}ms ease-in-out,
                        top ${SPREAD_DURATION_MS}ms ease-in-out,
                        opacity ${SPREAD_DURATION_MS * 0.7}ms ease-in-out;
        }
    `;
    document.head.append(style);

    const animationState = {
        letters: [],
        logo: null,
        currentLetterIndex: 0,
        animationFrameId: null,
        zLetterIndex: -1,
        zRotationMultiplier: 1,
    };

    function loadLetterImages() {
        const uniqueChars = [...new Set(TEXT.toLowerCase().replace(/\s/g, ''))];
        const promises = uniqueChars.map(char => new Promise((resolve, reject) => {
            const img = new Image();
            img.src = `${IMAGE_PATH}${char}.png`;
            img.onload = () => resolve({ char, img });
            img.onerror = () => reject(`Could not load image for letter: ${char}`);
        }));
        promises.push(new Promise((resolve, reject) => {
            const img = new Image();
            img.src = LOGO_PATH;
            img.onload = () => resolve({ char: 'logo', img });
            img.onerror = () => reject(`Could not load logo image!`);
        }));
        return Promise.all(promises);
    }

    async function startIntro() {
        try {
            const loadedImages = await loadLetterImages();
            const imageMap = new Map(loadedImages.map(item => [item.char, item.img]));
            prepareLetters(imageMap);
            startNextLetterAnimation();
        } catch (error) {
            console.error("Failed to start intro:", error);
            cleanupAndShowLoadingPanel();
        }
    }

    function prepareLetters(imageMap) {
        const textChars = TEXT.split('');
        const totalWidth = textChars.reduce((width, char) => {
            if (char === ' ') return width + (FINAL_LETTER_HEIGHT * 0.5);
            const img = imageMap.get(char.toLowerCase());
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            return width + (FINAL_LETTER_HEIGHT * aspectRatio) + (FINAL_LETTER_HEIGHT * LETTER_SPACING);
        }, -FINAL_LETTER_HEIGHT * LETTER_SPACING);

        const startX = (window.innerWidth - totalWidth) / 2;
        let currentX = startX;
        let letterIndexWithoutSpaces = 0;

        for (const char of textChars) {
            if (char === ' ') {
                currentX += (FINAL_LETTER_HEIGHT * 0.5);
                continue;
            }

            const isZ = char.toLowerCase() === 'z';
            const imgData = imageMap.get(char.toLowerCase());
            const aspectRatio = imgData.naturalWidth / imgData.naturalHeight;
            const finalWidth = FINAL_LETTER_HEIGHT * aspectRatio;

            const letterData = {
                targetX: currentX,
                targetY: (window.innerHeight - FINAL_LETTER_HEIGHT) / 2,
                targetW: finalWidth, targetH: FINAL_LETTER_HEIGHT,
                rotation: (Math.random() - 0.5) * 2 * MAX_ROTATION_DEGREES,
                state: 'waiting', progress: 0,
            };

            if (isZ) {
                animationState.zLetterIndex = letterIndexWithoutSpaces;
                letterData.fallY = 0;
                letterData.fallRotation = 0;

                const wrapper = document.createElement('div');
                wrapper.style.position = 'absolute';
                wrapper.style.width = `${finalWidth}px`;
                wrapper.style.height = `${FINAL_LETTER_HEIGHT}px`;
                
                const innerImg = document.createElement('img');
                innerImg.src = imgData.src;
                innerImg.classList.add('letter-z-inner');
                innerImg.style.width = '100%';
                innerImg.style.height = '100%';
                wrapper.appendChild(innerImg);
                introContainer.appendChild(wrapper);

                letterData.element = wrapper;
                letterData.innerElement = innerImg;
                
                // === POPRAWKA: Tworzenie logo z wrapperem ===
                const logoWrapper = document.createElement('div');
                const logoImg = document.createElement('img');
                const finalLogoWidth = LOGO_FINAL_HEIGHT;
                const zCenterX = currentX + finalWidth / 2;
                const logoTargetY = letterData.targetY + LOGO_VERTICAL_OFFSET_PX;

                logoImg.src = LOGO_PATH;
                logoImg.style.width = '100%';
                logoImg.style.height = '100%';

                logoWrapper.appendChild(logoImg);
                logoWrapper.classList.add('intro-logo');
                logoWrapper.style.position = 'absolute';
                logoWrapper.style.height = `${LOGO_FINAL_HEIGHT}px`;
                logoWrapper.style.opacity = '0';
                logoWrapper.style.width = '0px';
                logoWrapper.style.left = `${zCenterX}px`;
                logoWrapper.style.top = `${logoTargetY}px`;
                introContainer.appendChild(logoWrapper);

                animationState.logo = {
                    wrapper: logoWrapper,
                    element: logoImg,
                    targetWidth: finalLogoWidth,
                    targetLeft: zCenterX - (finalLogoWidth / 2),
                };

            } else {
                const imgElement = document.createElement('img');
                imgElement.src = imgData.src;
                imgElement.style.position = 'absolute';
                introContainer.appendChild(imgElement);
                letterData.element = imgElement;
            }
            
            letterData.element.style.opacity = '0';
            animationState.letters.push(letterData);
            currentX += finalWidth + (FINAL_LETTER_HEIGHT * LETTER_SPACING);
            letterIndexWithoutSpaces++;
        }
    }

    function startNextLetterAnimation() {
        if (animationState.currentLetterIndex >= animationState.letters.length) {
            setTimeout(finalZFallAnimation, Z_FINAL_FALL_DELAY_MS);
            return;
        }
        if (animationState.currentLetterIndex >= Z_FALL_TRIGGER_CHAR_INDEX && animationState.zLetterIndex !== -1) {
            updateZNudge();
        }
        const letter = animationState.letters[animationState.currentLetterIndex];
        letter.state = 'animating';
        letter.startTime = performance.now();
        if (!animationState.animationFrameId) {
            animationState.animationFrameId = requestAnimationFrame(animate);
        }
    }
    
    function updateZNudge() {
        const zLetter = animationState.letters[animationState.zLetterIndex];
        if (!zLetter || !zLetter.innerElement) return;
        zLetter.fallY += Z_NUDGE_Y_PX;
        zLetter.fallRotation += Z_NUDGE_ROTATION_DEG * animationState.zRotationMultiplier;
        animationState.zRotationMultiplier *= -1;
        zLetter.innerElement.style.transform = `translateY(${zLetter.fallY}px) rotate(${zLetter.fallRotation}deg)`;
    }

    function animate(currentTime) {
        let stillAnimating = false;
        for (let i = 0; i < animationState.letters.length; i++) {
            const letter = animationState.letters[i];
            if (letter.state === 'waiting') continue;
            const elapsed = currentTime - letter.startTime;
            let baseTransform = '';
            if (letter.state === 'animating') {
                stillAnimating = true;
                letter.progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
                const easeOutProgress = 1 - Math.pow(1 - letter.progress, 3);
                const startScale = START_SCALE_MULTIPLIER;
                const currentScale = startScale + (1 - startScale) * easeOutProgress;
                const initialX = window.innerWidth / 2 - (letter.targetW * currentScale) / 2;
                const initialY = window.innerHeight / 2 - (letter.targetH * currentScale) / 2;
                const x = initialX + (letter.targetX - initialX) * easeOutProgress;
                const y = initialY + (letter.targetY - initialY) * easeOutProgress;
                letter.element.style.opacity = letter.progress;
                letter.element.style.width = `${letter.targetW * currentScale}px`;
                letter.element.style.height = `${letter.targetH * currentScale}px`;
                baseTransform = `translate(${x}px, ${y}px) rotate(${letter.rotation}deg)`;
                if (letter.progress >= 1) {
                    letter.state = 'impact';
                    letter.startTime = currentTime;
                }
            } else if (letter.state === 'impact') {
                stillAnimating = true;
                const impactProgress = Math.min(elapsed / IMPACT_BOUNCE_MS, 1);
                const bounce = impactProgress < 0.5 ? 1 + 0.2 * (impactProgress * 2) : 1 + 0.2 * (1 - (impactProgress - 0.5) * 2);
                baseTransform = `translate(${letter.targetX}px, ${letter.targetY}px) scale(${bounce}) rotate(${letter.rotation}deg)`;
                if (impactProgress >= 1) {
                    letter.state = 'finished';
                    letter.element.style.width = `${letter.targetW}px`;
                    letter.element.style.height = `${letter.targetH}px`;
                    if (i === animationState.currentLetterIndex) {
                       animationState.currentLetterIndex++;
                       setTimeout(startNextLetterAnimation, DELAY_BETWEEN_LETTERS_MS);
                    }
                }
            } else if (letter.state === 'finished') {
                baseTransform = `translate(${letter.targetX}px, ${letter.targetY}px) scale(1) rotate(${letter.rotation}deg)`;
            }
            letter.element.style.transform = baseTransform;
        }
        if (stillAnimating) {
            animationState.animationFrameId = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationState.animationFrameId);
            animationState.animationFrameId = null;
        }
    }
    
    function finalZFallAnimation() {
        if (animationState.zLetterIndex === -1) {
            setTimeout(spreadLettersAnimation, SPREAD_DELAY_MS);
            return;
        }
        const zLetter = animationState.letters[animationState.zLetterIndex];
        const finalY = window.innerHeight + zLetter.targetH;
        const finalRotation = zLetter.rotation + zLetter.fallRotation + 90;
        zLetter.element.style.transition = `transform ${Z_FINAL_FALL_DURATION_MS}ms ease-in, opacity ${Z_FINAL_FALL_DURATION_MS}ms linear`;
        zLetter.element.style.transform = `translate(${zLetter.targetX}px, ${finalY}px) rotate(${finalRotation}deg)`;
        zLetter.element.style.opacity = '0';
        setTimeout(() => spreadLettersAnimation(), Z_FINAL_FALL_DURATION_MS + SPREAD_DELAY_MS);
    }
    
    function spreadLettersAnimation() {
        if (animationState.zLetterIndex === -1) {
            setTimeout(finalSplitAndZoom, FADE_OUT_DELAY_MS);
            return;
        }
        
        const zLetter = animationState.letters[animationState.zLetterIndex];
        const zWidth = zLetter.targetW;
        const logoWidth = animationState.logo.targetWidth;
        const widthDifference = logoWidth - zWidth;
        const shiftAmount = widthDifference / 2;

        animationState.letters.forEach((letter, index) => {
            if (index === animationState.zLetterIndex) return;
            let newTargetX = letter.targetX;
            if (index < animationState.zLetterIndex) {
                newTargetX -= shiftAmount + 30;
            } else {
                newTargetX += shiftAmount - 10;
            }
            letter.targetX = newTargetX;
            letter.element.style.transition = `transform ${SPREAD_DURATION_MS}ms ease-in-out`;
            letter.element.style.transform = `translate(${letter.targetX}px, ${letter.targetY}px) rotate(${letter.rotation}deg)`;
        });
        
        // === POPRAWKA: Animowanie wrappera logo ===
        if (animationState.logo) {
            const logo = animationState.logo;
            logo.wrapper.style.opacity = '1';
            logo.wrapper.style.left = `${logo.targetLeft}px`;
            logo.wrapper.style.width = `${logo.targetWidth}px`;
        }

        setTimeout(finalSplitAndZoom, SPREAD_DURATION_MS + FADE_OUT_DELAY_MS);
    }

    function finalSplitAndZoom() {
        const wobbleKeyframes = `
            @keyframes gentleWobble {
                0% { transform: rotate(-${LOGO_WOBBLE_DEG}deg); }
                50% { transform: rotate(${LOGO_WOBBLE_DEG}deg); }
                100% { transform: rotate(-${LOGO_WOBBLE_DEG}deg); }
            }
        `;
        const finalStyle = document.createElement('style');
        finalStyle.textContent = wobbleKeyframes;
        document.head.appendChild(finalStyle);

        const solendLetters = animationState.letters.slice(0, animationState.zLetterIndex);
        const caravanLetters = animationState.letters.slice(animationState.zLetterIndex + 1);

        const moveLetters = (letters, direction) => {
            letters.forEach(letter => {
                const finalX = direction === 'left' 
                    ? letter.targetX - (window.innerWidth + letter.targetW) 
                    : letter.targetX + window.innerWidth + letter.targetW;
                
                letter.element.style.transition = `transform ${FINAL_SPLIT_DURATION_MS}ms ease-in`;
                letter.element.style.transform = `translate(${finalX}px, ${letter.targetY}px) rotate(${letter.rotation}deg)`;
            });
        };

        moveLetters(solendLetters, 'left');
        moveLetters(caravanLetters, 'right');

        // === POPRAWKA: Nowa, niezawodna animacja logo do centrum ekranu ===
        if (animationState.logo && animationState.logo.wrapper) {
            const logoWrapper = animationState.logo.wrapper;
            const logoElement = animationState.logo.element; // Wewnętrzny <img>
            
            // 1. Zastosuj animację obrotu do wewnętrznego obrazka
            const totalWobbleTime = LOGO_ZOOM_DURATION_MS + LOGO_ZOOM_HOLD_MS;
            logoElement.style.animation = `gentleWobble ${totalWobbleTime}ms ease-in-out infinite`;

            // 2. Animuj zewnętrzny wrapper, aby przesunąć i przeskalować logo
            logoWrapper.style.transformOrigin = 'center center';
            
            // Pobierz aktualną pozycję i rozmiar wrappera
            const rect = logoWrapper.getBoundingClientRect();
            const logoCenterX = rect.left + rect.width / 2;
            const logoCenterY = rect.top + rect.height / 2;
            
            // Oblicz przesunięcie potrzebne do wyśrodkowania
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const deltaX = screenCenterX - logoCenterX;
            const deltaY = screenCenterY - logoCenterY;

            // Oblicz skalę potrzebną do wypełnienia ekranu
            const scale = Math.max(
                window.innerWidth / rect.width, 
                window.innerHeight / rect.height
            ) * 0.3; // Dodatkowy margines
            
            // Ustaw płynne przejście i docelową transformację
            logoWrapper.style.transition = `transform ${LOGO_ZOOM_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            logoWrapper.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
        }
        
        setTimeout(fadeOutIntro, LOGO_ZOOM_DURATION_MS + LOGO_ZOOM_HOLD_MS);
    }

    function fadeOutIntro() {
        introContainer.style.transition = `opacity ${FADE_OUT_DURATION_MS}ms ease-in`;
        introContainer.style.opacity = '0';
        setTimeout(cleanupAndShowLoadingPanel, FADE_OUT_DURATION_MS);
    }

    function cleanupAndShowLoadingPanel() {
        introContainer.style.display = 'none';
        if (window.loadingManager) {
            window.loadingManager.show(() => {
                if (window.startAssetLoading) {
                    window.startAssetLoading();
                } else {
                    console.error("startAssetLoading function not found!");
                    window.loadingManager.hide(() => {
                         lobby.style.display = 'block';
                         lobby.style.opacity = '1';
                    });
                }
            });
        } else {
            console.error("loadingManager not found!");
            lobby.style.display = 'block';
            lobby.style.opacity = '1';
        }
    }

    startIntro();
});