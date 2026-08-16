import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatEventDate, headingMediaItem } from "../utils/dataLoader";
import ImageModal from "./ImageModal";
import "./EventCard.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

/**
 * EventCard shows one event in the list under the map. Clicking the image
 * opens it full-size in the image modal.
 *
 * @param {Object} props
 * @param {EventData} props.event
 * @param {() => void} props.onShowOnMap selects this event's city marker
 */
export default function EventCard({ event, onShowOnMap }) {
    const [modalOpen, setModalOpen] = useState(false);
    const isUpcoming = event.dateValue >= new Date().setHours(0, 0, 0, 0);
    const heading = useMemo(() => headingMediaItem(event), [event]);

    return (
        <article id={`event-${event.event_id}`} className="event-card glass-panel">
            <div className="event-card-media">
                {event.urlWebp && (
                    <button
                        type="button"
                        className="event-card-image-btn"
                        onClick={() => setModalOpen(true)}
                        aria-label={`View image for ${event.event_name}`}
                    >
                        <img
                            src={event.urlWebp}
                            alt={event.event_name}
                            className="event-card-image"
                            loading="lazy"
                            onError={(e) => {
                                const placeholder = e.target
                                    .closest(".event-card-media")
                                    .querySelector(".event-card-placeholder");
                                e.target.closest(".event-card-image-btn").style.display = "none";
                                placeholder.style.display = "flex";
                            }}
                        />
                    </button>
                )}
                <div className="event-card-placeholder" style={{ display: event.urlWebp ? "none" : "flex" }}>
                    <span>{event.event_name.charAt(0)}</span>
                </div>
                <span className={`event-card-date ${isUpcoming ? "upcoming" : "visited"}`}>
                    {isUpcoming ? "Upcoming · " : ""}
                    {formatEventDate(event.dateValue)}
                </span>
            </div>
            <div className="event-card-body">
                <h3 className="event-card-name">{event.event_name}</h3>
                {event.eventTypes.length > 0 && (
                    <div className="event-card-types">
                        {event.eventTypes.map((type) => (
                            <span key={type} className="event-card-type-chip">
                                {type}
                            </span>
                        ))}
                    </div>
                )}
                {event.place && <p className="event-card-venue">{event.place}</p>}
                <p className="event-card-location">
                    {event.city}, {event.country}
                </p>
            </div>
            <div className="event-card-actions">
                <button className="event-card-map-btn" onClick={onShowOnMap}>
                    Show on map
                </button>
                <Link className="event-card-view" to={`/view/${event.event_id}`}>
                    View details
                </Link>
            </div>
            {modalOpen && heading && (
                <ImageModal items={[heading]} selectedIndex={0} onClose={() => setModalOpen(false)} />
            )}
        </article>
    );
}
