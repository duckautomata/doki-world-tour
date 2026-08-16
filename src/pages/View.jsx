import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../store/store";
import { formatEventDate, headingMediaItem } from "../utils/dataLoader";
import ImageModal from "../components/ImageModal";
import { isUrl } from "../utils/textUtils";
import notFoundImage from "../assets/404.png";
import "./View.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 * @typedef {import("../store/types").MediaItem} MediaItem
 */

/**
 * Renders one media link as a card. The source is only made clickable when it
 * really is a URL, so a stray note in the column never becomes a dead link.
 *
 * @param {Object} props
 * @param {MediaItem} props.item
 */
function MediaLinkCard({ item }) {
    const href = item.source.startsWith("www.") ? `https://${item.source}` : item.source;
    const body = (
        <>
            <span className="media-link-platform">{item.platform || "Link"}</span>
            <span className="media-link-body">
                {item.description && <span className="media-link-description">{item.description}</span>}
                <span className="media-link-source">{item.source}</span>
            </span>
        </>
    );

    if (!isUrl(item.source)) {
        return <div className="media-link glass-panel">{body}</div>;
    }

    return (
        <a className="media-link glass-panel" href={href} target="_blank" rel="noreferrer">
            {body}
            <span className="media-link-arrow" aria-hidden="true">
                ↗
            </span>
        </a>
    );
}

/**
 * The event detail page: everything the map list shows plus every piece of
 * media attached to the event, uploads first and then links.
 *
 * @param {Object} props
 * @param {EventData[]} props.data
 */
export default function View({ data }) {
    const { event_id } = useParams();
    const navigate = useNavigate();
    const setSelectedCityKey = useAppStore((state) => state.setSelectedCityKey);

    const event = useMemo(() => data.find((e) => e.event_id === event_id), [data, event_id]);
    const [selectedIndex, setSelectedIndex] = useState(null);

    const heading = useMemo(() => (event ? headingMediaItem(event) : null), [event]);
    const uploads = useMemo(() => (event?.media ?? []).filter((m) => m.kind === "upload"), [event]);
    const links = useMemo(() => (event?.media ?? []).filter((m) => m.kind === "link"), [event]);

    // The heading image shares the gallery modal with the uploads, and comes
    // first because that is the order they appear on the page.
    const viewable = useMemo(() => (heading ? [heading, ...uploads] : uploads), [heading, uploads]);

    if (!event) {
        return (
            <div className="view-page">
                <Link to="/" className="view-back">
                    <span className="back-arrow">←</span> Back to Map
                </Link>
                <div className="view-not-found glass-panel">
                    <img src={notFoundImage} alt="Not found" className="not-found-image" />
                    <h1>Event not found</h1>
                    <p>
                        No event was found with id <code>{event_id}</code>.
                    </p>
                </div>
            </div>
        );
    }

    const isUpcoming = event.dateValue >= new Date().setHours(0, 0, 0, 0);

    const showOnMap = () => {
        setSelectedCityKey(`${event.city}|${event.country}`);
        navigate("/");
    };

    return (
        <div className="view-page">
            <Link to="/" className="view-back">
                <span className="back-arrow">←</span> Back to Map
            </Link>

            <article className="view-hero glass-panel">
                <div className="view-hero-media">
                    {heading ? (
                        <button
                            type="button"
                            className="view-hero-image-btn"
                            onClick={() => setSelectedIndex(0)}
                            aria-label={`View image for ${event.event_name}`}
                        >
                            <img src={heading.urlWebp} alt={event.event_name} className="view-hero-image" />
                        </button>
                    ) : (
                        <div className="view-hero-placeholder">
                            <span>{event.event_name.charAt(0)}</span>
                        </div>
                    )}
                </div>

                <div className="view-hero-content">
                    <span className={`view-date-badge ${isUpcoming ? "upcoming" : "visited"}`}>
                        {isUpcoming ? "Upcoming · " : ""}
                        {formatEventDate(event.dateValue)}
                    </span>
                    <h1 className="view-title">{event.event_name}</h1>

                    {event.eventTypes.length > 0 && (
                        <div className="view-types">
                            {event.eventTypes.map((type) => (
                                <span key={type} className="view-type-chip">
                                    {type}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="view-meta">
                        {event.place && (
                            <div className="view-meta-item">
                                <span className="view-meta-label">Venue</span>
                                <span className="view-meta-value">{event.place}</span>
                            </div>
                        )}
                        <div className="view-meta-item">
                            <span className="view-meta-label">Location</span>
                            <span className="view-meta-value">
                                {event.city}, {event.country}
                            </span>
                        </div>
                        <div className="view-meta-item">
                            <span className="view-meta-label">Coordinates</span>
                            <span className="view-meta-value">
                                {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                            </span>
                        </div>
                    </div>

                    <div className="view-actions">
                        <button type="button" className="view-action-btn" onClick={showOnMap}>
                            Show on map
                        </button>
                        <Link className="view-action-btn" to={`/edit/${event.event_id}`}>
                            ✎ Suggest edit
                        </Link>
                    </div>
                </div>
            </article>

            {uploads.length > 0 && (
                <section className="view-section">
                    <h2 className="view-section-title">
                        Photos &amp; Videos <span className="view-section-count">{uploads.length}</span>
                    </h2>
                    <div className="media-grid">
                        {uploads.map((item, index) => (
                            <button
                                type="button"
                                key={item.index}
                                className="media-tile glass-panel"
                                // The heading image, when present, occupies index 0 of the modal list.
                                onClick={() => setSelectedIndex(index + (heading ? 1 : 0))}
                                aria-label={`View ${item.description || item.media_id}`}
                            >
                                <img
                                    src={item.urlWebp}
                                    alt={item.description || ""}
                                    className="media-tile-image"
                                    loading="lazy"
                                />
                                {item.media_ext === ".mp4" && <div className="video-indicator"></div>}
                                {item.description && <span className="media-tile-caption">{item.description}</span>}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {links.length > 0 && (
                <section className="view-section">
                    <h2 className="view-section-title">
                        Links <span className="view-section-count">{links.length}</span>
                    </h2>
                    <div className="media-link-list">
                        {links.map((item) => (
                            <MediaLinkCard key={item.index} item={item} />
                        ))}
                    </div>
                </section>
            )}

            {event.media.length === 0 && (
                <section className="view-section">
                    <div className="view-empty-media glass-panel">
                        <p>No media has been added for this event yet.</p>
                        <p>
                            Got a VOD, a clip, or photos?{" "}
                            <Link className="text-link" to={`/edit/${event.event_id}`}>
                                Suggest them!
                            </Link>
                        </p>
                    </div>
                </section>
            )}

            {selectedIndex !== null && (
                <ImageModal
                    items={viewable}
                    selectedIndex={selectedIndex}
                    onClose={() => setSelectedIndex(null)}
                    onNavigate={setSelectedIndex}
                />
            )}
        </div>
    );
}
