import Papa from "papaparse";
import { LOG_ERROR, LOG_WARN } from "./debug";
import { cdn } from "../config";

/**
 * @typedef {import("../store/types").EventData} EventData
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

/**
 * Loads and parses the event list from the CDN CSV. Rows without a parseable
 * date or coordinates are dropped (they cannot be placed on the map or the
 * timeline). Result is sorted by date ascending.
 *
 * @returns {Promise<EventData[]>}
 */
export const loadEventData = async () => {
    try {
        const rows = await fetchAndParseCSV(`${cdn}/events.csv`);

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

            // The CSV has no id column, so derive a stable one from the name
            // and date. It doubles as the edit-suggestion target_id, so admins
            // can match it back to a row. Skip the year suffix when the name
            // already ends with it ("Anime Expo 2026" → "anime-expo-2026").
            const slug = slugify(event_name);
            const year = date.getFullYear();
            const base = slug.endsWith(`-${year}`) ? slug : `${slug}-${year}`;
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
                place: (row.place ?? "").trim(),
                city: (row.city ?? "").trim(),
                country: (row.country ?? "").trim(),
                dateValue: date.getTime(),
                latitude,
                longitude,
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
