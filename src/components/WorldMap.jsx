import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import "d3-transition";
import { feature, mesh } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import "./WorldMap.css";

/**
 * @typedef {import("../store/types").CityGroup} CityGroup
 */

// Internal SVG coordinate space. The svg scales to its container through the
// viewBox, so these never change at runtime.
const MAP_WIDTH = 960;

const sphere = { type: "Sphere" };
const projection = geoEqualEarth().fitWidth(MAP_WIDTH, sphere);
const path = geoPath(projection);
const MAP_HEIGHT = Math.ceil(path.bounds(sphere)[1][1]);

// Static geometry, computed once at module load.
const SPHERE_PATH = path(sphere);
const GRATICULE_PATH = path(geoGraticule10());
const LAND_PATH = path(feature(world, world.objects.countries));
const BORDER_PATH = path(mesh(world, world.objects.countries, (a, b) => a !== b));

const MIN_ZOOM = 1;
const MAX_ZOOM = 32;

/**
 * The interactive Equal Earth world map. Renders one marker per city group;
 * pan/zoom works with mouse, wheel, and touch (drag + pinch) via d3-zoom.
 *
 * The viewBox is sized to the container's aspect ratio so the map never gets
 * letterboxed into a sliver on portrait phones; d3-zoom's constrain keeps the
 * world centered in whatever slack space remains.
 *
 * @param {Object} props
 * @param {CityGroup[]} props.groups markers to draw
 * @param {string | null} props.selectedKey key of the selected city group
 * @param {(key: string | null) => void} props.onSelect marker tap/deselect callback
 */
