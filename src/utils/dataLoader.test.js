import { describe, it, expect, vi, afterEach } from "vitest";
import {
    parseEventDate,
    formatEventDate,
    isoToCsvDate,
    msToIsoDate,
    isValidCoordinate,
    loadEventData,
    groupByCity,
    detectPlatform,
    headingMediaItem,
    EVENT_TYPES,
    PLATFORMS,
} from "./dataLoader";

const CSV = [
    "date,event_id,event_name,event_type,place,city,country,latitude,longitude,image_id,image_ext,image_source",
    '7/2/2026,2026-anime-expo,Anime Expo 2026,"Meet & Greet, Panel",Los Angeles Convention Center,Los Angeles,USA,34.0403213,-118.2695652,tjpVRHP9,.webp,https://x.com/animeexpo/status/1',
    "7/4/2026,2026-rewind-time,DOKI DOKI: REWIND TIME,Concert,The Vermont Hollywood,Los Angeles,USA,34.0903998,-118.2914843,pGSAo5DP,.webp,",
    "5/30/2026,,Dokomi 2026  ,Convention,CCD Congress Center,Düsseldorf,Germany,51.2559613,6.7417614,,,",
    ",2026-offkai,OffKai Expo Gen 3,Convention,San Jose McEnery Convention Center,San Jose,USA,37.3291386,-121.8890110,,,",
].join("\n");

const MEDIA_CSV = [
    "event_id,description,source,platform,media_id,media_ext,credit",
    "2026-anime-expo,Panel VOD,https://www.youtube.com/watch?v=abc,YouTube,,,",
    "2026-anime-expo,Booth photo,,,phOtO1,.jpg,@someartist",
    "2026-anime-expo,Clip,https://www.twitch.tv/videos/1,Twitch,,,",
    "2026-rewind-time,,,,,,",
    "2026-offkai,Dropped with its event,https://www.youtube.com/watch?v=xyz,YouTube,,,",
].join("\n");

// loadEventData pulls both CSVs; hand each request the file it asked for.
const stubCsvFetch = ({ events = CSV, media = MEDIA_CSV, ok = true } = {}) =>
    vi.stubGlobal(
        "fetch",
        vi.fn((url) =>
            Promise.resolve({ ok, text: () => Promise.resolve(url.endsWith("media.csv") ? media : events) }),
        ),
    );

describe("parseEventDate", () => {
    it("parses M/D/YYYY dates", () => {
        const date = parseEventDate("7/2/2026");
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(6);
        expect(date.getDate()).toBe(2);
    });

    it("rejects malformed and rollover dates", () => {
        expect(parseEventDate("")).toBeNull();
        expect(parseEventDate(undefined)).toBeNull();
        expect(parseEventDate("2026-07-02")).toBeNull();
        expect(parseEventDate("2/30/2026")).toBeNull();
    });
});

describe("date conversion helpers", () => {
    it("round-trips between iso inputs and csv format", () => {
        expect(isoToCsvDate("2026-07-02")).toBe("7/2/2026");
        expect(msToIsoDate(new Date(2026, 6, 2).getTime())).toBe("2026-07-02");
    });

    it("formats display dates", () => {
        expect(formatEventDate(new Date(2026, 6, 2).getTime())).toMatch(/2026/);
    });
});

describe("isValidCoordinate", () => {
    it("accepts in-range numbers and rejects everything else", () => {
        expect(isValidCoordinate("34.04", 90)).toBe(true);
        expect(isValidCoordinate("-118.26", 180)).toBe(true);
        expect(isValidCoordinate("91", 90)).toBe(false);
        expect(isValidCoordinate("abc", 90)).toBe(false);
        expect(isValidCoordinate("", 90)).toBe(false);
    });
});

describe("EVENT_TYPES", () => {
    it("contains the canonical list", () => {
        expect(EVENT_TYPES).toContain("Convention");
        expect(EVENT_TYPES).toContain("Pop-up Café");
        expect(EVENT_TYPES).toHaveLength(8);
    });
});

