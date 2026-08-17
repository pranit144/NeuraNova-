/**
 * app.js — AI Meme University — Main Application Logic
 * 
 * Handles: sidebar, navigation, phase tabs, lesson rendering,
 * search UI, toasts, and page-specific initialization.
 */

(function () {
    'use strict';

    // ==================== Sidebar ====================

    function initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const hamburger = document.getElementById('hamburgerBtn');
        const closeBtn = document.getElementById('sidebarClose');

        if (!sidebar) return;

        function openSidebar() {
            sidebar.classList.add('open');
            sidebar.classList.remove('collapsed');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (hamburger) hamburger.addEventListener('click', openSidebar);
        if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
        if (overlay) overlay.addEventListener('click', closeSidebar);

        // Render sidebar content
        renderSidebar();
        updateSidebarProgress();
    }

    function renderSidebar() {
        const nav = document.getElementById('sidebarNav');
        if (!nav) return;

        let html = '';
        curriculum.forEach(phase => {
            const isExpanded = isCurrentPhase(phase.id);
            html += `
                <div class="sidebar-phase">
                    <div class="sidebar-phase-header ${isExpanded ? 'expanded' : ''}" 
                         data-phase="${phase.id}" 
                         role="button" 
                         tabindex="0"
                         aria-expanded="${isExpanded}">
                        <span>${phase.icon} Phase ${phase.phase}</span>
                        <svg class="phase-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
                    </div>
                    <div class="sidebar-lessons ${isExpanded ? 'expanded' : ''}" id="sidebarLessons-${phase.id}">
                        ${phase.lessons.map(lesson => {
                            const status = Progress.getLessonStatus(lesson.id);
                            let icon = '○';
                            let statusClass = '';
                            if (status === 'completed') { icon = '✓'; statusClass = 'completed'; }
                            else if (status === 'current') { icon = '→'; statusClass = 'active'; }
                            return `
                                <a class="sidebar-lesson ${statusClass}" 
                                   href="viewer.html?lesson=${lesson.id}" 
                                   data-lesson="${lesson.id}"
                                   title="${lesson.title}">
                                    <span class="sidebar-lesson-icon">${icon}</span>
                                    <span class="sidebar-lesson-title">${lesson.title}</span>
                                </a>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });

        nav.innerHTML = html;

        // Phase toggle handlers
        nav.querySelectorAll('.sidebar-phase-header').forEach(header => {
            header.addEventListener('click', () => toggleSidebarPhase(header));
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSidebarPhase(header);
                }
            });
        });
    }

    function toggleSidebarPhase(header) {
        const phaseId = header.dataset.phase;
        const lessons = document.getElementById(`sidebarLessons-${phaseId}`);
        const isExpanded = header.classList.toggle('expanded');
        lessons.classList.toggle('expanded');
        header.setAttribute('aria-expanded', isExpanded);
    }

    function isCurrentPhase(phaseId) {
        // Check URL params for viewer page
        const params = new URLSearchParams(window.location.search);
        const lessonId = params.get('lesson');
        if (lessonId) {
            const result = findLessonById(lessonId);
            if (result && result.phase.id === phaseId) return true;
        }
        // Default: expand phase 0
        if (phaseId === 'phase-0' && !lessonId) return true;
        return false;
    }

    function updateSidebarProgress() {
        const percent = Progress.getOverallProgress();
        const bar = document.getElementById('sidebarProgressBar');
        const label = document.getElementById('sidebarProgressPercent');
        if (bar) bar.style.width = percent + '%';
        if (label) label.textContent = percent + '%';
    }

    // ==================== Search ====================

    function initSearch() {
        const input = document.getElementById('searchInput');
        const results = document.getElementById('searchResults');
        if (!input || !results) return;

        let debounceTimer;

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const term = input.value.trim();
                if (term.length < 2) {
                    results.classList.remove('active');
                    return;
                }
                renderSearchResults(term);
            }, 200);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) {
                results.classList.add('active');
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#searchContainer')) {
                results.classList.remove('active');
            }
        });

        // Keyboard: Escape closes
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                results.classList.remove('active');
                input.blur();
            }
        });
    }

    function renderSearchResults(term) {
        const results = document.getElementById('searchResults');
        const matches = Search.query(term);

        if (matches.length === 0) {
            results.innerHTML = `
                <div class="search-no-results">
                    <p>No results for "<strong>${escapeHtml(term)}</strong>"</p>
                    <p style="margin-top: 4px; font-size: 0.75rem;">Cosine similarity search returned 0 results 🔍</p>
                </div>
            `;
            results.classList.add('active');
            return;
        }

        let html = `<div class="search-results-header">${matches.length} result${matches.length !== 1 ? 's' : ''}</div>`;
        matches.slice(0, 10).forEach(match => {
            const status = Progress.isCompleted(match.lesson.id) ? '✓' : '';
            html += `
                <a class="search-result-item" href="viewer.html?lesson=${match.lesson.id}" role="option">
                    <div class="search-result-icon">${match.phase.icon}</div>
                    <div class="search-result-content">
                        <div class="search-result-title">
                            ${status ? '<span style="color: var(--color-success); margin-right: 4px;">✓</span>' : ''}
                            ${Search.highlight(match.lesson.title, term)}
                        </div>
                        <div class="search-result-meta">
                            Phase ${match.phase.phase} · ${match.phase.title} · ${match.lesson.duration}
                        </div>
                    </div>
                </a>
            `;
        });

        results.innerHTML = html;
        results.classList.add('active');
    }

    // ==================== Home Page ====================

    function initHomePage() {
        updateHomeStats();
        renderContinueLearning();
        renderPhaseTabs();
        renderPhasesOverview();
        initStartLearningBtn();
    }

    function updateHomeStats() {
        const statPhases = document.getElementById('statPhases');
        const statLessons = document.getElementById('statLessons');
        const statCompleted = document.getElementById('statCompleted');
        const statProgress = document.getElementById('statProgress');

        if (statPhases) statPhases.textContent = curriculum.length;
        if (statLessons) statLessons.textContent = getTotalLessons();
        if (statCompleted) statCompleted.textContent = Progress.getCompletedCount();
        if (statProgress) statProgress.textContent = Progress.getOverallProgress() + '%';
    }

    function initStartLearningBtn() {
        const btn = document.getElementById('startLearningBtn');
        if (!btn) return;

        const nextLesson = Progress.getNextIncompleteLesson();
        if (nextLesson) {
            btn.href = `viewer.html?lesson=${nextLesson.id}`;
        }
    }

    function renderContinueLearning() {
        const container = document.getElementById('continueLearningSection');
        if (!container) return;

        const nextLesson = Progress.getNextIncompleteLesson();
        if (!nextLesson) {
            container.innerHTML = `
                <div class="continue-card" style="justify-content: center; cursor: default;">
                    <div class="continue-card-icon">🎓</div>
                    <div class="continue-card-body">
                        <div class="continue-card-label">Congratulations!</div>
                        <div class="continue-card-title">All lessons completed</div>
                        <div class="continue-card-meta">You've finished the entire curriculum. You're basically AGI now. 🧠</div>
                    </div>
                </div>
            `;
            return;
        }

        const result = findLessonById(nextLesson.id);
        if (!result) return;

        const completedCount = Progress.getCompletedCount();
        const welcomeMsg = completedCount > 0
            ? memeMessages.welcome[Math.floor(Math.random() * memeMessages.welcome.length)]
            : 'Ready to start your AI journey?';

        container.innerHTML = `
            <a href="viewer.html?lesson=${nextLesson.id}" class="continue-card">
                <div class="continue-card-icon">▶</div>
                <div class="continue-card-body">
                    <div class="continue-card-label">${completedCount > 0 ? 'Continue Learning' : 'Start Learning'}</div>
                    <div class="continue-card-title">PPT ${String(nextLesson.id).padStart(2, '0')} — ${nextLesson.title}</div>
                    <div class="continue-card-meta">Phase ${result.phase.phase} · ${result.phase.title} · ${nextLesson.duration} · ${welcomeMsg}</div>
                </div>
            </a>
        `;
    }

    // ==================== Phase Tabs ====================

    let activePhaseIndex = 0;

    function renderPhaseTabs() {
        const tabsContainer = document.getElementById('phaseTabs');
        if (!tabsContainer) return;

        let html = '';
        curriculum.forEach((phase, index) => {
            html += `
                <button class="phase-tab ${index === activePhaseIndex ? 'active' : ''}" 
                        data-phase-index="${index}" 
                        role="tab" 
                        aria-selected="${index === activePhaseIndex}"
                        id="phaseTab-${index}">
                    ${phase.shortTitle}
                </button>
            `;
        });

        tabsContainer.innerHTML = html;

        // Tab click handlers
        tabsContainer.querySelectorAll('.phase-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                activePhaseIndex = parseInt(tab.dataset.phaseIndex);
                updatePhaseTabs();
                renderPhaseContent();
            });
        });

        renderPhaseContent();
    }

    function updatePhaseTabs() {
        const tabs = document.querySelectorAll('.phase-tab');
        tabs.forEach((tab, index) => {
            tab.classList.toggle('active', index === activePhaseIndex);
            tab.setAttribute('aria-selected', index === activePhaseIndex);
        });
    }

    function renderPhaseContent() {
        const container = document.getElementById('phaseContent');
        if (!container) return;

        const phase = curriculum[activePhaseIndex];
        const progress = Progress.getPhaseProgress(phase.id);
        const completedCount = Progress.getPhaseCompletedCount(phase.id);

        let html = `
            <div class="phase-header">
                <div class="phase-icon">${phase.icon}</div>
                <div class="phase-info">
                    <h3>Phase ${phase.phase} — ${phase.title}</h3>
                    <p>${phase.description}</p>
                </div>
                <div class="phase-progress-inline">
                    <span class="phase-progress-text">${completedCount}/${phase.lessons.length}</span>
                    <div class="phase-progress-bar">
                        <div class="phase-progress-bar-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
        `;

        if (phase.lessons.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <h3>No lessons yet</h3>
                    <p>This phase doesn't have any PDFs uploaded yet.<br>
                    Drop PDFs into <code>pdfs/${phase.id}/</code> using the naming convention <code>NN-title-words.pdf</code><br>
                    then run <code>python build_curriculum.py</code> or push to GitHub.</p>
                </div>
            `;
            container.innerHTML = html;
            return;
        }

        html += '<div class="lessons-grid">';

        phase.lessons.forEach(lesson => {
            const status = Progress.getLessonStatus(lesson.id);
            const isCompleted = status === 'completed';
            const isCurrent = status === 'current';

            html += `
                <a href="viewer.html?lesson=${lesson.id}" 
                   class="lesson-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
                   data-lesson-id="${lesson.id}">
                    <div class="lesson-number">${isCompleted ? '✓' : String(lesson.id).padStart(2, '0')}</div>
                    <div class="lesson-body">
                        <div class="lesson-title">${lesson.title}</div>
                        <div class="lesson-description">${lesson.description}</div>
                    </div>
                    <div class="lesson-meta">
                        <span class="lesson-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            PDF
                        </span>
                        <span class="lesson-meta-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            ${lesson.duration}
                        </span>
                        ${isCompleted
                            ? '<span class="lesson-status-badge completed">✓ Done</span>'
                            : isCurrent
                                ? '<span class="lesson-status-badge current">→ Current</span>'
                                : '<span class="lesson-open-btn">Open Lesson</span>'
                        }
                    </div>
                </a>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // ==================== Phases Overview ====================

    function renderPhasesOverview() {
        const container = document.getElementById('phasesOverview');
        if (!container) return;

        let html = '';
        curriculum.forEach((phase, index) => {
            const progress = Progress.getPhaseProgress(phase.id);
            html += `
                <a href="index.html#phase-content" class="phase-mini-card" data-phase-index="${index}" onclick="event.preventDefault(); document.getElementById('phaseTab-${index}').click(); document.getElementById('phaseContent').scrollIntoView({behavior:'smooth'});">
                    <div class="phase-mini-card-icon">${phase.icon}</div>
                    <div class="phase-mini-card-title">${phase.shortTitle}</div>
                    <div class="phase-mini-card-bar">
                        <div class="phase-mini-card-bar-fill" style="width: ${progress}%"></div>
                    </div>
                </a>
            `;
        });

        container.innerHTML = html;
    }

    // ==================== Roadmap Page ====================

    function initRoadmapPage() {
        const grid = document.getElementById('roadmapGrid');
        if (!grid) return;

        let html = '';
        curriculum.forEach(phase => {
            const progress = Progress.getPhaseProgress(phase.id);
            const completed = Progress.getPhaseCompletedCount(phase.id);
            const total = phase.lessons.length;
            const hasLessons = total > 0;
            const firstLesson = hasLessons ? phase.lessons[0] : null;
            
            const linkHref = hasLessons ? `viewer.html?lesson=${firstLesson.id}` : '#';
            const cardClass = hasLessons ? 'roadmap-card' : 'roadmap-card disabled-card';
            
            html += `
                <a href="${linkHref}" class="${cardClass}" ${!hasLessons ? 'style="opacity: 0.7; cursor: default;" onclick="event.preventDefault();"' : ''}>
                    <div class="roadmap-card-phase">Phase ${phase.phase}</div>
                    <div class="roadmap-card-icon">${phase.icon}</div>
                    <h3>${phase.title}</h3>
                    <p>${phase.description}</p>
                    <div class="roadmap-card-footer">
                        <span class="roadmap-card-lessons">${total} Lessons</span>
                        <div class="roadmap-card-progress">
                            ${progress > 0 && hasLessons
                                ? `<div class="phase-progress-bar" style="width: 60px;">
                                       <div class="phase-progress-bar-fill" style="width: ${progress}%"></div>
                                   </div>
                                   <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 600;">${completed}/${total}</span>`
                                : hasLessons 
                                    ? `<span class="roadmap-card-action">Start Phase →</span>` 
                                    : `<span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 600;">Coming Soon</span>`
                            }
                        </div>
                    </div>
                </a>
            `;
        });

        grid.innerHTML = html;
    }

    // ==================== About Page ====================

    function initAboutPage() {
        // Stats
        const els = {
            phases: document.getElementById('aboutStatPhases'),
            lessons: document.getElementById('aboutStatLessons'),
            completed: document.getElementById('aboutStatCompleted'),
            progress: document.getElementById('aboutStatProgress')
        };

        if (els.phases) els.phases.textContent = curriculum.length;
        if (els.lessons) els.lessons.textContent = getTotalLessons();
        if (els.completed) els.completed.textContent = Progress.getCompletedCount();
        if (els.progress) els.progress.textContent = Progress.getOverallProgress() + '%';

        // Phase list
        const list = document.getElementById('aboutPhaseList');
        if (list) {
            list.innerHTML = curriculum.map(p =>
                `<li><strong>Phase ${p.phase}:</strong> ${p.title} — ${p.lessons.length} lessons</li>`
            ).join('');
        }
    }

    // ==================== Toasts ====================

    window.showToast = function (message, icon = '🧠', duration = 3000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // ==================== Utilities ====================

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Detect current page
    function getCurrentPage() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('roadmap')) return 'roadmap';
        if (path.includes('viewer')) return 'viewer';
        if (path.includes('about')) return 'about';
        return 'home';
    }

    // ==================== Init ====================

    function init() {
        initSidebar();
        initSearch();

        const page = getCurrentPage();

        switch (page) {
            case 'home':
                initHomePage();
                break;
            case 'roadmap':
                initRoadmapPage();
                break;
            case 'about':
                initAboutPage();
                break;
            case 'viewer':
                // Viewer is initialized by viewer.js
                break;
        }

        // Show welcome toast on first visit
        const state = Progress.load();
        if (!state.lastVisited && page === 'home') {
            setTimeout(() => {
                showToast('Welcome to AI Meme University! 🎓', '🧠', 4000);
            }, 500);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
