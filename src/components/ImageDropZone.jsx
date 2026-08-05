import { useRef, useState } from "react";

/**
 * Square dropzone with checkered transparency background. Click to browse,
 * drag-and-drop a file, or display a preview image with an optional × clear button.
 *
 * @param {Object} props
 * @param {string} [props.accept] - Native input accept list (e.g. ".png,.jpg").
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.multiple] - Allow picking/dropping multiple files. `onSelect` is called once per file.
 * @param {(file: File) => void} props.onSelect - Called with the picked/dropped file.
 * @param {string | null} [props.previewSrc] - Image URL to render. When null, the empty state is shown.
 * @param {string | null} [props.overlay] - Status text (e.g. "Uploading…"). Hides the × button while present.
 * @param {() => void} [props.onClear]
 * @param {boolean} [props.clearable] - Whether to show the × button on the preview.
 * @param {string} [props.placeholder]
 * @param {string} [props.hint]
 */
export default function ImageDropZone({
    accept,
    disabled = false,
    multiple = false,
    onSelect,
    previewSrc,
    overlay = null,
    onClear,
    clearable = false,
    placeholder = "Drop image or click to browse",
    hint,
}) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    const triggerInput = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    const acceptFiles = (fileList) => {
        if (disabled || !fileList) return;
        const files = Array.from(fileList);
        if (files.length === 0) return;
        if (multiple) {
            for (const f of files) onSelect?.(f);
        } else {
            onSelect?.(files[0]);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        if (disabled) return;
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        acceptFiles(e.dataTransfer.files);
    };

    const handleInputChange = (e) => {
        acceptFiles(e.target.files);
        e.target.value = "";
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerInput();
        }
    };

    const handleClearClick = (e) => {
        e.stopPropagation();
        onClear?.();
    };

    const className = [
        "suggestion-dropzone",
        isDragging ? "dragging" : "",
        disabled ? "disabled" : "",
        previewSrc ? "has-preview" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={className}
            onClick={triggerInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={placeholder}
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={handleInputChange}
                style={{ display: "none" }}
                disabled={disabled}
            />
            {previewSrc ? (
                <img src={previewSrc} alt="" className="suggestion-dropzone-image" />
            ) : (
                <div className="suggestion-dropzone-empty">
                    <strong>{isDragging ? "Drop to upload" : placeholder}</strong>
                    {hint && <span>{hint}</span>}
                </div>
            )}
            {overlay && <div className="suggestion-dropzone-overlay">{overlay}</div>}
            {clearable && previewSrc && !overlay && (
                <button
                    type="button"
                    className="suggestion-dropzone-clear"
                    onClick={handleClearClick}
                    aria-label="Remove image"
                >
                    ×
                </button>
            )}
        </div>
    );
}