describe("loadEventData", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("parses rows, splits multi types, takes ids and urls, drops dateless rows, sorts by date", async () => {
        stubCsvFetch();

        const data = await loadEventData();
        expect(data).toHaveLength(3); // dateless OffKai row dropped
        expect(data[0].event_name).toBe("Dokomi 2026"); // sorted ascending + trailing spaces trimmed
        expect(data[0].event_id).toBe("dokomi-2026"); // no id column value, so derived from name + year
        expect(data[0].eventTypes).toEqual(["Convention"]);
        expect(data[0].urlOrig).toBeNull();
        expect(data[1].event_id).toBe("2026-anime-expo"); // the CSV's own id
        expect(data[1].eventTypes).toEqual(["Meet & Greet", "Panel"]); // quoted multi-type split
        expect(data[1].latitude).toBeCloseTo(34.0403213);
        expect(data[1].urlWebp).toMatch(/tjpVRHP9_p\.webp$/);
        expect(data[1].image_source).toBe("https://x.com/animeexpo/status/1");
        expect(data[2].eventTypes).toEqual(["Concert"]);
        expect(data[2].image_source).toBe("");
    });

    it("attaches media to its event, uploads first, and drops empty rows", async () => {
        stubCsvFetch();

        const data = await loadEventData();
        const expo = data.find((e) => e.event_id === "2026-anime-expo");
        expect(expo.media.map((m) => m.description)).toEqual(["Booth photo", "Clip", "Panel VOD"]);

        const [upload, twitch] = expo.media;
        expect(upload.kind).toBe("upload");
        expect(upload.credit).toBe("@someartist");
        expect(upload.urlOrig).toMatch(/phOtO1\.jpg$/);
        expect(upload.urlThumb).toMatch(/phOtO1_t\.webp$/);
        expect(twitch.kind).toBe("link");
        expect(twitch.platform).toBe("Twitch");
        expect(twitch.urlOrig).toBeNull();

        // The row with neither a link nor an upload never makes it through.
        expect(data.find((e) => e.event_id === "2026-rewind-time").media).toEqual([]);
    });

    it("keeps the events when media.csv cannot be loaded", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((url) =>
                url.endsWith("media.csv")
                    ? Promise.resolve({ ok: false })
                    : Promise.resolve({ ok: true, text: () => Promise.resolve(CSV) }),
            ),
        );

        const data = await loadEventData();
        expect(data).toHaveLength(3);
        expect(data.every((e) => e.media.length === 0)).toBe(true);
    });

    it("returns an empty list when the event fetch fails", async () => {
        stubCsvFetch({ ok: false });
        expect(await loadEventData()).toEqual([]);
    });
});

describe("detectPlatform", () => {
    it("recognises the canonical platforms and nothing else", () => {
        expect(PLATFORMS).toEqual(["YouTube", "Twitch", "Twitter", "Facebook"]);
        expect(detectPlatform("https://youtu.be/abc")).toBe("YouTube");
        expect(detectPlatform("https://www.youtube.com/watch?v=abc")).toBe("YouTube");
        expect(detectPlatform("https://www.twitch.tv/videos/1")).toBe("Twitch");
        expect(detectPlatform("https://x.com/dokibird/status/1")).toBe("Twitter");
        expect(detectPlatform("https://twitter.com/dokibird/status/1")).toBe("Twitter");
        expect(detectPlatform("https://www.facebook.com/watch?v=1")).toBe("Facebook");
        expect(detectPlatform("https://example.com/post")).toBe("");
        expect(detectPlatform("")).toBe("");
    });
});

describe("headingMediaItem", () => {
    it("wraps an event's heading image as media, crediting the image source", () => {
        const item = headingMediaItem({
            event_name: "Dokomi",
            image_id: "abc",
            image_ext: ".webp",
            image_source: "https://x.com/dokibird/status/1",
            urlOrig: "https://cdn/abc.webp",
            urlWebp: "https://cdn/abc_p.webp",
            urlThumb: "https://cdn/abc_t.webp",
        });
        expect(item).toMatchObject({
            kind: "upload",
            description: "Dokomi",
            credit: "https://x.com/dokibird/status/1",
            media_id: "abc",
            media_ext: ".webp",
        });
        expect(headingMediaItem({ urlOrig: null })).toBeNull();
    });
});

describe("groupByCity", () => {
    it("groups by city+country at the mean coordinates", () => {
        const events = [
            { city: "Los Angeles", country: "USA", latitude: 34, longitude: -118 },
            { city: "Los Angeles", country: "USA", latitude: 36, longitude: -120 },
            { city: "Düsseldorf", country: "Germany", latitude: 51.25, longitude: 6.74 },
        ];
        const groups = groupByCity(events);
        expect(groups).toHaveLength(2);
        const la = groups.find((g) => g.city === "Los Angeles");
        expect(la.events).toHaveLength(2);
        expect(la.latitude).toBeCloseTo(35);
        expect(la.longitude).toBeCloseTo(-119);
        expect(la.key).toBe("Los Angeles|USA");
    });
});
