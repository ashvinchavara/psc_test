// App State
let examMode = 'exam'; // 'exam' or 'practice'
let userAnswers = Array(100).fill(null);
let markedReview = Array(100).fill(false);
let timerInterval = null;
let totalTime = 90 * 60; // 90 minutes in seconds
let timeLeft = totalTime;
let timeElapsed = 0;

// Custom Ingestion State
let uploadedFiles = [];
let parsedQuestions = [];

// Page Load Initializer
document.addEventListener('DOMContentLoaded', () => {
    setupUploadDropzone();
});

// 1. Landing Screen Mode Select
function selectMode(mode) {
    examMode = mode;
    const cards = document.querySelectorAll('.mode-card');
    cards.forEach(card => card.classList.remove('selected'));
    if (mode === 'exam') {
        cards[0].classList.add('selected');
    } else if (mode === 'practice') {
        cards[1].classList.add('selected');
    } else if (mode === 'infinite') {
        cards[2].classList.add('selected');
    }
}

function handleStartClick() {
    if (examMode === 'infinite') {
        startInfiniteMode();
    } else {
        startExam();
    }
}

// 2. Start Exam (Default Mock Test)
function startExam() {
    // Set active exam title
    document.getElementById('active-exam-title').innerText = "Fire & Rescue Officer Exam";
    
    // Set badges and classes
    const modeBadge = document.getElementById('mode-badge');
    if (examMode === 'exam') {
        modeBadge.innerText = "Exam Mode";
        modeBadge.style.color = "var(--accent-color)";
        timeLeft = 90 * 60; // 90 mins
        startTimerCountdown();
    } else {
        modeBadge.innerText = "Practice Mode";
        modeBadge.style.color = "var(--success-color)";
        timeElapsed = 0;
        startTimerCountup();
    }

    // Reset state
    userAnswers = Array(100).fill(null);
    markedReview = Array(100).fill(false);
    
    // Render dynamic question lists and navigation grid using the default QUESTIONS array
    renderQuestionsList();
    renderNavigationGrid();
    updateProgress();

    // Switch screen view
    switchScreen('landing-screen', 'exam-screen');
}

// Timer Logic - Countdown (Exam Mode)
function startTimerCountdown() {
    clearInterval(timerInterval);
    updateTimerDisplay(timeLeft);
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        
        // Warning color at less than 10 minutes
        const timerBox = document.getElementById('timer-display');
        if (timeLeft <= 10 * 60) {
            timerBox.classList.add('warning');
        } else {
            timerBox.classList.remove('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("Time's up! Your answers will be submitted automatically.");
            submitExam();
        }
    }, 1000);
}

// Timer Logic - Countup (Practice Mode)
function startTimerCountup() {
    clearInterval(timerInterval);
    updateTimerDisplay(timeElapsed);
    
    timerInterval = setInterval(() => {
        timeElapsed++;
        updateTimerDisplay(timeElapsed);
    }, 1000);
}

// Format seconds into MM:SS
function updateTimerDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('time-text').innerText = formatted;
}

// 3. Dynamic Questions Rendering
function renderQuestionsList() {
    const container = document.getElementById('questions-list-container');
    container.innerHTML = "";
    
    QUESTIONS.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.id = `q-card-${idx}`;
        
        // Header
        const header = document.createElement('div');
        header.className = 'q-card-header';
        
        const badge = document.createElement('span');
        badge.className = 'q-badge';
        badge.innerText = `Question ${q.qNum} of ${QUESTIONS.length}`;
        header.appendChild(badge);
        
        const flagBtn = document.createElement('button');
        flagBtn.className = 'q-flag-icon-btn';
        flagBtn.title = "Mark for Review";
        flagBtn.innerHTML = '<i class="fa-regular fa-flag"></i>';
        flagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleReviewFlag(idx, flagBtn);
        });
        header.appendChild(flagBtn);
        
        card.appendChild(header);
        
        // Question Text
        const text = document.createElement('div');
        text.className = 'q-text';
        text.innerHTML = q.question;
        card.appendChild(text);
        
        // Options Container
        const optionsGroup = document.createElement('div');
        optionsGroup.className = 'q-options-container';
        
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const optBtn = document.createElement('button');
            optBtn.className = 'option-btn';
            optBtn.id = `opt-btn-${idx}-${opt}`;
            
            const letter = document.createElement('span');
            letter.className = 'option-letter';
            letter.innerText = opt;
            optBtn.appendChild(letter);
            
            const textSpan = document.createElement('span');
            textSpan.className = 'option-text';
            textSpan.innerText = q.options[opt] || '';
            optBtn.appendChild(textSpan);
            
            optBtn.addEventListener('click', () => {
                // If in practice mode and already checked, don't allow changes
                if (examMode === 'practice' && card.classList.contains('checked-practice')) {
                    return;
                }
                selectOption(idx, opt);
            });
            
            optionsGroup.appendChild(optBtn);
        });
        
        card.appendChild(optionsGroup);
        
        // Footer (Practice Mode check button)
        if (examMode === 'practice') {
            const footer = document.createElement('div');
            footer.className = 'q-card-footer';
            
            const checkBtn = document.createElement('button');
            checkBtn.className = 'q-check-btn';
            checkBtn.id = `check-btn-${idx}`;
            checkBtn.innerText = "Check Answer";
            checkBtn.addEventListener('click', () => {
                checkAnswerPractice(idx);
            });
            
            footer.appendChild(checkBtn);
            card.appendChild(footer);
        }
        
        container.appendChild(card);
    });
}

// 4. Navigation Grid Rendering
function renderNavigationGrid() {
    const container = document.getElementById('nav-grid-container');
    container.innerHTML = "";
    
    // Dynamic grid columns layout depending on question count
    container.style.gridTemplateColumns = `repeat(5, 1fr)`;
    
    for (let i = 0; i < QUESTIONS.length; i++) {
        const cell = document.createElement('div');
        cell.className = 'nav-cell';
        cell.id = `nav-cell-${i}`;
        cell.innerText = i + 1;
        
        cell.addEventListener('click', () => {
            scrollToQuestion(i);
        });
        
        container.appendChild(cell);
    }
}

// Scroll question card into view
function scrollToQuestion(idx) {
    // Remove active styling from all cards
    document.querySelectorAll('.question-card').forEach(c => c.classList.remove('active-card'));
    
    const card = document.getElementById(`q-card-${idx}`);
    card.classList.add('active-card');
    
    card.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
}

// Selection handler
function selectOption(qIdx, option) {
    userAnswers[qIdx] = option;
    updateProgress();
    
    // Update Option Buttons Styling
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`opt-btn-${qIdx}-${opt}`);
        if (opt === option) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // Update Nav Cell status
    const cell = document.getElementById(`nav-cell-${qIdx}`);
    cell.classList.add('answered');
}

// Toggle review flag
function toggleReviewFlag(qIdx, btnElement) {
    markedReview[qIdx] = !markedReview[qIdx];
    const card = document.getElementById(`q-card-${qIdx}`);
    const cell = document.getElementById(`nav-cell-${qIdx}`);
    
    if (markedReview[qIdx]) {
        card.classList.add('marked-review');
        cell.classList.add('review');
        btnElement.innerHTML = '<i class="fa-solid fa-flag" style="color: var(--review-color);"></i>';
    } else {
        card.classList.remove('marked-review');
        cell.classList.remove('review');
        btnElement.innerHTML = '<i class="fa-regular fa-flag"></i>';
    }
}

// Update test progress bar
function updateProgress() {
    const answeredCount = userAnswers.filter(ans => ans !== null).length;
    document.getElementById('progress-val').innerText = `${answeredCount} / ${QUESTIONS.length} Answered`;
    
    const percentage = QUESTIONS.length > 0 ? (answeredCount / QUESTIONS.length) * 100 : 0;
    document.getElementById('progress-bar').style.width = `${percentage}%`;
}

