import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import View from "./View";
import { useAppStore } from "../store/store";

beforeEach(() => {
    useAppStore.setState({ selectedCityKey: null });
});

const media = [
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
];

const event = {
    event_id: "2026-dokomi",
    date: "5/30/2026",
    dateValue: new Date(2026, 4, 30).getTime(),
    event_name: "Dokomi 2026",
    eventTypes: ["Convention", "Meet & Greet"],
    place: "CCD Congress Center",
    city: "Düsseldorf",
    country: "Germany",
    latitude: 51.2559613,
    longitude: 6.7417614,
    image_id: "abc",
    image_ext: ".webp",
    image_source: "https://x.com/dokibird/status/1",
    urlOrig: "https://cdn.example/abc.webp",
    urlWebp: "https://cdn.example/abc_p.webp",
    urlThumb: "https://cdn.example/abc_t.webp",
    media,
};

const bare = { ...event, event_id: "2026-bare", event_name: "Bare Event", media: [], urlOrig: null, urlWebp: null };

const renderView = (eventId) =>
    render(
        <MemoryRouter initialEntries={[`/view/${eventId}`]}>
            <Routes>
                <Route path="/view/:event_id" element={<View data={[event, bare]} />} />
                <Route path="/" element={<div>map page</div>} />
            </Routes>
        </MemoryRouter>,
    );

describe("View", () => {
    it("shows the event's details", () => {
        renderView("2026-dokomi");
        expect(screen.getByRole("heading", { name: "Dokomi 2026" })).toBeInTheDocument();
        expect(screen.getByText("CCD Congress Center")).toBeInTheDocument();
        expect(screen.getByText("Düsseldorf, Germany")).toBeInTheDocument();
        expect(screen.getByText("Convention")).toBeInTheDocument();
        expect(screen.getByText("Meet & Greet")).toBeInTheDocument();
        expect(screen.getByText(/May 30, 2026/)).toBeInTheDocument();
    });

    it("links to the edit form", () => {
        renderView("2026-dokomi");
        expect(screen.getByRole("link", { name: /Suggest edit/ })).toHaveAttribute("href", "/edit/2026-dokomi");
    });

    it("lists uploaded media and links separately", () => {
        renderView("2026-dokomi");
        expect(screen.getByRole("button", { name: "View Booth photo" })).toBeInTheDocument();
        const link = screen.getByRole("link", { name: /Panel VOD/ });
        expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc");
        expect(link).toHaveTextContent("YouTube");
    });

    it("opens the media modal on an uploaded item", () => {
        renderView("2026-dokomi");
        fireEvent.click(screen.getByRole("button", { name: "View Booth photo" }));
        expect(screen.getByRole("button", { name: /Download Original/ })).toBeInTheDocument();
        // The heading image comes first in the gallery, so this is the second of two.
        expect(screen.getByText("2 / 2")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("button", { name: /Download Original/ })).not.toBeInTheDocument();
    });

    it("selects the event's city and returns to the map with Show on map", () => {
        renderView("2026-dokomi");
        fireEvent.click(screen.getByRole("button", { name: "Show on map" }));
        expect(useAppStore.getState().selectedCityKey).toBe("Düsseldorf|Germany");
        expect(screen.getByText("map page")).toBeInTheDocument();
    });

    it("invites a suggestion when the event has no media", () => {
        renderView("2026-bare");
        expect(screen.getByText(/No media has been added/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Suggest them/ })).toHaveAttribute("href", "/edit/2026-bare");
    });

    it("shows a not-found card for an unknown id", () => {
        renderView("nope");
        expect(screen.getByRole("heading", { name: "Event not found" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Back to Map/ })).toHaveAttribute("href", "/");
    });
});
