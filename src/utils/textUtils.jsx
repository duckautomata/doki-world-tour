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
