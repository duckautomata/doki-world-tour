import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import "./ImageModal.css";
import { LOG_ERROR } from "../utils/debug";
import { isUrl } from "../utils/textUtils";

/**
 * @typedef {import("../store/types").MediaItem} MediaItem
 */

/**
 * ImageModal shows an uploaded media item full-size, with its credit
 * (rendered as a link when it is one), copy, and download actions. Several
 * items can be passed to browse them as a gallery; a single one (an event's
 * heading image) simply hides the navigation.
 *
 * @param {Object} props
 * @param {MediaItem[]} props.items the uploaded media to browse
 * @param {number} props.selectedIndex index of the item on screen
 * @param {function(): void} props.onClose
 * @param {function(number): void} [props.onNavigate] required when items has more than one entry
 */
export default function ImageModal({ items, selectedIndex, onClose, onNavigate }) {
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedImage, setCopiedImage] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [lastSelectedIndex, setLastSelectedIndex] = useState(selectedIndex);
    const [fileSize, setFileSize] = useState(null);
    const [dimensions, setDimensions] = useState(null);

    const item = items[selectedIndex];
    const isVideo = item?.media_ext === ".mp4";

    // Reset the per-item state when the gallery moves to another item.
    if (selectedIndex !== lastSelectedIndex) {
        setLastSelectedIndex(selectedIndex);
        setCopiedLink(false);
        setCopiedImage(false);
        setErrorMsg("");
        setFileSize(null);
        setDimensions(null);
    }

    // Fetch file size when the item changes. Keyed on the URL rather than the
    // item so a caller that rebuilds the item object every render (an event's
    // heading image, say) does not refetch on every render.
    const originalUrl = item?.urlOrig;
    useEffect(() => {
        if (!originalUrl) return undefined;

        let isMounted = true;
        const fetchSize = async () => {
            try {
                const response = await fetch(originalUrl, { method: "HEAD" });
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
    }, [originalUrl]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowRight") {
                if (selectedIndex < items.length - 1) onNavigate?.(selectedIndex + 1);
            } else if (e.key === "ArrowLeft") {
                if (selectedIndex > 0) onNavigate?.(selectedIndex - 1);
            }
        },
        [selectedIndex, items.length, onClose, onNavigate],
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

    if (!item?.urlOrig) return null;

    const title = item.description || item.media_id;
    const credit = item.credit?.trim();

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
            await navigator.clipboard.writeText(isVideo ? item.urlOrig : item.urlWebp);
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

            const response = await fetch(item.urlOrig);
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

            const clipboardItem = new ClipboardItem({ [clipboardBlob.type]: clipboardBlob });
            await navigator.clipboard.write([clipboardItem]);
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
        const fileName = `${title}${item.media_ext}`;
        link.href = `${item.urlOrig}?download=true&name=${encodeURIComponent(fileName)}`;
        // Suggest a filename
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImageLoad = (e) => {
        setDimensions(`${e.target.naturalWidth} × ${e.target.naturalHeight}`);
    };

    const handleVideoLoad = (e) => {
        setDimensions(`${e.target.videoWidth} × ${e.target.videoHeight}`);
    };

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
                    {isVideo ? (
                        <video
                            src={item.urlOrig}
                            className="modal-image checkerboard-bg"
                            controls
                            autoPlay
                            loop
                            onLoadedMetadata={handleVideoLoad}
                        />
                    ) : (
                        <img
                            src={item.urlWebp}
                            alt={title}
                            className="modal-image checkerboard-bg"
                            onLoad={handleImageLoad}
                        />
                    )}

                    {selectedIndex > 0 && (
                        <button
                            className="modal-nav prev"
                            onClick={() => onNavigate?.(selectedIndex - 1)}
                            aria-label="Previous media"
                        >
                            ‹
                        </button>
                    )}

                    {selectedIndex < items.length - 1 && (
                        <button
                            className="modal-nav next"
                            onClick={() => onNavigate?.(selectedIndex + 1)}
                            aria-label="Next media"
                        >
                            ›
                        </button>
                    )}
                </div>

                <div className="modal-info-bar">
                    <div className="modal-details">
                        <h3 className="modal-title">{title}</h3>
                        <div className="modal-meta">
                            {credit &&
                                (isUrl(credit) ? (
                                    <a
                                        href={credit.startsWith("www.") ? `https://${credit}` : credit}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="modal-tag source-tag"
                                        style={{ textDecoration: "none" }}
                                    >
                                        <span style={{ marginRight: "4px" }}>🔗</span>
                                        Source
                                    </a>
                                ) : (
                                    <span className="modal-tag source-tag" title={credit}>
                                        Credit: {credit}
                                    </span>
                                ))}
                            <span className="modal-tag id-tag">ID: {item.media_id}</span>
                            {dimensions && <span className="modal-tag dim-tag">{dimensions}</span>}
                            {fileSize && <span className="modal-tag size-tag">{fileSize}</span>}
                            <span className="modal-tag ext-tag">Original: {item.media_ext.toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="modal-action-btn" onClick={handleCopyLink} title="Copy Link">
                            <span className="icon">🔗</span>
                            {copiedLink ? "Copied Link!" : "Copy Link"}
                        </button>
                        {item.media_ext !== ".gif" && !isVideo && (
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
            {items.length > 1 && (
                <div className="modal-counter">
                    {selectedIndex + 1} / {items.length}
                </div>
            )}
        </div>,
        document.body,
    );
}
