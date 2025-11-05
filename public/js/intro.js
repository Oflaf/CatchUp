document.addEventListener('DOMContentLoaded', () => {
    // === Konfiguracja animacji ===
    const TEXT = "Solendz Caravan";
    const IMAGE_PATH = 'img/intro/';
    const MAX_FINAL_LETTER_HEIGHT = 80; // Maksymalna wysokość litery w pixelach
    const START_SCALE_MULTIPLIER = 35;
    const ANIMATION_DURATION_MS = 150;
    const IMPACT_BOUNCE_MS = 300;
    const DELAY_BETWEEN_LETTERS_MS = 10;
    const LETTER_SPACING = 0.2; // Odstęp jako mnożnik wysokości litery
    const MAX_ROTATION_DEGREES = 4;
    const FADE_OUT_DELAY_MS = 800;
    const FADE_OUT_DURATION_MS = 800;

    // === Konfiguracja dla animacji "z", logo i rozsuwania ===
    const LOGO_PATH = 'img/intro/logo.png';
    const LOGO_HEIGHT_MULTIPLIER = 3;
    const LOGO_VERTICAL_OFFSET_MULTIPLIER = -1;
    const Z_FALL_TRIGGER_CHAR_INDEX = 7;
    const Z_NUDGE_Y_PX = 5;
    const Z_NUDGE_ROTATION_DEG = 3;
    const Z_NUDGE_TRANSITION_MS = 200;
    const Z_FINAL_FALL_DELAY_MS = 150;
    const Z_FINAL_FALL_DURATION_MS = 400;
    const SPREAD_DURATION_MS = 600;
    const SPREAD_DELAY_MS = 100;

    // === Konfiguracja dla animacji końcowej: rozjazd i zoom logo ===
    const FINAL_SPLIT_DURATION_MS = 1200;
    const LOGO_ZOOM_DURATION_MS = 1200;
    const LOGO_ZOOM_HOLD_MS = 2000;
    const LOGO_WOBBLE_DEG = 2;

    // === Elementy DOM ===
    const introContainer = document.getElementById('intro-container');
    const lobby = document.getElementById('lobby');
    if (!introContainer || !lobby) {
        console.error("Intro container or lobby not found!");
        return;
    }
    
    let isSkipped = false;
    const allTimeouts = [];
    const imageMap = new Map();

    const style = document.createElement('style');
    style.textContent = `
        .letter-z-inner {
            transition: transform ${Z_NUDGE_TRANSITION_MS}ms ease-out;
        }
        .intro-logo {
            transition: width ${SPREAD_DURATION_MS}ms ease-in-out, 
                        height ${SPREAD_DURATION_MS}ms ease-in-out,
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
        baseTextWidthRatio: 0, // NOWOŚĆ: Przechowuje łączny stosunek szerokości do wysokości całego tekstu
    };

    function setSafeTimeout(callback, delay) {
        const id = setTimeout(callback, delay);
        allTimeouts.push(id);
        return id;
    }

    function clearAllTimeouts() {
        allTimeouts.forEach(id => clearTimeout(id));
    }
    
    function skipIntro() {
        if (isSkipped) return;
        isSkipped = true;

        console.log("Intro skipped!");
        document.removeEventListener('keydown', skipIntro);
        document.removeEventListener('mousedown', skipIntro);
        window.removeEventListener('resize', handleResize);

        cancelAnimationFrame(animationState.animationFrameId);
        animationState.animationFrameId = null;
        clearAllTimeouts();

        fadeOutIntro();
    }

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
            loadedImages.forEach(item => imageMap.set(item.char, item.img));
            
            calculateBaseTextMetrics(); // NOWOŚĆ: Oblicz proporcje tekstu
            prepareLettersAndLayout();
            startNextLetterAnimation();

            document.addEventListener('keydown', skipIntro);
            document.addEventListener('mousedown', skipIntro);
            window.addEventListener('resize', handleResize);

        } catch (error) {
            console.error("Failed to start intro:", error);
            cleanupAndShowLoadingPanel();
        }
    }

    // NOWA FUNKCJA: Oblicza i zapamiętuje "naturalny" stosunek szerokości do wysokości całego tekstu.
    function calculateBaseTextMetrics() {
        let totalWidthRatio = 0;
        const textChars = TEXT.split('');
        for (const char of textChars) {
            if (char === ' ') {
                totalWidthRatio += 0.5; // Szerokość spacji
                continue;
            }
            const img = imageMap.get(char.toLowerCase());
            if (img) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                totalWidthRatio += aspectRatio + LETTER_SPACING;
            }
        }
        totalWidthRatio -= LETTER_SPACING; // Usuń ostatni odstęp
        animationState.baseTextWidthRatio = totalWidthRatio;
    }

    // ZMIENIONA FUNKCJA: Teraz inteligentnie skaluje animację, aby zmieściła się na ekranie
    function recalculateLayout() {
        // 1. Oblicz maksymalną wysokość litery na podstawie wysokości ekranu (zostaw 10% marginesu)
        const heightBasedLetterHeight = window.innerHeight * 0.90 / LOGO_HEIGHT_MULTIPLIER;

        // 2. Oblicz maksymalną wysokość litery na podstawie szerokości ekranu (zostaw 5% marginesu)
        const widthBasedLetterHeight = (window.innerWidth * 0.95) / animationState.baseTextWidthRatio;

        // 3. Wybierz MNIEJSZĄ z tych dwóch wartości, aby mieć pewność, że animacja zmieści się w obu wymiarach.
        const finalLetterHeight = Math.min(MAX_FINAL_LETTER_HEIGHT, heightBasedLetterHeight, widthBasedLetterHeight);
        const finalLogoHeight = finalLetterHeight * LOGO_HEIGHT_MULTIPLIER;
        
        // Oblicz całkowitą szerokość i punkt startowy na podstawie nowej, bezpiecznej wysokości liter
        const totalWidth = finalLetterHeight * animationState.baseTextWidthRatio;
        const startX = (window.innerWidth - totalWidth) / 2;
        let currentX = startX;

        animationState.letters.forEach(letterData => {
            if (letterData.isSpace) {
                currentX += (finalLetterHeight * 0.5);
                return;
            }
            
            const img = imageMap.get(letterData.char.toLowerCase());
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            const finalWidth = finalLetterHeight * aspectRatio;

            letterData.targetX = currentX;
            letterData.targetY = (window.innerHeight - finalLetterHeight) / 2;
            letterData.targetW = finalWidth;
            letterData.targetH = finalLetterHeight;

            if (letterData.state === 'finished' || letterData.state === 'impact') {
                 letterData.element.style.transform = `translate(${letterData.targetX}px, ${letterData.targetY}px) scale(1) rotate(${letterData.rotation}deg)`;
                 letterData.element.style.width = `${letterData.targetW}px`;
                 letterData.element.style.height = `${letterData.targetH}px`;
            }

            if (letterData.isZ) {
                const zCenterX = currentX + finalWidth / 2;
                const logoTargetY = letterData.targetY + (finalLetterHeight * LOGO_VERTICAL_OFFSET_MULTIPLIER);
                
                animationState.logo.targetWidth = finalLogoHeight; // Logo jest kwadratowe
                animationState.logo.targetHeight = finalLogoHeight;
                animationState.logo.targetLeft = zCenterX - (finalLogoHeight / 2);
                animationState.logo.targetTop = logoTargetY;

                if (animationState.logo.wrapper.style.opacity === '1') {
                    animationState.logo.wrapper.style.left = `${animationState.logo.targetLeft}px`;
                    animationState.logo.wrapper.style.top = `${animationState.logo.targetTop}px`;
                    animationState.logo.wrapper.style.width = `${animationState.logo.targetWidth}px`;
                    animationState.logo.wrapper.style.height = `${animationState.logo.targetHeight}px`;
                }
            }
            
            currentX += finalWidth + (finalLetterHeight * LETTER_SPACING);
        });
    }
    
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(recalculateLayout, 150);
    }

    function prepareLettersAndLayout() {
        const textChars = TEXT.split('');
        let letterIndexWithoutSpaces = 0;

        for (const char of textChars) {
            if (char === ' ') {
                animationState.letters.push({ isSpace: true });
                continue;
            }

            const isZ = char.toLowerCase() === 'z';
            const imgData = imageMap.get(char.toLowerCase());

            const letterData = {
                char: char,
                rotation: (Math.random() - 0.5) * 2 * MAX_ROTATION_DEGREES,
                state: 'waiting', progress: 0,
                isZ: isZ,
                isSpace: false,
            };

            if (isZ) {
                animationState.zLetterIndex = letterIndexWithoutSpaces;
                letterData.fallY = 0;
                letterData.fallRotation = 0;

                const wrapper = document.createElement('div');
                wrapper.style.position = 'absolute';
                
                const innerImg = document.createElement('img');
                innerImg.src = imgData.src;
                innerImg.classList.add('letter-z-inner');
                innerImg.style.width = '100%';
                innerImg.style.height = '100%';
                wrapper.appendChild(innerImg);
                introContainer.appendChild(wrapper);

                letterData.element = wrapper;
                letterData.innerElement = innerImg;
                
                const logoWrapper = document.createElement('div');
                const logoImg = new Image();
                logoImg.src = LOGO_PATH;
                logoImg.style.width = '100%';
                logoImg.style.height = '100%';

                logoWrapper.appendChild(logoImg);
                logoWrapper.classList.add('intro-logo');
                logoWrapper.style.position = 'absolute';
                logoWrapper.style.opacity = '0';
                logoWrapper.style.width = '0px';
                logoWrapper.style.height = '0px';
                introContainer.appendChild(logoWrapper);

                animationState.logo = { wrapper: logoWrapper, element: logoImg };
            } else {
                const imgElement = document.createElement('img');
                imgElement.src = imgData.src;
                imgElement.style.position = 'absolute';
                introContainer.appendChild(imgElement);
                letterData.element = imgElement;
            }
            
            letterData.element.style.opacity = '0';
            animationState.letters.push(letterData);
            letterIndexWithoutSpaces++;
        }
        recalculateLayout();
    }


    function startNextLetterAnimation() {
        if (isSkipped) return;
        
        let letterToAnimateIndex = -1;
        let currentIndex = 0;
        for(let i = 0; i < animationState.letters.length; i++){
            if(!animationState.letters[i].isSpace){
                if(currentIndex === animationState.currentLetterIndex){
                    letterToAnimateIndex = i;
                    break;
                }
                currentIndex++;
            }
        }

        if (letterToAnimateIndex === -1) {
            setSafeTimeout(finalZFallAnimation, Z_FINAL_FALL_DELAY_MS);
            return;
        }

        if (animationState.currentLetterIndex >= Z_FALL_TRIGGER_CHAR_INDEX && animationState.zLetterIndex !== -1) {
            updateZNudge();
        }
        
        const letter = animationState.letters[letterToAnimateIndex];
        letter.state = 'animating';
        letter.startTime = performance.now();
        if (!animationState.animationFrameId) {
            animationState.animationFrameId = requestAnimationFrame(animate);
        }
    }
    
    function updateZNudge() {
        const zLetter = animationState.letters.find(l => l.isZ);
        if (!zLetter || !zLetter.innerElement) return;
        zLetter.fallY += Z_NUDGE_Y_PX;
        zLetter.fallRotation += Z_NUDGE_ROTATION_DEG * animationState.zRotationMultiplier;
        animationState.zRotationMultiplier *= -1;
        zLetter.innerElement.style.transform = `translateY(${zLetter.fallY}px) rotate(${zLetter.fallRotation}deg)`;
    }

    function animate(currentTime) {
        let stillAnimating = false;
        let currentNonSpaceIndex = 0;

        animationState.letters.forEach((letter) => {
            if (letter.isSpace || letter.state === 'waiting') return;

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
                    
                    if (currentNonSpaceIndex === animationState.currentLetterIndex) {
                       animationState.currentLetterIndex++;
                       setSafeTimeout(startNextLetterAnimation, DELAY_BETWEEN_LETTERS_MS);
                    }
                }
            } else if (letter.state === 'finished') {
                baseTransform = `translate(${letter.targetX}px, ${letter.targetY}px) scale(1) rotate(${letter.rotation}deg)`;
            }
            
            letter.element.style.transform = baseTransform;
            currentNonSpaceIndex++;
        });

        if (stillAnimating) {
            animationState.animationFrameId = requestAnimationFrame(animate);
        } else {
            cancelAnimationFrame(animationState.animationFrameId);
            animationState.animationFrameId = null;
        }
    }
    
    function finalZFallAnimation() {
        const zLetterData = animationState.letters.find(l => l.isZ);
        if (!zLetterData) {
            setSafeTimeout(spreadLettersAnimation, SPREAD_DELAY_MS);
            return;
        }
        
        const finalY = window.innerHeight + zLetterData.targetH;
        const finalRotation = zLetterData.rotation + zLetterData.fallRotation + 90;
        zLetterData.element.style.transition = `transform ${Z_FINAL_FALL_DURATION_MS}ms ease-in, opacity ${Z_FINAL_FALL_DURATION_MS}ms linear`;
        zLetterData.element.style.transform = `translate(${zLetterData.targetX}px, ${finalY}px) rotate(${finalRotation}deg)`;
        zLetterData.element.style.opacity = '0';
        setSafeTimeout(() => spreadLettersAnimation(), Z_FINAL_FALL_DURATION_MS + SPREAD_DELAY_MS);
    }
    
    function spreadLettersAnimation() {
        const zLetterIndex = animationState.letters.findIndex(l => l.isZ);
        if (zLetterIndex === -1) {
            setSafeTimeout(finalSplitAndZoom, FADE_OUT_DELAY_MS);
            return;
        }
        
        const zLetter = animationState.letters[zLetterIndex];
        const zWidth = zLetter.targetW;
        const logoWidth = animationState.logo.targetWidth;
        const widthDifference = logoWidth - zWidth;
        const shiftAmount = widthDifference / 2;

        animationState.letters.forEach((letter, index) => {
            if (letter.isSpace || index === zLetterIndex) return;
            
            let newTargetX = letter.targetX;
            if (index < zLetterIndex) {
                newTargetX -= shiftAmount + (letter.targetH * 0.1);
            } else {
                newTargetX += shiftAmount + (letter.targetH * 0.1);
            }
            letter.targetX = newTargetX;
            letter.element.style.transition = `transform ${SPREAD_DURATION_MS}ms ease-in-out`;
            letter.element.style.transform = `translate(${letter.targetX}px, ${letter.targetY}px) rotate(${letter.rotation}deg)`;
        });
        
        if (animationState.logo) {
            const logo = animationState.logo;
            logo.wrapper.style.opacity = '1';
            logo.wrapper.style.left = `${logo.targetLeft}px`;
            logo.wrapper.style.top = `${logo.targetTop}px`;
            logo.wrapper.style.width = `${logo.targetWidth}px`;
            logo.wrapper.style.height = `${logo.targetHeight}px`;
        }

        setSafeTimeout(finalSplitAndZoom, SPREAD_DURATION_MS + FADE_OUT_DELAY_MS);
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

        const zLetterIndex = animationState.letters.findIndex(l => l.isZ);
        const solendLetters = animationState.letters.slice(0, zLetterIndex);
        const caravanLetters = animationState.letters.slice(zLetterIndex + 1);

        const moveLetters = (letters, direction) => {
            letters.forEach(letter => {
                if(letter.isSpace) return;
                const finalX = direction === 'left' 
                    ? - (letter.targetW + 100)
                    : window.innerWidth + 100;
                
                letter.element.style.transition = `transform ${FINAL_SPLIT_DURATION_MS}ms ease-in`;
                letter.element.style.transform = `translate(${finalX}px, ${letter.targetY}px) rotate(${letter.rotation + (direction === 'left' ? -30 : 30)}deg)`;
            });
        };

        moveLetters(solendLetters, 'left');
        moveLetters(caravanLetters, 'right');

        if (animationState.logo && animationState.logo.wrapper) {
            const logoWrapper = animationState.logo.wrapper;
            const logoElement = animationState.logo.element;
            
            const totalWobbleTime = LOGO_ZOOM_DURATION_MS + LOGO_ZOOM_HOLD_MS;
            logoElement.style.animation = `gentleWobble ${totalWobbleTime}ms ease-in-out infinite`;
            logoWrapper.style.transformOrigin = 'center center';
            
            const rect = logoWrapper.getBoundingClientRect();
            const logoCenterX = rect.left + rect.width / 2;
            const logoCenterY = rect.top + rect.height / 2;
            
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const deltaX = screenCenterX - logoCenterX;
            const deltaY = screenCenterY - logoCenterY;

            const scale = Math.min(
                window.innerWidth / rect.width, 
                window.innerHeight / rect.height
            ) * 0.95; // Skaluj do 95% mniejszego wymiaru ekranu
            
            logoWrapper.style.transition = `transform ${LOGO_ZOOM_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
            logoWrapper.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
        }
        
        setSafeTimeout(fadeOutIntro, LOGO_ZOOM_DURATION_MS + LOGO_ZOOM_HOLD_MS);
    }

    function fadeOutIntro() {
        introContainer.style.transition = `opacity ${FADE_OUT_DURATION_MS}ms ease-in`;
        introContainer.style.opacity = '0';
        setSafeTimeout(cleanupAndShowLoadingPanel, FADE_OUT_DURATION_MS);
    }

    function cleanupAndShowLoadingPanel() {
        document.removeEventListener('keydown', skipIntro);
        document.removeEventListener('mousedown', skipIntro);
        window.removeEventListener('resize', handleResize);
        clearAllTimeouts();
        
        introContainer.style.display = 'none';
        introContainer.innerHTML = '';

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