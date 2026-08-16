import Papa from "papaparse";
import { LOG_ERROR, LOG_WARN } from "./debug";
import { cdn } from "../config";

/**
 * @typedef {import("../store/types").EventData} EventData
 * @typedef {import("../store/types").MediaItem} MediaItem
 * @typedef {import("../store/types").CityGroup} CityGroup
 */

// The canonical event types, in display order. The CSV's event_type column
// holds one or more of these, comma separated.
export const EVENT_TYPES = [
    "Convention",
    "Watch Party",
    "Concert",
    "Collaboration",
    "Panel",
    "Meet & Greet",
    "Sponsor Appearance",
    "Pop-up Café",
];

// The canonical platforms a linked piece of media can come from, in display
// order. media.csv's platform column holds one of these (uploaded media has
// no platform).
export const PLATFORMS = ["YouTube", "Twitch", "Twitter", "Facebook"];

const PLATFORM_PATTERNS = [
    ["YouTube", /youtube\.com|youtu\.be/],
    ["Twitch", /twitch\.tv/],
    ["Twitter", /twitter\.com|(?:^|\/\/|\.)x\.com/],
    ["Facebook", /facebook\.com|fb\.watch|fb\.com/],
];

/**
 * Guesses which platform a media link belongs to from its URL, so the
 * suggestion forms can prefill the platform picker.
 *
 * @param {string} [url]
 * @returns {string} a PLATFORMS entry, or "" when nothing matches
 */
export const detectPlatform = (url) => {
    const text = (url ?? "").trim().toLowerCase();
    if (!text) return "";
    return PLATFORM_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "";
};

const fetchAndParseCSV = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const text = await response.text();

    return new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data),
            error: (error) => reject(error),
        });
    });
};

/**
 * Parses the CSV's M/D/YYYY date format explicitly rather than trusting
 * Date.parse with a non-ISO string.
 *
 * @param {string} [text]
 * @returns {Date | null} null when the text is not a real calendar date
 */
export const parseEventDate = (text) => {
    if (!text) return null;
    const match = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    // Reject rollover dates like 2/30 (which Date silently turns into Mar 2).
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

/**
 * Formats an epoch-ms timestamp for display, e.g. "Jul 2, 2026".
 *
 * @param {number} ms
 * @returns {string}
 */
export const formatEventDate = (ms) =>
    new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/**
 * Validates a latitude/longitude text field from the suggestion forms.
 *
 * @param {string} text
 * @param {number} bound 90 for latitude, 180 for longitude
 * @returns {boolean}
 */
export const isValidCoordinate = (text, bound) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const value = Number(trimmed);
    return Number.isFinite(value) && value >= -bound && value <= bound;
};

/**
 * Converts a YYYY-MM-DD date-input value to the CSV's M/D/YYYY format so
 * suggestion payloads match the format admins paste into the sheet.
 *
 * @param {string} iso
 * @returns {string}
 */
export const isoToCsvDate = (iso) => {
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return iso;
    return `${Number(match[2])}/${Number(match[3])}/${match[1]}`;
};

/**
 * Formats an epoch-ms timestamp as a YYYY-MM-DD date-input value.
 *
 * @param {number} ms
 * @returns {string}
 */
