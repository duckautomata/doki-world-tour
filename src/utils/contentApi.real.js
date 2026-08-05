import { contentApi, siteName } from "../config";
import { clampSummary } from "./suggestionSummary";

let cachedConfig = null;
let inFlightConfig = null;

const readErrorDetail = async (res) => {
    try {
        const body = await res.json();
        if (body && typeof body.detail === "string") return body.detail;
    } catch {
        // ignore JSON parse errors; fall back to status text
    }
    return `${res.status} ${res.statusText}`.trim();
};

export const fetchPublicConfig = async () => {
    if (cachedConfig) return cachedConfig;
    if (inFlightConfig) return inFlightConfig;

    inFlightConfig = (async () => {
        const res = await fetch(`${contentApi}/public/config`);
        if (!res.ok) {
            throw new Error(`Failed to load public config: ${await readErrorDetail(res)}`);
        }
        cachedConfig = await res.json();
        return cachedConfig;
    })().finally(() => {
        inFlightConfig = null;
    });

    return inFlightConfig;
};

export const uploadImage = async ({ token, file }) => {
    const formData = new FormData();
    formData.append("cf_turnstile_response", token);
    formData.append("file", file);

    const res = await fetch(`${contentApi}/public/image`, {
        method: "POST",
        body: formData,
    });
    if (!res.ok) {
        throw new Error(await readErrorDetail(res));
    }
    return res.json();
};

export const submitSuggestion = async ({ token, kind, payload, imageIds = [], site = siteName, summary }) => {
    const body = {
        cf_turnstile_response: token,
        site,
        kind,
        payload,
        image_ids: imageIds,
    };
    // Optional: omitting it lets the server generate one from the payload.
    const trimmedSummary = clampSummary(summary);
    if (trimmedSummary) body.summary = trimmedSummary;

    const res = await fetch(`${contentApi}/public/suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(await readErrorDetail(res));
    }
    return res.json();
};

// The server accepts at most 50 ids per request; chunk so power users don't 400.
const STATUS_CHUNK_SIZE = 50;

// The lookup is scoped to a single site: ids belonging to another site come
// back in not_found rather than being returned, so the whole saved id list can
// be passed as-is.
export const fetchSuggestionStatuses = async (ids, site = siteName) => {
    const unique = [...new Set(ids)];
    const results = { suggestions: [], not_found: [] };
    for (let i = 0; i < unique.length; i += STATUS_CHUNK_SIZE) {
        const chunk = unique.slice(i, i + STATUS_CHUNK_SIZE);
        const res = await fetch(
            `${contentApi}/public/suggestions/${encodeURIComponent(site)}?ids=${encodeURIComponent(chunk.join(","))}`,
        );
        if (!res.ok) {
            throw new Error(await readErrorDetail(res));
        }
        const data = await res.json();
        results.suggestions.push(...(data.suggestions ?? []));
        results.not_found.push(...(data.not_found ?? []));
    }
    return results;
};
