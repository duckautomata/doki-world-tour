import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DateRangeSlider from "./DateRangeSlider";

const DAY = 86400000;
const MIN = new Date(2026, 0, 1).getTime();
const MAX = new Date(2026, 11, 31).getTime();

describe("DateRangeSlider", () => {
    it("renders both handles with accessible values", () => {
        render(<DateRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={() => {}} />);
        const sliders = screen.getAllByRole("slider");
        expect(sliders).toHaveLength(2);
        expect(screen.getByLabelText("Start date")).toHaveAttribute("aria-valuenow", String(MIN));
        expect(screen.getByLabelText("End date")).toHaveAttribute("aria-valuenow", String(MAX));
    });

    it("moves the start handle by one day with arrow keys", () => {
        const onChange = vi.fn();
        render(<DateRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={onChange} />);
        fireEvent.keyDown(screen.getByLabelText("Start date"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenCalledWith([MIN + DAY, MAX]);
    });

    it("clamps the end handle to the range bounds", () => {
        const onChange = vi.fn();
        render(<DateRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={onChange} />);
        fireEvent.keyDown(screen.getByLabelText("End date"), { key: "ArrowRight" });
        expect(onChange).toHaveBeenCalledWith([MIN, MAX]);
    });

    it("never lets the handles cross", () => {
        const onChange = vi.fn();
        render(<DateRangeSlider min={MIN} max={MAX} value={[MIN, MIN + DAY]} onChange={onChange} />);
        fireEvent.keyDown(screen.getByLabelText("End date"), { key: "Home" });
        expect(onChange).toHaveBeenCalledWith([MIN, MIN]);
    });

    it("jumps to the bounds with Home and End", () => {
        const onChange = vi.fn();
        render(<DateRangeSlider min={MIN} max={MAX} value={[MIN + 30 * DAY, MAX - 30 * DAY]} onChange={onChange} />);
        fireEvent.keyDown(screen.getByLabelText("Start date"), { key: "Home" });
        expect(onChange).toHaveBeenCalledWith([MIN, MAX - 30 * DAY]);
    });

    it("renders nothing for a degenerate range", () => {
        const { container } = render(<DateRangeSlider min={MIN} max={MIN} value={[MIN, MIN]} onChange={() => {}} />);
        expect(container).toBeEmptyDOMElement();
    });

    // Regression: snapping used to round to UTC day multiples, so in western
    // timezones dragging the end handle to the far right landed a few hours
    // short of max, displayed and filtered as one day early.
    it("snaps dragged values to exact local midnights, reaching max at the far right", () => {
        const onChange = vi.fn();
        const { container } = render(
            <DateRangeSlider min={MIN} max={MAX} value={[MIN, MIN + 100 * DAY]} onChange={onChange} />,
        );
        const track = container.querySelector(".range-track");
        vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
            left: 0,
            right: 1000,
            width: 1000,
            top: 0,
            bottom: 6,
            height: 6,
        });
        const endHandle = screen.getByLabelText("End date");

        fireEvent.pointerDown(endHandle, { pointerId: 1, clientX: 300 });
        fireEvent.pointerMove(endHandle, { pointerId: 1, clientX: 1000 });
        expect(onChange).toHaveBeenLastCalledWith([MIN, MAX]);

        fireEvent.pointerMove(endHandle, { pointerId: 1, clientX: 500 });
        const [, midValue] = onChange.mock.calls.at(-1)[0];
        const midDate = new Date(midValue);
        expect(midDate.getHours()).toBe(0);
        expect(midDate.getMinutes()).toBe(0);

        fireEvent.pointerUp(endHandle, { pointerId: 1 });
    });
});