// Practice Mode - Check individual answer instantly
function checkAnswerPractice(qIdx) {
    const selected = userAnswers[qIdx];
    if (!selected) {
        alert("Please select an option first!");
        return;
    }
    
    const correct = QUESTIONS[qIdx].answer;
    const card = document.getElementById(`q-card-${qIdx}`);
    card.classList.add('checked-practice');
    
    // Hide check button
    const checkBtn = document.getElementById(`check-btn-${qIdx}`);
    if (checkBtn) checkBtn.style.display = 'none';
    
    const cell = document.getElementById(`nav-cell-${qIdx}`);
    
    if (selected === correct) {
        card.classList.add('correct');
        document.getElementById(`opt-btn-${qIdx}-${selected}`).classList.add('correct-option');
        cell.classList.add('correct');
    } else {
        card.classList.add('incorrect');
        document.getElementById(`opt-btn-${qIdx}-${selected}`).classList.add('incorrect-option');
        document.getElementById(`opt-btn-${qIdx}-${correct}`).classList.add('correct-option');
        cell.classList.add('incorrect');
    }
    
    // Create AI explanation button in footer
    const footer = card.querySelector('.q-card-footer');
    if (footer) {
        const aiBtn = document.createElement('button');
        aiBtn.className = 'ai-expl-btn';
        aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Explanation';
        aiBtn.addEventListener('click', () => toggleAIExplanation(qIdx, card, QUESTIONS[qIdx]));
        footer.appendChild(aiBtn);
    }
}

// 5. Submit Exam
function confirmSubmit() {
    const unansweredCount = userAnswers.filter(ans => ans === null).length;
    let message = "Are you sure you want to submit your test paper?";
    if (unansweredCount > 0) {
        message = `You have ${unansweredCount} unanswered questions. ${message}`;
    }
    
    if (confirm(message)) {
        submitExam();
    }
}

function submitExam() {
    clearInterval(timerInterval);
    
    // Calculate performance scores
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    
    for (let i = 0; i < QUESTIONS.length; i++) {
        const correct = QUESTIONS[i].answer;
        if (userAnswers[i] === null) {
            unansweredCount++;
        } else if (userAnswers[i] === correct) {
            correctCount++;
        } else {
            wrongCount++;
        }
    }
    
    // Calculate final score using KPSC negative marking rules (+1.00, -0.33)
    const score = correctCount - (wrongCount * 0.33);
    const finalScore = Math.max(0, Math.round(score * 100) / 100);
    const passThreshold = Math.ceil(QUESTIONS.length * 0.61); // Dynamically set cutoff at 61%
    const passed = finalScore >= passThreshold;
    const accuracy = correctCount + wrongCount > 0 
        ? Math.round((correctCount / (correctCount + wrongCount)) * 100) 
        : 0;

    // Update Result UI Screen
    document.getElementById('score-text').innerText = finalScore.toFixed(2);
    document.getElementById('score-ring-visual').nextElementSibling.innerText = `out of ${QUESTIONS.length}`;
    document.getElementById('stat-correct-count').innerText = correctCount;
    document.getElementById('stat-wrong-count').innerText = wrongCount;
    document.getElementById('stat-unanswered-count').innerText = unansweredCount;
    document.getElementById('stat-accuracy-val').innerText = `${accuracy}%`;
    
    // Update Score Circle SVG Visual
    const scoreRingVisual = document.getElementById('score-ring-visual');
    const percentFill = QUESTIONS.length > 0 ? (finalScore / QUESTIONS.length) * 100 : 0;
    scoreRingVisual.style.borderImage = `conic-gradient(var(--primary-color) ${percentFill}%, rgba(255,255,255,0.05) ${percentFill}%) 1`;

    // Set Pass/Fail Badge
    const verdictBadge = document.getElementById('result-verdict-badge');
    const verdictDesc = document.getElementById('score-desc-text');
    if (passed) {
        verdictBadge.innerText = "Passed";
        verdictBadge.className = "result-badge pass";
        verdictDesc.innerText = `Excellent job! You cleared the cut-off mark of ${passThreshold}.00.`;
    } else {
        verdictBadge.innerText = "Failed";
        verdictBadge.className = "result-badge fail";
        verdictDesc.innerText = `You did not clear the cut-off mark of ${passThreshold}.00. Keep practicing!`;
    }

    // Populate Detailed Review List
    renderReviewGrid();

    // Populate Explanations
    renderMathExplanations();

    // Switch screen view
    switchScreen('exam-screen', 'result-screen');
}

// 6. Render Detailed Review Grid
function renderReviewGrid() {
    const container = document.getElementById('review-grid-container');
    container.innerHTML = "";
    
    QUESTIONS.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'review-card';
        
        const correctOpt = q.answer;
        const userOpt = userAnswers[idx];
        
        // Header
        const header = document.createElement('div');
        header.className = 'review-card-header';
        
        const badge = document.createElement('span');
        badge.className = 'q-badge';
        badge.innerText = `Question ${q.qNum} of ${QUESTIONS.length}`;
        header.appendChild(badge);
        
        const statusText = document.createElement('span');
        statusText.className = 'review-status-text';
        
        if (userOpt === null) {
            card.classList.add('unanswered');
            statusText.innerHTML = '<i class="fa-regular fa-circle"></i> Not Attempted';
            statusText.classList.add('unanswered');
        } else if (userOpt === correctOpt) {
            card.classList.add('correct');
            statusText.innerHTML = '<i class="fa-solid fa-circle-check"></i> Correct';
            statusText.classList.add('correct');
        } else {
            card.classList.add('wrong');
            statusText.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Incorrect';
            statusText.classList.add('wrong');
        }
        header.appendChild(statusText);
        card.appendChild(header);
        
        // Question Text
        const text = document.createElement('div');
        text.className = 'q-text';
        text.innerHTML = q.question;
        card.appendChild(text);
        
        // Options List
        const optionsGroup = document.createElement('div');
        optionsGroup.className = 'q-options-container';
        
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const optDiv = document.createElement('div');
            optDiv.className = 'review-option';
            
            const letter = document.createElement('span');
            letter.className = 'option-letter';
            letter.innerText = opt;
            optDiv.appendChild(letter);
            
            const textSpan = document.createElement('span');
            textSpan.className = 'option-text';
            textSpan.innerText = q.options[opt] || '';
            optDiv.appendChild(textSpan);
            
            // Highlights
            if (opt === correctOpt) {
                optDiv.classList.add('correct-option');
            } else if (opt === userOpt) {
                optDiv.classList.add('incorrect-option');
            }
            
            optionsGroup.appendChild(optDiv);
        });
        
        card.appendChild(optionsGroup);
        
        // Add action buttons (AI Explanation & Report Key) for review card
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '0.5rem';
        actionsDiv.style.marginTop = '1rem';
        
        const aiBtn = document.createElement('button');
        aiBtn.className = 'ai-expl-btn';
        aiBtn.style.margin = '0';
        aiBtn.style.flex = '1';
        aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Explanation';
        aiBtn.addEventListener('click', () => toggleAIExplanation(idx, card, q));
        actionsDiv.appendChild(aiBtn);
        
        const flagBtn = document.createElement('button');
        flagBtn.className = 'ai-expl-btn';
        flagBtn.style.margin = '0';
        flagBtn.style.flex = '1';
        flagBtn.style.background = 'rgba(239, 68, 68, 0.1)';
        flagBtn.style.color = '#f87171';
        flagBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Report Wrong Key';
        flagBtn.addEventListener('click', () => openFlagModal(q.id || '', q.question));
        actionsDiv.appendChild(flagBtn);
        
        card.appendChild(actionsDiv);
        
        container.appendChild(card);
    });
}

