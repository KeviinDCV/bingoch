document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    // const currentBallDisplay = document.getElementById('current-ball'); // Removed
    const startPauseButton = document.getElementById('start-pause-button');
    const resetButton = document.getElementById('reset-button');
    const voiceSelect = document.getElementById('voice-select');
    const rateSlider = document.getElementById('rate-slider');
    const rateValueSpan = document.getElementById('rate-value');
    const pitchSlider = document.getElementById('pitch-slider');
    const pitchValueSpan = document.getElementById('pitch-value');
    const intervalSlider = document.getElementById('interval-slider');
    const intervalValueSpan = document.getElementById('interval-value');
    const ballBoardContainer = document.getElementById('ball-board'); // Unified board
    const recentBallsSlider = document.getElementById('recent-balls-slider'); // Recent slider
    const remainingCountSpan = document.getElementById('remaining-count');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const settingsToggle = document.querySelector('.settings-toggle');
    const settingsContent = document.querySelector('.settings-content');
    const toggleIcon = document.querySelector('.toggle-icon');
    const letterCheckboxes = document.querySelectorAll('.letter-checkboxes input[type="checkbox"]');
    const countdownTimerSpan = document.getElementById('countdown-timer');
    const repeatDigitsToggle = document.getElementById('repeat-digits-toggle');
    const repeatNumberToggle = document.getElementById('repeat-number-toggle');

    // Game State
    let allBalls = [];
    let remainingBalls = [];
    let calledBalls = [];
    let isRunning = false;
    let intervalId = null;
    let countdownValue = 0;
    let currentUtterance = null;
    let secondaryUtterance = null;
    let wakeLockSentinel = null;
    let lastCalledBall = null; // To track the last ball for highlighting

    // Settings State
    let voices = [];
    let selectedVoice = null;
    let currentRate = 1;
    let currentPitch = 1;
    let currentInterval = 5;
    let activeLetters = { B: true, I: true, N: true, G: true, O: true };
    let repeatDigitsEnabled = true;
    let repeatNumberEnabled = false;

    // Letter Ranges
    const letterRanges = {
        B: { min: 1, max: 15 }, I: { min: 16, max: 30 }, N: { min: 31, max: 45 },
        G: { min: 46, max: 60 }, O: { min: 61, max: 75 }
    };

    // --- Theme Management ---
    function applyTheme(theme) {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        // themeToggleButton.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'; // Removed text update
        localStorage.setItem('bingoTheme', theme);
    }
    function toggleTheme() {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        applyTheme(newTheme);
    }
    function loadInitialTheme() {
        const savedTheme = localStorage.getItem('bingoTheme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
    }

    // --- Settings Collapse ---
    function toggleSettings() {
        const isExpanded = settingsContent.classList.toggle('expanded');
        toggleIcon.textContent = isExpanded ? '−' : '+';
        toggleIcon.classList.toggle('expanded', isExpanded);
    }
    function initializeSettingsCollapse() {
         const isMobile = window.innerWidth < 768;
         settingsContent.classList.toggle('expanded', !isMobile);
         toggleIcon.textContent = !isMobile ? '−' : '+';
         toggleIcon.classList.toggle('expanded', !isMobile);
    }

    // --- Initialization ---
    function initializeGame() {
        loadSettings();
        generateBallList();
        resetGame(); // Calls UI updates
        loadInitialTheme();
        initializeSettingsCollapse();
        populateVoiceList();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }

    // --- Ball List Generation ---
    function generateBallList() {
        allBalls = [];
        for (const letter in activeLetters) {
            if (activeLetters[letter]) {
                const range = letterRanges[letter];
                for (let i = range.min; i <= range.max; i++) { allBalls.push(i); }
            }
        }
         if (allBalls.length === 0) {
             console.warn("No letters selected. Defaulting to all letters.");
             for (const letter in letterRanges) {
                 const range = letterRanges[letter];
                 for (let i = range.min; i <= range.max; i++) { allBalls.push(i); }
             }
         }
         allBalls.sort((a, b) => a - b);
    }

    // --- Game State Reset ---
    function resetGame() {
        releaseWakeLock();
        if (intervalId) clearInterval(intervalId);
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        currentUtterance = null; secondaryUtterance = null; isRunning = false;
        intervalId = null; countdownValue = 0; lastCalledBall = null;
        startPauseButton.textContent = 'Start';
        startPauseButton.disabled = allBalls.length === 0;
        countdownTimerSpan.textContent = '--';
        remainingBalls = [...allBalls]; calledBalls = [];
        // Removed references to currentBallDisplay
        // currentBallDisplay.innerHTML = '-';
        // currentBallDisplay.className = 'current-ball-display';
        updateBallBoardUI(); // Update unified board
        updateRecentBallsSlider(); // Update slider
        remainingCountSpan.textContent = remainingBalls.length;
    }

    // --- BINGO Logic ---
    function getBingoLetter(number) {
        for (const letter in letterRanges) {
            if (number >= letterRanges[letter].min && number <= letterRanges[letter].max) return letter;
        }
        return '';
    }

    // --- UI Updates ---
    function updateBallBoardUI() {
        ballBoardContainer.innerHTML = '';
        allBalls.forEach(ballNum => {
            const isCalled = calledBalls.includes(ballNum);
            const element = createBallElement(ballNum, isCalled);
            // Add highlight class only if this is the most recently called ball
            if (isCalled && ballNum === lastCalledBall) {
                element.classList.add('ball-highlight');
                setTimeout(() => {
                    if (element && element.parentNode) {
                         element.classList.remove('ball-highlight');
                    }
                }, 1000);
            }
            ballBoardContainer.appendChild(element);
        });
        remainingCountSpan.textContent = remainingBalls.length;
    }

    // Clears and rebuilds the slider (used only on reset)
    function updateRecentBallsSlider() {
        recentBallsSlider.innerHTML = '';
        // Build slider from scratch if needed (e.g., on reset)
        const ballsToDisplay = [...calledBalls].reverse(); // Create reversed copy
        ballsToDisplay.forEach(ballNum => {
            const sliderBall = createBallElement(ballNum, true);
            recentBallsSlider.appendChild(sliderBall); // Use appendChild for initial build
        });
        // Ensure the slider scrolls back to the beginning
        recentBallsSlider.scrollLeft = 0;
    }

    function createBallElement(number, isCalled = false) {
        const ball = document.createElement('div');
        ball.classList.add('ball');
        const letter = getBingoLetter(number); // Still need letter for class
        // ball.innerHTML = `<span class="letter">${letter}</span>${number}`; // Original
        ball.innerHTML = `${number}`; // Only number inside
        ball.dataset.number = number;
        if (isCalled) ball.classList.add('called');
        if (letter) ball.classList.add(letter); // Keep adding letter class for color styling
        return ball;
    }

    // Removed displayCurrentBall function
    /*
    function displayCurrentBall(number) {
        const letter = getBingoLetter(number);
        currentBallDisplay.innerHTML = `<span class="letter">${letter}</span>${number}`;
        currentBallDisplay.className = 'current-ball-display';
        if (letter) currentBallDisplay.classList.add(letter);
        currentBallDisplay.style.animation = 'none';
        void currentBallDisplay.offsetWidth;
        currentBallDisplay.style.animation = 'popIn 0.5s ease-out forwards';
    }
    */

    // --- Speech Synthesis ---
    function populateVoiceList() {
        try { voices = speechSynthesis.getVoices(); }
        catch (error) { console.error("Error getting voices:", error); voices = []; }
        const previouslySelectedName = selectedVoice ? selectedVoice.name : null;
        const previouslySelectedLang = selectedVoice ? selectedVoice.lang : null;
        voiceSelect.innerHTML = '';
        const spanishVoices = voices.filter(voice => voice.lang.startsWith('es'));
        const voicesToDisplay = spanishVoices.length > 0 ? spanishVoices : voices;
        voicesToDisplay.forEach((voice) => {
            const originalIndex = voices.indexOf(voice);
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.setAttribute('data-lang', voice.lang);
            option.setAttribute('data-name', voice.name);
            option.value = originalIndex;
            voiceSelect.appendChild(option);
        });
        const savedVoiceIndex = localStorage.getItem('bingoVoiceIndex');
        let voiceFound = false;
        if (savedVoiceIndex !== null && voices[savedVoiceIndex]) {
            const optionExists = Array.from(voiceSelect.options).some(opt => opt.value === savedVoiceIndex);
            if (optionExists) { voiceSelect.value = savedVoiceIndex; voiceFound = true; }
        }
        if (!voiceFound && previouslySelectedName && previouslySelectedLang) {
             const matchingVoiceIndex = voices.findIndex(v => v.name === previouslySelectedName && v.lang === previouslySelectedLang);
             if (matchingVoiceIndex !== -1) {
                 const optionExists = Array.from(voiceSelect.options).some(opt => opt.value == matchingVoiceIndex);
                 if (optionExists) { voiceSelect.value = matchingVoiceIndex; voiceFound = true; }
             }
        }
        if (!voiceFound && voiceSelect.options.length > 0) { voiceSelect.selectedIndex = 0; }
        selectedVoice = (voiceSelect.value && voices[voiceSelect.value]) ? voices[voiceSelect.value] : null;
    }

    const digitToWord = { '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro', '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve' };
    function numberToWords(number) { return String(number).split('').map(digit => digitToWord[digit]).join(', '); }

    function speakBall(number) {
        if (!selectedVoice) { console.warn("No voice selected."); return; }
        if (speechSynthesis.speaking) { speechSynthesis.cancel(); }
        currentUtterance = null; secondaryUtterance = null;

        const letter = getBingoLetter(number);
        const textToSpeakNormal = `${letter} ${number}`;
        currentUtterance = new SpeechSynthesisUtterance(textToSpeakNormal);
        currentUtterance.voice = selectedVoice; currentUtterance.rate = currentRate;
        currentUtterance.pitch = currentPitch; currentUtterance.lang = selectedVoice.lang;
        currentUtterance.onerror = (event) => {
            if (event.error !== 'interrupted') { // Only log non-interruption errors as critical
                console.error('Utterance 1 error', event);
            } else {
                // console.warn('Utterance 1 interrupted (expected)'); // Optional: log as warning
            }
            currentUtterance = null;
        };

        let textToSpeakSecond = null;
        // Modified: Remove letter from the digit repetition
        if (repeatDigitsEnabled) { textToSpeakSecond = numberToWords(number); }
        else if (repeatNumberEnabled) { textToSpeakSecond = textToSpeakNormal; }

        if (textToSpeakSecond) {
            secondaryUtterance = new SpeechSynthesisUtterance(textToSpeakSecond);
            secondaryUtterance.voice = selectedVoice; secondaryUtterance.rate = currentRate;
            secondaryUtterance.pitch = currentPitch; secondaryUtterance.lang = selectedVoice.lang;
            secondaryUtterance.onerror = (event) => {
                if (event.error !== 'interrupted') { // Only log non-interruption errors as critical
                     console.error('Utterance 2 error', event);
                } else {
                    // console.warn('Utterance 2 interrupted (expected)'); // Optional: log as warning
                }
                secondaryUtterance = null;
            };
            secondaryUtterance.onend = () => { secondaryUtterance = null; };
            currentUtterance.onend = () => {
                currentUtterance = null;
                if (!speechSynthesis.speaking && secondaryUtterance) {
                    // Determine delay: longer for single digits (1-9), shorter otherwise
                    const delay = (number >= 1 && number <= 9) ? 1500 : 400; // 1500ms for 1-9, 400ms for others

                    // Add a conditional delay before speaking the repetition
                    setTimeout(() => {
                        // Check again in case something else started speaking during the delay
                        if (!speechSynthesis.speaking && secondaryUtterance) {
                            speechSynthesis.speak(secondaryUtterance);
                        } else {
                            secondaryUtterance = null; // Clear if we can't speak it
                        }
                    }, delay);
                } else {
                     secondaryUtterance = null; // Clear if primary wasn't supposed to trigger it
                }
            };
        } else {
            currentUtterance.onend = () => { currentUtterance = null; };
        }
        speechSynthesis.speak(currentUtterance);
    }

    // --- Screen Wake Lock ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                if (wakeLockSentinel) { await releaseWakeLock(); }
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null; if (isRunning) { requestWakeLock(); }
                });
            } catch (err) { console.error(`Wake Lock request failed: ${err.name}, ${err.message}`); wakeLockSentinel = null; }
        }
    };
    const releaseWakeLock = async () => {
        if (wakeLockSentinel !== null) {
            const sentinelToRelease = wakeLockSentinel; wakeLockSentinel = null;
            try { await sentinelToRelease.release(); }
            catch (err) { console.error(`Wake Lock release failed: ${err.name}, ${err.message}`); }
        }
    };

    // --- Settings Management ---
    function loadSettings() {
        currentRate = parseFloat(localStorage.getItem('bingoRate') || '1');
        currentPitch = parseFloat(localStorage.getItem('bingoPitch') || '1');
        currentInterval = parseInt(localStorage.getItem('bingoInterval') || '5', 10);
        rateSlider.value = currentRate; rateValueSpan.textContent = currentRate;
        pitchSlider.value = currentPitch; pitchValueSpan.textContent = currentPitch;
        intervalSlider.value = currentInterval; intervalValueSpan.textContent = currentInterval;
        const savedLetters = localStorage.getItem('bingoActiveLetters');
        try { activeLetters = savedLetters ? JSON.parse(savedLetters) : { B: true, I: true, N: true, G: true, O: true }; }
        catch (e) { console.error("Parse error letters", e); activeLetters = { B: true, I: true, N: true, G: true, O: true }; }
        letterCheckboxes.forEach(cb => { cb.checked = activeLetters[cb.dataset.letter]; });
        repeatDigitsEnabled = localStorage.getItem('bingoRepeatDigits') !== 'false';
        repeatNumberEnabled = localStorage.getItem('bingoRepeatNumber') === 'true';
        repeatDigitsToggle.checked = repeatDigitsEnabled;
        repeatNumberToggle.checked = repeatNumberEnabled;
    }

    function saveSettings() {
        localStorage.setItem('bingoRate', currentRate);
        localStorage.setItem('bingoPitch', currentPitch);
        localStorage.setItem('bingoInterval', currentInterval);
        if (selectedVoice) {
            const voiceIndex = voices.findIndex(v => v.name === selectedVoice.name && v.lang === selectedVoice.lang);
            if (voiceIndex !== -1) localStorage.setItem('bingoVoiceIndex', voiceIndex);
        }
        localStorage.setItem('bingoActiveLetters', JSON.stringify(activeLetters));
        localStorage.setItem('bingoRepeatDigits', repeatDigitsEnabled);
        localStorage.setItem('bingoRepeatNumber', repeatNumberEnabled);
    }

    // --- Game Flow ---
    function drawBall() {
        if (remainingBalls.length === 0) { stopGame(); return; }
        const randomIndex = Math.floor(Math.random() * remainingBalls.length);
        const drawnBall = remainingBalls.splice(randomIndex, 1)[0];
        calledBalls.push(drawnBall);
        lastCalledBall = drawnBall; // Track last called for highlight
        // displayCurrentBall(drawnBall); // Removed call
        updateBallBoardUI(); // Update unified board

        // --- Slider Update Modification ---
        // Create the new ball element
        const newSliderBall = createBallElement(drawnBall, true);
        // Add it to the beginning of the slider
        recentBallsSlider.prepend(newSliderBall);
        // Ensure the slider scrolls to the beginning
        recentBallsSlider.scrollLeft = 0;
        // --- End Slider Update Modification ---

        speakBall(drawnBall);
        if (remainingBalls.length > 0 && isRunning) { startCountdown(); }
        else if (remainingBalls.length === 0) { stopGame(); }
    }

    function startCountdown(resumeValue = null) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        countdownValue = (resumeValue !== null) ? Math.max(0, resumeValue) : currentInterval;
        countdownTimerSpan.textContent = countdownValue;
        if (countdownValue <= 0 && isRunning) { setTimeout(() => { if (isRunning) drawBall(); }, 0); return; }
        if (isRunning && countdownValue > 0) {
            intervalId = setInterval(() => {
                countdownValue--;
                countdownTimerSpan.textContent = countdownValue;
                if (countdownValue <= 0) {
                    clearInterval(intervalId); intervalId = null;
                    if (isRunning) drawBall();
                }
            }, 1000);
        }
    }

    function pauseGame() {
        if (!isRunning) return; isRunning = false;
        startPauseButton.textContent = 'Start';
        if (intervalId) clearInterval(intervalId); intervalId = null;
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        currentUtterance = null; secondaryUtterance = null;
        releaseWakeLock();
    }

    function stopGame() {
        releaseWakeLock();
        if (intervalId) clearInterval(intervalId); intervalId = null;
        if (speechSynthesis.speaking) speechSynthesis.cancel();
        currentUtterance = null; secondaryUtterance = null; isRunning = false;
        startPauseButton.textContent = 'Start';
        countdownTimerSpan.textContent = '--';
        if (remainingBalls.length === 0) startPauseButton.disabled = true;
    }

    // --- Event Listeners ---
    startPauseButton.addEventListener('click', () => {
        if (isRunning) { pauseGame(); }
        else {
             generateBallList();
             if (allBalls.length > 0) {
                 if (calledBalls.length === 0) { remainingBalls = [...allBalls]; lastCalledBall = null; }
                 else { remainingBalls = allBalls.filter(ball => !calledBalls.includes(ball)); }
                 updateBallBoardUI(); // Update board first
                 updateRecentBallsSlider();
                 if (remainingBalls.length > 0) {
                     startPauseButton.disabled = false; isRunning = true;
                     startPauseButton.textContent = 'Pause'; requestWakeLock();
                     if (calledBalls.length === 0) { drawBall(); }
                     else { startCountdown(countdownValue); }
                 } else { startPauseButton.disabled = true; }
             } else { alert("No letters selected."); startPauseButton.disabled = true; }
        }
    });

    resetButton.addEventListener('click', () => { generateBallList(); resetGame(); });
    themeToggleButton.addEventListener('click', toggleTheme);
    settingsToggle.addEventListener('click', toggleSettings);
    voiceSelect.addEventListener('change', (e) => { selectedVoice = voices[e.target.value]; saveSettings(); });
    rateSlider.addEventListener('input', (e) => { currentRate = parseFloat(e.target.value); rateValueSpan.textContent = currentRate; saveSettings(); });
    pitchSlider.addEventListener('input', (e) => { currentPitch = parseFloat(e.target.value); pitchValueSpan.textContent = currentPitch; saveSettings(); });
    intervalSlider.addEventListener('input', (e) => { currentInterval = parseInt(e.target.value, 10); intervalValueSpan.textContent = currentInterval; saveSettings(); if (isRunning) pauseGame(); });
    letterCheckboxes.forEach(cb => { cb.addEventListener('change', (e) => { activeLetters[e.target.dataset.letter] = e.target.checked; saveSettings(); generateBallList(); resetGame(); }); });
    repeatDigitsToggle.addEventListener('change', (e) => { repeatDigitsEnabled = e.target.checked; saveSettings(); });
    repeatNumberToggle.addEventListener('change', (e) => { repeatNumberEnabled = e.target.checked; saveSettings(); });
    document.addEventListener('visibilitychange', async () => {
        if (!('wakeLock' in navigator)) return;
        if (wakeLockSentinel !== null && document.visibilityState === 'hidden') { await releaseWakeLock(); }
        else if (isRunning && document.visibilityState === 'visible') { await requestWakeLock(); }
    });

    // --- Initial Load ---
    initializeGame();
});
