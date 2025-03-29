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
    const countdownTimerSpan = document.getElementById('countdown-timer'); // Added for countdown
    // Removed largeBallsToggle reference

    // Game State
    let allBalls = []; // Will be populated based on active letters
    let remainingBalls = [];
    let calledBalls = [];
    let isRunning = false;
    let intervalId = null; // Will be used for the 1-second countdown tick
    let countdownValue = 0; // Stores the current countdown seconds
    let drawBallTimeoutId = null; // Timeout for the next ball draw (alternative to interval)
    let currentUtterance = null;
    let wakeLockSentinel = null; // Screen Wake Lock sentinel

    // Settings State
    let voices = [];
    let selectedVoice = null;
    let currentRate = 1;
    let currentPitch = 1;
    let currentInterval = 5;
    let activeLetters = { B: true, I: true, N: true, G: true, O: true }; // Added
    // Removed isLargeBallsMode variable

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
        // Removed applyLargeBallsMode call
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
        releaseWakeLock(); // Release lock on reset
        // Clear both potential timers/intervals
        if (intervalId) clearInterval(intervalId);
        if (drawBallTimeoutId) clearTimeout(drawBallTimeoutId);
        if (currentUtterance) speechSynthesis.cancel();

        isRunning = false;
        intervalId = null;
        drawBallTimeoutId = null;
        countdownValue = 0;
        currentUtterance = null;
        startPauseButton.textContent = 'Start';
        startPauseButton.disabled = allBalls.length === 0; // Disable if no balls generated
        countdownTimerSpan.textContent = '--'; // Reset countdown display

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

    // --- Screen Wake Lock ---

    // Function to request the screen wake lock
    const requestWakeLock = async () => {
        if ('wakeLock' in navigator) {
            try {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    console.log('Screen Wake Lock released:', wakeLockSentinel);
                    wakeLockSentinel = null; // Sentinel is released when screen locks or visibility changes
                });
                console.log('Screen Wake Lock acquired:', wakeLockSentinel);
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        } else {
            console.log('Screen Wake Lock API not supported.');
        }
    };

    // Function to release the screen wake lock
    const releaseWakeLock = async () => {
        if (wakeLockSentinel !== null) {
            try {
                await wakeLockSentinel.release();
                // Listener should set wakeLockSentinel to null automatically
                console.log('Screen Wake Lock released programmatically.');
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
    };


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

        // Removed large balls mode loading
    }

    // Removed applyLargeBallsMode function


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
        // Removed large balls mode saving
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

        // After drawing, if game should continue, start the countdown for the next ball
        if (remainingBalls.length > 0 && isRunning) {
            console.log("drawBall: Calling startCountdown() for next ball."); // Log 5
            startCountdown();
        } else if (remainingBalls.length === 0) {
            stopGame(); // Stop immediately if last ball was drawn
        }
    }

    // Starts the visual countdown timer, optionally resuming from a specific value
    function startCountdown(resumeValue = null) {
        console.log("startCountdown called. resumeValue:", resumeValue); // Log 6
        if (intervalId) clearInterval(intervalId); // Clear any existing countdown interval
        intervalId = null; // Ensure it's null before setting again

        // Use resumeValue if provided and valid, otherwise start from full interval.
        // Ensure countdownValue is at least 0 if resuming.
        countdownValue = (resumeValue !== null) ? Math.max(0, resumeValue) : currentInterval;
        countdownTimerSpan.textContent = countdownValue;

        // If the countdown is already zero or less when starting/resuming, draw immediately
        // but use setTimeout to avoid potential stack overflow if drawBall calls startCountdown right back.
        if (countdownValue <= 0 && isRunning) {
            console.log("startCountdown: countdownValue <= 0, drawing immediately via setTimeout.");
            setTimeout(() => {
                // Double-check isRunning inside timeout, as state might change quickly
                if (isRunning) drawBall();
            }, 0); // Minimal delay
            return; // Don't start interval if we're drawing immediately
        }

        // Only start the interval if the game is running and there's time left on the countdown
        if (isRunning && countdownValue > 0) {
            console.log("startCountdown: Starting setInterval. countdownValue:", countdownValue); // Log 7
            intervalId = setInterval(() => {
            countdownValue--;
            countdownTimerSpan.textContent = countdownValue;
            if (countdownValue <= 0) {
                clearInterval(intervalId); // Stop this countdown
                intervalId = null;
                if (isRunning) { // Only draw if still running
                    console.log("startCountdown interval: Countdown reached 0, calling drawBall.");
                    drawBall(); // Draw the next ball
                }
            }
        }, 1000); // Tick every second
      } // Closing brace for the 'if (isRunning && countdownValue > 0)' block
    } // Closing brace for the startCountdown function


    function startGame() {
        // This function seems redundant now as the logic is handled in the button listener and drawBall/startCountdown
        // Let's keep it for potential future structure but ensure it's not causing issues.
        // It should NOT be called directly when resuming.
        console.warn("startGame function called - this might be unexpected unless it's a very specific scenario.");
        if (isRunning || remainingBalls.length === 0) return;

        isRunning = true;
        startPauseButton.textContent = 'Pause';
        // Draw the first ball immediately
        drawBall();
        // The countdown for the *next* ball is started within drawBall if needed
    }

    function pauseGame() {
        console.log("pauseGame called.");
        if (!isRunning) return;

        isRunning = false;
        startPauseButton.textContent = 'Start';
        // Clear the countdown interval
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
        // Stop any pending speech
        if (currentUtterance) speechSynthesis.cancel();
        currentUtterance = null;
        // Keep the current countdown value displayed, or reset? Let's reset for clarity.
        // countdownTimerSpan.textContent = '--'; // Or show paused state? Keep value for now.
        releaseWakeLock(); // Release lock on pause
    }

    function stopGame() {
        console.log("stopGame called.");
        releaseWakeLock(); // Release lock on stop
        // Clear the countdown interval
        if (intervalId) clearInterval(intervalId);
        intervalId = null;

        isRunning = false;
        startPauseButton.textContent = 'Start';
        countdownTimerSpan.textContent = '--'; // Reset countdown display

        if (remainingBalls.length === 0) {
             startPauseButton.disabled = true;
        }
        // Note: We don't clear remainingBalls or calledBalls here, resetGame does that.
    }

    // --- Event Listeners ---

    startPauseButton.addEventListener('click', () => {
        console.log("Start/Pause button clicked. isRunning:", isRunning); // Log 1
        if (isRunning) {
            pauseGame();
        } else {
             console.log("Attempting to start or resume."); // Log 2
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
                     isRunning = true; // Set running state
                     startPauseButton.textContent = 'Pause'; // Update button text
                     requestWakeLock(); // Request lock on start/resume

                     // If calledBalls is empty, it's a fresh start: draw the first ball.
                     // drawBall() will then call startCountdown() for the *next* ball.
                     if (calledBalls.length === 0) {
                         console.log("Button Listener: Fresh start, calling drawBall()."); // Log 3
                         drawBall();
                     } else {
                         // Resume: Start the countdown directly from the paused value.
                         console.log("Button Listener: Resuming, calling startCountdown with value:", countdownValue); // Log 4
                         startCountdown(countdownValue);
                     }
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
        // If the game is running, clear the old interval and start a new countdown
        // If the game is running, pause it before changing the interval.
        // The user will need to press Start again to resume with the new interval.
        if (isRunning) {
            console.log("Interval slider changed while running, pausing game.");
            pauseGame();
            // Optionally, display a message or visually indicate that the interval changed
            // and the game needs to be resumed manually? For now, just pausing.
        } else {
             // If paused, just update the display if needed, countdown will use new value on resume
             // Or maybe update the displayed value even if paused?
             // Let's update the display if paused but not running countdown
             if (countdownTimerSpan.textContent !== '--') {
                 // If showing a number, update it? Or wait for resume?
                 // Let's just ensure the next countdown uses the new value.
                 // No immediate action needed if paused.
             }
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

    // Removed large balls toggle listener

    // Handle page visibility changes for Wake Lock
    document.addEventListener('visibilitychange', async () => {
        if (wakeLockSentinel !== null && document.visibilityState === 'hidden') {
            console.log('Page hidden, releasing wake lock.');
            // Release the lock, but keep isRunning state as is.
            // The lock will be re-acquired if the page becomes visible again while isRunning is true.
            await releaseWakeLock(); // Release but don't change game state
        } else if (isRunning && document.visibilityState === 'visible') {
            console.log('Page visible and game is running, re-acquiring wake lock.');
            await requestWakeLock(); // Re-acquire lock if game was running
        }
    });


    // --- Initial Load ---
    initializeGame();
});