// 7. Render Math Explanations in Results
function renderMathExplanations() {
    const container = document.getElementById('math-explanations-container');
    container.innerHTML = "";
    
    // Hide math section if no custom explanations exist
    const mathCard = document.getElementById('explanations-section');
    
    if (typeof MATH_EXPLANATIONS === 'undefined' || MATH_EXPLANATIONS.length === 0) {
        mathCard.style.display = 'none';
        return;
    }
    
    mathCard.style.display = 'block';
    
    MATH_EXPLANATIONS.forEach(expl => {
        // Only render if the question exists in the active test
        const qExists = QUESTIONS.some(q => q.qNum === expl.qNum);
        if (!qExists) return;
        
        const item = document.createElement('div');
        item.className = 'expl-item';
        
        const header = document.createElement('div');
        header.className = 'expl-qtitle';
        header.innerHTML = `<span>${expl.title}</span><span class="answer-span">Correct Answer: Option ${expl.correctAnswer}</span>`;
        item.appendChild(header);
        
        const body = document.createElement('div');
        body.className = 'expl-body';
        body.innerHTML = expl.body;
        item.appendChild(body);
        
        container.appendChild(item);
    });
}

// 8. Navigation Helpers
function switchScreen(fromId, toId) {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);
    
    fromScreen.style.opacity = 0;
    setTimeout(() => {
        fromScreen.style.display = 'none';
        fromScreen.classList.remove('active');
        
        toScreen.style.display = 'flex';
        toScreen.classList.add('active');
        setTimeout(() => {
            toScreen.style.opacity = 1;
        }, 50);
    }, 400);
}

function retakeExam() {
    clearInterval(timerInterval);
    switchScreen('result-screen', 'landing-screen');
}

function scrollToReview() {
    document.getElementById('review-section-element').scrollIntoView({
        behavior: 'smooth'
    });
}

// =========================================================================
// CUSTOM QUESTION UPLOAD & PARSER LOGIC
// =========================================================================

// Open/Close Ingestion Modal
function openUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.add('active');
    uploadedFiles = [];
    document.getElementById('selected-file-info').style.display = 'none';
    document.getElementById('process-file-btn').disabled = true;
    
    // Clear dropzone styling
    const dropzone = document.getElementById('dropzone');
    dropzone.className = 'dropzone';
    dropzone.querySelector('p').innerText = "Drag & Drop your PDF or Images here";
}

function closeUploadModal() {
    document.getElementById('upload-modal').classList.remove('active');
}

// Dropzone Drag-and-drop Events
function setupUploadDropzone() {
    const dropzone = document.getElementById('dropzone');
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    });
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
}

function handleFiles(files) {
    uploadedFiles = Array.from(files);
    
    const info = document.getElementById('selected-file-info');
    const nameDisplay = document.getElementById('file-name-display');
    const processBtn = document.getElementById('process-file-btn');
    
    if (uploadedFiles.length > 0) {
        const names = uploadedFiles.map(f => f.name).join(', ');
        nameDisplay.innerText = names.length > 45 ? names.substring(0, 42) + '...' : names;
        info.style.display = 'block';
        processBtn.disabled = false;
        
        // Update dropzone description
        document.getElementById('dropzone').querySelector('p').innerText = `${uploadedFiles.length} file(s) selected`;
    }
}

// Terminal Console Log Helper
function logConsole(message, type = 'info') {
    const consoleBox = document.getElementById('terminal-logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.innerText = `[${timestamp}] ${message}`;
    
    consoleBox.appendChild(entry);
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

// Processing main function
async function processUploadedFile() {
    if (uploadedFiles.length === 0) return;
    
    // Switch to processing view
    closeUploadModal();
    switchScreen('landing-screen', 'processing-screen');
    
    const progressBar = document.getElementById('processing-bar-fill');
    const statusText = document.getElementById('processing-status-text');
    const logs = document.getElementById('terminal-logs');
    logs.innerHTML = ""; // reset logs
    progressBar.style.width = '0%';
    
    logConsole("Initializing ingestion pipeline...", "info");
    
    let accumulatedText = "";
    const selectedLanguage = document.getElementById('ocr-lang-select').value;
    
    try {
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            logConsole(`Processing file ${i + 1} of ${uploadedFiles.length}: ${file.name}...`);
            
            if (file.type === "application/pdf") {
                accumulatedText += await parsePDF(file, selectedLanguage, progressBar, statusText);
            } else if (file.type.startsWith("image/")) {
                accumulatedText += await parseImage(file, selectedLanguage, progressBar, statusText);
            } else {
                logConsole(`Unsupported file type: ${file.type}`, "error");
            }
        }
        
        logConsole("Text extraction complete. Running question parser...", "info");
        progressBar.style.width = '95%';
        statusText.innerText = "Parsing questions and options...";
        
        const pattern = document.getElementById('parser-pattern-select').value;
        parseQuestionsFromText(accumulatedText, pattern);
        
        progressBar.style.width = '100%';
        statusText.innerText = "Test parsed successfully!";
        logConsole(`Successfully parsed ${parsedQuestions.length} questions. Redirecting to Editor...`);
        
        setTimeout(() => {
            openIngestionEditor();
        }, 1500);
        
    } catch (err) {
        logConsole(`Critical Error: ${err.message}`, "error");
        statusText.innerText = "Processing failed.";
        statusText.style.color = "var(--danger-color)";
        console.error(err);
        
        // Show back to landing after 4 seconds
        setTimeout(() => {
            statusText.style.color = "var(--primary-color)";
            switchScreen('processing-screen', 'landing-screen');
        }, 5000);
    }
}

// PDF Parser using PDF.js
function parsePDF(file, language, progressBar, statusText) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                // Configure PDF.js global worker
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                logConsole(`PDF loaded. Total Pages: ${pdf.numPages}`);
                
                let pdfText = "";
                
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    logConsole(`Analyzing Page ${pageNum}...`);
                    statusText.innerText = `Analyzing Page ${pageNum} of ${pdf.numPages}...`;
                    progressBar.style.width = `${(pageNum / pdf.numPages) * 80}%`;
                    
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const extracted = textContent.items.map(item => item.str).join(' ');
                    
                    // Heuristic: If we extracted substantial text, check if it contains expected Unicode character scripts
                    const isMalayalamSelected = (language === 'mal');
                    const hasMalayalamUnicode = /[\u0D00-\u0D7F]/.test(extracted);
                    
                    let useDirectExtraction = false;
                    if (extracted.trim().length > 100) {
                        if (isMalayalamSelected) {
                            // If Malayalam, direct extraction is only valid if it contains Malayalam Unicode.
                            // If it contains no Malayalam Unicode (only ASCII gibberish), it uses a legacy custom font.
                            if (hasMalayalamUnicode) {
                                useDirectExtraction = true;
                            } else {
                                logConsole(`Page ${pageNum}: Selectable text contains no Malayalam Unicode (likely legacy ASCII-mapped font). Forcing WebAssembly OCR.`, "warning");
                            }
                        } else {
                            useDirectExtraction = true;
                        }
                    }
                    
                    if (useDirectExtraction) {
                        logConsole(`Page ${pageNum}: Selectable text found. Extracting directly.`);
                        pdfText += extracted + "\n\n";
                    } else {
                        // Scanned PDF: Render page to canvas and perform OCR
                        logConsole(`Page ${pageNum}: No selectable text. Rendering page image...`);
                        statusText.innerText = `Rendering Page ${pageNum} for OCR...`;
                        
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        
                        const numCols = parseInt(document.getElementById('ocr-columns-select').value) || 1;
                        logConsole(`Page ${pageNum}: Slicing into ${numCols} column(s)...`);
                        
                        let pageText = "";
                        const colWidth = canvas.width / numCols;
                        
                        for (let col = 0; col < numCols; col++) {
                            logConsole(`Page ${pageNum} - Column ${col + 1}/${numCols}: Running OCR...`);
                            statusText.innerText = `OCR Page ${pageNum} (Col ${col + 1}/${numCols})...`;
                            
                            const colCanvas = document.createElement('canvas');
                            colCanvas.width = colWidth;
                            colCanvas.height = canvas.height;
                            const colCtx = colCanvas.getContext('2d');
                            
                            // Draw the vertical slice of the page
                            colCtx.drawImage(canvas, col * colWidth, 0, colWidth, canvas.height, 0, 0, colWidth, canvas.height);
                            
                            const result = await Tesseract.recognize(colCanvas, language, {
                                logger: m => {
                                    if (m.status === 'recognizing') {
                                        const progress = Math.round(m.progress * 100);
                                        statusText.innerText = `Page ${pageNum} Col ${col + 1}: ${progress}%`;
                                    }
                                }
                            });
                            pageText += result.data.text + "\n\n";
                        }
                        
                        logConsole(`Page ${pageNum}: OCR completed.`);
                        pdfText += pageText + "\n\n";
                    }
                }
                
                resolve(pdfText);
            } catch (err) {
                reject(err);
            }
        };
        
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });
}

