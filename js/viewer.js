/**
 * viewer.js — PDF Viewer using PDF.js
 * 
 * Renders PDFs onto canvas, supports navigation, zoom, fullscreen,
 * and lesson-to-lesson navigation.
 */

(function () {
    'use strict';

    // ==================== State ====================

    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let currentScale = 1.0;
    let isFullscreen = false;
    let currentLessonId = null;
    let currentLesson = null;
    let currentPhase = null;
    let isRendering = false;

    const MIN_SCALE = 0.25;
    const MAX_SCALE = 3.0;
    const SCALE_STEP = 0.25;

    // ==================== DOM Elements ====================

    const canvas = document.getElementById('pdfCanvas');
    const canvasWrapper = document.getElementById('pdfCanvasWrapper');
    const canvasContainer = document.getElementById('canvasContainer');
    const loadingEl = document.getElementById('viewerLoading');
    const errorEl = document.getElementById('viewerError');
    const errorText = document.getElementById('viewerErrorText');

    const lessonNumEl = document.getElementById('viewerLessonNum');
    const lessonTitleEl = document.getElementById('viewerLessonTitle');

    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageJumpInput = document.getElementById('pageJumpInput');
    const totalPagesEl = document.getElementById('totalPages');

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomDisplay = document.getElementById('zoomDisplay');
    const fitWidthBtn = document.getElementById('fitWidthBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const openTabBtn = document.getElementById('openTabBtn');

    const prevLessonLink = document.getElementById('prevLessonLink');
    const nextLessonLink = document.getElementById('nextLessonLink');
    const prevLessonTitle = document.getElementById('prevLessonTitle');
    const nextLessonTitle = document.getElementById('nextLessonTitle');
    const backToPhaseLink = document.getElementById('backToPhaseLink');
    const backToPhaseBtn = document.getElementById('backToPhaseBtn');

    const markCompleteBtn = document.getElementById('markCompleteBtn');
    const markCompleteBtnText = document.getElementById('markCompleteBtnText');

    // Fullscreen elements
    const fullscreenControls = document.getElementById('fullscreenControls');
    const fullscreenExitBtn = document.getElementById('fullscreenExitBtn');
    const fsPrevPageBtn = document.getElementById('fsPrevPageBtn');
    const fsNextPageBtn = document.getElementById('fsNextPageBtn');
    const fsPageIndicator = document.getElementById('fsPageIndicator');

    if (!canvas) return; // Not on viewer page

    const ctx = canvas.getContext('2d');

    // ==================== Initialize ====================

    function init() {
        // Get lesson ID from URL
        const params = new URLSearchParams(window.location.search);
        currentLessonId = params.get('lesson');

        if (!currentLessonId) {
            showError('No lesson specified. Please select a lesson from the curriculum.');
            return;
        }

        // Find lesson data
        const result = findLessonById(currentLessonId);
        if (!result) {
            showError('Lesson not found. The requested lesson does not exist in the curriculum.');
            return;
        }

        currentLesson = result.lesson;
        currentPhase = result.phase;

        // Update progress - set as current lesson
        Progress.setCurrentLesson(currentLessonId);

        // Restore last page position
        currentPage = Progress.getPdfPage(currentLessonId);

        // Setup UI
        setupLessonInfo();
        setupNavigation();
        setupControls();
        setupKeyboardNav();
        updateCompleteButton();

        // Set PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Load PDF
        loadPdf(currentLesson.pdf);
    }

    // ==================== Setup ====================

    function setupLessonInfo() {
        if (lessonNumEl) lessonNumEl.textContent = `PPT ${String(currentLesson.id).padStart(2, '0')}`;
        if (lessonTitleEl) lessonTitleEl.textContent = currentLesson.title;

        // Update page title
        document.title = `PPT ${String(currentLesson.id).padStart(2, '0')} — ${currentLesson.title} — AI Meme University`;

        // Back link
        if (backToPhaseLink) {
            backToPhaseLink.href = 'index.html';
            backToPhaseLink.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                ${currentPhase.title}
            `;
        }

        if (backToPhaseBtn) {
            backToPhaseBtn.href = 'index.html';
            backToPhaseBtn.textContent = `← Back to ${currentPhase.title}`;
        }
    }

    function setupNavigation() {
        const adjacent = getAdjacentLessons(currentLessonId);

        // Previous lesson
        if (adjacent.prev) {
            prevLessonLink.href = `viewer.html?lesson=${adjacent.prev.id}`;
            prevLessonTitle.textContent = `PPT ${String(adjacent.prev.id).padStart(2, '0')} — ${adjacent.prev.title}`;
            prevLessonLink.classList.remove('disabled');
        } else {
            prevLessonLink.classList.add('disabled');
            prevLessonTitle.textContent = 'First lesson';
        }

        // Next lesson
        if (adjacent.next) {
            nextLessonLink.href = `viewer.html?lesson=${adjacent.next.id}`;
            nextLessonTitle.textContent = `PPT ${String(adjacent.next.id).padStart(2, '0')} — ${adjacent.next.title}`;
            nextLessonLink.classList.remove('disabled');
        } else {
            nextLessonLink.classList.add('disabled');
            nextLessonTitle.textContent = 'Last lesson';
        }
    }

    function setupControls() {
        // Page navigation
        prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
        nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));

        pageJumpInput.addEventListener('change', () => {
            const page = parseInt(pageJumpInput.value);
            if (page >= 1 && page <= totalPages) {
                goToPage(page);
            } else {
                pageJumpInput.value = currentPage;
            }
        });

        pageJumpInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                pageJumpInput.blur();
            }
        });

        // Zoom
        zoomInBtn.addEventListener('click', () => setZoom(currentScale + SCALE_STEP));
        zoomOutBtn.addEventListener('click', () => setZoom(currentScale - SCALE_STEP));
        fitWidthBtn.addEventListener('click', fitWidth);

        // Fullscreen
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        if (fullscreenExitBtn) fullscreenExitBtn.addEventListener('click', toggleFullscreen);

        // Fullscreen page nav
        if (fsPrevPageBtn) fsPrevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
        if (fsNextPageBtn) fsNextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));

        // Download
        downloadBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = currentLesson.pdf;
            link.download = currentLesson.pdf.split('/').pop();
            link.click();
        });

        // Open in new tab
        openTabBtn.addEventListener('click', () => {
            window.open(currentLesson.pdf, '_blank');
        });

        // Mark complete
        markCompleteBtn.addEventListener('click', handleMarkComplete);
    }

    function setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            // Don't intercept when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    goToPage(currentPage - 1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    goToPage(currentPage + 1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    goToPage(currentPage - 1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    goToPage(currentPage + 1);
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    setZoom(currentScale + SCALE_STEP);
                    break;
                case '-':
                    e.preventDefault();
                    setZoom(currentScale - SCALE_STEP);
                    break;
                case 'f':
                case 'F':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        toggleFullscreen();
                    }
                    break;
                case 'Escape':
                    if (isFullscreen) {
                        toggleFullscreen();
                    }
                    break;
                case 'Home':
                    e.preventDefault();
                    goToPage(1);
                    break;
                case 'End':
                    e.preventDefault();
                    goToPage(totalPages);
                    break;
            }
        });
    }

    // ==================== PDF Loading ====================

    async function loadPdf(pdfPath) {
        showLoading();

        try {
            const loadingTask = pdfjsLib.getDocument(pdfPath);
            pdfDoc = await loadingTask.promise;
            totalPages = pdfDoc.numPages;

            // Validate saved page
            if (currentPage > totalPages || currentPage < 1) {
                currentPage = 1;
            }

            // Update UI
            totalPagesEl.textContent = totalPages;
            pageJumpInput.max = totalPages;

            hideLoading();
            canvasWrapper.style.display = 'inline-block';

            // Render first page
            await renderPage(currentPage);

            // Try fit width on initial load
            fitWidth();
        } catch (err) {
            console.error('PDF load error:', err);
            showError(`Could not load the PDF file. Make sure "${pdfPath}" exists in the project directory.`);
        }
    }

    // ==================== Page Rendering ====================

    async function renderPage(pageNum) {
        if (!pdfDoc || isRendering) return;
        if (pageNum < 1 || pageNum > totalPages) return;

        isRendering = true;
        currentPage = pageNum;

        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: currentScale });

            // Set canvas dimensions (use devicePixelRatio for sharpness)
            const dpr = window.devicePixelRatio || 1;
            canvas.width = viewport.width * dpr;
            canvas.height = viewport.height * dpr;
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Update UI
            updatePageUI();

            // Save page position
            Progress.savePdfPage(currentLessonId, currentPage);

        } catch (err) {
            console.error('Page render error:', err);
        } finally {
            isRendering = false;
        }
    }

    function updatePageUI() {
        pageJumpInput.value = currentPage;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;

        if (fsPrevPageBtn) fsPrevPageBtn.disabled = currentPage <= 1;
        if (fsNextPageBtn) fsNextPageBtn.disabled = currentPage >= totalPages;
        if (fsPageIndicator) fsPageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;
    }

    function goToPage(pageNum) {
        if (pageNum < 1 || pageNum > totalPages) return;
        renderPage(pageNum);
        
        // Scroll canvas into view
        if (!isFullscreen) {
            canvasContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ==================== Zoom ====================

    function setZoom(scale) {
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        currentScale = Math.round(scale * 100) / 100;
        zoomDisplay.textContent = Math.round(currentScale * 100) + '%';
        renderPage(currentPage);
    }

    function fitWidth() {
        if (!pdfDoc) return;

        pdfDoc.getPage(currentPage).then(page => {
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const containerWidth = canvasContainer.clientWidth - 48; // padding
            const newScale = containerWidth / unscaledViewport.width;
            setZoom(Math.min(newScale, MAX_SCALE));
        });
    }

    // ==================== Fullscreen ====================

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;

        if (isFullscreen) {
            document.body.classList.add('viewer-fullscreen');
            canvasContainer.classList.add('fullscreen');
            fullscreenControls.classList.add('active');
            fullscreenExitBtn.classList.add('active');
        } else {
            document.body.classList.remove('viewer-fullscreen');
            canvasContainer.classList.remove('fullscreen');
            fullscreenControls.classList.remove('active');
            fullscreenExitBtn.classList.remove('active');
        }

        // Re-fit after toggle
        setTimeout(() => fitWidth(), 100);
    }

    // ==================== Mark Complete ====================

    function handleMarkComplete() {
        const wasCompleted = Progress.isCompleted(currentLessonId);
        Progress.toggleCompleted(currentLessonId);

        updateCompleteButton();

        if (!wasCompleted) {
            // Just completed
            const meme = currentPhase.memeOnComplete || memeMessages.lessonComplete[Math.floor(Math.random() * memeMessages.lessonComplete.length)];
            showToast(meme, '✅', 4000);

            // Check if phase is complete
            const phaseProgress = Progress.getPhaseProgress(currentPhase.id);
            if (phaseProgress === 100) {
                setTimeout(() => {
                    const phaseMeme = memeMessages.phaseComplete[Math.floor(Math.random() * memeMessages.phaseComplete.length)];
                    showToast(`Phase ${currentPhase.phase} complete! ${phaseMeme}`, '🎉', 5000);
                }, 1500);
            }
        } else {
            showToast('Lesson unmarked', '↩️', 2000);
        }

        // Refresh sidebar
        if (typeof renderSidebar === 'function') renderSidebar();
    }

    function updateCompleteButton() {
        const isComplete = Progress.isCompleted(currentLessonId);
        markCompleteBtn.classList.toggle('completed', isComplete);
        markCompleteBtnText.textContent = isComplete ? 'Completed' : 'Mark as Completed';
    }

    // ==================== Loading/Error States ====================

    function showLoading() {
        loadingEl.style.display = 'flex';
        errorEl.style.display = 'none';
        canvasWrapper.style.display = 'none';
    }

    function hideLoading() {
        loadingEl.style.display = 'none';
    }

    function showError(message) {
        loadingEl.style.display = 'none';
        errorEl.style.display = 'flex';
        canvasWrapper.style.display = 'none';
        if (errorText) errorText.textContent = message;
    }

    // ==================== Window resize handler ====================

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (pdfDoc && !isRendering) {
                // Re-render at current scale on resize for sharpness
                renderPage(currentPage);
            }
        }, 250);
    });

    // ==================== Init ====================

    init();

})();
