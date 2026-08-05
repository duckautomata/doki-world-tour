import { describe, it, expect, vi, afterEach } from "vitest";
import {
    parseEventDate,
    formatEventDate,
    isoToCsvDate,
    msToIsoDate,
    isValidCoordinate,
    loadEventData,
    groupByCity,
    EVENT_TYPES,
} from "./dataLoader";

const CSV = [
    "date,event_name,event_type,place,city,country,latitude,longitude,image_id,image_ext",
    '7/2/2026,Anime Expo 2026,"Meet & Greet, Panel",Los Angeles Convention Center,Los Angeles,USA,34.0403213,-118.2695652,tjpVRHP9,.webp',
    "7/4/2026,DOKI DOKI: REWIND TIME,Concert,The Vermont Hollywood,Los Angeles,USA,34.0903998,-118.2914843,pGSAo5DP,.webp",
    "5/30/2026,Dokomi 2026  ,Convention,CCD Congress Center,Düsseldorf,Germany,51.2559613,6.7417614,,",
    ",OffKai Expo Gen 3,Convention,San Jose McEnery Convention Center,San Jose,USA,37.3291386,-121.8890110,,",
].join("\n");

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

    it("parses rows, splits multi types, derives ids and urls, drops dateless rows, sorts by date", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(CSV) }));

        const data = await loadEventData();
        expect(data).toHaveLength(3); // dateless OffKai row dropped
        expect(data[0].event_name).toBe("Dokomi 2026"); // sorted ascending + trailing spaces trimmed
        expect(data[0].event_id).toBe("dokomi-2026");
        expect(data[0].eventTypes).toEqual(["Convention"]);
        expect(data[0].urlOrig).toBeNull();
        expect(data[1].event_id).toBe("anime-expo-2026"); // year not doubled
        expect(data[1].eventTypes).toEqual(["Meet & Greet", "Panel"]); // quoted multi-type split
        expect(data[1].latitude).toBeCloseTo(34.0403213);
        expect(data[1].urlWebp).toMatch(/tjpVRHP9_p\.webp$/);
        expect(data[2].eventTypes).toEqual(["Concert"]);
    });

    it("returns an empty list when the fetch fails", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
        expect(await loadEventData()).toEqual([]);
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
