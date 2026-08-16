import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "./Home";
import { useAppStore } from "../store/store";

// jsdom implements neither of these; the map component guards on their
// existence but scrollIntoView is called directly by "Show on map".
beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    useAppStore.setState({
        searchText: "",
        dateRange: null,
        filterCountry: "",
        filterEventType: "",
        selectedCityKey: null,
        showList: false,
    });
});

const events = [
    {
        event_id: "dokomi-2026",
        date: "5/30/2026",
        dateValue: new Date(2026, 4, 30).getTime(),
        event_name: "Dokomi",
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
    },
    {
        event_id: "rewind-time-2026",
        date: "7/4/2026",
        dateValue: new Date(2026, 6, 4).getTime(),
        event_name: "Rewind Time",
        eventTypes: ["Concert", "Meet & Greet"],
        place: "The Vermont Hollywood",
        city: "Los Angeles",
        country: "USA",
        latitude: 34.0903998,
        longitude: -118.2914843,
        image_id: "abc",
        image_ext: ".webp",
        image_source: "https://x.com/dokibird/status/123",
        urlOrig: "https://cdn.example/abc.webp",
        urlWebp: "https://cdn.example/abc_p.webp",
        urlThumb: "https://cdn.example/abc_t.webp",
    },
];

const renderHome = () =>
    render(
        <MemoryRouter>
            <Home data={events} />
        </MemoryRouter>,
    );

const openList = () => fireEvent.click(screen.getByRole("button", { name: /Show event list/ }));

describe("Home", () => {
    it("renders the map and filters with the list collapsed by default", () => {
        renderHome();
        expect(screen.getByRole("img", { name: /world map of events/i })).toBeInTheDocument();
        expect(screen.getByText(/Showing 2 of 2 events/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Show event list (2)" })).toBeInTheDocument();
        expect(screen.queryByText("Dokomi")).not.toBeInTheDocument();
    });

    it("expands and collapses the event list with the toggle", () => {
        renderHome();
        openList();
        expect(screen.getByText("Dokomi")).toBeInTheDocument();
        expect(screen.getByText("Rewind Time")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Hide event list" }));
        expect(screen.queryByText("Dokomi")).not.toBeInTheDocument();
    });

    it("shows event type chips on cards", () => {
        const { container } = renderHome();
        openList();
        const chips = [...container.querySelectorAll(".event-card-type-chip")].map((c) => c.textContent);
        expect(chips).toEqual(["Convention", "Concert", "Meet & Greet"]);
    });

    it("filters the list by search text, including event types", () => {
        renderHome();
        openList();
        fireEvent.change(screen.getByLabelText("Search events"), { target: { value: "concert" } });
        expect(screen.getByText("Rewind Time")).toBeInTheDocument();
        expect(screen.queryByText("Dokomi")).not.toBeInTheDocument();
        expect(screen.getByText(/Showing 1 of 2 events/)).toBeInTheDocument();
    });

    it("filters by event type with the dropdown", () => {
        renderHome();
        openList();
        const select = screen.getByLabelText("Filter by event type");
        fireEvent.change(select, { target: { value: "Convention" } });
        expect(screen.getByText("Dokomi")).toBeInTheDocument();
        expect(screen.queryByText("Rewind Time")).not.toBeInTheDocument();
        expect(screen.getByText(/Showing 1 of 2 events/)).toBeInTheDocument();
    });

    it("filters by country with the dropdown", () => {
        renderHome();
        openList();
        const select = screen.getByLabelText("Filter by country");
        expect([...select.options].map((o) => o.textContent)).toEqual(["All countries", "Germany", "USA"]);
        fireEvent.change(select, { target: { value: "USA" } });
        expect(screen.getByText("Rewind Time")).toBeInTheDocument();
        expect(screen.queryByText("Dokomi")).not.toBeInTheDocument();
    });

    it("clears every filter with Reset filters", () => {
        renderHome();
        fireEvent.change(screen.getByLabelText("Filter by country"), { target: { value: "Germany" } });
        fireEvent.change(screen.getByLabelText("Filter by event type"), { target: { value: "Convention" } });
        expect(screen.getByText(/Showing 1 of 2 events/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
        expect(screen.getByText(/Showing 2 of 2 events/)).toBeInTheDocument();
        expect(screen.getByLabelText("Filter by country")).toHaveValue("");
        expect(screen.getByLabelText("Filter by event type")).toHaveValue("");
    });

    it("shows the empty state with an add link when nothing matches", () => {
        renderHome();
        openList();
        fireEvent.change(screen.getByLabelText("Search events"), { target: { value: "zzz" } });
        expect(screen.getByText(/No events match/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Suggest it/ })).toHaveAttribute("href", "/add");
    });

    it("opens the city sheet when a card's Show on map is clicked", () => {
        renderHome();
        openList();
        fireEvent.click(screen.getAllByRole("button", { name: "Show on map" })[0]);
        const sheet = screen.getByRole("dialog", { name: /Events in Düsseldorf/ });
        expect(sheet).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("links each event to its view page", () => {
        renderHome();
        openList();
        expect(screen.getAllByRole("link", { name: "View details" })[0]).toHaveAttribute("href", "/view/dokomi-2026");
    });

    it("opens the image modal from a card image, showing its source link", () => {
        renderHome();
        openList();
        fireEvent.click(screen.getByRole("button", { name: "View image for Rewind Time" }));
        expect(screen.getByRole("button", { name: /Download Original/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Source/ })).toHaveAttribute(
            "href",
            "https://x.com/dokibird/status/123",
        );
        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(screen.queryByRole("button", { name: /Download Original/ })).not.toBeInTheDocument();
    });

    it("has no image button on cards without an image", () => {
        renderHome();
        openList();
        expect(screen.queryByRole("button", { name: "View image for Dokomi" })).not.toBeInTheDocument();
    });

    it("links the city sheet's View button to the event's view page", () => {
        const { container } = renderHome();
        // Tap the Düsseldorf marker (first group, list still collapsed).
        fireEvent.click(container.querySelector(".map-marker"));
        expect(screen.getByRole("link", { name: "View Dokomi" })).toHaveAttribute("href", "/view/dokomi-2026");
    });
});
