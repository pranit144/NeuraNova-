/**
 * progress.js — Progress tracking using localStorage
 * 
 * Tracks: completed lessons, current lesson, PDF page positions, phase/overall progress.
 */

const Progress = (() => {
    const STORAGE_KEY = 'aimeme_progress';

    // Default state
    function getDefault() {
        return {
            completedLessons: [],
            currentLessonId: 1,
            pdfPagePositions: {},
            lastVisited: null
        };
    }

    // Load from localStorage
    function load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                return { ...getDefault(), ...parsed };
            }
        } catch (e) {
            console.warn('Progress: Failed to load from localStorage', e);
        }
        return getDefault();
    }

    // Save to localStorage
    function save(state) {
        try {
            state.lastVisited = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Progress: Failed to save to localStorage', e);
        }
    }

    // Mark a lesson as completed
    function markCompleted(lessonId) {
        const state = load();
        lessonId = parseInt(lessonId);
        if (!state.completedLessons.includes(lessonId)) {
            state.completedLessons.push(lessonId);
        }
        save(state);
        return state;
    }

    // Unmark a lesson (toggle off)
    function markIncomplete(lessonId) {
        const state = load();
        lessonId = parseInt(lessonId);
        state.completedLessons = state.completedLessons.filter(id => id !== lessonId);
        save(state);
        return state;
    }

    // Toggle lesson completion
    function toggleCompleted(lessonId) {
        lessonId = parseInt(lessonId);
        if (isCompleted(lessonId)) {
            return markIncomplete(lessonId);
        } else {
            return markCompleted(lessonId);
        }
    }

    // Check if a lesson is completed
    function isCompleted(lessonId) {
        const state = load();
        return state.completedLessons.includes(parseInt(lessonId));
    }

    // Set current lesson
    function setCurrentLesson(lessonId) {
        const state = load();
        state.currentLessonId = parseInt(lessonId);
        save(state);
    }

    // Get current lesson
    function getCurrentLesson() {
        const state = load();
        return state.currentLessonId;
    }

    // Save PDF page position for a lesson
    function savePdfPage(lessonId, pageNum) {
        const state = load();
        state.pdfPagePositions[lessonId] = pageNum;
        save(state);
    }

    // Get saved PDF page for a lesson
    function getPdfPage(lessonId) {
        const state = load();
        return state.pdfPagePositions[lessonId] || 1;
    }

    // Get overall progress (percentage)
    function getOverallProgress() {
        const state = load();
        const total = getTotalLessons();
        if (total === 0) return 0;
        return Math.round((state.completedLessons.length / total) * 100);
    }

    // Get phase progress (percentage)
    function getPhaseProgress(phaseId) {
        const state = load();
        const phase = getPhaseById(phaseId);
        if (!phase) return 0;
        const completedInPhase = phase.lessons.filter(l =>
            state.completedLessons.includes(l.id)
        ).length;
        return Math.round((completedInPhase / phase.lessons.length) * 100);
    }

    // Get count of completed lessons
    function getCompletedCount() {
        const state = load();
        return state.completedLessons.length;
    }

    // Get count of completed lessons in a phase
    function getPhaseCompletedCount(phaseId) {
        const state = load();
        const phase = getPhaseById(phaseId);
        if (!phase) return 0;
        return phase.lessons.filter(l => state.completedLessons.includes(l.id)).length;
    }

    // Get the next incomplete lesson
    function getNextIncompleteLesson() {
        const state = load();
        const allLessons = getAllLessons();
        return allLessons.find(l => !state.completedLessons.includes(l.id)) || allLessons[0];
    }

    // Get lesson status: 'completed', 'current', 'locked'
    function getLessonStatus(lessonId) {
        if (isCompleted(lessonId)) return 'completed';
        const current = getCurrentLesson();
        if (parseInt(lessonId) === current) return 'current';
        return 'upcoming';
    }

    // Reset all progress
    function reset() {
        localStorage.removeItem(STORAGE_KEY);
    }

    return {
        load,
        save,
        markCompleted,
        markIncomplete,
        toggleCompleted,
        isCompleted,
        setCurrentLesson,
        getCurrentLesson,
        savePdfPage,
        getPdfPage,
        getOverallProgress,
        getPhaseProgress,
        getCompletedCount,
        getPhaseCompletedCount,
        getNextIncompleteLesson,
        getLessonStatus,
        reset
    };
})();

if (typeof window !== 'undefined') {
    window.Progress = Progress;
}
