import { Link } from "react-router-dom";
import { formatEventDate } from "../utils/dataLoader";
import "./CitySheet.css";

/**
 * @typedef {import("../store/types").CityGroup} CityGroup
 */

/**
 * Overlay card listing every event at the selected city marker.
 * Anchored to the bottom of the map: a bottom sheet on phones, a floating
 * card on wider screens.
 *
 * @param {Object} props
 * @param {CityGroup} props.group the selected city group
 * @param {() => void} props.onClose
 */
export default function CitySheet({ group, onClose }) {
    const count = group.events.length;

    return (
        <div className="city-sheet glass-panel" role="dialog" aria-label={`Events in ${group.city}`}>
            <header className="city-sheet-header">
                <div>
                    <h3 className="city-sheet-title">{group.city}</h3>
                    <span className="city-sheet-subtitle">
                        {group.country} · {count} event{count > 1 ? "s" : ""}
                    </span>
                </div>
                <button className="city-sheet-close" onClick={onClose} aria-label="Close">
                    ✕
                </button>
            </header>
            <ul className="city-sheet-list">
                {group.events.map((event) => (
                    <li key={event.event_id} className="city-sheet-item">
                        {event.urlThumb ? (
                            <img
                                className="city-sheet-thumb"
                                src={event.urlThumb}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                    e.target.style.visibility = "hidden";
                                }}
                            />
                        ) : (
                            <div className="city-sheet-thumb city-sheet-thumb-placeholder">
                                {event.event_name.charAt(0)}
                            </div>
                        )}
                        <div className="city-sheet-item-info">
                            <span className="city-sheet-item-name">{event.event_name}</span>
                            <span className="city-sheet-item-date">{formatEventDate(event.dateValue)}</span>
                            {event.eventTypes.length > 0 && (
                                <span className="city-sheet-item-types">{event.eventTypes.join(" · ")}</span>
                            )}
                            {event.place && <span className="city-sheet-item-venue">{event.place}</span>}
                        </div>
                        <Link
                            className="city-sheet-item-view"
                            to={`/view/${event.event_id}`}
                            aria-label={`View ${event.event_name}`}
                        >
                            View
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
