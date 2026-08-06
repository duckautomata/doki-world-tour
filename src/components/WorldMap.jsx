import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoEqualEarth, geoNaturalEarth1, geoMercator, geoEquirectangular, geoPath, geoGraticule10 } from "d3-geo";
import { geoRobinson, geoWinkel3, geoMollweide, geoMiller } from "d3-geo-projection";
import { select } from "d3-selection";
import { zoom, zoomIdentity, zoomTransform } from "d3-zoom";
import "d3-transition";
import { feature, mesh } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import "./WorldMap.css";

/**
 * @typedef {import("../store/types").CityGroup} CityGroup
 */

// Internal SVG coordinate width. The svg scales to its container through the
// viewBox; the height depends on the active projection's aspect ratio.
const MAP_WIDTH = 960;

// World projections offered by the switcher: the equal-area/compromise set,
// plus rectangular cylindrical ones for comparison (d3's Mercator clips the
// poles to the classic ±85° square, so the math stays finite).
const PROJECTION_GROUPS = [
    {
        label: "Modern",
        projections: [
            { id: "equal-earth", label: "Equal Earth", factory: geoEqualEarth },
            { id: "natural-earth", label: "Natural Earth", factory: geoNaturalEarth1 },
            { id: "robinson", label: "Robinson", factory: geoRobinson },
            { id: "winkel3", label: "Winkel Tripel", factory: geoWinkel3 },
            { id: "mollweide", label: "Mollweide", factory: geoMollweide },
        ],
    },
    {
        label: "Cylindrical",
        projections: [
            { id: "mercator", label: "Mercator", factory: geoMercator },
            { id: "miller", label: "Miller", factory: geoMiller },
            { id: "equirectangular", label: "Equirectangular", factory: geoEquirectangular },
        ],
    },
];

const PROJECTIONS = PROJECTION_GROUPS.flatMap((group) => group.projections);

const sphere = { type: "Sphere" };

// Static geometry, computed once at module load; projected per selection.
const LAND_FEATURES = feature(world, world.objects.countries);
const BORDER_MESH = mesh(world, world.objects.countries, (a, b) => a !== b);
const GRATICULE = geoGraticule10();

const DEFAULT_MAP_HEIGHT = Math.ceil(geoPath(geoEqualEarth().fitWidth(MAP_WIDTH, sphere)).bounds(sphere)[1][1]);

const MIN_ZOOM = 1;
const MAX_ZOOM = 32;

/**
 * The interactive world map with a projection switcher (Equal Earth by
 * default). Renders one marker per city group; pan/zoom works with mouse,
 * wheel, and touch (drag + pinch) via d3-zoom.
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
    const [aspect, setAspect] = useState(MAP_WIDTH / DEFAULT_MAP_HEIGHT);
    const [projectionId, setProjectionId] = useState("equal-earth");

    // Project the world geometry for the active projection. A switch redraws
    // everything (paths, marker positions, world height).
    const { projection, mapHeight, spherePath, graticulePath, landPath, borderPath } = useMemo(() => {
        const factory = PROJECTIONS.find((p) => p.id === projectionId)?.factory ?? geoEqualEarth;
        const proj = factory().fitWidth(MAP_WIDTH, sphere);
        const pathGen = geoPath(proj);
        return {
            projection: proj,
            mapHeight: Math.ceil(pathGen.bounds(sphere)[1][1]),
            spherePath: pathGen(sphere),
            graticulePath: pathGen(GRATICULE),
            landPath: pathGen(LAND_FEATURES),
            borderPath: pathGen(BORDER_MESH),
        };
    }, [projectionId]);

    // View box matching the container aspect while always containing the
    // whole world at zoom 1 (slack goes to whichever axis has room).
    const viewW = aspect >= MAP_WIDTH / mapHeight ? mapHeight * aspect : MAP_WIDTH;
    const viewH = aspect >= MAP_WIDTH / mapHeight ? mapHeight : MAP_WIDTH / aspect;
    const padX = (viewW - MAP_WIDTH) / 2;
    const padY = (viewH - mapHeight) / 2;

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
            .on("zoom", (event) => setTransform(event.transform));
        svg.call(behavior);
        zoomRef.current = behavior;
        return () => svg.on(".zoom", null);
    }, []);

    // d3-zoom's extent must track the viewBox explicitly: jsdom (tests) has
    // no viewBox.baseVal, and gestures need it to zoom about the pointer.
    // The translate extent tracks the active projection's world bounds.
    useEffect(() => {
        zoomRef.current
            ?.extent([
                [0, 0],
                [viewW, viewH],
            ])
            .translateExtent([
                [0, 0],
                [MAP_WIDTH, mapHeight],
            ]);
    }, [viewW, viewH, mapHeight]);

    // Center the world in the viewBox slack while unzoomed (first render and
    // on rotation/resize). A projection switch reshapes the world, so it
    // always resets to the full view; otherwise, once the user has zoomed in,
    // d3-zoom's constrain keeps things sensible on its own.
    const lastProjectionRef = useRef(projectionId);
    useEffect(() => {
        if (!zoomRef.current) return;
        const projectionChanged = lastProjectionRef.current !== projectionId;
        lastProjectionRef.current = projectionId;
        if (!projectionChanged && zoomTransform(svgRef.current).k !== 1) return;
        select(svgRef.current).call(zoomRef.current.transform, zoomIdentity.translate(padX, padY));
    }, [padX, padY, projectionId]);

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
        const ty = clampTranslate(viewH / 2 - k * y, viewH, mapHeight, k);
        select(svgRef.current)
            .transition()
            .duration(500)
            .call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(k));
    }, [selectedKey, groups, viewW, viewH, mapHeight, projection]);

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
    // Dividing marker sizes by k would keep them a constant screen size; a
    // sublinear power instead lets them GROW on screen as you zoom in,
    // which makes them much easier to tap on phones once zoomed into a region.
    const markerScale = Math.pow(k, 0.75);

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
                    <path className="map-sphere" d={spherePath} onClick={() => onSelect(null)} />
                    <path className="map-graticule" d={graticulePath} />
                    <path className="map-land" d={landPath} onClick={() => onSelect(null)} />
                    <path className="map-borders" d={borderPath} />
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
                                <circle className="marker-hit" r={22 / markerScale} />
                                <circle
                                    className="marker-dot"
                                    r={(selected ? 10.5 : 8.5) / markerScale}
                                    strokeWidth={1.6 / markerScale}
                                />
                                {count > 1 && (
                                    <text className="marker-count" fontSize={9.5 / markerScale} dy={3.3 / markerScale}>
                                        {count}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>
            </svg>
            <select
                className="map-projection-select"
                value={projectionId}
                onChange={(e) => setProjectionId(e.target.value)}
                aria-label="Map projection"
            >
                {PROJECTION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                        {group.projections.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </select>
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
