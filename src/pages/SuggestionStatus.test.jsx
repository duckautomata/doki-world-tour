import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SuggestionStatus from "./SuggestionStatus";
import { fetchSuggestionStatuses } from "../utils/contentApi";

vi.mock("../utils/contentApi", () => ({
    fetchSuggestionStatuses: vi.fn(),
}));

// Keep in sync with suggestionIds.js (site-scoped because the duck-automata
// sites share an origin).
const STORAGE_KEY = "suggestion_ids:doki-world-tour";

const seedSavedIds = (ids) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.map((id) => ({ id, savedAt: "2026-07-01T00:00:00.000Z" }))));

const makeSuggestion = (overrides = {}) => ({
    id: "sug_alpha",
    site: "doki-world-tour",
    kind: "new",
    status: "pending",
    summary: "Add the doki 'Alpha'",
    submitted_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    admin_context: "",
    ...overrides,
});

const renderPage = () =>
    render(
        <MemoryRouter>
            <SuggestionStatus />
        </MemoryRouter>,
    );

describe("SuggestionStatus", () => {
    beforeEach(() => {
        localStorage.clear();
        fetchSuggestionStatuses.mockReset();
    });

    it("shows the empty state without fetching when nothing is saved", async () => {
        renderPage();

        await waitFor(() => expect(screen.getByText(/No saved suggestions yet/i)).toBeInTheDocument());
        expect(fetchSuggestionStatuses).not.toHaveBeenCalled();
    });

    it("fetches all saved ids in one call and renders status and not-found rows", async () => {
        seedSavedIds(["sug_alpha", "sug_gone"]);
        fetchSuggestionStatuses.mockResolvedValueOnce({
            suggestions: [
                makeSuggestion({
                    kind: "edit",
                    status: "approved",
                    summary: "Fix the debut date on 'Alpha'",
                    updated_at: "2026-07-03T12:00:00.000Z",
                    admin_context: "Looks good!\nGoing live soon.",
                }),
            ],
            not_found: ["sug_gone"],
        });

        renderPage();

        await waitFor(() => expect(screen.getByText("approved")).toBeInTheDocument());
        expect(fetchSuggestionStatuses).toHaveBeenCalledTimes(1);
        expect(fetchSuggestionStatuses).toHaveBeenCalledWith(["sug_alpha", "sug_gone"]);

        // Full row: pill, kind label, id, summary, meaning, dates, feedback
        expect(screen.getByText("Edit")).toBeInTheDocument();
        expect(screen.getByText("Fix the debut date on 'Alpha'")).toBeInTheDocument();
        expect(screen.getByText("sug_alpha")).toBeInTheDocument();
        expect(screen.getByText("Accepted! The change is being worked on.")).toBeInTheDocument();
        expect(screen.getByText(/Submitted/)).toBeInTheDocument();
        expect(screen.getByText(/Updated/)).toBeInTheDocument();
        expect(screen.getByText("Admin feedback")).toBeInTheDocument();
        expect(screen.getByText(/Going live soon/)).toBeInTheDocument();

        // not_found row is rendered, not silently dropped
        expect(screen.getByText("not found")).toBeInTheDocument();
        expect(
            screen.getByText(/removed by an admin, belong to another site, or the id is invalid/i),
        ).toBeInTheDocument();
    });

    it("adds a manually entered id when it belongs to this site", async () => {
        fetchSuggestionStatuses.mockResolvedValueOnce({
            suggestions: [makeSuggestion({ id: "sug_manual" })],
            not_found: [],
        });

        renderPage();
        await waitFor(() => expect(screen.getByText(/No saved suggestions yet/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/Track another suggestion/i), { target: { value: "sug_manual" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        await waitFor(() => expect(screen.getByText("pending")).toBeInTheDocument());
        expect(fetchSuggestionStatuses).toHaveBeenCalledTimes(1);
        expect(fetchSuggestionStatuses).toHaveBeenCalledWith(["sug_manual"]);
        expect(screen.getByText("sug_manual")).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).map((entry) => entry.id)).toEqual(["sug_manual"]);
        expect(screen.getByLabelText(/Track another suggestion/i)).toHaveValue("");
    });

    it("re-reads the summary on refresh", async () => {
        seedSavedIds(["sug_alpha"]);
        fetchSuggestionStatuses.mockResolvedValue({ suggestions: [makeSuggestion()], not_found: [] });

        renderPage();
        await waitFor(() => expect(screen.getByText("Add the doki 'Alpha'")).toBeInTheDocument());

        fetchSuggestionStatuses.mockResolvedValue({
            suggestions: [makeSuggestion({ summary: "Add the doki 'Alpha' (renamed by admin)" })],
            not_found: [],
        });
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

        await waitFor(() => expect(screen.getByText("Add the doki 'Alpha' (renamed by admin)")).toBeInTheDocument());
        expect(screen.queryByText("Add the doki 'Alpha'")).not.toBeInTheDocument();
    });

    // The lookup is scoped to this site server-side, so an id from another site
    // is indistinguishable from an unknown one: both come back in not_found.
    it("refuses to add an id the server does not return for this site", async () => {
        fetchSuggestionStatuses.mockResolvedValueOnce({
            suggestions: [],
            not_found: ["sug_missing"],
        });

        renderPage();
        await waitFor(() => expect(screen.getByText(/No saved suggestions yet/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/Track another suggestion/i), { target: { value: "sug_missing" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        await waitFor(() =>
            expect(screen.getByText(/No doki-world-tour suggestion was found with that id/i)).toBeInTheDocument(),
        );
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("rejects a malformed id without calling the server", async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText(/No saved suggestions yet/i)).toBeInTheDocument());

        fireEvent.change(screen.getByLabelText(/Track another suggestion/i), { target: { value: "bad id!" } });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));

        expect(screen.getByText(/valid suggestion id/i)).toBeInTheDocument();
        expect(fetchSuggestionStatuses).not.toHaveBeenCalled();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("removes a row locally without refetching", async () => {
        seedSavedIds(["sug_alpha"]);
        fetchSuggestionStatuses.mockResolvedValueOnce({
            suggestions: [makeSuggestion()],
            not_found: [],
        });

        renderPage();
        await waitFor(() => expect(screen.getByText("pending")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "Remove sug_alpha from this list" }));

        expect(screen.queryByText("pending")).not.toBeInTheDocument();
        expect(screen.getByText(/No saved suggestions yet/i)).toBeInTheDocument();
        expect(fetchSuggestionStatuses).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([]);
    });
});
