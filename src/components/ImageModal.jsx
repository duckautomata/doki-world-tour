import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import "./ImageModal.css";
import { LOG_ERROR } from "../utils/debug";
import { isUrl } from "../utils/textUtils";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

/**
 * ImageModal shows an event's heading image full-size, with its source
 * (rendered as a link when it is one), copy, and download actions. Events
 * have a single image, so unlike the sibling sites there is no gallery
 * navigation.
 *
 * @param {Object} props
 * @param {EventData} props.event the event whose image is shown
 * @param {function(): void} props.onClose
 */
export default function ImageModal({ event, onClose }) {
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedImage, setCopiedImage] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [fileSize, setFileSize] = useState(null);
    const [dimensions, setDimensions] = useState(null);

    // Fetch file size when the modal opens
    useEffect(() => {
        if (!event?.urlOrig) return undefined;

        let isMounted = true;
        const fetchSize = async () => {
            try {
                const response = await fetch(event.urlOrig, { method: "HEAD" });
                const contentLength = response.headers.get("content-length");
                if (contentLength && isMounted) {
                    const size = parseInt(contentLength, 10);
                    if (size > 1024 * 1024) {
                        setFileSize((size / (1024 * 1024)).toFixed(2) + " MB");
                    } else if (size > 1024) {
                        setFileSize((size / 1024).toFixed(2) + " KB");
                    } else {
                        setFileSize(size + " B");
                    }
                }
            } catch (e) {
                // Silently handle if we can't fetch it, maybe CORS or network issue
                LOG_ERROR("Failed to fetch file size:", e);
            }
        };

        fetchSize();

        return () => {
            isMounted = false;
        };
    }, [event]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Escape") onClose();
        },
        [onClose],
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        // Prevent scrolling on body when modal is open
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [handleKeyDown]);

    if (!event?.urlOrig) return null;

    const handleBackgroundClick = (e) => {
        if (
            e.target.classList.contains("modal-overlay") ||
            e.target.classList.contains("modal-content") ||
            e.target.classList.contains("modal-image-container")
        ) {
            onClose();
        }
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(event.urlWebp);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2000);
        } catch (err) {
            LOG_ERROR("Failed to copy link:", err);
        }
    };

    const handleCopyImage = async () => {
        try {
            if (!navigator.clipboard || !window.ClipboardItem) {
                setErrorMsg("Copying images is not supported in your browser.");
                setTimeout(() => setErrorMsg(""), 3000);
                return;
            }

            const response = await fetch(event.urlOrig);
            const blob = await response.blob();

            let clipboardBlob = blob;

            // The Clipboard API mainly supports image/png.
            // Convert non-PNG images to PNG using a canvas.
            if (blob.type !== "image/png") {
                clipboardBlob = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        URL.revokeObjectURL(img.src);
                        const canvas = document.createElement("canvas");
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob((b) => {
                            if (b) {
                                resolve(b);
                            } else {
                                reject(new Error("Canvas toBlob failed"));
                            }
                        }, "image/png");
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(img.src);
                        reject(new Error("Image failed to load for conversion"));
                    };
                    img.src = URL.createObjectURL(blob);
                });
            }

            const item = new ClipboardItem({ [clipboardBlob.type]: clipboardBlob });
            await navigator.clipboard.write([item]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2000);
        } catch (err) {
            LOG_ERROR("Failed to copy image:", err);
            setErrorMsg(
                "Failed to copy image. Your browser might block cross-origin copying, or the image format might not be supported.",
            );
            setTimeout(() => setErrorMsg(""), 3000);
        }
    };

    const handleDownload = () => {
        const link = document.createElement("a");
        const fileName = `${event.event_name}${event.image_ext}`;
        link.href = `${event.urlOrig}?download=true&name=${encodeURIComponent(fileName)}`;
        // Suggest a filename
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImageLoad = (e) => {
        setDimensions(`${e.target.naturalWidth} × ${e.target.naturalHeight}`);
    };

    const source = event.image_source?.trim();

    // Portal to <body>: the card that opens this modal has a backdrop-filter
    // (and a hover transform), either of which would become the containing
    // block for position:fixed and trap the overlay inside the card.
    return createPortal(
        <div className="modal-overlay" onClick={handleBackgroundClick}>
            {errorMsg && <div className="modal-error-popup">{errorMsg}</div>}
            <div className="modal-content">
                <button className="modal-close" onClick={onClose} aria-label="Close">
                    ×
                </button>

                <div className="modal-image-container">
                    <img
                        src={event.urlWebp}
                        alt={event.event_name}
                        className="modal-image checkerboard-bg"
                        onLoad={handleImageLoad}
                    />
                </div>

                <div className="modal-info-bar">
                    <div className="modal-details">
                        <h3 className="modal-title">{event.event_name}</h3>
                        <div className="modal-meta">
                            {source &&
                                (isUrl(source) ? (
                                    <a
                                        href={source.startsWith("www.") ? `https://${source}` : source}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="modal-tag source-tag"
                                        style={{ textDecoration: "none" }}
                                    >
                                        <span style={{ marginRight: "4px" }}>🔗</span>
                                        Source
                                    </a>
                                ) : (
                                    <span className="modal-tag source-tag" title={source}>
                                        Source: {source}
                                    </span>
                                ))}
                            <span className="modal-tag id-tag">ID: {event.image_id}</span>
                            {dimensions && <span className="modal-tag dim-tag">{dimensions}</span>}
                            {fileSize && <span className="modal-tag size-tag">{fileSize}</span>}
                            <span className="modal-tag ext-tag">Original: {event.image_ext.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="modal-action-btn" onClick={handleCopyLink} title="Copy Link">
                            <span className="icon">🔗</span>
                            {copiedLink ? "Copied Link!" : "Copy Link"}
                        </button>
                        {event.image_ext !== ".gif" && (
                            <button
                                className="modal-action-btn"
                                onClick={handleCopyImage}
                                title="Copy Original Image Data"
                            >
                                <span className="icon">📋</span>
                                {copiedImage ? "Copied Image!" : "Copy Image"}
                            </button>
                        )}
                        <button className="modal-action-btn primary" onClick={handleDownload} title="Download Original">
                            <span className="icon">⬇️</span>
                            Download Original
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
