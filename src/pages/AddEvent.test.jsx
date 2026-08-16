import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AddEvent from "./AddEvent";
import { submitSuggestion } from "../utils/contentApi";

// Turnstile is reported disabled so the token gate opens immediately and the
// widget never mounts, the batching logic is what's under test here.
vi.mock("../utils/contentApi", () => ({
    fetchPublicConfig: vi.fn(() =>
        Promise.resolve({
            turnstile_site_key: "test-key",
            turnstile_enabled: false,
            allowed_sites: ["doki-world-tour"],
            max_image_bytes: 26214400,
            supported_formats: ["png", "jpg", "webp"],
        }),
    ),
    uploadImage: vi.fn(),
    submitSuggestion: vi.fn(() => Promise.resolve({ id: "sug_test123" })),
    validateImageFile: vi.fn(() => null),
}));

vi.mock("../components/TurnstileWidget", () => ({
    default: () => <div data-testid="turnstile" />,
}));

vi.mock("../components/UnsavedChangesGuard", () => ({
    default: () => null,
}));

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

const renderForm = async () => {
    render(
        <MemoryRouter>
            <AddEvent />
        </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/Suggest a New Event/i)).toBeInTheDocument());
};

const fillEntry = ({ name, types, date, city, country }) => {
    fireEvent.change(screen.getByLabelText(/Event Name/), { target: { value: name } });
    // Toggle checkboxes to exactly match the requested type list.
    screen
        .getAllByRole("checkbox")
        .filter((box) => box.checked !== types.includes(box.closest("label").textContent.trim()))
        .forEach((box) => fireEvent.click(box));
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: date } });
    fireEvent.change(screen.getByLabelText(/^City/), { target: { value: city } });
    fireEvent.change(screen.getByLabelText(/^Country/), { target: { value: country } });
};

const conA = {
    name: "Con A",
    types: ["Convention"],
    date: "2027-03-15",
    city: "Tokyo",
    country: "Japan",
};
const conB = {
    name: "Con B",
    types: ["Concert", "Meet & Greet"],
    date: "2027-04-01",
    city: "Osaka",
    country: "Japan",
};

describe("AddEvent", () => {
    it("submits a single filled form with the original flat payload", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: "Submit Suggestion" }));
        fireEvent.click(screen.getByRole("button", { name: "Submit" })); // confirm modal

        await waitFor(() => expect(screen.getByText(/Thanks!/)).toBeInTheDocument());
        expect(submitSuggestion).toHaveBeenCalledTimes(1);
        const call = submitSuggestion.mock.calls[0][0];
        expect(call.kind).toBe("new");
        expect(call.payload.event_name).toBe("Con A");
        expect(call.payload.event_type).toEqual(["Convention"]);
        expect(call.payload.date).toBe("3/15/2027");
        expect(call.payload.events).toBeUndefined();
        expect(call.summary).toBe("Add the event 'Con A'");
    });

    it("requires at least one event type before an entry is valid", async () => {
        await renderForm();
        fillEntry({ ...conA, types: [] });
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeDisabled();
        fireEvent.click(screen.getByRole("checkbox", { name: "Convention" }));
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeEnabled();
    });

    it("has no coordinate fields and sends no coordinates in the payload", async () => {
        await renderForm();
        expect(screen.queryByLabelText(/Latitude/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Longitude/)).not.toBeInTheDocument();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: "Submit Suggestion" }));
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
        const call = submitSuggestion.mock.calls[0][0];
        expect(call.payload).not.toHaveProperty("latitude");
        expect(call.payload).not.toHaveProperty("longitude");
    });

    it("queues entries with Add to list and submits them as one batch", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
        expect(screen.getByText("Queued events (1)", { exact: false })).toBeInTheDocument();
        expect(screen.getByLabelText(/Event Name/)).toHaveValue(""); // form cleared

        fillEntry(conB);
        fireEvent.click(screen.getByRole("button", { name: /Add another/ }));
        expect(screen.getByText("Queued events (2)", { exact: false })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Submit 2 Events" }));
        fireEvent.click(screen.getByRole("button", { name: "Submit" })); // confirm modal

        await waitFor(() => expect(screen.getByText(/Thanks!/)).toBeInTheDocument());
        expect(screen.getByText(/2 event suggestions have been submitted/)).toBeInTheDocument();
        const call = submitSuggestion.mock.calls[0][0];
        expect(call.payload.events).toHaveLength(2);
        expect(call.payload.events.map((e) => e.event_name)).toEqual(["Con A", "Con B"]);
        expect(call.payload.events[1].event_type).toEqual(["Concert", "Meet & Greet"]);
        expect(call.summary).toBe("Add 2 events: 'Con A', 'Con B'");
    });

    it("includes a valid in-form entry alongside the queue on submit", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
        fillEntry(conB); // left in the form, not queued

        fireEvent.click(screen.getByRole("button", { name: "Submit 2 Events" }));
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
        const call = submitSuggestion.mock.calls[0][0];
        expect(call.payload.events.map((e) => e.event_name)).toEqual(["Con A", "Con B"]);
    });

    it("blocks submission while a queued batch has an incomplete entry in the form", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
        fireEvent.change(screen.getByLabelText(/Event Name/), { target: { value: "Half-finished" } });

        expect(screen.getByText(/incomplete. Finish it, add it to the list, or clear it/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeDisabled();
    });

    it("removes a queued entry with its remove button", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
        fireEvent.click(screen.getByRole("button", { name: "Remove Con A" }));
        expect(screen.queryByText(/Queued events/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeDisabled();
    });

    it("sends media links with the event and fills the platform from the URL", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: "+ Add a link" }));
        fireEvent.change(screen.getByLabelText("Description for media"), { target: { value: "Panel VOD" } });
        fireEvent.change(screen.getByLabelText("Link for Panel VOD"), {
            target: { value: "https://www.youtube.com/watch?v=abc" },
        });
        expect(screen.getByLabelText("Platform for Panel VOD")).toHaveValue("YouTube");

        fireEvent.click(screen.getByRole("button", { name: "Submit Suggestion" }));
        fireEvent.click(screen.getByRole("button", { name: "Submit" }));

        await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
        expect(submitSuggestion.mock.calls[0][0].payload.media).toEqual([
            { description: "Panel VOD", source: "https://www.youtube.com/watch?v=abc", platform: "YouTube" },
        ]);
    });

    it("blocks submission while a media link is missing its URL", async () => {
        await renderForm();
        fillEntry(conA);
        fireEvent.click(screen.getByRole("button", { name: "+ Add a link" }));

        expect(screen.getByText(/Every link needs a URL and a platform/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("Link for media"), {
            target: { value: "https://www.twitch.tv/videos/1" },
        });
        expect(screen.getByRole("button", { name: "Submit Suggestion" })).toBeEnabled();
    });

    it("drops a media row with its remove button", async () => {
        await renderForm();
        fireEvent.click(screen.getByRole("button", { name: "+ Add a link" }));
        fireEvent.click(screen.getByRole("button", { name: "Remove media" }));
        expect(screen.queryByLabelText("Link for media")).not.toBeInTheDocument();
    });

    it("loads a queued entry back into the form for editing", async () => {
        await renderForm();
        fillEntry(conB);
        fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
        fireEvent.click(screen.getByRole("button", { name: "Edit Con B" }));

        expect(screen.queryByText(/Queued events/)).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Event Name/)).toHaveValue("Con B");
        expect(screen.getByLabelText(/^City/)).toHaveValue("Osaka");
        expect(screen.getByRole("checkbox", { name: "Concert" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Meet & Greet" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Convention" })).not.toBeChecked();
    });
});
