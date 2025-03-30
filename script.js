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
    const ballBoardContainer = document.getElementById('ball-board'); // Renamed from remainingBallsContainer
    const remainingCountSpan = document.getElementById('remaining-count');
    const themeToggleButton = document.getElementById('theme-toggle-button');
    const settingsToggle = document.querySelector('.settings-toggle');
    const settingsContent = document.querySelector('.settings-content');
    const toggleIcon = document.querySelector('.toggle-icon');
    const letterCheckboxes = document.querySelectorAll('.letter-checkboxes input[type="checkbox"]');
    const countdownTimerSpan = document.getElementById('countdown-timer');

    // Game State
    let allBalls = [];
    let remainingBalls = [];
    let calledBalls = []; // Stores balls in the order they are called
    let isRunning = false;
    let intervalId = null;
    let countdownValue = 0;
    let currentUtterance = null;
    let secondaryUtterance = null;
    let wakeLockSentinel = null;

    // Settings State
    let voices = [];
    let selectedVoice = null;
    let currentRate = 1;
    let currentPitch = 1;
    let currentInterval = 5;
    let activeLetters = { B: true, I: true, N: true, G: true, O: true };

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
        loadSettings();
        generateBallList();
        resetGame(); // Calls updateBallBoardUI
        loadInitialTheme();
        initializeSettingsCollapse();
        populateVoiceList(); // Now defined before being called
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
         if (allBalls.length === 0) {
             console.warn("No letters selected. Defaulting to all letters.");
             for (const letter in letterRanges) {
                 const range = letterRanges[letter];
                 for (let i = range.min; i <= range.max; i++) {
                     allBalls.push(i);
                 }
             }
         }
         // Ensure allBalls is sorted for the unified board display logic
         allBalls.sort((a, b) => a - b);
    }

    function resetGame() {
        releaseWakeLock();
        if (intervalId) clearInterval(intervalId);
        if (speechSynthesis.speaking) {
             speechSynthesis.cancel();
        }
        currentUtterance = null;
        secondaryUtterance = null;
        isRunning = false;
        intervalId = null;
        countdownValue = 0;
        startPauseButton.textContent = 'Start';
        startPauseButton.disabled = allBalls.length === 0;
        countdownTimerSpan.textContent = '--';
        remainingBalls = [...allBalls];
        calledBalls = []; // Reset called balls
        currentBallDisplay.innerHTML = '-';
        currentBallDisplay.className = 'current-ball-display';
        updateBallBoardUI();
        remainingCountSpan.textContent = remainingBalls.length;
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
    function updateBallBoardUI() {
        ballBoardContainer.innerHTML = ''; // Clear the board

        const calledElements = [];
        const remainingElements = [];

        // Create elements for called balls IN REVERSE ORDER (most recent first)
        [...calledBalls].reverse().forEach(ballNum => {
             calledElements.push(createBallElement(ballNum, true)); // Mark as called
        });

        // Create elements for remaining balls (sorted numerically)
        // Filter allBalls to get only those NOT in calledBalls
        const currentRemainingBalls = allBalls.filter(ballNum => !calledBalls.includes(ballNum));
        currentRemainingBalls.forEach(ballNum => { // Already sorted because allBalls is sorted
            remainingElements.push(createBallElement(ballNum, false)); // Mark as not called
        });

        // Append called balls first (most recent first), then remaining balls
        calledElements.forEach(el => ballBoardContainer.appendChild(el));
        remainingElements.forEach(el => ballBoardContainer.appendChild(el));

        // Update remaining count separately
        remainingCountSpan.textContent = remainingBalls.length; // Use the state variable remainingBalls count
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
        }

        if (voiceSelect.value && voices[voiceSelect.value]) {
             selectedVoice = voices[voiceSelect.value];
        } else {
             selectedVoice = null;
        }
    }

    const digitToWord = {
        '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
        '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve'
    };

    function numberToWords(number) {
        return String(number).split('').map(digit => digitToWord[digit]).join(', ');
    }

    function speakBall(number) {
        if (!selectedVoice) {
            console.warn("No voice selected. Cannot speak.");
            return;
        }
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }
        currentUtterance = null;
        secondaryUtterance = null;

        const letter = getBingoLetter(number);
        const textToSpeakNormal = `${letter} ${number}`;
        const textToSpeakDigits = `${letter}, ${numberToWords(number)}`;

        currentUtterance = new SpeechSynthesisUtterance(textToSpeakNormal);
        currentUtterance.voice = selectedVoice;
        currentUtterance.rate = currentRate;
        currentUtterance.pitch = currentPitch;
        currentUtterance.lang = selectedVoice.lang;

        secondaryUtterance = new SpeechSynthesisUtterance(textToSpeakDigits);
        secondaryUtterance.voice = selectedVoice;
        secondaryUtterance.rate = currentRate;
        secondaryUtterance.pitch = currentPitch;
        secondaryUtterance.lang = selectedVoice.lang;

        currentUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance (Normal) .onerror', event);
            currentUtterance = null;
        };
        secondaryUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance (Digits) .onerror', event);
            secondaryUtterance = null;
        };

        currentUtterance.onend = () => {
            currentUtterance = null;
            if (secondaryUtterance) {
                 speechSynthesis.speak(secondaryUtterance);
            }
        };

        secondaryUtterance.onend = () => {
             secondaryUtterance = null;
        };

        speechSynthesis.speak(currentUtterance);
    }

    // --- Screen Wake Lock ---
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                if (wakeLockSentinel) {
                    await releaseWakeLock();
                }
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null;
                    if (isRunning) {
                        requestWakeLock();
                    }
                });
            } catch (err) {
                console.error(`Wake Lock request failed: ${err.name}, ${err.message}`);
                wakeLockSentinel = null;
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockSentinel !== null) {
            const sentinelToRelease = wakeLockSentinel;
            wakeLockSentinel = null;
            try {
                await sentinelToRelease.release();
            } catch (err) {
                console.error(`Wake Lock release failed: ${err.name}, ${err.message}`);
            }
        }
    };

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

        const savedLetters = localStorage.getItem('bingoActiveLetters');
        if (savedLetters) {
            try {
                activeLetters = JSON.parse(savedLetters);
            } catch (e) {
                console.error("Failed to parse saved active letters", e);
                activeLetters = { B: true, I: true, N: true, G: true, O: true };
            }
        } else {
             activeLetters = { B: true, I: true, N: true, G: true, O: true };
        }
        letterCheckboxes.forEach(checkbox => {
            const letter = checkbox.dataset.letter;
            checkbox.checked = activeLetters[letter];
        });
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
        calledBalls.push(drawnBall); // Add to the end of the called list
        displayCurrentBall(drawnBall);
        updateBallBoardUI(); // Update board (will show called in reverse order)
        speakBall(drawnBall);

        if (remainingBalls.length > 0 && isRunning) {
            startCountdown();
        } else if (remainingBalls.length === 0) {
            stopGame();
        }
    }

    function startCountdown(resumeValue = null) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        countdownValue = (resumeValue !== null) ? Math.max(0, resumeValue) : currentInterval;
        countdownTimerSpan.textContent = countdownValue;

        if (countdownValue <= 0 && isRunning) {
            setTimeout(() => { if (isRunning) drawBall(); }, 0);
            return;
        }

        if (isRunning && countdownValue > 0) {
            intervalId = setInterval(() => {
                countdownValue--;
                countdownTimerSpan.textContent = countdownValue;
                if (countdownValue <= 0) {
                    clearInterval(intervalId);
                    intervalId = null;
                    if (isRunning) {
                        drawBall();
                    }
                }
            }, 1000);
        }
    }

    function pauseGame() {
        if (!isRunning) return;
        isRunning = false;
        startPauseButton.textContent = 'Start';
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        if (speechSynthesis.speaking) {
             speechSynthesis.cancel();
        }
        currentUtterance = null;
        secondaryUtterance = null;
        releaseWakeLock();
    }

    function stopGame() {
        releaseWakeLock();
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        if (speechSynthesis.speaking) {
             speechSynthesis.cancel();
        }
        currentUtterance = null;
        secondaryUtterance = null;
        isRunning = false;
        startPauseButton.textContent = 'Start';
        countdownTimerSpan.textContent = '--';
        if (remainingBalls.length === 0) {
             startPauseButton.disabled = true;
        }
    }

    // --- Event Listeners ---
    startPauseButton.addEventListener('click', () => {
        if (isRunning) {
            pauseGame();
        } else {
             generateBallList();
             if (allBalls.length > 0) {
                 if (calledBalls.length === 0) {
                     remainingBalls = [...allBalls];
                 } else {
                     remainingBalls = allBalls.filter(ball => !calledBalls.includes(ball));
                 }
                 updateBallBoardUI();

                 if (remainingBalls.length > 0) {
                     startPauseButton.disabled = false;
                     isRunning = true;
                     startPauseButton.textContent = 'Pause';
                     requestWakeLock();
                     if (calledBalls.length === 0) {
                         drawBall();
                     } else {
                         startCountdown(countdownValue);
                     }
                 } else {
                      startPauseButton.disabled = true;
                 }
             } else {
                 alert("No letters selected. Please select at least one letter in the settings.");
                 startPauseButton.disabled = true;
             }
        }
    });

    resetButton.addEventListener('click', () => {
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
        }
    });

    letterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const letter = e.target.dataset.letter;
            activeLetters[letter] = e.target.checked;
            saveSettings();
            generateBallList();
            resetGame();
        });
    });

    document.addEventListener('visibilitychange', async () => {
        if (!('wakeLock' in navigator)) return;
        if (wakeLockSentinel !== null && document.visibilityState === 'hidden') {
            await releaseWakeLock();
        } else if (isRunning && document.visibilityState === 'visible') {
             await requestWakeLock();
        }
    });

    // --- Initial Load ---
    initializeGame();
});
