import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import SiteMenu from "./SiteMenu";

const sites = [
    {
        id: "doki",
        title: "Dokimotes",
        subtitle: "Dokibird",
        href: "/dokimotes/",
        iconSrc: "/dokimotes/favicon-32x32.png",
        iconSrcSet: "/dokimotes/favicon-32x32.png 1x, /dokimotes/android-chrome-192x192.png 2x",
        current: true,
    },
    {
        id: "mint",
        title: "Mintomotes",
        subtitle: "Mint Fantome",
        href: "/mintomotes/",
        iconSrc: "/mintomotes/favicon-32x32.png",
        iconSrcSet: "/mintomotes/favicon-32x32.png 1x, /mintomotes/android-chrome-192x192.png 2x",
        current: false,
    },
];
const hubUrl = "https://www.duck-automata.com/";

const CurrentPath = () => <p data-testid="path">{useLocation().pathname}</p>;

const renderMenu = ({ route = "/", menuSites = sites } = {}) =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <SiteMenu title="Dokimotes" sites={menuSites} hubUrl={hubUrl} />
            <Link to="/view/other">Elsewhere</Link>
            <CurrentPath />
        </MemoryRouter>,
    );

const gridButton = () => screen.getByRole("button", { name: "Site menu" });
const titleButton = () => screen.getByRole("button", { name: "Dokimotes" });
const queryPanel = () => screen.queryByRole("navigation", { name: "Sites" });

describe("SiteMenu", () => {
    it("starts closed with both triggers collapsed", () => {
        renderMenu();

        expect(gridButton()).toHaveAttribute("aria-expanded", "false");
        expect(titleButton()).toHaveAttribute("aria-expanded", "false");
        expect(gridButton()).toHaveAttribute("title", "My sites");
        expect(gridButton()).not.toHaveAttribute("aria-controls");
        expect(queryPanel()).not.toBeInTheDocument();
    });

    it.each([
        ["grid button", gridButton],
        ["title", titleButton],
    ])("opens from the %s, and both triggers point at the panel", (_, trigger) => {
        renderMenu();

        fireEvent.click(trigger());

        const panel = queryPanel();
        expect(panel).toBeInTheDocument();
        for (const button of [gridButton(), titleButton()]) {
            expect(button).toHaveAttribute("aria-expanded", "true");
            expect(button).toHaveAttribute("aria-controls", panel.id);
        }
    });

    it("closes when either trigger is clicked again", () => {
        renderMenu();

        fireEvent.click(gridButton());
        fireEvent.click(titleButton());

        expect(queryPanel()).not.toBeInTheDocument();
        expect(gridButton()).toHaveAttribute("aria-expanded", "false");
    });

    it("closes on Escape and moves focus to the grid button", () => {
        renderMenu();
        fireEvent.click(titleButton());
        screen.getByRole("link", { name: /Mintomotes/ }).focus();

        fireEvent.keyDown(document.activeElement, { key: "Escape" });

        expect(queryPanel()).not.toBeInTheDocument();
        expect(gridButton()).toHaveFocus();
    });

    it("closes on Escape but leaves focus alone when it's outside the menu", () => {
        renderMenu();
        const elsewhere = screen.getByRole("link", { name: "Elsewhere" });
        elsewhere.focus();
        fireEvent.click(gridButton());

        fireEvent.keyDown(elsewhere, { key: "Escape" });

        expect(queryPanel()).not.toBeInTheDocument();
        expect(elsewhere).toHaveFocus();
    });

    it("stays open while focus moves within the menu, and closes when it leaves", () => {
        renderMenu();
        fireEvent.click(gridButton());

        // Moving focus fires focusout, so it needs act() for React to apply the state update.
        act(() => gridButton().focus());
        act(() => titleButton().focus());
        act(() => screen.getByRole("link", { name: "All my sites" }).focus());
        expect(queryPanel()).toBeInTheDocument();

        act(() => screen.getByRole("link", { name: "Elsewhere" }).focus());
        expect(queryPanel()).not.toBeInTheDocument();
    });

    it("closes when clicking or tapping outside, but not inside", () => {
        renderMenu();
        fireEvent.click(gridButton());

        fireEvent.mouseDown(screen.getByRole("link", { name: /Mintomotes/ }));
        expect(queryPanel()).toBeInTheDocument();

        fireEvent.mouseDown(document.body);
        expect(queryPanel()).not.toBeInTheDocument();

        fireEvent.click(gridButton());
        fireEvent.touchStart(document.body);
        expect(queryPanel()).not.toBeInTheDocument();
    });

    it("closes when the route changes", () => {
        renderMenu();
        fireEvent.click(gridButton());

        fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }));

        expect(screen.getByTestId("path")).toHaveTextContent("/view/other");
        expect(queryPanel()).not.toBeInTheDocument();
    });

    it("lists the sites in the given order, marking the current one", () => {
        renderMenu();
        fireEvent.click(gridButton());

        const links = within(queryPanel()).getAllByRole("link");
        expect(links.map((link) => link.textContent)).toEqual([
            "Dokimotes Dokibird",
            "Mintomotes Mint Fantome",
            "All my sites",
        ]);

        const [current, other] = links;
        expect(current).toHaveAttribute("aria-current", "true");
        expect(other).not.toHaveAttribute("aria-current");

        const icon = other.querySelector("img");
        expect(icon).toHaveAttribute("src", "/mintomotes/favicon-32x32.png");
        expect(icon).toHaveAttribute(
            "srcset",
            "/mintomotes/favicon-32x32.png 1x, /mintomotes/android-chrome-192x192.png 2x",
        );
        expect(icon).toHaveAttribute("alt", "");
    });

    it("goes to this site's homepage from the current site's row and closes", () => {
        renderMenu({ route: "/view/abc" });
        fireEvent.click(gridButton());

        const current = screen.getByRole("link", { name: "Dokimotes Dokibird" });
        expect(current).toHaveAttribute("href", "/");
        fireEvent.click(current);

        expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
        expect(queryPanel()).not.toBeInTheDocument();
    });

    it("closes after choosing the current site's row while already on the homepage", () => {
        renderMenu();
        fireEvent.click(gridButton());

        fireEvent.click(screen.getByRole("link", { name: "Dokimotes Dokibird" }));

        expect(queryPanel()).not.toBeInTheDocument();
    });

    it("links to the other sites and the hub with plain links", () => {
        renderMenu();
        fireEvent.click(gridButton());

        expect(screen.getByRole("link", { name: "Mintomotes Mint Fantome" })).toHaveAttribute("href", "/mintomotes/");
        expect(screen.getByRole("link", { name: "All my sites" })).toHaveAttribute("href", hubUrl);
    });

    it("only shows All my sites when there are no sites", () => {
        renderMenu({ menuSites: [] });
        fireEvent.click(titleButton());

        const panel = queryPanel();
        expect(within(panel).getAllByRole("listitem")).toHaveLength(1);
        expect(within(panel).getByRole("link")).toHaveAccessibleName("All my sites");
        expect(within(panel).getByRole("link")).toHaveAttribute("href", hubUrl);
        expect(panel.querySelector("img")).toBeNull();
    });
});
