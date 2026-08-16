import { PLATFORMS, detectPlatform } from "../utils/dataLoader";

/**
 * @typedef {Object} MediaDraft a media row being edited in a suggestion form
 * @property {string} uid stable key for the row
 * @property {"link" | "upload"} kind
 * @property {string} description
 * @property {string} source link URL (links only)
 * @property {string} platform where the link is from (links only)
 * @property {string} credit who the upload should be credited to (uploads only)
 * @property {string} [media_id]
 * @property {string} [media_ext]
 * @property {string | null} [previewUrl] thumbnail for upload rows
 * @property {string} [fileName]
 * @property {boolean} [deleted] set on existing rows the user wants removed
 */

/**
 * Editable list of media rows shared by the add and edit suggestion forms.
 * Link rows carry a platform and a URL; upload rows carry a thumbnail and an
 * optional credit. In "existing" mode the remove button marks the row for
 * deletion (and can undo it) instead of dropping it from the list.
 *
 * @param {Object} props
 * @param {MediaDraft[]} props.items
 * @param {(uid: string, patch: Object) => void} props.onChange
 * @param {(uid: string) => void} props.onRemove
 * @param {"new" | "existing"} [props.mode]
 * @param {boolean} [props.disabled]
 */
export default function MediaList({ items, onChange, onRemove, mode = "new", disabled = false }) {
    if (items.length === 0) return null;

    return (
        <div className="suggestion-media-list">
            {items.map((item) => {
                const label = item.description || item.fileName || item.source || item.media_id || "media";
                const isDeleted = !!item.deleted;
                return (
                    <div key={item.uid} className={`suggestion-media-row ${isDeleted ? "marked-deleted" : ""}`}>
                        {item.kind === "upload" ? (
                            <div className="suggestion-image-row-thumb">
                                {item.previewUrl && <img src={item.previewUrl} alt="" loading="lazy" />}
                            </div>
                        ) : (
                            <div className="suggestion-media-row-kind">Link</div>
                        )}

                        {isDeleted ? (
                            <span className="suggestion-image-row-deleted-label">Will request deletion</span>
                        ) : (
                            <div className="suggestion-media-row-fields">
                                {item.kind === "link" && (
                                    <>
                                        <select
                                            className={`suggestion-image-row-type ${item.platform ? "" : "is-empty"}`}
                                            value={item.platform}
                                            onChange={(e) => onChange(item.uid, { platform: e.target.value })}
                                            disabled={disabled}
                                            aria-label={`Platform for ${label}`}
                                        >
                                            <option value="">Platform</option>
                                            {PLATFORMS.map((platform) => (
                                                <option key={platform} value={platform}>
                                                    {platform}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            className="suggestion-image-row-source"
                                            type="text"
                                            value={item.source}
                                            // Filling the URL picks the platform for the user, but only
                                            // while they have not chosen one themselves.
                                            onChange={(e) =>
                                                onChange(item.uid, {
                                                    source: e.target.value,
                                                    platform: item.platform || detectPlatform(e.target.value),
                                                })
                                            }
                                            placeholder="https://www.youtube.com/watch?v=…"
                                            maxLength={500}
                                            disabled={disabled}
                                            aria-label={`Link for ${label}`}
                                        />
                                    </>
                                )}
                                <input
                                    className="suggestion-image-row-source"
                                    type="text"
                                    value={item.description}
                                    onChange={(e) => onChange(item.uid, { description: e.target.value })}
                                    placeholder="Description (what is this?)"
                                    maxLength={500}
                                    disabled={disabled}
                                    aria-label={`Description for ${label}`}
                                />
                                {item.kind === "upload" && (
                                    <input
                                        className="suggestion-image-row-source"
                                        type="text"
                                        value={item.credit}
                                        onChange={(e) => onChange(item.uid, { credit: e.target.value })}
                                        placeholder="Credit (link or @artist)"
                                        maxLength={500}
                                        disabled={disabled}
                                        aria-label={`Credit for ${label}`}
                                    />
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            className="suggestion-image-row-remove"
                            onClick={() => onRemove(item.uid)}
                            disabled={disabled}
                            title={mode === "existing" && isDeleted ? "Undo deletion" : undefined}
                            aria-label={
                                mode === "existing"
                                    ? isDeleted
                                        ? `Undo deletion of ${label}`
                                        : `Mark ${label} for deletion`
                                    : `Remove ${label}`
                            }
                        >
                            {isDeleted ? "↺" : "×"}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
