// A short, human-readable line describing what a suggestion asks for, e.g.
// "Add the doki 'Kiki'". Sent on submit and echoed back by the status API,
// where it is the headline of each row.
export const SUMMARY_MAX_LENGTH = 300;

/**
 * Normalises a caller-built summary for the API: collapses surrounding
 * whitespace and truncates to the server's limit. Returns null when there is
 * nothing to send, in which case the server generates one from the payload.
 *
 * @param {string} [text]
 * @returns {string | null}
 */
export const clampSummary = (text) => {
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (trimmed.length <= SUMMARY_MAX_LENGTH) return trimmed;
    return `${trimmed.slice(0, SUMMARY_MAX_LENGTH - 1).trimEnd()}…`;
};
