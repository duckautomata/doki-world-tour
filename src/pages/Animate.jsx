import { useEffect, useState } from "react";
import AnimateMap from "../components/AnimateMap";
import ImageModal from "../components/ImageModal";
import { formatEventDate } from "../utils/dataLoader";
import "./Animate.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

// How long each event stays on screen at 1× speed.
const BASE_MS = 2000;
const SPEEDS = [1, 2, 4];

/**
 * The timelapse page: plays through every event in date order on a world
 * map, with the active event's details and image beside it.
 *
 * @param {Object} props
 * @param {EventData[]} props.data all events, sorted by date ascending
 */
export default function Animate({ data }) {
    const [index, setIndex] = useState(0);
    // Starts paused; the visitor presses play when they're ready.
    const [playing, setPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [modalOpen, setModalOpen] = useState(false);

    const events = data;
    const active = events[index];

    // Advance while playing; linger on the final event, then stop.
    useEffect(() => {
        if (!playing || events.length === 0) return undefined;
        const timer = setTimeout(() => {
            if (index >= events.length - 1) setPlaying(false);
            else setIndex((i) => i + 1);
        }, BASE_MS / speed);
        return () => clearTimeout(timer);
    }, [playing, index, speed, events.length]);

    if (!events.length) {
        return (
            <div className="animate-page">
                <div className="empty-state glass-panel">
                    <p>No events to play yet.</p>
                </div>
            </div>
        );
    }

    const togglePlay = () => {
        // Play at the end restarts the show.
        if (!playing && index >= events.length - 1) setIndex(0);
        setPlaying(!playing);
    };

    const restart = () => {
        setIndex(0);
        setPlaying(true);
    };

    return (
        <div className="animate-page">
            <div className="animate-layout">
                <section className="animate-map-panel glass-panel">
                    <AnimateMap events={events} activeIndex={index} />
                    <div className="animate-controls">
                        <button className="animate-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                            {playing ? "⏸" : "▶"}
                        </button>
                        <button className="animate-btn" onClick={restart} aria-label="Restart">
                            ⟲
                        </button>
                        <input
                            className="animate-scrubber"
                            type="range"
                            min={0}
                            max={events.length - 1}
                            value={index}
                            onChange={(e) => setIndex(Number(e.target.value))}
                            aria-label="Timeline position"
                        />
                        <div className="animate-speeds">
                            {SPEEDS.map((s) => (
                                <button
                                    key={s}
                                    className={`animate-speed-btn${speed === s ? " active" : ""}`}
                                    onClick={() => setSpeed(s)}
                                    aria-pressed={speed === s}
                                >
                                    {s}×
                                </button>
                            ))}
                        </div>
                        <span className="animate-progress">
                            {index + 1} / {events.length} · {formatEventDate(active.dateValue)}
                        </span>
                    </div>
                </section>

                <aside className="animate-detail glass-panel" key={active.event_id}>
                    <div className="animate-detail-media">
                        {active.urlWebp ? (
                            <button
                                type="button"
                                className="animate-detail-image-btn"
                                onClick={() => setModalOpen(true)}
                                aria-label={`View image for ${active.event_name}`}
                            >
                                <img src={active.urlWebp} alt={active.event_name} className="animate-detail-image" />
                            </button>
                        ) : (
                            <div className="animate-detail-placeholder">
                                <span>{active.event_name.charAt(0)}</span>
                            </div>
                        )}
                    </div>
                    <div className="animate-detail-body">
                        <span className="animate-detail-date">{formatEventDate(active.dateValue)}</span>
                        <h2 className="animate-detail-name">{active.event_name}</h2>
                        {active.eventTypes.length > 0 && (
                            <div className="animate-detail-types">
                                {active.eventTypes.map((type) => (
                                    <span key={type} className="animate-detail-type-chip">
                                        {type}
                                    </span>
                                ))}
                            </div>
                        )}
                        {active.place && <p className="animate-detail-venue">{active.place}</p>}
                        <p className="animate-detail-location">
                            {active.city}, {active.country}
                        </p>
                    </div>
                </aside>
            </div>
            {modalOpen && <ImageModal event={active} onClose={() => setModalOpen(false)} />}
        </div>
    );
}
