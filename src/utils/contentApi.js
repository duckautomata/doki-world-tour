import { isMockMode } from "../config";
import * as real from "./contentApi.real";
import * as mock from "./contentApi.mock";

const impl = isMockMode ? mock : real;

export const { fetchPublicConfig, uploadImage, submitSuggestion, fetchSuggestionStatuses } = impl;

export const validateImageFile = (file, cfg) => {
    if (!cfg) return null;
    if (file.size > cfg.max_image_bytes) {
        const mb = (cfg.max_image_bytes / (1024 * 1024)).toFixed(0);
        return `File is larger than the ${mb} MB limit.`;
    }
    const formats = cfg.supported_formats ?? [];
    const lowerName = file.name.toLowerCase();
    const matchesFormat = formats.some((ext) => lowerName.endsWith(`.${ext.toLowerCase()}`));
    if (!matchesFormat) {
        return `Unsupported file format. Allowed: ${formats.join(", ")}`;
    }
    return null;
};
