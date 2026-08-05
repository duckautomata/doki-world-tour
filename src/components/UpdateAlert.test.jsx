import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import UpdateAlert from "./UpdateAlert";

const mockUseVersionCheck = vi.fn();
vi.mock("../utils/useVersionCheck", () => ({
    useVersionCheck: () => mockUseVersionCheck(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe("UpdateAlert", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // mock window.location.reload
        Object.defineProperty(window, "location", {
            writable: true,
            value: { reload: vi.fn() },
        });
    });

    it("renders nothing when no update is available", () => {
        mockUseVersionCheck.mockReturnValue({ updateAvailable: false });
        const { container } = render(
            <MemoryRouter>
                <UpdateAlert />
            </MemoryRouter>,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it("renders alert when update is available", () => {
        mockUseVersionCheck.mockReturnValue({ updateAvailable: true });
        render(
            <MemoryRouter>
                <UpdateAlert />
            </MemoryRouter>,
        );

        expect(screen.getByText("Update Available")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Update" })).toBeInTheDocument();
    });

    it("handles update button click", () => {
        vi.useFakeTimers();
        mockUseVersionCheck.mockReturnValue({ updateAvailable: true });

        render(
            <MemoryRouter>
                <UpdateAlert />
            </MemoryRouter>,
        );

        const updateButton = screen.getByRole("button", { name: "Update" });
        fireEvent.click(updateButton);

        expect(updateButton).toBeDisabled();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });

        vi.advanceTimersByTime(100);
        expect(window.location.reload).toHaveBeenCalledWith(true);

        vi.useRealTimers();
    });
});
