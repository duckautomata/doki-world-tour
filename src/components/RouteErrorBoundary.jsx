import { Link, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { LOG_ERROR } from "../utils/debug";
import notFoundImage from "../assets/404.png";
import "../pages/SuggestionForms.css";

/**
 * Catches errors thrown anywhere below it in the route tree (render errors,
 * loader/action errors, etc.) and shows a friendly fallback. Wired in via the
 * `errorElement` field on each route in `src/index.jsx`. In dev mode the raw
 * stack is included to make debugging easier.
 */
export default function RouteErrorBoundary() {
    const error = useRouteError();
    LOG_ERROR("Route error", error);

    let title = "Something went wrong";
    let detail = "An unexpected error occurred. Try heading back to the map.";

    if (isRouteErrorResponse(error)) {
        title = `${error.status} ${error.statusText || "Error"}`;
        detail = (typeof error.data === "string" && error.data) || error.statusText || detail;
    } else if (error instanceof Error) {
        detail = error.message || detail;
    }

    const showStack = import.meta.env.DEV && error instanceof Error && error.stack;

    return (
        <div className="suggestion-page">
            <div className="suggestion-card glass-panel route-error-card">
                <img src={notFoundImage} alt="Not found" className="not-found-image" />
                <h1 className="suggestion-title">{title}</h1>
                <p className="suggestion-subtitle">{detail}</p>
                {showStack && <pre className="route-error-stack">{error.stack}</pre>}
                <div className="suggestion-actions">
                    <Link to="/" className="suggestion-submit-btn" style={{ textDecoration: "none" }}>
                        Back to Map
                    </Link>
                </div>
            </div>
        </div>
    );
}
