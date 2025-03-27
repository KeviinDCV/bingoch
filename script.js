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
    const settingsToggle = document.querySelector('.settings-toggle');
    const settingsContent = document.querySelector('.settings-content');
    const toggleIcon = document.querySelector('.toggle-icon');
    const letterCheckboxes = document.querySelectorAll('.letter-checkboxes input[type="checkbox"]'); // Added

    // Game State
    let allBalls = []; // Will be populated based on active letters
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
    let activeLetters = { B: true, I: true, N: true, G: true, O: true }; // Added

    // Letter Ranges
    const letterRanges = {
        B: { min: 1, max: 15 },
        I: { min: 16, max: 30 },
        N: { min: 31, max: 45 },
        G: { min: 46, max: 60 },
        O: { min: 61, max: 75 }
    };

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
            applyTheme('light');
        }
    }

    // --- Settings Collapse ---

    function toggleSettings() {
        const isExpanded = settingsContent.classList.toggle('expanded');
        toggleIcon.textContent = isExpanded ? '−' : '+';
        toggleIcon.classList.toggle('expanded', isExpanded);
    }

    function initializeSettingsCollapse() {
         const isMobile = window.innerWidth < 768;
         if (!isMobile) {
             settingsContent.classList.add('expanded');
             toggleIcon.textContent = '−';
             toggleIcon.classList.add('expanded');
         } else {
             toggleIcon.textContent = '+';
         }
    }

    // --- Initialization ---

    function initializeGame() {
        // Load settings that affect ball generation first
        loadSettings();
        // Generate initial ball list based on loaded active letters
        generateBallList();
        // Reset game state using the generated list
        resetGame();
        // Load visual/audio settings
        loadInitialTheme();
        initializeSettingsCollapse();
        populateVoiceList();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }

    // Generates the allBalls array based on activeLetters state
    function generateBallList() {
        allBalls = [];
        for (const letter in activeLetters) {
            if (activeLetters[letter]) {
                const range = letterRanges[letter];
                for (let i = range.min; i <= range.max; i++) {
                    allBalls.push(i);
                }
            }
        }
         // Handle case where no letters are selected (prevent empty game)
         if (allBalls.length === 0) {
             console.warn("No letters selected. Defaulting to all letters.");
             // Temporarily activate all for this round, but don't save
             for (const letter in letterRanges) {
                 const range = letterRanges[letter];
                 for (let i = range.min; i <= range.max; i++) {
                     allBalls.push(i);
                 }
             }
             // Optionally, re-check all checkboxes visually? Or show a message?
             // For now, just proceed with all balls for this session.
         }
    }


    function resetGame() {
        if (intervalId) clearInterval(intervalId);
        if (currentUtterance) speechSynthesis.cancel();
        isRunning = false;
        intervalId = null;
        currentUtterance = null;
        startPauseButton.textContent = 'Start';
        startPauseButton.disabled = allBalls.length === 0; // Disable if no balls generated

        // Use the currently generated allBalls list
        remainingBalls = [...allBalls];
        calledBalls = [];

        currentBallDisplay.innerHTML = '-';
        currentBallDisplay.className = 'current-ball-display';
        updateRemainingBallsUI(); // Update based on potentially filtered list
        updateCalledBallsUI();
        remainingCountSpan.textContent = remainingBalls.length; // Update count based on filtered list
    }

    // --- BINGO Logic ---

    function getBingoLetter(number) {
        for (const letter in letterRanges) {
            const range = letterRanges[letter];
            if (number >= range.min && number <= range.max) {
                return letter;
            }
        }
        return '';
    }

    // --- UI Updates ---

    function updateRemainingBallsUI() {
        remainingBallsContainer.innerHTML = '';
        [...remainingBalls].sort((a, b) => a - b).forEach(ballNum => {
            remainingBallsContainer.appendChild(createBallElement(ballNum));
        });
        remainingCountSpan.textContent = remainingBalls.length;
    }

    function updateCalledBallsUI() {
        calledBallsContainer.innerHTML = '';
        calledBalls.forEach(ballNum => { // No sorting here
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
        // Load audio/interval settings
        currentRate = parseFloat(localStorage.getItem('bingoRate') || '1');
        currentPitch = parseFloat(localStorage.getItem('bingoPitch') || '1');
        currentInterval = parseInt(localStorage.getItem('bingoInterval') || '5', 10);

        rateSlider.value = currentRate;
        rateValueSpan.textContent = currentRate;
        pitchSlider.value = currentPitch;
        pitchValueSpan.textContent = currentPitch;
        intervalSlider.value = currentInterval;
        intervalValueSpan.textContent = currentInterval;

        // Load active letters state
        const savedLetters = localStorage.getItem('bingoActiveLetters');
        if (savedLetters) {
            try {
                activeLetters = JSON.parse(savedLetters);
            } catch (e) {
                console.error("Failed to parse saved active letters", e);
                // Fallback to default if parsing fails
                activeLetters = { B: true, I: true, N: true, G: true, O: true };
            }
        } else {
             // Default if nothing saved
             activeLetters = { B: true, I: true, N: true, G: true, O: true };
        }


        // Update checkboxes based on loaded state
        letterCheckboxes.forEach(checkbox => {
            const letter = checkbox.dataset.letter;
            checkbox.checked = activeLetters[letter];
        });
    }

    function saveSettings() {
        // Save audio/interval
        localStorage.setItem('bingoRate', currentRate);
        localStorage.setItem('bingoPitch', currentPitch);
        localStorage.setItem('bingoInterval', currentInterval);
        // Save voice index
        if (selectedVoice) {
            const voiceIndex = voices.findIndex(v => v.name === selectedVoice.name && v.lang === selectedVoice.lang);
            if (voiceIndex !== -1) {
                localStorage.setItem('bingoVoiceIndex', voiceIndex);
            }
        }
        // Save active letters state
        localStorage.setItem('bingoActiveLetters', JSON.stringify(activeLetters));
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
             // Regenerate ball list in case letters changed while paused
             generateBallList();
             // Only start if there are balls available with current settings
             if (allBalls.length > 0) {
                 // If calledBalls is not empty, it means we are resuming, don't reset called list
                 if (calledBalls.length === 0) {
                     remainingBalls = [...allBalls]; // Fresh start
                 } else {
                     // Resuming: filter allBalls to get remaining ones
                     remainingBalls = allBalls.filter(ball => !calledBalls.includes(ball));
                 }
                 updateRemainingBallsUI(); // Update UI before starting
                 if (remainingBalls.length > 0) {
                     startPauseButton.disabled = false;
                     startGame();
                 } else {
                      startPauseButton.disabled = true; // No balls left to draw
                 }
             } else {
                 alert("No letters selected. Please select at least one letter in the settings.");
                 startPauseButton.disabled = true;
             }
        }
    });

    resetButton.addEventListener('click', () => {
         // Regenerate ball list based on current checkbox state before resetting
         generateBallList();
         resetGame();
    });


    themeToggleButton.addEventListener('click', toggleTheme);

    settingsToggle.addEventListener('click', toggleSettings);

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

    // Listener for letter checkboxes
    letterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const letter = e.target.dataset.letter;
            activeLetters[letter] = e.target.checked;
            saveSettings();
            // Regenerate ball list and reset the game to apply changes
            generateBallList();
            resetGame();
        });
    });


    // --- Initial Load ---
    initializeGame();
});
