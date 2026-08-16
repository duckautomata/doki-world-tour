import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EditEvent from "./EditEvent";
import { submitSuggestion } from "../utils/contentApi";

// Turnstile is reported disabled so the token gate opens immediately and the
// widget never mounts; the media diffing is what's under test here.
vi.mock("../utils/contentApi", () => ({
    fetchPublicConfig: vi.fn(() =>
        Promise.resolve({
            turnstile_site_key: "test-key",
            turnstile_enabled: false,
            allowed_sites: ["doki-world-tour"],
            max_image_bytes: 26214400,
            supported_formats: ["png", "jpg", "webp", "mp4"],
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

const event = {
    event_id: "2026-dokomi",
    date: "5/30/2026",
    dateValue: new Date(2026, 4, 30).getTime(),
    event_name: "Dokomi 2026",
    eventTypes: ["Convention"],
    place: "CCD Congress Center",
    city: "Düsseldorf",
    country: "Germany",
    latitude: 51.2559613,
    longitude: 6.7417614,
    image_id: "",
    image_ext: "",
    image_source: "",
    urlOrig: null,
    urlWebp: null,
    urlThumb: null,
    media: [
        {
            index: 0,
            kind: "link",
            description: "Panel VOD",
            source: "https://www.youtube.com/watch?v=abc",
            platform: "YouTube",
            credit: "",
            media_id: "",
            media_ext: "",
            urlOrig: null,
            urlWebp: null,
            urlThumb: null,
        },
        {
            index: 1,
            kind: "upload",
            description: "Booth photo",
            source: "",
            platform: "",
            credit: "@someartist",
            media_id: "phOtO1",
            media_ext: ".jpg",
            urlOrig: "https://cdn.example/phOtO1.jpg",
            urlWebp: "https://cdn.example/phOtO1_p.webp",
            urlThumb: "https://cdn.example/phOtO1_t.webp",
        },
    ],
};

const renderForm = async () => {
    render(
        <MemoryRouter initialEntries={["/edit/2026-dokomi"]}>
            <Routes>
                <Route path="/edit/:event_id" element={<EditEvent data={[event]} />} />
            </Routes>
        </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/Suggest a Correction/i)).toBeInTheDocument());
};

const submit = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Submit Correction" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit" })); // confirm modal
    await waitFor(() => expect(submitSuggestion).toHaveBeenCalledTimes(1));
    return submitSuggestion.mock.calls[0][0];
};

describe("EditEvent media", () => {
    it("lists the event's current media and starts with nothing to submit", async () => {
        await renderForm();
        expect(screen.getByLabelText("Link for Panel VOD")).toHaveValue("https://www.youtube.com/watch?v=abc");
        expect(screen.getByLabelText("Credit for Booth photo")).toHaveValue("@someartist");
        expect(screen.getByRole("button", { name: "Submit Correction" })).toBeDisabled();
    });

    it("sends only the media rows whose details changed", async () => {
        await renderForm();
        fireEvent.change(screen.getByLabelText("Credit for Booth photo"), { target: { value: "@otherartist" } });

        const call = await submit();
        expect(call.payload.edited_media).toEqual([
            {
                media_index: 1,
                media_id: "phOtO1",
                description: "Booth photo",
                source: "",
                platform: "",
                credit: "@otherartist",
            },
        ]);
        expect(call.payload.deleted_media).toBeUndefined();
        expect(call.summary).toBe("Update the media details on 'Dokomi 2026'");
    });

    it("marks a media row for removal, and can undo it", async () => {
        await renderForm();
        fireEvent.click(screen.getByRole("button", { name: "Mark Panel VOD for deletion" }));
        expect(screen.getAllByText("Will request deletion")).toHaveLength(1);

        fireEvent.click(screen.getByRole("button", { name: "Undo deletion of Panel VOD" }));
        expect(screen.queryByText("Will request deletion")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit Correction" })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "Mark Panel VOD for deletion" }));
        const call = await submit();
        expect(call.payload.deleted_media).toEqual([
            {
                media_index: 0,
                media_id: "",
                source: "https://www.youtube.com/watch?v=abc",
                description: "Panel VOD",
            },
        ]);
    });

    it("adds a new media link", async () => {
        await renderForm();
        fireEvent.click(screen.getByRole("button", { name: "+ Add a link" }));
        fireEvent.change(screen.getByLabelText("Link for media"), {
            target: { value: "https://www.twitch.tv/videos/1" },
        });
        fireEvent.change(screen.getByLabelText("Description for https://www.twitch.tv/videos/1"), {
            target: { value: "Stream VOD" },
        });

        const call = await submit();
        expect(call.payload.new_media).toEqual([
            { description: "Stream VOD", source: "https://www.twitch.tv/videos/1", platform: "Twitch" },
        ]);
        expect(call.summary).toBe("Update the new media on 'Dokomi 2026'");
    });

    it("blocks submission while a new link is missing its platform", async () => {
        await renderForm();
        fireEvent.click(screen.getByRole("button", { name: "+ Add a link" }));
        fireEvent.change(screen.getByLabelText("Link for media"), { target: { value: "https://example.com/post" } });

        expect(screen.getByText(/Every link needs a URL and a platform/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Submit Correction" })).toBeDisabled();

        fireEvent.change(screen.getByLabelText("Platform for https://example.com/post"), {
            target: { value: "Facebook" },
        });
        expect(screen.getByRole("button", { name: "Submit Correction" })).toBeEnabled();
    });
});