// Image Parser using Tesseract.js (with column slicing)
function parseImage(file, language, progressBar, statusText) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = async function() {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                const numCols = parseInt(document.getElementById('ocr-columns-select').value) || 1;
                logConsole(`Image selected: ${file.name}. Slicing into ${numCols} column(s)...`);
                progressBar.style.width = "20%";
                
                let imageText = "";
                const colWidth = canvas.width / numCols;
                
                for (let col = 0; col < numCols; col++) {
                    logConsole(`Image - Column ${col + 1}/${numCols}: Running OCR...`);
                    statusText.innerText = `OCR Column ${col + 1}/${numCols}...`;
                    
                    const colCanvas = document.createElement('canvas');
                    colCanvas.width = colWidth;
                    colCanvas.height = canvas.height;
                    const colCtx = colCanvas.getContext('2d');
                    
                    colCtx.drawImage(canvas, col * colWidth, 0, colWidth, canvas.height, 0, 0, colWidth, canvas.height);
                    
                    const result = await Tesseract.recognize(colCanvas, language, {
                        logger: m => {
                            if (m.status === 'recognizing') {
                                const progress = Math.round(m.progress * 100);
                                statusText.innerText = `Col ${col + 1} OCR: ${progress}%`;
                                progressBar.style.width = `${20 + (((col + m.progress) / numCols) * 70)}%`;
                            }
                        }
                    });
                    imageText += result.data.text + "\n\n";
                }
                
                logConsole("Image OCR completed.");
                resolve(imageText);
            } catch (err) {
                reject(err);
            }
        };
        
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Malayalam Options Translator Helper
function translateMalayalamOption(opt) {
    if (!opt) return 'A';
    opt = opt.trim().toUpperCase();
    if (opt === 'എ' || opt === 'എ)' || opt === 'A') return 'A';
    if (opt === 'ബി' || opt === 'ബി)' || opt === 'B') return 'B';
    if (opt === 'സി' || opt === 'സി)' || opt === 'C') return 'C';
    if (opt === 'ഡി' || opt === 'ഡി)' || opt === 'D') return 'D';
    return 'A'; // fallback
}

// State for storing the extracted exam posting title
let extractedPostingName = "Fire & Rescue Officer";

// Core parsing heuristics engine
function parseQuestionsFromText(text, pattern) {
    parsedQuestions = [];
    
    // Normalize newlines and whitespace
    let cleanText = text.replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n\n');
    
    // Heuristic: Extract Posting/Exam Name from the text content (e.g. from answer key metadata or header)
    extractedPostingName = "Fire & Rescue Officer";
    const postingMatch = cleanText.match(/Name of Post\s*:\s*([^\n\r]+)/i);
    if (postingMatch) {
        extractedPostingName = postingMatch[1].trim();
        logConsole(`Extracted Posting Name from PDF: ${extractedPostingName}`);
    } else {
        // Look in the first 1500 characters for keywords
        const headerSegment = cleanText.substring(0, 1500);
        const firemanMatch = headerSegment.match(/(fireman|fire\s*&\s*rescue|ldc|clerk|typist|police|assistant)/i);
        if (firemanMatch) {
            extractedPostingName = firemanMatch[0].toUpperCase();
            logConsole(`Extracted Posting Name keyword from header: ${extractedPostingName}`);
        }
    }
    
    if (pattern === 'end') {
        // Pattern A: Answers at the end of last page
        // 1. Try to find the boundary of the answer key
        const answerMarkers = [/ANSWERS/i, /EXPLANATIONS/i, /ഉത്തരങ്ങൾ/i, /ANSWER KEY/i, /മാതൃക/i];
        let splitIndex = -1;
        
        for (const marker of answerMarkers) {
            const match = cleanText.search(marker);
            if (match !== -1 && match > cleanText.length * 0.5) { // marker should be in the second half
                splitIndex = match;
                break;
            }
        }
        
        let questionsText = cleanText;
        let answersText = "";
        
        if (splitIndex !== -1) {
            questionsText = cleanText.substring(0, splitIndex);
            answersText = cleanText.substring(splitIndex);
            logConsole("Found Answer Key marker. Splitting question text and key.");
        } else {
            logConsole("Could not find Answer Key section marker. Loading questions without key.", "error");
        }
        
        // 2. Parse Answers Map
        const answersMap = new Map();
        if (answersText) {
            // Find patterns like: "1 A" or "1. A" or "1: A" or "1-A" or "1A"
            // Handles both English and Malayalam options ఎ, ബി, സി, ഡി
            const answerRegex = /\b(\d+)\s*[\.\-\:\)]?\s*([A-D|എ|ബി|സി|ഡി])\b/g;
            let match;
            while ((match = answerRegex.exec(answersText)) !== null) {
                const qNum = parseInt(match[1]);
                const ans = translateMalayalamOption(match[2]);
                answersMap.set(qNum, ans);
            }
            logConsole(`Parsed ${answersMap.size} answers from the key.`);
        }
        
        // 3. Parse Question Blocks
        // Heuristic: Questions start with a number at the beginning of a line
        const lines = questionsText.split('\n');
        let currentBlock = null;
        const blocks = [];
        
        lines.forEach(line => {
            const numMatch = line.match(/^\s*(\d+)\s*[\.\-\)]\s*(.*)/);
            if (numMatch) {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = {
                    num: parseInt(numMatch[1]),
                    content: numMatch[2] + "\n"
                };
            } else if (currentBlock) {
                currentBlock.content += line + "\n";
            }
        });
        if (currentBlock) blocks.push(currentBlock);
        
        // 4. Extract Questions, Options, and Answers from Blocks
        blocks.forEach(block => {
            const parsed = extractQuestionStructure(block.content, block.num);
            // Attach correct answer from our parsed answers map
            if (answersMap.has(block.num)) {
                parsed.answer = answersMap.get(block.num);
            }
            parsedQuestions.push(parsed);
        });
        
    } else {
        // Pattern B: Answer following each question
        // Heuristic: Find question blocks, then look for answers inline
        const blocks = [];
        const lines = cleanText.split('\n');
        let currentBlock = null;
        
        lines.forEach(line => {
            const numMatch = line.match(/^\s*(\d+)\s*[\.\-\)]\s*(.*)/);
            if (numMatch) {
                if (currentBlock) blocks.push(currentBlock);
                currentBlock = {
                    num: parseInt(numMatch[1]),
                    content: numMatch[2] + "\n"
                };
            } else if (currentBlock) {
                currentBlock.content += line + "\n";
            }
        });
        if (currentBlock) blocks.push(currentBlock);
        
        blocks.forEach(block => {
            const parsed = extractQuestionStructure(block.content, block.num);
            
            // Look for inline answers like "Ans: A" or "Answer: B" or "ഉത്തരം: എ"
            const inlineAnswerRegex = /(?:Ans|Answer|Key|ഉത്തരം)[\s\-\:\.]*([A-D|എ|ബി|സി|ഡി])/i;
            const ansMatch = block.content.match(inlineAnswerRegex);
            if (ansMatch) {
                parsed.answer = translateMalayalamOption(ansMatch[1]);
                // Strip the answer line from the question text
                parsed.question = parsed.question.replace(inlineAnswerRegex, '').trim();
            }
            
            parsedQuestions.push(parsed);
        });
    }
}