export default function WorldMap({ groups, selectedKey, onSelect }) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const zoomRef = useRef(null);
    const [transform, setTransform] = useState(zoomIdentity);
    const [aspect, setAspect] = useState(MAP_WIDTH / MAP_HEIGHT);

    // View box matching the container aspect while always containing the
    // whole world at zoom 1 (slack goes to whichever axis has room).
    const viewW = aspect >= MAP_WIDTH / MAP_HEIGHT ? MAP_HEIGHT * aspect : MAP_WIDTH;
    const viewH = aspect >= MAP_WIDTH / MAP_HEIGHT ? MAP_HEIGHT : MAP_WIDTH / aspect;
    const padX = (viewW - MAP_WIDTH) / 2;
    const padY = (viewH - MAP_HEIGHT) / 2;

    // Measure synchronously on mount so the first paint already has the right
    // aspect; the observer then tracks resizes and rotations.
    useLayoutEffect(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect?.width && rect?.height) setAspect(rect.width / rect.height);
    }, []);

    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect?.width && rect?.height) setAspect(rect.width / rect.height);
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const svg = select(svgRef.current);
        const behavior = zoom()
            .scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .translateExtent([
                [0, 0],
                [MAP_WIDTH, MAP_HEIGHT],
            ])
            .on("zoom", (event) => setTransform(event.transform));
        svg.call(behavior);
        zoomRef.current = behavior;
        return () => svg.on(".zoom", null);
    }, []);

    // d3-zoom's extent must track the viewBox explicitly: jsdom (tests) has
    // no viewBox.baseVal, and gestures need it to zoom about the pointer.
    useEffect(() => {
        zoomRef.current?.extent([
            [0, 0],
            [viewW, viewH],
        ]);
    }, [viewW, viewH]);

    // Center the world in the viewBox slack while unzoomed (first render and
    // on rotation/resize). Once the user has zoomed in, d3-zoom's constrain
    // keeps things sensible on its own.
    useEffect(() => {
        if (!zoomRef.current) return;
        if (zoomTransform(svgRef.current).k !== 1) return;
        select(svgRef.current).call(zoomRef.current.transform, zoomIdentity.translate(padX, padY));
    }, [padX, padY]);

    // Keeps the desired translation inside the world bounds (mirrors what
    // d3-zoom's constrain would do on the next gesture), centering when the
    // scaled world is smaller than the viewport on that axis.
    const clampTranslate = (desired, viewSize, worldSize, k) => {
        if (k * worldSize <= viewSize) return (viewSize - k * worldSize) / 2;
        return Math.min(0, Math.max(viewSize - k * worldSize, desired));
    };

    // Pan/zoom to the selected city (e.g. picked from the list below the map).
    const lastFollowedKey = useRef(null);
    useEffect(() => {
        if (selectedKey === lastFollowedKey.current) return;
        lastFollowedKey.current = selectedKey;
        if (!selectedKey || !zoomRef.current) return;
        const group = groups.find((g) => g.key === selectedKey);
        if (!group) return;
        const [x, y] = projection([group.longitude, group.latitude]);
        const k = Math.max(zoomTransform(svgRef.current).k, 4);
        const tx = clampTranslate(viewW / 2 - k * x, viewW, MAP_WIDTH, k);
        const ty = clampTranslate(viewH / 2 - k * y, viewH, MAP_HEIGHT, k);
        select(svgRef.current)
            .transition()
            .duration(500)
            .call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(k));
    }, [selectedKey, groups, viewW, viewH]);

    const zoomBy = (factor) => {
        select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
    };

    const resetZoom = () => {
        onSelect(null);
        select(svgRef.current)
            .transition()
            .duration(400)
            .call(zoomRef.current.transform, zoomIdentity.translate(padX, padY));
    };

    const todayStart = useMemo(() => new Date().setHours(0, 0, 0, 0), []);
    const k = transform.k;

    return (
        <div className="world-map" ref={containerRef}>
            <svg
                ref={svgRef}
                className="world-map-svg"
                viewBox={`0 0 ${viewW} ${viewH}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="World map of events"
            >
                <g transform={transform.toString()}>
                    <path className="map-sphere" d={SPHERE_PATH} onClick={() => onSelect(null)} />
                    <path className="map-graticule" d={GRATICULE_PATH} />
                    <path className="map-land" d={LAND_PATH} onClick={() => onSelect(null)} />
                    <path className="map-borders" d={BORDER_PATH} />
                    {groups.map((group) => {
                        const [x, y] = projection([group.longitude, group.latitude]);
                        const selected = group.key === selectedKey;
                        const upcoming = group.events.some((e) => e.dateValue >= todayStart);
                        const count = group.events.length;
                        const label = `${group.city}, ${group.country}: ${count} event${count > 1 ? "s" : ""}`;
                        return (
                            <g
                                key={group.key}
                                className={`map-marker${selected ? " selected" : ""}${upcoming ? " upcoming" : ""}`}
                                transform={`translate(${x},${y})`}
                                onClick={() => onSelect(selected ? null : group.key)}
                            >
                                <title>{label}</title>
                                {/* Oversized invisible hit area for touch */}
                                <circle className="marker-hit" r={16 / k} />
                                <circle className="marker-dot" r={(selected ? 9.5 : 7.5) / k} strokeWidth={1.6 / k} />
                                {count > 1 && (
                                    <text className="marker-count" fontSize={8.5 / k} dy={3 / k}>
                                        {count}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>
            <div className="map-zoom-controls">
                <button className="map-zoom-btn" onClick={() => zoomBy(1.7)} aria-label="Zoom in">
                    +
                </button>
                <button className="map-zoom-btn" onClick={() => zoomBy(1 / 1.7)} aria-label="Zoom out">
                    −
                </button>
                <button className="map-zoom-btn map-zoom-reset" onClick={resetZoom} aria-label="Reset view">
                    ⟲
                </button>
            </div>
            <div className="map-legend">
                <span className="map-legend-item">
                    <span className="map-legend-dot visited" /> Visited
                </span>
                <span className="map-legend-item">
                    <span className="map-legend-dot upcoming" /> Upcoming
                </span>
            </div>
        </div>
    );
}
