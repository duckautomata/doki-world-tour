import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ScrollToTop from "./ScrollToTop";

describe("ScrollToTop", () => {
    it("renders nothing initially when scroll position is 0", () => {
        render(<ScrollToTop />);
        const button = screen.queryByRole("button", { name: "Scroll to top" });
        expect(button).not.toBeInTheDocument();
    });

    it("shows button when scrolled past 300px", () => {
        render(<ScrollToTop />);

        // Mock scroll event
        window.scrollY = 400;
        fireEvent.scroll(window);

        const button = screen.getByRole("button", { name: "Scroll to top" });
        expect(button).toBeInTheDocument();
    });

    it("scrolls to top when clicked", () => {
        render(<ScrollToTop />);
        window.scrollTo = vi.fn();

        // Show button
        window.scrollY = 400;
        fireEvent.scroll(window);

        const button = screen.getByRole("button", { name: "Scroll to top" });
        fireEvent.click(button);

        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
});
