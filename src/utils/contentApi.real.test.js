import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSuggestionStatuses, submitSuggestion } from "./contentApi.real";
import { contentApi, siteName } from "../config";

const okJson = (body) => ({ ok: true, json: async () => body });

describe("contentApi.real", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("fetchSuggestionStatuses", () => {
        it("scopes the lookup to the site", async () => {
            fetch.mockResolvedValue(okJson({ suggestions: [], not_found: ["sug_a"] }));

            const result = await fetchSuggestionStatuses(["sug_a", "sug_b"]);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(`${contentApi}/public/suggestions/${siteName}?ids=sug_a%2Csug_b`);
            expect(result.not_found).toEqual(["sug_a"]);
        });

        it("accepts an explicit site", async () => {
            fetch.mockResolvedValue(okJson({ suggestions: [], not_found: [] }));

            await fetchSuggestionStatuses(["sug_a"], "dokimotes");

            expect(fetch).toHaveBeenCalledWith(`${contentApi}/public/suggestions/dokimotes?ids=sug_a`);
        });

        it("chunks ids and merges the responses", async () => {
            const ids = Array.from({ length: 51 }, (_, i) => `sug_${i}`);
            fetch
                .mockResolvedValueOnce(okJson({ suggestions: [{ id: "sug_0" }], not_found: [] }))
                .mockResolvedValueOnce(okJson({ suggestions: [], not_found: ["sug_50"] }));

            const result = await fetchSuggestionStatuses(ids);

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(result.suggestions).toEqual([{ id: "sug_0" }]);
            expect(result.not_found).toEqual(["sug_50"]);
        });

        it("surfaces the server's error detail", async () => {
            fetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: "Not Found",
                json: async () => ({ detail: "Unknown site" }),
            });

            await expect(fetchSuggestionStatuses(["sug_a"])).rejects.toThrow("Unknown site");
        });
    });

    describe("submitSuggestion", () => {
        const bodyOf = () => JSON.parse(fetch.mock.calls[0][1].body);

        it("sends the summary when one is given", async () => {
            fetch.mockResolvedValue(okJson({ id: "sug_new" }));

            await submitSuggestion({
                token: "tok",
                kind: "new",
                payload: { name: "Kiki" },
                summary: "  Add the doki 'Kiki'  ",
            });

            expect(bodyOf()).toEqual({
                cf_turnstile_response: "tok",
                site: siteName,
                kind: "new",
                payload: { name: "Kiki" },
                image_ids: [],
                summary: "Add the doki 'Kiki'",
            });
        });

        it("omits the summary when there isn't one, so the server generates it", async () => {
            fetch.mockResolvedValue(okJson({ id: "sug_new" }));

            await submitSuggestion({ token: "tok", kind: "new", payload: {} });

            expect(bodyOf()).not.toHaveProperty("summary");
        });

        it("truncates a summary that exceeds the server limit", async () => {
            fetch.mockResolvedValue(okJson({ id: "sug_new" }));

            await submitSuggestion({ token: "tok", kind: "new", payload: {}, summary: "x".repeat(400) });

            expect(bodyOf().summary).toHaveLength(300);
            expect(bodyOf().summary.endsWith("…")).toBe(true);
        });
    });
});
