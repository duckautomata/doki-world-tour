import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Animate from "./Animate";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

const makeEvent = (id, name, dateValue, extra = {}) => ({
    event_id: id,
    date: "",
    dateValue,
    event_name: name,
    eventTypes: ["Convention"],
    place: `${name} Hall`,
    city: "City",
    country: "Country",
    latitude: 10,
    longitude: 20,
    image_id: "",
    image_ext: "",
    image_source: "",
    urlOrig: null,
    urlWebp: null,
    urlThumb: null,
    ...extra,
});

const events = [
    makeEvent("first-2024", "First Con", new Date(2024, 0, 10).getTime()),
    makeEvent("second-2024", "Second Con", new Date(2024, 5, 5).getTime(), {
        image_id: "img",
        image_ext: ".webp",
        image_source: "https://x.com/artist/status/9",
        urlOrig: "https://cdn.example/img.webp",
        urlWebp: "https://cdn.example/img_p.webp",
        urlThumb: "https://cdn.example/img_t.webp",
    }),
    makeEvent("third-2025", "Third Con", new Date(2025, 2, 20).getTime()),
];

describe("Animate", () => {
    it("starts paused on the first event", () => {
        render(<Animate data={events} />);
        expect(screen.getByRole("heading", { name: "First Con" })).toBeInTheDocument();
        expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByRole("heading", { name: "First Con" })).toBeInTheDocument();
    });

    it("advances on the timer and stops after the last event", () => {
        const { container } = render(<Animate data={events} />);
        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByRole("heading", { name: "Second Con" })).toBeInTheDocument();
        expect(container.querySelectorAll(".animate-trail-dot")).toHaveLength(1);

        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByRole("heading", { name: "Third Con" })).toBeInTheDocument();

        // Lingers on the final event, then stops.
        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByRole("heading", { name: "Third Con" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });

    it("pause stops the clock; play resumes", () => {
        render(<Animate data={events} />);
        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        fireEvent.click(screen.getByRole("button", { name: "Pause" }));
        act(() => vi.advanceTimersByTime(10000));
        expect(screen.getByRole("heading", { name: "First Con" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByRole("heading", { name: "Second Con" })).toBeInTheDocument();
    });

    it("doubles the pace at 2× speed", () => {
        render(<Animate data={events} />);
        fireEvent.click(screen.getByRole("button", { name: "2×" }));
        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByRole("heading", { name: "Second Con" })).toBeInTheDocument();
    });

    it("scrubs to any point in the timeline", () => {
        render(<Animate data={events} />);
        fireEvent.change(screen.getByLabelText("Timeline position"), { target: { value: "2" } });
        expect(screen.getByRole("heading", { name: "Third Con" })).toBeInTheDocument();
        expect(screen.getByText(/3 \/ 3/)).toBeInTheDocument();
    });

    it("restart returns to the first event and plays", () => {
        render(<Animate data={events} />);
        fireEvent.change(screen.getByLabelText("Timeline position"), { target: { value: "2" } });
        fireEvent.click(screen.getByRole("button", { name: "Restart" }));
        expect(screen.getByRole("heading", { name: "First Con" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    });

    it("opens the image modal for events with an image", () => {
        render(<Animate data={events} />);
        fireEvent.change(screen.getByLabelText("Timeline position"), { target: { value: "1" } });
        fireEvent.click(screen.getByRole("button", { name: "View image for Second Con" }));
        expect(screen.getByRole("button", { name: /Download Original/ })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Source/ })).toHaveAttribute("href", "https://x.com/artist/status/9");
    });

    it("shows a placeholder instead of an image button for imageless events", () => {
        render(<Animate data={events} />);
        expect(screen.queryByRole("button", { name: "View image for First Con" })).not.toBeInTheDocument();
        expect(document.querySelector(".animate-detail-placeholder")).toBeInTheDocument();
    });

    it("renders an empty state without events", () => {
        render(<Animate data={[]} />);
        expect(screen.getByText(/No events to play yet/)).toBeInTheDocument();
    });
});
