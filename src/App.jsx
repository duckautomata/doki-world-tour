import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { loadEventData } from "./utils/dataLoader";
import { useAppStore } from "./store/store";
import UpdateAlert from "./components/UpdateAlert";
import EnvironmentBadge from "./components/EnvironmentBadge";
import MockApiBadge from "./components/MockApiBadge";
import ScrollToTop from "./components/ScrollToTop";
import SuggestionsDropdown from "./components/SuggestionsDropdown";
import "./App.css";

export default function App() {
    const location = useLocation();

    useLayoutEffect(() => {
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        setTimeout(() => {
            document.documentElement.style.scrollBehavior = "";
        }, 20);
    }, [location.pathname]);

    // null = still loading; an array (possibly empty) = loaded. An empty
    // result still renders the map so a CDN hiccup never blanks the site.
    const [data, setData] = useState(null);
    const theme = useAppStore((state) => state.theme);

    useEffect(() => {
        loadEventData().then(setData);
    }, []);

    // Apply theme to document
    useEffect(() => {
        const applyTheme = (currentTheme) => {
            if (currentTheme === "system") {
                const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                document.documentElement.setAttribute("data-theme", systemPrefersDark ? "dark" : "light");
            } else {
                document.documentElement.setAttribute("data-theme", currentTheme);
            }
        };
        applyTheme(theme);
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = () => applyTheme("system");
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", handleChange);
                return () => mediaQuery.removeEventListener("change", handleChange);
            } else if (mediaQuery.addListener) {
                mediaQuery.addListener(handleChange);
                return () => mediaQuery.removeListener(handleChange);
            }
        }
    }, [theme]);

    if (data === null)
        return (
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    fontSize: "1.2rem",
                    color: "var(--text-secondary)",
                }}
            >
                Loading Doki&apos;s World Tour...
            </div>
        );

    return (
        <>
            <UpdateAlert />
            <header className="top-nav">
                <div className="brand-group">
                    <Link to="/" className="nav-brand">
                        Doki&apos;s World Tour
                    </Link>
                    <EnvironmentBadge />
                    <MockApiBadge />
                </div>
                <nav className="nav-links">
                    <div className="nav-main-links">
                        <NavLink to="/" end className="nav-link nav-home">
                            Map
                        </NavLink>
                        <EnvironmentBadge className="mobile-only" />
                        <MockApiBadge className="mobile-only" />
                        <SuggestionsDropdown />
                    </div>
                    <ScrollToTop />
                </nav>
            </header>
            <main className="content">
                <Outlet context={{ data }} />
            </main>
        </>
    );
}