// Helper to separate question text and options from block string
function extractQuestionStructure(content, qNum) {
    const qObj = {
        qNum: qNum,
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        answer: "A" // default fallback
    };
    
    // Look for options A, B, C, D (English or Malayalam ಎ, ബി, സി, ഡി)
    // Matches patterns like "A) text" or "A. text" or "എ) text" or "എ. text"
    const optRegexes = {
        A: /(?:A|എ)[\s\.\-\)]+([\s\S]*?)(?=(?:B|ബി)[\s\.\-\)]+|(?:C|സി)[\s\.\-\)]+|(?:D|ഡി)[\s\.\-\)]+|$)/i,
        B: /(?:B|ബി)[\s\.\-\)]+([\s\S]*?)(?=(?:C|സി)[\s\.\-\)]+|(?:D|ഡി)[\s\.\-\)]+|$)/i,
        C: /(?:C|സി)[\s\.\-\)]+([\s\S]*?)(?=(?:D|ഡി)[\s\.\-\)]+|$)/i,
        D: /(?:D|ഡി)[\s\.\-\)]+([\s\S]*?)$/i
    };
    
    let questionText = content;
    let foundOptions = false;
    
    // Attempt option extraction
    const matchA = content.match(optRegexes.A);
    const matchB = content.match(optRegexes.B);
    const matchC = content.match(optRegexes.C);
    const matchD = content.match(optRegexes.D);
    
    if (matchA && matchB && matchC && matchD) {
        qObj.options.A = matchA[1].trim();
        qObj.options.B = matchB[1].trim();
        qObj.options.C = matchC[1].trim();
        qObj.options.D = matchD[1].trim();
        foundOptions = true;
        
        // Question text is everything before option A starts
        const indexA = content.search(/(?:A|എ)[\s\.\-\)]+/);
        if (indexA !== -1) {
            questionText = content.substring(0, indexA);
        }
    }
    
    // Format question text
    qObj.question = questionText.replace(/\n+/g, '<br>').trim();
    
    // Fallback 1: If options weren't parsed cleanly, try line-splitting
    if (!foundOptions) {
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length >= 5) {
            qObj.question = lines.slice(0, lines.length - 4).join('<br>').trim();
            qObj.options.A = lines[lines.length - 4].replace(/^(?:A|എ)[\s\.\-\)]+/i, '').trim();
            qObj.options.B = lines[lines.length - 3].replace(/^(?:B|ബി)[\s\.\-\)]+/i, '').trim();
            qObj.options.C = lines[lines.length - 2].replace(/^(?:C|സി)[\s\.\-\)]+/i, '').trim();
            qObj.options.D = lines[lines.length - 1].replace(/^(?:D|ഡി)[\s\.\-\)]+/i, '').trim();
            foundOptions = true;
        }
    }
    
    // Fallback 2: If still not found, put entire content as question
    if (!foundOptions) {
        qObj.question = content.replace(/\n+/g, '<br>').trim();
        qObj.options.A = "Option A (Edit me)";
        qObj.options.B = "Option B (Edit me)";
        qObj.options.C = "Option C (Edit me)";
        qObj.options.D = "Option D (Edit me)";
    }
    
    return qObj;
}

// 6. Ingestion Editor UI Controllers
function openIngestionEditor() {
    switchScreen('processing-screen', 'editor-screen');
    const postingInput = document.getElementById('editor-posting-input');
    if (postingInput) {
        postingInput.value = extractedPostingName;
    }
    renderEditorCards();
}

function cancelIngestion() {
    if (confirm("Are you sure you want to discard your uploaded test paper?")) {
        switchScreen('editor-screen', 'landing-screen');
    }
}

// Render questions inside editor screen
function renderEditorCards() {
    const container = document.getElementById('editor-cards-container');
    container.innerHTML = "";
    
    parsedQuestions.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = 'editor-card glass';
        card.id = `editor-card-${idx}`;
        
        // Card Header
        const header = document.createElement('div');
        header.className = 'q-card-header';
        
        const badge = document.createElement('span');
        badge.className = 'q-badge';
        badge.innerText = `Question ${idx + 1}`;
        header.appendChild(badge);
        
        header.appendChild(document.createElement('div')); // spacing
        card.appendChild(header);
        
        // Question Editable textarea (displays text with <br> converted back to newlines)
        const textarea = document.createElement('textarea');
        textarea.className = 'editor-textarea';
        textarea.rows = 3;
        textarea.value = q.question.replace(/<br>/g, '\n');
        textarea.placeholder = "Enter question text here...";
        textarea.addEventListener('input', (e) => {
            q.question = e.target.value.replace(/\n/g, '<br>');
        });
        card.appendChild(textarea);
        
        // Options grid
        const grid = document.createElement('div');
        grid.className = 'editor-options-grid';
        
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const wrapper = document.createElement('div');
            wrapper.className = 'editor-opt-input-wrapper';
            
            const prefix = document.createElement('span');
            prefix.className = 'editor-opt-prefix';
            prefix.innerText = opt;
            wrapper.appendChild(prefix);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'editor-opt-field';
            input.value = q.options[opt] || '';
            input.placeholder = `Option ${opt}`;
            input.addEventListener('input', (e) => {
                q.options[opt] = e.target.value;
            });
            
            wrapper.appendChild(input);
            grid.appendChild(wrapper);
        });
        card.appendChild(grid);
        
        // Footer (Correct Answer Selector and Delete Button)
        const footer = document.createElement('div');
        footer.className = 'editor-card-footer';
        
        const answerWrapper = document.createElement('div');
        answerWrapper.style.display = 'flex';
        answerWrapper.style.alignItems = 'center';
        answerWrapper.style.gap = '0.5rem';
        
        const label = document.createElement('label');
        label.innerText = "Correct Option:";
        label.style.fontSize = '0.9rem';
        label.style.fontWeight = '700';
        answerWrapper.appendChild(label);
        
        const select = document.createElement('select');
        select.className = 'glass-select';
        select.style.padding = '0.4rem 1rem';
        select.style.fontSize = '0.85rem';
        
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const optionEl = document.createElement('option');
            optionEl.value = opt;
            optionEl.innerText = opt;
            if (q.answer === opt) optionEl.selected = true;
            select.appendChild(optionEl);
        });
        
        select.addEventListener('change', (e) => {
            q.answer = e.target.value;
        });
        
        answerWrapper.appendChild(select);
        footer.appendChild(answerWrapper);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-q-btn';
        deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i> Delete';
        deleteBtn.addEventListener('click', () => {
            deleteQuestionFromEditor(idx);
        });
        footer.appendChild(deleteBtn);
        
        card.appendChild(footer);
        container.appendChild(card);
    });
}

