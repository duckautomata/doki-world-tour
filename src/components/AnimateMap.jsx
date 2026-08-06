import { geoEqualEarth, geoPath, geoGraticule10 } from "d3-geo";
import { feature, mesh } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import "./AnimateMap.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

// Fixed Equal Earth world for the timelapse, no zoom or projection switching
// here, the whole globe stays in view so the journey reads at a glance.
const MAP_WIDTH = 960;
const sphere = { type: "Sphere" };
const projection = geoEqualEarth().fitWidth(MAP_WIDTH, sphere);
const path = geoPath(projection);
const MAP_HEIGHT = Math.ceil(path.bounds(sphere)[1][1]);

const SPHERE_PATH = path(sphere);
const GRATICULE_PATH = path(geoGraticule10());
const LAND_PATH = path(feature(world, world.objects.countries));
const BORDER_PATH = path(mesh(world, world.objects.countries, (a, b) => a !== b));

/**
 * The timelapse map: already-played events remain as a dot trail, the active
 * event pulses. Base map classes (.map-sphere etc.) come from WorldMap.css,
 * which is always loaded since the router imports every page statically.
 *
 * @param {Object} props
 * @param {EventData[]} props.events all events in play order
 * @param {number} props.activeIndex index of the event currently showing
 */
export default function AnimateMap({ events, activeIndex }) {
    const active = events[activeIndex];
    const activePoint = active ? projection([active.longitude, active.latitude]) : null;

    return (
        <div className="animate-map">
            <svg
                className="animate-map-svg"
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Timelapse map of events"
            >
                <path className="map-sphere" d={SPHERE_PATH} />
                <path className="map-graticule" d={GRATICULE_PATH} />
                <path className="map-land" d={LAND_PATH} />
                <path className="map-borders" d={BORDER_PATH} />
                {events.slice(0, activeIndex).map((e) => {
                    const [x, y] = projection([e.longitude, e.latitude]);
                    return <circle key={e.event_id} className="animate-trail-dot" cx={x} cy={y} r={3.5} />;
                })}
                {activePoint && (
                    <g className="animate-active" transform={`translate(${activePoint[0]},${activePoint[1]})`}>
                        <circle className="animate-active-pulse" r={9} />
                        <circle className="animate-active-dot" r={5.5} />
                    </g>
                )}
            </svg>
        </div>
    );
}
