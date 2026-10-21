import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImageModal from "./ImageModal";

/** @type {import("../store/types").MediaItem} */
const baseItem = {
    kind: "upload",
    description: "Booth photo",
    source: "",
    platform: "",
    credit: "",
    media_id: "phOtO1",
    media_ext: ".jpg",
    urlOrig: "https://cdn.example/phOtO1.jpg",
    urlWebp: "https://cdn.example/phOtO1_p.webp",
};

const renderWithCredit = (credit) =>
    render(<ImageModal items={[{ ...baseItem, credit }]} selectedIndex={0} onClose={vi.fn()} />);

describe("ImageModal", () => {
    beforeEach(() => {
        // The modal HEADs the original to show its file size; keep it off the network.
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve({ headers: { get: () => null } })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows a credit that is a URL as a link to it, labelled with the URL itself", () => {
        renderWithCredit("https://www.example.com/artists/doki/");

        const link = screen.getByRole("link", { name: /Credit/i });
        expect(link).toHaveAttribute("href", "https://www.example.com/artists/doki/");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveTextContent("www.example.com/artists/doki");
        // No "Credit: ..." plain text version when it's a link
        expect(screen.queryByText(/^Credit:/)).not.toBeInTheDocument();
    });

    it("links a bare www. credit as https", () => {
        renderWithCredit("www.example.com/artists/doki");

        expect(screen.getByRole("link", { name: /Credit/i })).toHaveAttribute(
            "href",
            "https://www.example.com/artists/doki",
        );
    });

    it("keeps the full credit url in the title, where the cropped text can't show it", () => {
        const credit = "https://twitter.com/a_very_long_artist_handle/status/1234567890123456789";
        renderWithCredit(credit);

        const link = screen.getByRole("link", { name: /Credit/i });
        expect(link).toHaveAttribute("title", credit);
        // Visible text is the url without its scheme; CSS crops it to fit
        expect(link.querySelector(".source-link-url")).toHaveTextContent(
            "twitter.com/a_very_long_artist_handle/status/1234567890123456789",
        );
    });

    it("shows a credit that is not a URL as plain text", () => {
        renderWithCredit("@someartist");

        expect(screen.queryByRole("link", { name: /Credit/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Credit: @someartist/)).toBeInTheDocument();
    });
});