function addNewQuestionToEditor() {
    parsedQuestions.push({
        qNum: parsedQuestions.length + 1,
        question: "New Malayalam Question Text...",
        options: { A: "Option A", B: "Option B", C: "Option C", D: "Option D" },
        answer: "A"
    });
    renderEditorCards();
    
    // Scroll to the bottom card
    setTimeout(() => {
        const cards = document.querySelectorAll('.editor-card');
        if (cards.length > 0) {
            cards[cards.length - 1].scrollIntoView({ behavior: 'smooth' });
        }
    }, 100);
}

function deleteQuestionFromEditor(idx) {
    if (confirm(`Are you sure you want to delete Question ${idx + 1}?`)) {
        parsedQuestions.splice(idx, 1);
        
        // Re-number remaining questions
        parsedQuestions.forEach((q, i) => {
            q.qNum = i + 1;
        });
        
        renderEditorCards();
    }
}

// Generate test from custom array and launch
function generateTestFromEditor() {
    if (parsedQuestions.length === 0) {
        alert("Please add at least one question to generate the exam!");
        return;
    }
    
    if (confirm(`Generate mock test with these ${parsedQuestions.length} custom questions?`)) {
        const postingVal = document.getElementById('editor-posting-input') ? document.getElementById('editor-posting-input').value.trim() : "Fire & Rescue Officer";
        
        // Save to MySQL database for Infinite Mode
        fetch(window.location.origin + '/api/save-questions', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                questions: parsedQuestions,
                source: 'pdf_upload',
                posting: postingVal
            })
        }).then(res => res.json())
          .then(data => {
              console.log(`[MySQL Ingest] Saved ${data.count} uploaded questions to database.`);
          }).catch(err => {
              console.error("Failed to save uploaded questions to MySQL:", err);
          });

        // Swap active QUESTIONS array with custom ingested array
        window.QUESTIONS = parsedQuestions;
        
        // Disable default MATH_EXPLANATIONS since this is a new custom paper
        window.MATH_EXPLANATIONS = [];
        
        // Update landing stats
        document.getElementById('landing-q-count').innerText = QUESTIONS.length;
        const passThreshold = Math.ceil(QUESTIONS.length * 0.61);
        document.getElementById('landing-cutoff').innerText = passThreshold;
        
        // Update active test title
        document.getElementById('active-exam-title').innerText = "Uploaded Custom Test";
        
        // Swap screen back to landing so the user can select Mode
        switchScreen('editor-screen', 'landing-screen');
    }
}

// =========================================================================
// AI EXPLANATION GENERATION API CALLS
// =========================================================================

async function requestAIExplanation(prompt) {
    const response = await fetch(window.location.origin + '/api/explain', {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.explanation;
}

async function toggleAIExplanation(qIdx, parentContainer, qObj) {
    // Check if box already exists in parent
    let existingBox = parentContainer.querySelector('.ai-expl-box');
    if (existingBox) {
        // Toggle visibility
        if (existingBox.style.display === 'none') {
            existingBox.style.display = 'block';
        } else {
            existingBox.style.display = 'none';
        }
        return;
    }
    
    // Check if loader already exists
    if (parentContainer.querySelector('.ai-expl-loader')) return;
    
    // Show loader
    const loader = document.createElement('div');
    loader.className = 'ai-expl-loader';
    loader.innerHTML = '<i class="fa-solid fa-sparkles fa-spin"></i> Asking AI Tutor & Wikipedia...';
    parentContainer.appendChild(loader);
    
    // Create unique cache key
    const cleanQ = qObj.question.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
    const cacheKey = `kpsc_expl_${qIdx}_${cleanQ}`;
    let explanationText = localStorage.getItem(cacheKey);
    
    if (!explanationText) {
        const prompt = `You are a highly qualified academic tutor preparing candidates for the competitive Kerala PSC Fire & Rescue Officer exam.
Your task is to solve the following question, identify the correct answer from the choices, and provide a fact-checked explanation.
Do not rely on any pre-provided answer key; use your own knowledge to determine the correct answer.

Question: ${qObj.question.replace(/<br>/g, '\n')}
Options:
A: ${qObj.options.A}
B: ${qObj.options.B}
C: ${qObj.options.C}
D: ${qObj.options.D}

INSTRUCTIONS FOR THE OUTPUT FORMAT:
- If the question is in Malayalam, output in Malayalam using this exact format:
<p><strong>ശരിയുത്തരം:</strong> [Write the correct option letter (A/B/C/D) followed by the text of that option, e.g. "B. സാമൂതിരി പോർച്ചുഗീസുകാർക്ക്..."]</p>
<p><strong>വിശദീകരണം:</strong><br>[Write a clear, detailed, and fact-checked explanation of why this answer is correct and why the other choices are incorrect.]</p>

- If the question is in English, output in English using this exact format:
<p><strong>Correct Answer:</strong> [Write the correct option letter (A/B/C/D) followed by the text of that option]</p>
<p><strong>Explanation:</strong><br>[Write a clear, detailed, and fact-checked explanation of why this answer is correct and why the other choices are incorrect.]</p>

- Do not include markdown code fences like \`\`\`html.
- Identify the single most relevant search keyword for a Wikipedia article related to this question (e.g., "Home Rule League", "Western Ghats"). Output it at the very end of your response inside a <wikitarget>Keyword</wikitarget> tag.`;
        
        try {
            explanationText = await requestAIExplanation(prompt);
            // Clean markdown blocks if LLM returns them
            explanationText = explanationText.replace(/```html/g, '').replace(/```/g, '').trim();
            
            // Extract Wikipedia Target
            let wikiTarget = "";
            const wikiMatch = explanationText.match(/<wikitarget>(.*?)<\/wikitarget>/i);
            if (wikiMatch) {
                wikiTarget = wikiMatch[1].trim();
                explanationText = explanationText.replace(/<wikitarget>.*?<\/wikitarget>/i, '').trim();
            }
            
            // Fetch Wikipedia Summary if target exists
            if (wikiTarget) {
                const isMalayalam = /[\u0D00-\u0D7F]/.test(qObj.question);
                const wikiBlock = await fetchWikipediaSummary(wikiTarget, isMalayalam, qObj.question);
                if (wikiBlock) {
                    explanationText += wikiBlock;
                }
            }
            
            localStorage.setItem(cacheKey, explanationText);
        } catch (err) {
            loader.remove();
            alert("Could not load AI explanation. Please check your network or try again.");
            return;
        }
    }
    
    loader.remove();
    
    // Create explanation box
    const box = document.createElement('div');
    box.className = 'ai-expl-box';
    
    // Create refresh button to clear cache and regenerate explanation
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'ai-refresh-btn';
    refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Regenerate';
    refreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm("Regenerate this AI explanation? This will clear the cache and fetch a new response.")) {
            localStorage.removeItem(cacheKey);
            box.remove();
            toggleAIExplanation(qIdx, parentContainer, qObj);
        }
    });
    box.appendChild(refreshBtn);
    
    // Create content container
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = explanationText;
    box.appendChild(contentDiv);
    
    parentContainer.appendChild(box);
}

