import { describe, it, expect } from "vitest";
import { isVideoFile, validateImageFile } from "./contentApi";

const MB = 1024 * 1024;
const CONFIG = {
    max_image_bytes: 25 * MB,
    max_video_bytes: 100 * MB,
    supported_formats: ["png", "gif", "mp4", "mkv"],
};

// A File's size comes from its contents; fake it rather than allocate 100 MB.
const fakeFile = (name, type, size) => {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
};

describe("isVideoFile", () => {
    it("goes by the declared type", () => {
        expect(isVideoFile(fakeFile("clip.bin", "video/mp4", 1))).toBe(true);
        expect(isVideoFile(fakeFile("pic.png", "image/png", 1))).toBe(false);
    });

    it("falls back to the extension when the browser gives no type", () => {
        expect(isVideoFile(fakeFile("clip.MKV", "", 1))).toBe(true);
        expect(isVideoFile(fakeFile("pic.png", "", 1))).toBe(false);
        expect(isVideoFile(fakeFile("mp4", "", 1))).toBe(false);
    });
});

describe("validateImageFile", () => {
    it("accepts anything while the config is still loading", () => {
        expect(validateImageFile(fakeFile("huge.png", "image/png", 999 * MB), null)).toBeNull();
    });

    it("holds images to the image cap", () => {
        expect(validateImageFile(fakeFile("ok.png", "image/png", 25 * MB), CONFIG)).toBeNull();
        expect(validateImageFile(fakeFile("big.png", "image/png", 25 * MB + 1), CONFIG)).toBe(
            "Image is larger than the 25 MB limit.",
        );
    });

    it("holds videos to the larger video cap", () => {
        expect(validateImageFile(fakeFile("ok.mp4", "video/mp4", 100 * MB), CONFIG)).toBeNull();
        expect(validateImageFile(fakeFile("big.mp4", "video/mp4", 100 * MB + 1), CONFIG)).toBe(
            "Video is larger than the 100 MB limit.",
        );
    });

    it("applies the image cap to videos when the server reports only one", () => {
        const legacy = { ...CONFIG, max_video_bytes: undefined };
        expect(validateImageFile(fakeFile("big.mp4", "video/mp4", 26 * MB), legacy)).toBe(
            "Video is larger than the 25 MB limit.",
        );
    });

    it("still rejects unsupported formats", () => {
        expect(validateImageFile(fakeFile("doc.pdf", "application/pdf", 1), CONFIG)).toBe(
            "Unsupported file format. Allowed: png, gif, mp4, mkv",
        );
    });
});
