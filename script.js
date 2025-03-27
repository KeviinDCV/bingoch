document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const currentBallDisplay = document.getElementById('current-ball');
    const startPauseButton = document.getElementById('start-pause-button');
    const resetButton = document.getElementById('reset-button');
    const voiceSelect = document.getElementById('voice-select');
    const rateSlider = document.getElementById('rate-slider');
    const rateValueSpan = document.getElementById('rate-value');
    const pitchSlider = document.getElementById('pitch-slider');
    const pitchValueSpan = document.getElementById('pitch-value');
    const intervalSlider = document.getElementById('interval-slider');
    const intervalValueSpan = document.getElementById('interval-value');
    const calledBallsContainer = document.getElementById('called-balls');
    const remainingBallsContainer = document.getElementById('remaining-balls');
    const remainingCountSpan = document.getElementById('remaining-count');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const settingsToggle = document.querySelector('.settings-toggle'); // Added
    const settingsContent = document.querySelector('.settings-content'); // Added
    const toggleIcon = document.querySelector('.toggle-icon'); // Added

    // Game State
    let allBalls = [];
    let remainingBalls = [];
    let calledBalls = [];
    let isRunning = false;
    let intervalId = null;
    let currentUtterance = null;

    // Settings State
    let voices = [];
    let selectedVoice = null;
    let currentRate = 1;
    let currentPitch = 1;
    let currentInterval = 5;

    // --- Theme Management ---

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleButton.textContent = 'Modo Claro';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleButton.textContent = 'Modo Oscuro';
        }
        localStorage.setItem('bingoTheme', theme);
    }

    function toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    function loadInitialTheme() {
        const savedTheme = localStorage.getItem('bingoTheme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            applyTheme(savedTheme);
        } else if (prefersDark) {
            applyTheme('dark');
        } else {
            applyTheme('light'); // Default to light
        }
    }

    // --- Settings Collapse ---

    function toggleSettings() {
        const isExpanded = settingsContent.classList.toggle('expanded');
        toggleIcon.textContent = isExpanded ? '−' : '+'; // Change icon
        toggleIcon.classList.toggle('expanded', isExpanded);
        // Optional: Save state if needed
        // localStorage.setItem('settingsExpanded', isExpanded);
    }

    function initializeSettingsCollapse() {
         // Check if screen is small (e.g., less than 768px)
         const isMobile = window.innerWidth < 768;
         // Optional: Load saved state
         // const savedState = localStorage.getItem('settingsExpanded') === 'true';
         // if (savedState) {
         //    settingsContent.classList.add('expanded');
         //    toggleIcon.textContent = '−';
         //    toggleIcon.classList.add('expanded');
         // } else if (!isMobile) { // Expand by default on desktop if no saved state
         if (!isMobile) { // Expand by default on desktop
             settingsContent.classList.add('expanded');
             toggleIcon.textContent = '−';
             toggleIcon.classList.add('expanded');
         } else { // Collapsed by default on mobile
             toggleIcon.textContent = '+';
         }
    }


    // --- Initialization ---

    function initializeGame() {
        allBalls = Array.from({ length: 75 }, (_, i) => i + 1);
        resetGame();
        loadSettings();
        loadInitialTheme();
        initializeSettingsCollapse(); // Initialize collapse state
        populateVoiceList();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }

    function resetGame() {
        if (intervalId) clearInterval(intervalId);
        if (currentUtterance) speechSynthesis.cancel();
        isRunning = false;
        intervalId = null;
        currentUtterance = null;
        startPauseButton.textContent = 'Start';
        startPauseButton.disabled = false;

        remainingBalls = [...allBalls];
        calledBalls = [];

        currentBallDisplay.innerHTML = '-';
        currentBallDisplay.className = 'current-ball-display';
        updateRemainingBallsUI();
        updateCalledBallsUI();
        remainingCountSpan.textContent = remainingBalls.length;
    }

    // --- BINGO Logic ---

    function getBingoLetter(number) {
        if (number >= 1 && number <= 15) return 'B';
        if (number >= 16 && number <= 30) return 'I';
        if (number >= 31 && number <= 45) return 'N';
        if (number >= 46 && number <= 60) return 'G';
        if (number >= 61 && number <= 75) return 'O';
        return '';
    }

    // --- UI Updates ---

    function updateRemainingBallsUI() {
        remainingBallsContainer.innerHTML = '';
        // Sort remaining balls numerically for consistent display
        [...remainingBalls].sort((a, b) => a - b).forEach(ballNum => {
            remainingBallsContainer.appendChild(createBallElement(ballNum));
        });
        remainingCountSpan.textContent = remainingBalls.length;
    }

    function updateCalledBallsUI() {
        calledBallsContainer.innerHTML = '';
        // Display called balls in the order they were drawn (no sorting)
        calledBalls.forEach(ballNum => {
            calledBallsContainer.appendChild(createBallElement(ballNum, true));
        });
    }

    function createBallElement(number, isCalled = false) {
        const ball = document.createElement('div');
        ball.classList.add('ball');
        const letter = getBingoLetter(number);
        ball.innerHTML = `<span class="letter">${letter}</span>${number}`;
        ball.dataset.number = number;
        if (isCalled) ball.classList.add('called');
        if (letter) ball.classList.add(letter);
        return ball;
    }

    function displayCurrentBall(number) {
        const letter = getBingoLetter(number);
        currentBallDisplay.innerHTML = `<span class="letter">${letter}</span>${number}`;
        currentBallDisplay.className = 'current-ball-display';
        if (letter) currentBallDisplay.classList.add(letter);

        currentBallDisplay.style.animation = 'none';
        void currentBallDisplay.offsetWidth;
        currentBallDisplay.style.animation = 'popIn 0.5s ease-out forwards';
    }


    // --- Speech Synthesis ---

    function populateVoiceList() {
        voices = speechSynthesis.getVoices();
        const previouslySelectedName = selectedVoice ? selectedVoice.name : null;
        const previouslySelectedLang = selectedVoice ? selectedVoice.lang : null;
        voiceSelect.innerHTML = '';

        voices.forEach((voice, i) => {
            if (voice.lang.startsWith('es') || voices.filter(v => v.lang.startsWith('es')).length === 0) {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                option.setAttribute('data-lang', voice.lang);
                option.setAttribute('data-name', voice.name);
                option.value = i;
                voiceSelect.appendChild(option);
            }
        });

        const savedVoiceIndex = localStorage.getItem('bingoVoiceIndex');
        let voiceFound = false;

        if (savedVoiceIndex !== null && voices[savedVoiceIndex]) {
            voiceSelect.value = savedVoiceIndex;
            selectedVoice = voices[savedVoiceIndex];
            voiceFound = true;
        } else if (previouslySelectedName && previouslySelectedLang) {
             const matchingVoiceIndex = voices.findIndex(v => v.name === previouslySelectedName && v.lang === previouslySelectedLang);
             if (matchingVoiceIndex !== -1) {
                 voiceSelect.value = matchingVoiceIndex;
                 selectedVoice = voices[matchingVoiceIndex];
                 voiceFound = true;
             }
        }

        if (!voiceFound) {
            const firstSpanishOption = Array.from(voiceSelect.options).find(opt => opt.getAttribute('data-lang').startsWith('es'));
            if (firstSpanishOption) {
                voiceSelect.value = firstSpanishOption.value;
            } else if (voiceSelect.options.length > 0) {
                voiceSelect.selectedIndex = 0;
            }
            if (voiceSelect.value && voices[voiceSelect.value]) {
                selectedVoice = voices[voiceSelect.value];
            }
        }
         if (!selectedVoice && voiceSelect.value && voices[voiceSelect.value]) {
             selectedVoice = voices[voiceSelect.value];
         }
    }


    function speakBall(number) {
        if (!selectedVoice) {
            console.warn("No voice selected.");
            return;
        }
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        const letter = getBingoLetter(number);
        const textToSpeak = `${letter} ${number}`;
        currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        currentUtterance.voice = selectedVoice;
        currentUtterance.rate = currentRate;
        currentUtterance.pitch = currentPitch;
        currentUtterance.lang = selectedVoice.lang;

        currentUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            currentUtterance = null;
        };
        currentUtterance.onend = () => {
            currentUtterance = null;
        };

        speechSynthesis.speak(currentUtterance);
    }

    // --- Settings Management ---

    function loadSettings() {
        currentRate = parseFloat(localStorage.getItem('bingoRate') || '1');
        currentPitch = parseFloat(localStorage.getItem('bingoPitch') || '1');
        currentInterval = parseInt(localStorage.getItem('bingoInterval') || '5', 10);

        rateSlider.value = currentRate;
        rateValueSpan.textContent = currentRate;
        pitchSlider.value = currentPitch;
        pitchValueSpan.textContent = currentPitch;
        intervalSlider.value = currentInterval;
        intervalValueSpan.textContent = currentInterval;
    }

    function saveSettings() {
        localStorage.setItem('bingoRate', currentRate);
        localStorage.setItem('bingoPitch', currentPitch);
        localStorage.setItem('bingoInterval', currentInterval);
        if (selectedVoice) {
            const voiceIndex = voices.findIndex(v => v.name === selectedVoice.name && v.lang === selectedVoice.lang);
            if (voiceIndex !== -1) {
                localStorage.setItem('bingoVoiceIndex', voiceIndex);
            }
        }
    }

    // --- Game Flow ---

    function drawBall() {
        if (remainingBalls.length === 0) {
            stopGame();
            return;
        }

        const randomIndex = Math.floor(Math.random() * remainingBalls.length);
        const drawnBall = remainingBalls.splice(randomIndex, 1)[0];
        calledBalls.push(drawnBall);

        displayCurrentBall(drawnBall);
        updateRemainingBallsUI();
        updateCalledBallsUI();
        speakBall(drawnBall);

        if (remainingBalls.length === 0) {
            stopGame();
        }
    }

    function startGame() {
        if (isRunning || remainingBalls.length === 0) return;

        isRunning = true;
        startPauseButton.textContent = 'Pause';
        drawBall();
        if (remainingBalls.length > 0) {
            intervalId = setInterval(drawBall, currentInterval * 1000);
        }
    }

    function pauseGame() {
        if (!isRunning) return;

        isRunning = false;
        startPauseButton.textContent = 'Start';
        if (intervalId) clearInterval(intervalId);
        if (currentUtterance) speechSynthesis.cancel();
        intervalId = null;
        currentUtterance = null;
    }

    function stopGame() {
        if (intervalId) clearInterval(intervalId);
        isRunning = false;
        intervalId = null;
        startPauseButton.textContent = 'Start';
        if (remainingBalls.length === 0) {
             startPauseButton.disabled = true;
        }
    }

    // --- Event Listeners ---

    startPauseButton.addEventListener('click', () => {
        if (isRunning) {
            pauseGame();
        } else {
            startGame();
        }
    });

    resetButton.addEventListener('click', resetGame);

    themeToggleButton.addEventListener('click', toggleTheme);

    settingsToggle.addEventListener('click', toggleSettings); // Added listener for collapse

    voiceSelect.addEventListener('change', (e) => {
        selectedVoice = voices[e.target.value];
        saveSettings();
    });

    rateSlider.addEventListener('input', (e) => {
        currentRate = parseFloat(e.target.value);
        rateValueSpan.textContent = currentRate;
        saveSettings();
    });

    pitchSlider.addEventListener('input', (e) => {
        currentPitch = parseFloat(e.target.value);
        pitchValueSpan.textContent = currentPitch;
        saveSettings();
    });

    intervalSlider.addEventListener('input', (e) => {
        currentInterval = parseInt(e.target.value, 10);
        intervalValueSpan.textContent = currentInterval;
        saveSettings();
        if (isRunning) {
            pauseGame();
            startGame();
        }
    });

    // --- Initial Load ---
    initializeGame();
});
