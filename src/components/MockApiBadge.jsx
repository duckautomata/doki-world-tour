import { useEffect, useState } from "react";
import { isMockMode } from "../config";
import "./EnvironmentBadge.css";

const FlaskIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M5 3h14v2h-1v3.79l4.94 9.04A2 2 0 0 1 21.18 21H2.82a2 2 0 0 1-1.76-3.17L6 8.79V5H5V3zm3 2v4.34L4.55 16h14.9L16 9.34V5H8z" />
    </svg>
);

export default function MockApiBadge({ className = "" }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!isMockMode) return undefined;
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (!isMockMode) return null;

    const dynamicStyles = {
        "--env-color": "#a855f7",
        "--env-bg-light": "#a855f71a",
        "--env-bg-dark": "#a855f726",
        "--env-bg-hover-light": "#a855f733",
        "--env-bg-hover-dark": "#a855f74d",
        "--env-border": "#a855f740",
        "--env-border-hover": "#a855f780",
        "--env-shadow": "#a855f740",
    };

    return (
        <div
            className={`env-badge-container ${className} ${isVisible ? "visible" : ""}`.trim()}
            style={dynamicStyles}
            title="Suggestion API calls are intercepted by the mock client. Nothing is sent to the backend."
        >
            <div className="env-badge">
                <FlaskIcon />
                <span>Mock API</span>
            </div>
        </div>
    );
}
