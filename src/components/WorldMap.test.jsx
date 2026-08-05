import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WorldMap from "./WorldMap";

const groups = [
    {
        key: "Los Angeles|USA",
        city: "Los Angeles",
        country: "USA",
        latitude: 34.06,
        longitude: -118.28,
        events: [
            // Relative to "now" so the upcoming test stays truthful over time.
            { event_id: "a", dateValue: Date.now() + 30 * 86400000 },
            { event_id: "b", dateValue: Date.now() + 60 * 86400000 },
        ],
    },
    {
        key: "Düsseldorf|Germany",
        city: "Düsseldorf",
        country: "Germany",
        latitude: 51.26,
        longitude: 6.74,
        events: [{ event_id: "c", dateValue: new Date(2020, 4, 30).getTime() }],
    },
];

describe("WorldMap", () => {
    it("renders a marker per city group with a count badge on multi-event cities", () => {
        const { container } = render(<WorldMap groups={groups} selectedKey={null} onSelect={() => {}} />);
        expect(container.querySelectorAll(".map-marker")).toHaveLength(2);
        expect(screen.getByText("2")).toBeInTheDocument(); // LA count badge
        expect(screen.getByText(/Los Angeles, USA: 2 events/)).toBeInTheDocument();
    });

    it("selects a marker on click and deselects on background click", () => {
        const onSelect = vi.fn();
        const { container } = render(<WorldMap groups={groups} selectedKey={null} onSelect={onSelect} />);
        fireEvent.click(container.querySelector(".map-marker"));
        expect(onSelect).toHaveBeenCalledWith("Los Angeles|USA");
        fireEvent.click(container.querySelector(".map-sphere"));
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it("marks cities with future events as upcoming", () => {
        const { container } = render(<WorldMap groups={groups} selectedKey={null} onSelect={() => {}} />);
        const markers = container.querySelectorAll(".map-marker");
        expect(markers[0].classList.contains("upcoming")).toBe(true);
        expect(markers[1].classList.contains("upcoming")).toBe(false);
    });

    it("renders zoom controls", () => {
        render(<WorldMap groups={[]} selectedKey={null} onSelect={() => {}} />);
        expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reset view" })).toBeInTheDocument();
    });
});