// Fetch Wikipedia summary block and find exact matching paragraph
async function fetchWikipediaSummary(target, isMalayalam, questionText) {
    const lang = isMalayalam ? 'ml' : 'en';
    try {
        // 1. Try Rest Summary API directly to resolve the title, URL, and thumbnail
        let url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(target)}`;
        let response = await fetch(url);
        
        if (!response.ok) {
            // 2. If direct title not found, search for it first
            const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(target)}&format=json&origin=*`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            
            if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
                const firstTitle = searchData.query.search[0].title;
                url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(firstTitle)}`;
                response = await fetch(url);
            } else {
                return null;
            }
        }
        
        if (!response.ok) return null;
        
        const summaryData = await response.json();
        if (summaryData.type === 'no-title') return null;
        
        // 3. Query the MediaWiki API to get the full plain-text extract of the entire page
        const queryUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(summaryData.title)}&format=json&origin=*`;
        const queryRes = await fetch(queryUrl);
        let paragraphText = summaryData.extract; // default fallback to summary intro
        
        if (queryRes.ok) {
            const queryData = await queryRes.json();
            if (queryData.query && queryData.query.pages) {
                const pages = queryData.query.pages;
                const pageId = Object.keys(pages)[0];
                if (pageId && pages[pageId] && pages[pageId].extract) {
                    const fullText = pages[pageId].extract;
                    const matchedPara = findRelevantParagraph(fullText, questionText);
                    if (matchedPara) {
                        paragraphText = matchedPara;
                    }
                }
            }
        }
        
        // Build Wikipedia UI block
        let html = `
            <div class="wiki-ref-container" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1); display: flex; gap: 1rem; align-items: flex-start;">
                ${summaryData.thumbnail ? `<img src="${summaryData.thumbnail.source}" style="width: 70px; height: 70px; border-radius: 8px; object-fit: cover; border: 1px solid var(--border-color); flex-shrink: 0;" alt="Wiki Thumbnail">` : ''}
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--accent-color); margin-bottom: 0.25rem;"><i class="fa-brands fa-wikipedia-w"></i> Wikipedia Reference</div>
                    <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem; font-size: 0.95rem;">${summaryData.title}</div>
                    <div style="font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary); margin-bottom: 0.5rem; font-style: italic;">"... ${paragraphText} ..."</div>
                    <button class="ai-expl-btn" onclick="openWikipediaReader('${summaryData.title.replace(/'/g, "\\'")}', ${isMalayalam})" style="margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem;"><i class="fa-brands fa-wikipedia-w"></i> Read Full Article</button>
                </div>
            </div>
        `;
        return html;
    } catch (err) {
        console.error("Wikipedia API error:", err);
        return null;
    }
}

// Keyword-overlap paragraph extraction algorithm
function findRelevantParagraph(fullText, questionText) {
    if (!fullText) return "";
    
    // Stop words list for English and Malayalam
    const stopWords = new Set([
        "and", "the", "of", "in", "to", "a", "is", "that", "for", "on", "with", "as", "by", "at", "an", "be", "this", "are", "from",
        "ആണ്", "എന്ന", "എന്നാൽ", "ഉള്ള", "ഒരു", "ഈ", "ആ", "അത്", "ഇത്", "എന്ന്", "കൊണ്ട്", "ചെയ്തു", "ആദ്യത്തെ", "ഏറ്റവും", "അല്ലെങ്കിൽ"
    ]);
    
    // Extract keywords from the question text
    const words = questionText.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\u200B]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));
        
    if (words.length === 0) return "";
    
    // Split the article text into paragraphs
    const paragraphs = fullText.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 40); // ignore short headers/lines
        
    let bestParagraph = "";
    let maxScore = -1;
    
    for (const paragraph of paragraphs) {
        const lowerPara = paragraph.toLowerCase();
        let score = 0;
        for (const word of words) {
            if (lowerPara.includes(word)) {
                score++;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestParagraph = paragraph;
        }
    }
    
    // Return matching paragraph if overlap is found, otherwise empty
    if (maxScore > 0 && bestParagraph) {
        return bestParagraph;
    }
    
    return "";
}

// =========================================================================
// INFINITE PRACTICE MODE GAME LOOP
// =========================================================================

let infiniteScoreCorrect = 0;
let infiniteScoreWrong = 0;
let currentInfiniteQuestion = null;

function startInfiniteMode() {
    infiniteScoreCorrect = 0;
    infiniteScoreWrong = 0;
    document.getElementById('inf-score-correct').innerText = '0';
    document.getElementById('inf-score-wrong').innerText = '0';
    
    // Switch screens
    switchScreen('landing-screen', 'infinite-screen');
    
    // Load first question
    loadNextInfiniteQuestion();
}

async function loadNextInfiniteQuestion() {
    const container = document.getElementById('infinite-question-card-container');
    container.innerHTML = `
        <div class="glass" style="padding: 3rem; text-align: center; border-radius: 20px;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
            <p style="color: var(--text-secondary); font-weight: 500;">Fetching question from MySQL database...</p>
        </div>
    `;
    
    try {
        const response = await fetch(window.location.origin + '/api/get-infinite-question');
        if (!response.ok) {
            throw new Error("Failed to retrieve question from database.");
        }
        
        const data = await response.json();
        currentInfiniteQuestion = data.question;
        currentInfiniteQuestion.userAnswer = null;
        currentInfiniteQuestion.answered = false;
        
        renderInfiniteQuestion();
    } catch (err) {
        container.innerHTML = `
            <div class="glass" style="padding: 3rem; text-align: center; border-radius: 20px;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-primary); font-weight: 700; margin-bottom: 1rem;">Error Loading Question</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${err.message}</p>
                <button class="start-btn" onclick="loadNextInfiniteQuestion()"><i class="fa-solid fa-arrows-rotate"></i> Retry</button>
            </div>
        `;
    }
}

function renderInfiniteQuestion() {
    const container = document.getElementById('infinite-question-card-container');
    const q = currentInfiniteQuestion;
    
    container.innerHTML = `
        <div class="question-card glass" id="inf-q-card" style="border-radius: 20px; padding: 2rem;">
            <div class="q-card-header" style="display: flex; gap: 0.75rem; margin-bottom: 1.25rem; flex-wrap: wrap;">
                <span class="q-badge" style="background: rgba(139, 92, 246, 0.1); color: var(--primary-color); border: 1px solid rgba(139, 92, 246, 0.2); font-weight: 700;">
                    Source: ${q.source.toUpperCase()}
                </span>
                <span class="q-badge" style="background: rgba(59, 130, 246, 0.1); color: var(--secondary-color); border: 1px solid rgba(59, 130, 246, 0.2); font-weight: 700;">
                    Posting: ${q.posting}
                </span>
                <span class="q-badge" style="background: rgba(245, 158, 11, 0.1); color: var(--accent-color); border: 1px solid rgba(245, 158, 11, 0.2); font-weight: 700;">
                    Topic: ${q.topic}
                </span>
            </div>
            
            <div class="q-text" style="font-size: 1.15rem; font-weight: 600; line-height: 1.6; color: var(--text-primary); margin-bottom: 1.5rem;">
                ${q.question}
            </div>
            
            <div class="q-options-container" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                <button class="option-btn" id="inf-opt-A" onclick="selectInfiniteOption('A')">
                    <span class="option-prefix">A</span>
                    <span class="option-text">${q.options.A}</span>
                </button>
                <button class="option-btn" id="inf-opt-B" onclick="selectInfiniteOption('B')">
                    <span class="option-prefix">B</span>
                    <span class="option-text">${q.options.B}</span>
                </button>
                <button class="option-btn" id="inf-opt-C" onclick="selectInfiniteOption('C')">
                    <span class="option-prefix">C</span>
                    <span class="option-text">${q.options.C}</span>
                </button>
                <button class="option-btn" id="inf-opt-D" onclick="selectInfiniteOption('D')">
                    <span class="option-prefix">D</span>
                    <span class="option-text">${q.options.D}</span>
                </button>
            </div>
            
            <div class="q-card-footer" id="inf-footer" style="display: flex; justify-content: flex-end; gap: 1rem; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                <button class="start-btn" id="inf-submit-btn" onclick="submitInfiniteAnswer()" disabled style="padding: 0.6rem 1.75rem; font-size: 0.9rem;">
                    Submit Answer <i class="fa-solid fa-check"></i>
                </button>
            </div>
        </div>
    `;
}