export const msToIsoDate = (ms) => {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const slugify = (text) =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

/**
 * Splits the CSV's comma-separated event_type cell into a trimmed list,
 * e.g. "Convention, Collaboration" → ["Convention", "Collaboration"].
 *
 * @param {string} [text]
 * @returns {string[]}
 */
const parseEventTypes = (text) =>
    (text ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

// Uploaded media renders as a gallery, links as a list, so uploads sort
// first. Within a kind the order is platform, then description, so the same
// CSV always produces the same page.
const MEDIA_KIND_ORDER = { upload: 0, link: 1 };

const compareMedia = (a, b) =>
    MEDIA_KIND_ORDER[a.kind] - MEDIA_KIND_ORDER[b.kind] ||
    a.platform.localeCompare(b.platform) ||
    a.description.localeCompare(b.description) ||
    a.index - b.index;

/**
 * Turns one media.csv row into a media item. A row is an upload when it has a
 * media_id (source/platform are then blank) and a link otherwise.
 *
 * @param {Object} row
 * @param {number} index position among the rows of the same event, which is
 *     how the suggestion forms point admins back at a specific row
 * @returns {MediaItem}
 */
const parseMediaRow = (row, index) => {
    const media_id = (row.media_id ?? "").trim();
    const media_ext = (row.media_ext ?? "").trim();
    const isUpload = Boolean(media_id);
    return {
        index,
        kind: isUpload ? "upload" : "link",
        description: (row.description ?? "").trim(),
        source: (row.source ?? "").trim(),
        platform: (row.platform ?? "").trim(),
        credit: (row.credit ?? "").trim(),
        media_id,
        media_ext,
        urlOrig: isUpload ? `${cdn}/${media_id}${media_ext}` : null,
        urlWebp: isUpload ? `${cdn}/${media_id}_p.webp` : null,
        urlThumb: isUpload ? `${cdn}/${media_id}_t.webp` : null,
    };
};

/**
 * Loads media.csv and groups it by event_id. Media is supplementary, so a
 * missing or broken file leaves the events themselves intact.
 *
 * @returns {Promise<Map<string, MediaItem[]>>}
 */
const loadMediaByEvent = async () => {
    const byEvent = new Map();
    let rows;
    try {
        rows = await fetchAndParseCSV(`${cdn}/media.csv`);
    } catch (error) {
        LOG_ERROR("Error loading media data:", error);
        return byEvent;
    }

    rows.forEach((row) => {
        const event_id = (row.event_id ?? "").trim();
        // A row with neither a link nor an upload has nothing to show.
        if (!event_id || (!(row.source ?? "").trim() && !(row.media_id ?? "").trim())) {
            LOG_WARN("Skipping malformed media row:", row);
            return;
        }
        const list = byEvent.get(event_id) ?? [];
        list.push(parseMediaRow(row, list.length));
        byEvent.set(event_id, list);
    });

    byEvent.forEach((list) => list.sort(compareMedia));
    return byEvent;
};

/**
 * Builds a media item for an event's heading image so it can share the media
 * modal with the event's gallery. Returns null when the event has no image.
 *
 * @param {EventData} event
 * @returns {MediaItem | null}
 */
export const headingMediaItem = (event) => {
    if (!event?.urlOrig) return null;
    return {
        index: -1,
        kind: "upload",
        description: event.event_name,
        source: "",
        platform: "",
        credit: event.image_source ?? "",
        media_id: event.image_id,
        media_ext: event.image_ext,
        urlOrig: event.urlOrig,
        urlWebp: event.urlWebp,
        urlThumb: event.urlThumb,
    };
};

/**
 * Loads and parses the event list from the CDN CSV, attaching each event's
 * media from media.csv. Rows without a parseable date or coordinates are
 * dropped (they cannot be placed on the map or the timeline). Result is
 * sorted by date ascending.
 *
 * @returns {Promise<EventData[]>}
 */
export const loadEventData = async () => {
    try {
        const [rows, mediaByEvent] = await Promise.all([fetchAndParseCSV(`${cdn}/events.csv`), loadMediaByEvent()]);

        const seenIds = new Set();
        const parsed = [];
        rows.forEach((row) => {
            const date = parseEventDate(row.date);
            const latitude = Number(row.latitude);
            const longitude = Number(row.longitude);
            const event_name = (row.event_name ?? "").trim();
            if (!event_name || !date || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                LOG_WARN("Skipping malformed event row:", row);
                return;
            }

            // The CSV's event_id links the row to its media and doubles as the
            // suggestion target_id. Older exports have no such column, so fall
            // back to a slug derived from the name and date, skipping the year
            // suffix when the name already ends with it ("Anime Expo 2026" →
            // "anime-expo-2026").
            const slug = slugify(event_name);
            const year = date.getFullYear();
            const base = (row.event_id ?? "").trim() || (slug.endsWith(`-${year}`) ? slug : `${slug}-${year}`);
            let event_id = base;
            let n = 2;
            while (seenIds.has(event_id)) event_id = `${base}-${n++}`;
            seenIds.add(event_id);

            const hasImage = Boolean(row.image_id);
            parsed.push({
                ...row,
                event_id,
                event_name,
                eventTypes: parseEventTypes(row.event_type),
                image_source: (row.image_source ?? "").trim(),
                place: (row.place ?? "").trim(),
                city: (row.city ?? "").trim(),
                country: (row.country ?? "").trim(),
                dateValue: date.getTime(),
                latitude,
                longitude,
                media: mediaByEvent.get(event_id) ?? [],
                urlOrig: hasImage ? `${cdn}/${row.image_id}${row.image_ext}` : null,
                urlWebp: hasImage ? `${cdn}/${row.image_id}_p.webp` : null,
                urlThumb: hasImage ? `${cdn}/${row.image_id}_t.webp` : null,
            });
        });

        parsed.sort((a, b) => a.dateValue - b.dateValue);
        return parsed;
    } catch (error) {
        LOG_ERROR("Error loading event data:", error);
        return [];
    }
};

/**
 * Groups events into one marker per city+country so nearby venue coordinates
 * never produce overlapping markers.
 *
 * @param {EventData[]} events
 * @returns {CityGroup[]}
 */
export const groupByCity = (events) => {
    const groups = new Map();
    events.forEach((e) => {
        const key = `${e.city}|${e.country}`;
        if (!groups.has(key)) {
            groups.set(key, { key, city: e.city, country: e.country, latitude: 0, longitude: 0, events: [] });
        }
        groups.get(key).events.push(e);
    });
    return Array.from(groups.values()).map((g) => ({
        ...g,
        latitude: g.events.reduce((sum, e) => sum + e.latitude, 0) / g.events.length,
        longitude: g.events.reduce((sum, e) => sum + e.longitude, 0) / g.events.length,
    }));
};
