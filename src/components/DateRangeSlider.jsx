import { useRef } from "react";
import { formatEventDate } from "../utils/dataLoader";
import "./DateRangeSlider.css";

const DAY = 86400000;

/**
 * A dual-handle date range slider. Handles are draggable (pointer events, so
 * mouse and touch both work), the track is tappable (moves the nearest
 * handle), and both handles are keyboard-operable sliders:
 * arrows = 1 day, shift+arrows = 7 days, PageUp/Down = 30 days, Home/End = full range.
 *
 * @param {Object} props
 * @param {number} props.min earliest selectable day (epoch ms)
 * @param {number} props.max latest selectable day (epoch ms)
 * @param {[number, number]} props.value current [start, end] (epoch ms)
 * @param {(range: [number, number]) => void} props.onChange
 */
export default function DateRangeSlider({ min, max, value, onChange }) {
    const trackRef = useRef(null);
    const [start, end] = value;

    if (max <= min) return null;

    // Snap to the nearest LOCAL midnight. Rounding to multiples of DAY would
    // snap to UTC midnights, which sit a few hours off the convention
    // dateValues (local midnights), dragging the end handle back to the far
    // right then landed just short of max and read as one day early.
    const snapToDay = (ms) => {
        const floor = new Date(ms).setHours(0, 0, 0, 0);
        if (ms - floor <= DAY / 2) return floor;
        // Aim mid-way into the next day before flooring so DST-shifted days
        // (23h/25h) still resolve to the next local midnight.
        return new Date(floor + DAY * 1.5).setHours(0, 0, 0, 0);
    };
    const clamp = (ms) => Math.min(max, Math.max(min, ms));
    const toPercent = (ms) => ((ms - min) / (max - min)) * 100;

    const positionToValue = (clientX) => {
        const rect = trackRef.current.getBoundingClientRect();
        const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return min + fraction * (max - min);
    };

    // Every path (drag, track tap, keyboard) funnels through here, so values
    // are always clamped and day-aligned before they reach the filters.
    const moveHandle = (which, ms) => {
        const snapped = clamp(snapToDay(ms));
        if (which === "start") onChange([Math.min(snapped, end), end]);
        else onChange([start, Math.max(snapped, start)]);
    };

    const handlePointerDown = (which) => (event) => {
        event.preventDefault();
        const target = event.currentTarget;
        target.setPointerCapture?.(event.pointerId);
        target.focus();
        const onMove = (moveEvent) => moveHandle(which, positionToValue(moveEvent.clientX));
        const onUp = () => {
            target.removeEventListener("pointermove", onMove);
            target.removeEventListener("pointerup", onUp);
            target.removeEventListener("pointercancel", onUp);
        };
        target.addEventListener("pointermove", onMove);
        target.addEventListener("pointerup", onUp);
        target.addEventListener("pointercancel", onUp);
    };

    // Tapping the track jumps the nearest handle to that spot.
    const handleTrackPointerDown = (event) => {
        if (event.target !== trackRef.current && !event.target.classList.contains("range-fill")) return;
        const tapped = positionToValue(event.clientX);
        const which = Math.abs(tapped - start) <= Math.abs(tapped - end) ? "start" : "end";
        moveHandle(which, tapped);
    };

    const handleKeyDown = (which) => (event) => {
        const current = which === "start" ? start : end;
        const week = event.shiftKey ? 7 * DAY : DAY;
        let next = null;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - week;
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + week;
        else if (event.key === "PageDown") next = current - 30 * DAY;
        else if (event.key === "PageUp") next = current + 30 * DAY;
        else if (event.key === "Home") next = min;
        else if (event.key === "End") next = max;
        if (next === null) return;
        event.preventDefault();
        moveHandle(which, next);
    };

    const renderHandle = (which, ms, label) => (
        <button
            type="button"
            className={`range-handle range-handle-${which}`}
            style={{ left: `${toPercent(ms)}%` }}
            role="slider"
            aria-label={label}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={ms}
            aria-valuetext={formatEventDate(ms)}
            onPointerDown={handlePointerDown(which)}
            onKeyDown={handleKeyDown(which)}
        />
    );

    return (
        <div className="date-range-slider">
            <div className="range-labels">
                <span className="range-label-title">Dates</span>
                <span className="range-label-value">
                    {formatEventDate(start)} – {formatEventDate(end)}
                </span>
            </div>
            <div className="range-track" ref={trackRef} onPointerDown={handleTrackPointerDown}>
                <div
                    className="range-fill"
                    style={{ left: `${toPercent(start)}%`, width: `${toPercent(end) - toPercent(start)}%` }}
                />
                {renderHandle("start", start, "Start date")}
                {renderHandle("end", end, "End date")}
            </div>
            <div className="range-bounds">
                <span>{formatEventDate(min)}</span>
                <span>{formatEventDate(max)}</span>
            </div>
        </div>
    );
}
