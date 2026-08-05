import { siteName } from "../config";

// Persists the ids returned by POST /api/public/suggestion so the user can
// look up their suggestions later. The id is an unguessable token that acts as
// the access capability, so losing it means losing access to the status.
//
// The key is scoped by site because dokimotes and dokinomicon are served from
// the same origin under different base paths, and localStorage is per-origin,
// an unscoped key would leak each site's ids into the other's list.
const STORAGE_KEY = `suggestion_ids:${siteName}`;

// Server-side id rule from the suggestion status API.
const SUGGESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const isValidSuggestionId = (id) => typeof id === "string" && SUGGESTION_ID_PATTERN.test(id);

/**
 * @typedef {Object} SavedSuggestion
 * @property {string} id
 * @property {string} savedAt - ISO-8601 timestamp of when the id was saved.
 */

/** @returns {SavedSuggestion[]} */
export const loadSavedSuggestions = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) => entry && isValidSuggestionId(entry.id));
    } catch {
        return [];
    }
};

const persist = (entries) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // Storage unavailable/full. Worst case the id just isn't remembered.
    }
};

/**
 * Appends an id to the saved list (no-op for duplicates or invalid ids).
 *
 * @returns {SavedSuggestion[]} the updated list
 */
export const saveSuggestionId = (id) => {
    const entries = loadSavedSuggestions();
    if (!isValidSuggestionId(id) || entries.some((entry) => entry.id === id)) return entries;
    const updated = [...entries, { id, savedAt: new Date().toISOString() }];
    persist(updated);
    return updated;
};

/**
 * Removes an id from the saved list. Does not delete anything server-side.
 *
 * @returns {SavedSuggestion[]} the updated list
 */
export const removeSuggestionId = (id) => {
    const entries = loadSavedSuggestions();
    const updated = entries.filter((entry) => entry.id !== id);
    if (updated.length !== entries.length) persist(updated);
    return updated;
};
