/**
 * search.js — Global search across curriculum
 * 
 * Searches across phase names, lesson titles, and descriptions.
 */

const Search = (() => {
    // Search the curriculum
    function query(searchTerm) {
        if (!searchTerm || searchTerm.trim().length === 0) return [];

        const term = searchTerm.toLowerCase().trim();
        const results = [];

        curriculum.forEach(phase => {
            // Check phase title/description match
            const phaseMatch =
                phase.title.toLowerCase().includes(term) ||
                phase.description.toLowerCase().includes(term) ||
                phase.shortTitle.toLowerCase().includes(term);

            phase.lessons.forEach(lesson => {
                const titleMatch = lesson.title.toLowerCase().includes(term);
                const descMatch = lesson.description.toLowerCase().includes(term);

                if (titleMatch || descMatch || phaseMatch) {
                    // Calculate relevance score
                    let score = 0;
                    if (titleMatch) score += 10;
                    if (descMatch) score += 5;
                    if (phaseMatch && !titleMatch && !descMatch) score += 2;

                    // Exact match boost
                    if (lesson.title.toLowerCase() === term) score += 20;

                    results.push({
                        lesson,
                        phase,
                        score,
                        matchType: titleMatch ? 'title' : descMatch ? 'description' : 'phase'
                    });
                }
            });
        });

        // Sort by relevance score (highest first)
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    // Highlight matching text
    function highlight(text, searchTerm) {
        if (!searchTerm) return text;
        const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // Escape regex special characters
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    return { query, highlight };
})();

if (typeof window !== 'undefined') {
    window.Search = Search;
}
