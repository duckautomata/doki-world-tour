import React, { useEffect, useState } from "react";
import "./EnvironmentBadge.css";

// SVG Icons
const LaptopMacIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2H0c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2h-4zM4 5h16v11H4V5zm8 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
    </svg>
);

const ConstructionIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
);

const ScienceIcon = () => (
    <svg viewBox="0 0 24 24">
        <path d="M13 11.33L18 18H6l5-6.67V6h2m2.96-2H6.04c-.42 0-.65.48-.39.81L9 12v6l-1.63 2.18c-.28.37.14.82.59.82h8.08c.45 0 .87-.45.59-.82L15 18v-6l3.35-7.19c.26-.33.03-.81-.39-.81z" />
    </svg>
);

export default function EnvironmentBadge({ className = "" }) {
    const [isVisible, setIsVisible] = useState(false);
    const environment = import.meta.env.VITE_ENVIRONMENT;

    useEffect(() => {
        // Trigger fade in on mount
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    if (!environment || environment === "prod" || environment === "production") {
        return null;
    }

    const config = {
        local: {
            label: "Local",
            color: "#9c27b0", // Violet/Purple
            icon: <LaptopMacIcon />,
        },
        dev: {
            label: "Development",
            color: "#ed6c02", // Orange
            icon: <ConstructionIcon />,
        },
        staging: {
            label: "Staging",
            color: "#0288d1", // Cyan/Blue
            icon: <ScienceIcon />,
        },
    };

    const envConfig = config[environment] || {
        label: environment.toUpperCase(),
        color: "#757575",
        icon: <ConstructionIcon />,
    };

    const dynamicStyles = {
        "--env-color": envConfig.color,
        "--env-bg-light": `${envConfig.color}1A`, // ~0.1
        "--env-bg-dark": `${envConfig.color}26`, // ~0.15
        "--env-bg-hover-light": `${envConfig.color}33`, // ~0.2
        "--env-bg-hover-dark": `${envConfig.color}4D`, // ~0.3
        "--env-border": `${envConfig.color}40`, // ~0.25
        "--env-border-hover": `${envConfig.color}80`, // ~0.5
        "--env-shadow": `${envConfig.color}40`, // ~0.25
    };

    return (
        <div className={`env-badge-container ${className} ${isVisible ? "visible" : ""}`.trim()} style={dynamicStyles}>
            <div className="env-badge">
                {envConfig.icon}
                <span>{envConfig.label}</span>
            </div>
        </div>
    );
}
