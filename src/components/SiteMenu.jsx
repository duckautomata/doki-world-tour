import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./SiteMenu.css";

// Shared by every duck-automata.com site, so keep this file and SiteMenu.css
// identical in each repo. Each site's App.jsx passes in its own sites.

const GridIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
);

const CheckIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const ArrowUpRightIcon = () => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
    </svg>
);

/**
 * The site title and a grid button, which both open a menu of the owner's sites.
 *
 * - `title`: the site's title, shown in the header.
 * - `sites`: rows in a fixed order, each `{ id, title, subtitle, href, iconSrc, iconSrcSet, current }`.
 *   The `current` row goes to this site's homepage; the others are full-page links. Empty for none.
 * - `hubUrl`: where "All my sites" goes.
 */
export default function SiteMenu({ title, sites = [], hubUrl }) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);
    const gridButtonRef = useRef(null);
    const panelId = useId();
    const { pathname } = useLocation();

    // Close when the route changes, e.g. with the browser's back button.
    const [openPathname, setOpenPathname] = useState(pathname);
    if (openPathname !== pathname) {
        setOpenPathname(pathname);
        setIsOpen(false);
    }

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                // Take focus back from inside the menu, or from nowhere (Safari doesn't focus
                // clicked buttons), but leave it alone on the rest of the page.
                const active = document.activeElement;
                const returnFocus = !active || active === document.body || menuRef.current?.contains(active);
                setIsOpen(false);
                if (returnFocus) gridButtonRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const toggle = () => setIsOpen((open) => !open);
    const close = () => setIsOpen(false);

    // Close when focus moves on to the rest of the page, e.g. tabbing past the last row.
    // Focus moving to nothing (no relatedTarget) is left to the outside-click handler.
    const handleBlur = (event) => {
        if (event.relatedTarget && !menuRef.current?.contains(event.relatedTarget)) {
            setIsOpen(false);
        }
    };

    // Both buttons control the same panel. aria-controls is only set while the panel exists.
    const triggerProps = {
        type: "button",
        onClick: toggle,
        "aria-expanded": isOpen,
        "aria-controls": isOpen ? panelId : undefined,
    };

    return (
        <div className="site-menu" ref={menuRef} onBlur={handleBlur}>
            <button
                {...triggerProps}
                ref={gridButtonRef}
                className="site-menu-grid"
                aria-label="Site menu"
                title="My sites"
            >
                <GridIcon />
            </button>
            {/* nav-brand is styled by each site's App.css, so the title looks the same as before it opened a menu. */}
            <button {...triggerProps} className="nav-brand site-menu-title">
                {title}
            </button>
            {isOpen && (
                <nav id={panelId} className="site-menu-panel" aria-label="Sites">
                    <ul className="site-menu-list">
                        {sites.map((site) => {
                            const content = (
                                <>
                                    <img
                                        className="site-menu-icon"
                                        src={site.iconSrc}
                                        srcSet={site.iconSrcSet}
                                        width="24"
                                        height="24"
                                        alt=""
                                    />
                                    {/* The space keeps the title and subtitle apart in the link's accessible name. */}
                                    <span className="site-menu-text">
                                        <span className="site-menu-item-title">{site.title}</span>{" "}
                                        <span className="site-menu-item-subtitle">{site.subtitle}</span>
                                    </span>
                                    {site.current && (
                                        <span className="site-menu-end site-menu-check">
                                            <CheckIcon />
                                        </span>
                                    )}
                                </>
                            );
                            return (
                                <li key={site.id} className="site-menu-site">
                                    {/* The current site's row goes home without reloading; the others are separate apps. */}
                                    {site.current ? (
                                        <Link to="/" onClick={close} className="site-menu-item" aria-current="true">
                                            {content}
                                        </Link>
                                    ) : (
                                        <a href={site.href} onClick={close} className="site-menu-item">
                                            {content}
                                        </a>
                                    )}
                                </li>
                            );
                        })}
                        <li className="site-menu-hub">
                            <a href={hubUrl} onClick={close} className="site-menu-item">
                                <span className="site-menu-icon site-menu-hub-icon">
                                    <GridIcon />
                                </span>
                                <span className="site-menu-text">
                                    <span className="site-menu-item-title">All my sites</span>
                                </span>
                                <span className="site-menu-end site-menu-arrow">
                                    <ArrowUpRightIcon />
                                </span>
                            </a>
                        </li>
                    </ul>
                </nav>
            )}
        </div>
    );
}
