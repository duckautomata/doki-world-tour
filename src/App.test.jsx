import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { loadEventData } from "./utils/dataLoader";

vi.mock("./utils/dataLoader", () => ({
    loadEventData: vi.fn(),
}));

// The map pulls in d3 and topojson, which the header doesn't need.
const renderApp = () =>
    render(
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<App />}>
                    <Route index element={<p>Map page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

describe("App", () => {
    const { matchMedia, scrollTo } = window;

    beforeEach(() => {
        vi.clearAllMocks();
        // jsdom implements neither
        window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
        window.scrollTo = vi.fn();
        loadEventData.mockResolvedValue([]);
    });

    afterEach(() => {
        window.matchMedia = matchMedia;
        window.scrollTo = scrollTo;
    });

    it.each([
        ["title", () => screen.getByRole("button", { name: "Doki's World Tour" })],
        ["grid button", () => screen.getByRole("button", { name: "Site menu" })],
    ])("opens the site menu from the header's %s, holding only All my sites", async (_, trigger) => {
        renderApp();
        await screen.findByText("Map page");

        // The title opens the menu now, rather than linking home.
        expect(screen.queryByRole("link", { name: "Doki's World Tour" })).not.toBeInTheDocument();

        fireEvent.click(trigger());
        const menu = screen.getByRole("navigation", { name: "Sites" });
        const links = within(menu).getAllByRole("link");

        expect(links).toHaveLength(1);
        expect(links[0]).toHaveAccessibleName("All my sites");
        expect(links[0]).toHaveAttribute("href", "https://www.duck-automata.com/");
    });
});
