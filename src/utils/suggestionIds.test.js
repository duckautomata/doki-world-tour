import { beforeEach, describe, expect, it } from "vitest";
import { isValidSuggestionId, loadSavedSuggestions, removeSuggestionId, saveSuggestionId } from "./suggestionIds";

// The storage key is scoped to this site because the duck-automata sites
// share an origin; keep in sync with suggestionIds.js.
const STORAGE_KEY = "suggestion_ids:doki-world-tour";

describe("isValidSuggestionId", () => {
    it("accepts ids of letters, digits, - and _ up to 64 chars", () => {
        expect(isValidSuggestionId("sug_abc-123")).toBe(true);
        expect(isValidSuggestionId("a")).toBe(true);
        expect(isValidSuggestionId("a".repeat(64))).toBe(true);
    });

    it("rejects empty, overlong, non-string, and bad-character ids", () => {
        expect(isValidSuggestionId("")).toBe(false);
        expect(isValidSuggestionId("a".repeat(65))).toBe(false);
        expect(isValidSuggestionId("has space")).toBe(false);
        expect(isValidSuggestionId("sug/../etc")).toBe(false);
        expect(isValidSuggestionId(null)).toBe(false);
        expect(isValidSuggestionId(42)).toBe(false);
    });
});

describe("saved suggestion storage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("round-trips a saved id under the site-scoped key", () => {
        const updated = saveSuggestionId("sug_one");
        expect(updated).toHaveLength(1);
        expect(updated[0].id).toBe("sug_one");
        expect(typeof updated[0].savedAt).toBe("string");
        expect(loadSavedSuggestions()).toEqual(updated);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(updated);
    });

    it("ignores duplicate saves", () => {
        saveSuggestionId("sug_one");
        const updated = saveSuggestionId("sug_one");
        expect(updated).toHaveLength(1);
        expect(loadSavedSuggestions()).toHaveLength(1);
    });

    it("ignores invalid ids", () => {
        expect(saveSuggestionId("not valid!")).toEqual([]);
        expect(loadSavedSuggestions()).toEqual([]);
    });

    it("removes a saved id and leaves the rest", () => {
        saveSuggestionId("sug_one");
        saveSuggestionId("sug_two");
        const updated = removeSuggestionId("sug_one");
        expect(updated.map((entry) => entry.id)).toEqual(["sug_two"]);
        expect(loadSavedSuggestions().map((entry) => entry.id)).toEqual(["sug_two"]);
    });

    it("removing an unknown id is a no-op", () => {
        saveSuggestionId("sug_one");
        const updated = removeSuggestionId("sug_other");
        expect(updated.map((entry) => entry.id)).toEqual(["sug_one"]);
    });

    it("recovers from corrupt storage (non-JSON)", () => {
        localStorage.setItem(STORAGE_KEY, "not json {");
        expect(loadSavedSuggestions()).toEqual([]);
    });

    it("recovers from corrupt storage (non-array JSON)", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "sug_one" }));
        expect(loadSavedSuggestions()).toEqual([]);
    });

    it("filters out entries with missing or invalid ids", () => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([{ id: "sug_ok", savedAt: "2026-07-01T00:00:00.000Z" }, { id: "bad id" }, null, {}]),
        );
        expect(loadSavedSuggestions().map((entry) => entry.id)).toEqual(["sug_ok"]);
    });
});
