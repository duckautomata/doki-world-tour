import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "../store/store";
import { groupByCity, EVENT_TYPES } from "../utils/dataLoader";
import WorldMap from "../components/WorldMap";
import DateRangeSlider from "../components/DateRangeSlider";
import CitySheet from "../components/CitySheet";
import EventCard from "../components/EventCard";
import "./Home.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

/**
 * The map home page: search, date range, country and event-type filters, the
 * Equal Earth world map with one marker per city, and a collapsible card
 * list of the filtered events.
 *
 * @param {Object} props
 * @param {EventData[]} props.data all events, sorted by date ascending
 */
export default function Home({ data }) {
    const searchText = useAppStore((state) => state.searchText);
    const setSearchText = useAppStore((state) => state.setSearchText);
    const dateRange = useAppStore((state) => state.dateRange);
    const setDateRange = useAppStore((state) => state.setDateRange);
    const filterCountry = useAppStore((state) => state.filterCountry);
    const setFilterCountry = useAppStore((state) => state.setFilterCountry);
    const filterEventType = useAppStore((state) => state.filterEventType);
    const setFilterEventType = useAppStore((state) => state.setFilterEventType);
    const selectedCityKey = useAppStore((state) => state.selectedCityKey);
    const setSelectedCityKey = useAppStore((state) => state.setSelectedCityKey);
    const showList = useAppStore((state) => state.showList);
    const setShowList = useAppStore((state) => state.setShowList);

    const mapSectionRef = useRef(null);

    // data is sorted by date ascending, so the timeline bounds are the ends.
    const [minDate, maxDate] = useMemo(() => {
        if (!data.length) return [0, 0];
        return [data[0].dateValue, data[data.length - 1].dateValue];
    }, [data]);

    const [rangeStart, rangeEnd] = dateRange ?? [minDate, maxDate];

    const countries = useMemo(() => {
        const set = new Set();
        data.forEach((e) => {
            if (e.country) set.add(e.country);
        });
        return Array.from(set).sort();
    }, [data]);

    const filtered = useMemo(() => {
        const query = searchText.trim().toLowerCase();
        return data.filter((e) => {
            if (e.dateValue < rangeStart || e.dateValue > rangeEnd) return false;
            if (filterCountry && e.country !== filterCountry) return false;
            if (filterEventType && !e.eventTypes.includes(filterEventType)) return false;
            if (!query) return true;
            return [e.event_name, e.place, e.city, e.country, e.eventTypes.join(" ")].some(
                (field) => field && field.toLowerCase().includes(query),
            );
        });
    }, [data, searchText, filterCountry, filterEventType, rangeStart, rangeEnd]);

    const groups = useMemo(() => groupByCity(filtered), [filtered]);
    const selectedGroup = groups.find((g) => g.key === selectedCityKey) ?? null;

    // Drop a stale selection when filtering removes that city's marker.
    useEffect(() => {
        if (selectedCityKey && !groups.some((g) => g.key === selectedCityKey)) {
            setSelectedCityKey(null);
        }
    }, [groups, selectedCityKey, setSelectedCityKey]);

    const hasActiveFilters =
        searchText.trim().length > 0 || dateRange !== null || filterCountry !== "" || filterEventType !== "";

    const showOnMap = (event) => {
        setSelectedCityKey(`${event.city}|${event.country}`);
        mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // The city sheet's View button: open the list (if collapsed), then scroll
    // to the event's card and flash it. The scroll waits a render so the card
    // exists when the list was closed.
    const [viewEventId, setViewEventId] = useState(null);
    const viewEvent = (eventId) => {
        setShowList(true);
        setViewEventId(eventId);
    };

    useEffect(() => {
        if (!viewEventId || !showList) return undefined;
        document.getElementById(`event-${viewEventId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        // Clear after the flash animation so a repeat View re-triggers it.
        const timer = setTimeout(() => setViewEventId(null), 4100);
        return () => clearTimeout(timer);
    }, [viewEventId, showList]);

    return (
        <div className="home-page">
            <section className="map-controls glass-panel">
                <div className="map-filter-row">
                    <div className="map-search">
                        <input
                            className="map-search-input"
                            type="search"
                            placeholder="Search events, venues, cities, countries…"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            aria-label="Search events"
                        />
                        {searchText && (
                            <button
                                className="search-clear-button"
                                onClick={() => setSearchText("")}
                                aria-label="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <select
                        className="map-select"
                        value={filterEventType}
                        onChange={(e) => setFilterEventType(e.target.value)}
                        aria-label="Filter by event type"
                    >
                        <option value="">All types</option>
                        {EVENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                    <select
                        className="map-select"
                        value={filterCountry}
                        onChange={(e) => setFilterCountry(e.target.value)}
                        aria-label="Filter by country"
                    >
                        <option value="">All countries</option>
                        {countries.map((country) => (
                            <option key={country} value={country}>
                                {country}
                            </option>
                        ))}
                    </select>
                </div>
                {minDate < maxDate && (
                    <DateRangeSlider
                        min={minDate}
                        max={maxDate}
                        value={[rangeStart, rangeEnd]}
                        onChange={(range) => setDateRange(range[0] === minDate && range[1] === maxDate ? null : range)}
                    />
                )}
                <div className="map-controls-footer">
                    <span className="result-count">
                        Showing {filtered.length} of {data.length} events
                    </span>
                    {hasActiveFilters && (
                        <button
                            className="reset-filters-btn"
                            onClick={() => {
                                setSearchText("");
                                setDateRange(null);
                                setFilterCountry("");
                                setFilterEventType("");
                            }}
                        >
                            Reset filters
                        </button>
                    )}
                </div>
            </section>

            <section className="map-section" ref={mapSectionRef}>
                <WorldMap groups={groups} selectedKey={selectedCityKey} onSelect={setSelectedCityKey} />
                {selectedGroup && (
                    <CitySheet group={selectedGroup} onClose={() => setSelectedCityKey(null)} onViewEvent={viewEvent} />
                )}
            </section>

            <section className="event-list">
                <button
                    className="list-toggle-btn glass-panel"
                    onClick={() => setShowList(!showList)}
                    aria-expanded={showList}
                >
                    {showList ? "Hide event list" : `Show event list (${filtered.length})`}
                    <span className="list-toggle-arrow" aria-hidden="true">
                        {showList ? "▲" : "▼"}
                    </span>
                </button>
                {showList &&
                    (filtered.length === 0 ? (
                        <div className="empty-state glass-panel">
                            <p>No events match the current filters.</p>
                            <p>
                                Know one that&apos;s missing?{" "}
                                <Link className="text-link" to="/add">
                                    Suggest it!
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <div className="event-grid">
                            {filtered.map((e) => (
                                <EventCard
                                    key={e.event_id}
                                    event={e}
                                    onShowOnMap={() => showOnMap(e)}
                                    highlighted={e.event_id === viewEventId}
                                />
                            ))}
                        </div>
                    ))}
            </section>
        </div>
    );
}
