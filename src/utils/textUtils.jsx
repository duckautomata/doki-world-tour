// Anchored URL test: whether an entire trimmed string IS a URL. Used to decide
// whether an image source renders as a clickable link or as plain text.
const URL_BODY = String.raw`https?:\/\/[^\s]+|www\.[^\s]+`;
const URL_REGEX_EXACT = new RegExp(`^(?:${URL_BODY})$`);

/**
 * Returns true if the given (trimmed) text is itself a URL, http://, https://,
 * or www.-prefixed.
 *
 * @param {string | null | undefined} text
 * @returns {boolean}
 */
export const isUrl = (text) => !!text && URL_REGEX_EXACT.test(text.trim());

/**
 * Turns a URL into an href, prefixing bare `www.` URLs with https:// so they
 * resolve as absolute links instead of relative paths.
 *
 * @param {string} url
 * @returns {string}
 */
export const toHref = (url) => {
    const trimmed = url.trim();
    return trimmed.startsWith("www.") ? `https://${trimmed}` : trimmed;
};

/**
 * Shortens a URL for use as visible link text by dropping the scheme and any
 * trailing slash. Callers that need a hard cap crop the rendered text with CSS,
 * which trims the tail to whatever actually fits instead of a character count.
 *
 * @param {string} url
 * @returns {string}
 */
export function formatUrlForDisplay(url) {
    if (!url) return url;

    return url
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, "");
}