function selectInfiniteOption(option) {
    if (currentInfiniteQuestion.answered) return;
    
    currentInfiniteQuestion.userAnswer = option;
    
    ['A', 'B', 'C', 'D'].forEach(opt => {
        document.getElementById(`inf-opt-${opt}`).classList.remove('selected');
    });
    
    document.getElementById(`inf-opt-${option}`).classList.add('selected');
    document.getElementById('inf-submit-btn').removeAttribute('disabled');
}

async function submitInfiniteAnswer() {
    const q = currentInfiniteQuestion;
    if (q.answered) return;
    
    q.answered = true;
    
    ['A', 'B', 'C', 'D'].forEach(opt => {
        document.getElementById(`inf-opt-${opt}`).style.pointerEvents = 'none';
    });
    
    document.getElementById('inf-submit-btn').style.display = 'none';
    
    const userAns = q.userAnswer;
    const correctAns = q.answer;
    const isCorrect = (userAns === correctAns);
    
    if (isCorrect) {
        document.getElementById(`inf-opt-${userAns}`).classList.add('correct-option');
        infiniteScoreCorrect++;
        document.getElementById('inf-score-correct').innerText = infiniteScoreCorrect;
    } else {
        document.getElementById(`inf-opt-${userAns}`).classList.add('incorrect-option');
        document.getElementById(`inf-opt-${correctAns}`).classList.add('correct-option');
        infiniteScoreWrong++;
        document.getElementById('inf-score-wrong').innerText = infiniteScoreWrong;
    }
    
    const footer = document.getElementById('inf-footer');
    
    const aiBtn = document.createElement('button');
    aiBtn.className = 'ai-expl-btn';
    aiBtn.style.padding = '0.6rem 1.25rem';
    aiBtn.style.fontSize = '0.85rem';
    aiBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> AI Explanation';
    aiBtn.onclick = () => toggleAIExplanation(q.id, document.getElementById('inf-q-card'), q);
    
    const flagBtn = document.createElement('button');
    flagBtn.className = 'ai-expl-btn';
    flagBtn.style.padding = '0.6rem 1.25rem';
    flagBtn.style.fontSize = '0.85rem';
    flagBtn.style.background = 'rgba(239, 68, 68, 0.1)';
    flagBtn.style.color = '#f87171';
    flagBtn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Report Wrong Key';
    flagBtn.onclick = () => openFlagModal(q.id, q.question);
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'start-btn';
    nextBtn.style.padding = '0.6rem 1.25rem';
    nextBtn.style.fontSize = '0.85rem';
    nextBtn.innerHTML = 'Next Question <i class="fa-solid fa-arrow-right"></i>';
    nextBtn.onclick = loadNextInfiniteQuestion;
    
    footer.appendChild(flagBtn);
    footer.appendChild(aiBtn);
    footer.appendChild(nextBtn);
    
    try {
        fetch(window.location.origin + '/api/answer-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionId: q.id
            })
        }).then(res => res.json())
          .then(data => {
              console.log("[AI generation background task triggered]:", data.message);
          });
    } catch (e) {
        console.error("Failed to notify server of answered question:", e);
    }
}

function exitInfiniteMode() {
    if (confirm("Are you sure you want to exit Infinite Practice Mode? Your running score will be reset.")) {
        switchScreen('infinite-screen', 'landing-screen');
    }
}

// =========================================================================
// IN-APP WIKIPEDIA READER
// =========================================================================

function openWikipediaReader(title, isMalayalam) {
    const lang = isMalayalam ? 'ml' : 'en';
    const modal = document.getElementById('wiki-modal');
    const content = document.getElementById('wiki-modal-content');
    const titleEl = document.getElementById('wiki-modal-title');
    
    titleEl.innerHTML = `<i class="fa-brands fa-wikipedia-w" style="color: var(--accent-color);"></i> ${title}`;
    content.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 0;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
            <p style="color: var(--text-secondary); font-weight: 500;">Loading page content directly from Wikipedia...</p>
        </div>
    `;
    
    modal.classList.add('active');
    
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Could not retrieve full Wikipedia article HTML document.");
            return res.text();
        })
        .then(html => {
            // Strip any <base> tags from Wikipedia HTML to prevent it from hijacking our site's base URL and routing local fetch requests to Wikipedia
            const sanitizedHtml = html.replace(/<base\b[^>]*>/gi, '');
            content.innerHTML = sanitizedHtml;
            
            // Adjust all anchor links inside the modal content to open in a new tab
            const links = content.querySelectorAll('a');
            links.forEach(link => {
                if (link.getAttribute('href') && !link.getAttribute('href').startsWith('#')) {
                    link.setAttribute('target', '_blank');
                }
            });
        })
        .catch(err => {
            content.innerHTML = `
                <div style="text-align: center; color: var(--danger-color); padding: 5rem 0;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; margin-bottom: 1.5rem;"></i>
                    <p style="font-weight: 700; font-size: 1.2rem; margin-bottom: 0.5rem;">Failed to load article</p>
                    <p style="font-size: 0.95rem; color: var(--text-secondary); max-width: 400px; margin: 0 auto 1.5rem;">${err.message}</p>
                    <button class="action-btn" onclick="openWikipediaReader('${title.replace(/'/g, "\\'")}', ${isMalayalam})"><i class="fa-solid fa-arrows-rotate"></i> Retry</button>
                </div>
            `;
        });
}

function closeWikipediaReader() {
    document.getElementById('wiki-modal').classList.remove('active');
}

// =========================================================================
// REPORT WRONG ANSWER KEY CONTROLLER
// =========================================================================
let selectedFlagOptionValue = null;

function openFlagModal(questionId, questionText) {
    selectedFlagOptionValue = null;
    document.getElementById('flag-question-id').value = questionId || "";
    document.getElementById('flag-modal').dataset.qText = questionText;
    document.getElementById('flag-reason').value = "";
    
    // Reset option button styles
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`flag-opt-${opt}`);
        if (btn) btn.classList.remove('selected');
    });
    
    document.getElementById('flag-modal').classList.add('active');
}

function closeFlagModal() {
    document.getElementById('flag-modal').classList.remove('active');
}

function selectFlagOption(option) {
    selectedFlagOptionValue = option;
    ['A', 'B', 'C', 'D'].forEach(opt => {
        const btn = document.getElementById(`flag-opt-${opt}`);
        if (btn) btn.classList.remove('selected');
    });
    const selectedBtn = document.getElementById(`flag-opt-${option}`);
    if (selectedBtn) selectedBtn.classList.add('selected');
}

function submitFlagCorrection() {
    if (!selectedFlagOptionValue) {
        alert("Please select what you believe is the correct option!");
        return;
    }
    
    const questionId = document.getElementById('flag-question-id').value;
    const questionText = document.getElementById('flag-modal').dataset.qText;
    const reason = document.getElementById('flag-reason').value;
    
    fetch(window.location.origin + '/api/flag-question', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            questionId: questionId,
            questionText: questionText,
            correctOption: selectedFlagOptionValue,
            reason: reason
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Thank you! The answer key has been updated in the database.");
            closeFlagModal();
            
            // Dynamically update UI state to prevent discrepancies
            if (currentInfiniteQuestion && (currentInfiniteQuestion.id == questionId || currentInfiniteQuestion.question === questionText)) {
                currentInfiniteQuestion.answer = selectedFlagOptionValue;
            }
        } else {
            alert("Error submitting correction: " + data.error);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Failed to submit correction. Please check your connection.");
    });
}
