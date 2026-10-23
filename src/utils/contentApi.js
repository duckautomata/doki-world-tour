import { isMockMode } from "../config";
import * as real from "./contentApi.real";
import * as mock from "./contentApi.mock";

const impl = isMockMode ? mock : real;

export const { fetchPublicConfig, uploadImage, submitSuggestion, fetchSuggestionStatuses } = impl;

// The server caps a video higher than a still image (only a frame is extracted
// from a video, while an image gets a full WebP encode), so size is checked
// against the cap for the file's kind. Browsers type a file by its extension;
// the list covers the ones that come through with no type at all.
const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi"];

export const isVideoFile = (file) => {
    if (file.type?.startsWith("video/")) return true;
    const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    return VIDEO_EXTENSIONS.includes(ext);
};

export const validateImageFile = (file, cfg) => {
    if (!cfg) return null;
    const video = isVideoFile(file);
    // An older server reports a single cap; apply it to everything.
    const maxBytes = video ? (cfg.max_video_bytes ?? cfg.max_image_bytes) : cfg.max_image_bytes;
    if (file.size > maxBytes) {
        const mb = (maxBytes / (1024 * 1024)).toFixed(0);
        return `${video ? "Video" : "Image"} is larger than the ${mb} MB limit.`;
    }
    const formats = cfg.supported_formats ?? [];
    const lowerName = file.name.toLowerCase();
    const matchesFormat = formats.some((ext) => lowerName.endsWith(`.${ext.toLowerCase()}`));
    if (!matchesFormat) {
        return `Unsupported file format. Allowed: ${formats.join(", ")}`;
    }
    return null;
};
