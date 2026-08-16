import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import TurnstileWidget from "../components/TurnstileWidget";
import ImageDropZone from "../components/ImageDropZone";
import MediaList from "../components/MediaList";
import UnsavedChangesGuard from "../components/UnsavedChangesGuard";
import ConfirmSubmitModal from "../components/ConfirmSubmitModal";
import { fetchPublicConfig, uploadImage, submitSuggestion, validateImageFile } from "../utils/contentApi";
import { saveSuggestionId } from "../utils/suggestionIds";
import { isoToCsvDate, EVENT_TYPES } from "../utils/dataLoader";
import { emptyLinkDraft, isMediaComplete, mediaToPayload, uploadToDraft } from "../utils/mediaDrafts";
import { LOG_ERROR } from "../utils/debug";
import "./SuggestionForms.css";

export default function AddEvent() {
    const [cfg, setCfg] = useState(null);
    const [cfgError, setCfgError] = useState(null);

    const [name, setName] = useState("");
    const [types, setTypes] = useState([]);
    const [date, setDate] = useState("");
    const [place, setPlace] = useState("");
    const [city, setCity] = useState("");
    const [country, setCountry] = useState("");
    const [notes, setNotes] = useState("");

    // Entries queued with "Add to list". The whole batch goes out as ONE
    // suggestion (one Turnstile token, one reference id) so people adding a
    // tour's worth of events don't have to submit N separate forms.
    const [batch, setBatch] = useState([]);

    // Events have a single heading image; picking a new file replaces any
    // previously uploaded one.
    const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imageSource, setImageSource] = useState("");

    // Links and uploaded files shown on the event's view page.
    const [media, setMedia] = useState([]);

    // One queue for every file the form uploads (the heading image and media
    // alike) so only one Turnstile token is ever in flight.
    const [uploadQueue, setUploadQueue] = useState([]); // [{ target: "heading" | "media", file }]

    // `null` = waiting on the widget; `""` = Turnstile disabled by the server
    // (submit-ready immediately); any other string = an actual issued token.
    // The page is submittable whenever this is non-null, so `=== null` is the
    // canonical "still waiting" check.
    const [turnstileToken, setTurnstileToken] = useState(null);
    const turnstileResetRef = useRef(null);
    const isUploadingRef = useRef(false);
    const jobUidRef = useRef(0);

    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        fetchPublicConfig()
            .then(setCfg)
            .catch((err) => {
                LOG_ERROR("Failed to fetch public config", err);
                setCfgError(err.message);
            });
    }, []);

    // Server-controlled toggle. Default to enabled if the field is missing
    // (older backend that doesn't return it yet) so we never accidentally
    // bypass verification when we shouldn't.
    const turnstileEnabled = cfg?.turnstile_enabled ?? true;

    // When the server says Turnstile is off, the widget never mounts so it
    // never emits onToken(""). Sync the token state here so submit gates open
    // as soon as the page is interactive.
    useEffect(() => {
        if (cfg && !turnstileEnabled) {
            setTurnstileToken("");
        }
    }, [cfg, turnstileEnabled]);

    const pendingHeadingFile = uploadQueue.find((job) => job.target === "heading")?.file ?? null;
    useEffect(() => {
        if (!pendingHeadingFile) {
            setLocalPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(pendingHeadingFile);
        setLocalPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [pendingHeadingFile]);

    useEffect(() => {
        if (uploadQueue.length === 0 || turnstileToken === null || busy) return;
        if (isUploadingRef.current) return;
        isUploadingRef.current = true;

        const token = turnstileToken;
        const job = uploadQueue[0];
        setBusy("uploading");
        setError(null);

        (async () => {
            try {
                const result = await uploadImage({ token, file: job.file });
                if (job.target === "heading") {
                    setUploadedImage({ ...result, file_name: job.file.name });
                } else {
                    setMedia((prev) => [...prev, uploadToDraft(result, job.file)]);
                }
            } catch (err) {
                LOG_ERROR("Upload failed", err);
                setError(`Upload failed: ${err.message}`);
            } finally {
                setUploadQueue((prev) => prev.filter((queued) => queued.uid !== job.uid)); // done, failed or not
                isUploadingRef.current = false;
                setBusy(null);
                turnstileResetRef.current?.();
            }
        })();
    }, [uploadQueue, turnstileToken, busy]);

    const toggleType = (type) => {
        setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
    };

    // A link row with no URL or platform yet would be dropped silently on
    // submit, so it blocks the entry the same way a half-filled form does.
    const mediaIncomplete = media.some((item) => !isMediaComplete(item));

    // The entry currently in the form fields. "Valid" means submittable on
    // its own; "empty" means untouched (notes are batch-level, so excluded).
    // No coordinates here, admins geocode from the venue on review.
    const currentValid =
        name.trim().length > 0 &&
        types.length > 0 &&
        date.length > 0 &&
        city.trim().length > 0 &&
        country.trim().length > 0 &&
        !mediaIncomplete;
    const currentEmpty =
        name.trim().length === 0 &&
        types.length === 0 &&
        date.length === 0 &&
        place.trim().length === 0 &&
        city.trim().length === 0 &&
        country.trim().length === 0 &&
        uploadQueue.length === 0 &&
        uploadedImage === null &&
        imageSource.trim().length === 0 &&
        media.length === 0;

    // A valid in-progress entry is submitted along with the queue; a
    // half-filled one blocks submission so it can't be lost silently.
    const totalCount = batch.length + (currentValid ? 1 : 0);
    const canSubmit = totalCount > 0 && (currentValid || currentEmpty) && turnstileToken !== null && !busy;
    const canAddToList = currentValid && !busy;

    const isDirty = !success && (batch.length > 0 || notes.trim().length > 0 || !currentEmpty);

    const buildEntry = () => ({
        dateIso: date,
        name: name.trim(),
        // Canonical display order regardless of click order.
        types: EVENT_TYPES.filter((t) => types.includes(t)),
        place: place.trim(),
        city: city.trim(),
        country: country.trim(),
        uploadedImage,
        imageSource: imageSource.trim(),
        media,
    });

    const clearEntryFields = () => {
        setName("");
        setTypes([]);
        setDate("");
        setPlace("");
        setCity("");
        setCountry("");
        setUploadQueue([]);
        setUploadedImage(null);
        setImageSource("");
        setMedia([]);
        setError(null);
    };

    const handleAddToList = () => {
        if (!canAddToList) return;
        setBatch((prev) => [...prev, buildEntry()]);
        clearEntryFields();
    };

    const handleRemoveEntry = (index) => {
        if (busy) return;
        setBatch((prev) => prev.filter((_, i) => i !== index));
    };

    // Loads a queued entry back into the form for corrections.
    const handleEditEntry = (index) => {
        if (busy) return;
        if (!currentEmpty) {
            setError("Add or clear the entry you're working on before editing a queued one.");
            return;
        }
        const entry = batch[index];
        setName(entry.name);
        setTypes(entry.types);
        setDate(entry.dateIso);
        setPlace(entry.place);
        setCity(entry.city);
        setCountry(entry.country);
        setUploadedImage(entry.uploadedImage);
        setImageSource(entry.imageSource);
        setMedia(entry.media);
        setBatch((prev) => prev.filter((_, i) => i !== index));
        setError(null);
    };

    // Queues a file for upload; `target` decides whether the result becomes
    // the heading image or another media row.
    const queueUpload = (file, target) => {
        setError(null);
        setSuccess(null);
        const validationError = validateImageFile(file, cfg);
        if (validationError) {
            setError(validationError);
            return;
        }
        const job = { uid: `job-${(jobUidRef.current += 1)}`, target, file };
        // A second heading pick replaces one still waiting in the queue;
        // media files all queue up behind each other.
        if (target === "heading") {
            setUploadedImage(null);
            setUploadQueue((prev) => [...prev.filter((queued) => queued.target !== "heading"), job]);
            return;
        }
        setUploadQueue((prev) => [...prev, job]);
    };

    const handleClearImage = () => {
        if (busy) return;
        setUploadQueue((prev) => prev.filter((job) => job.target !== "heading"));
        setUploadedImage(null);
        setImageSource("");
        setError(null);
    };

    const handleMediaChange = (uid, patch) => {
        setMedia((prev) => prev.map((item) => (item.uid === uid ? { ...item, ...patch } : item)));
    };

    const handleMediaRemove = (uid) => {
        if (busy) return;
        setMedia((prev) => prev.filter((item) => item.uid !== uid));
    };

    // Validate and open the confirmation modal; nothing is sent until the
    // user confirms.
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setError(null);
        setConfirmOpen(true);
    };

    const entryToPayload = (entry) => ({
        date: isoToCsvDate(entry.dateIso),
        event_name: entry.name,
        event_type: entry.types,
        place: entry.place,
        city: entry.city,
        country: entry.country,
        image_source: entry.imageSource,
        image: entry.uploadedImage
            ? { image_id: entry.uploadedImage.id, file_name: entry.uploadedImage.file_name }
            : null,
        media: entry.media.map(mediaToPayload),
    });

    const performSubmit = async () => {
        setConfirmOpen(false);
        if (!canSubmit) return; // re-check; state may have changed
        setError(null);
        setBusy("submitting");
        try {
            const entries = [...batch, ...(currentValid ? [buildEntry()] : [])];
            // A single entry keeps the original flat payload shape; a batch
            // nests them so admins see one reviewable unit.
            const payload =
                entries.length === 1
                    ? { ...entryToPayload(entries[0]), notes: notes.trim() }
                    : { events: entries.map(entryToPayload), notes: notes.trim() };
            const names = entries.map((entry) => `'${entry.name}'`);
            const result = await submitSuggestion({
                token: turnstileToken,
                kind: "new",
                payload,
                imageIds: entries.flatMap((entry) => [
                    ...(entry.uploadedImage ? [entry.uploadedImage.id] : []),
                    ...entry.media.filter((item) => item.kind === "upload").map((item) => item.media_id),
                ]),
                summary:
                    entries.length === 1
                        ? `Add the event ${names[0]}`
                        : `Add ${entries.length} events: ${names.join(", ")}`,
            });
            saveSuggestionId(result.id);
            setSuccess({ ...result, count: entries.length });
        } catch (err) {
            LOG_ERROR("Submit failed", err);
            setError(`Submission failed: ${err.message}`);
        } finally {
            setBusy(null);
            turnstileResetRef.current?.();
        }
    };

    if (cfgError) {
        return (
            <div className="suggestion-page">
                <Link to="/" className="suggestion-back">
                    <span className="back-arrow">←</span> Back to Map
                </Link>
                <div className="suggestion-card glass-panel">
                    <div className="suggestion-status error">Failed to load suggestion config: {cfgError}</div>
                </div>
            </div>
        );
    }

    if (!cfg) {
        return (
            <div className="suggestion-page">
                <div className="suggestion-loading">Loading suggestion form…</div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="suggestion-page">
                <Link to="/" className="suggestion-back">
                    <span className="back-arrow">←</span> Back to Map
                </Link>
                <div className="suggestion-card glass-panel">
                    <h1 className="suggestion-title">Thanks!</h1>
                    <p className="suggestion-subtitle">
                        {success.count > 1
                            ? `Your ${success.count} event suggestions have been submitted for review as one batch.`
                            : "Your event suggestion has been submitted for review."}{" "}
                        Reference ID: <code>{success.id}</code> (saved on this device, you can track it under My
                        Suggestions).
                    </p>
                    <div className="suggestion-actions">
                        <Link to="/my-suggestions" className="suggestion-submit-btn" style={{ textDecoration: "none" }}>
                            View Status
                        </Link>
                        <Link to="/" className="suggestion-secondary-btn" style={{ textDecoration: "none" }}>
                            Back to Map
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const maxMb = (cfg.max_image_bytes / (1024 * 1024)).toFixed(0);
    const acceptList = (cfg.supported_formats ?? []).map((f) => `.${f}`).join(",");

    // Each dropzone reports on its own files: what is uploading right now,
    // what is still queued behind it, and whether Turnstile is holding
    // everything up.
    const overlayFor = (target) => {
        const pending = uploadQueue.filter((job) => job.target === target).length;
        if (pending === 0) return null;
        if (turnstileToken === null) return "Waiting for verification…";
        if (uploadQueue[0]?.target !== target) return `Queued… (${pending})`;
        return pending > 1 ? `Uploading… (${pending} left)` : "Uploading…";
    };

    return (
        <div className="suggestion-page">
            <UnsavedChangesGuard when={isDirty} />
            <ConfirmSubmitModal
                open={confirmOpen}
                title="Submit suggestion?"
                message={
                    totalCount > 1 ? (
                        <>
                            Submit <strong>{totalCount} new events</strong> for review
                            {currentValid ? " (including the one still in the form)" : ""}?
                        </>
                    ) : (
                        <>
                            Submit the new event <strong>{currentValid ? name.trim() : batch[0]?.name}</strong> for
                            review?
                        </>
                    )
                }
                confirmLabel="Submit"
                onConfirm={performSubmit}
                onCancel={() => setConfirmOpen(false)}
            />
            <Link to="/" className="suggestion-back">
                <span className="back-arrow">←</span> Back to Map
            </Link>
            <div className="suggestion-card glass-panel">
                <h1 className="suggestion-title">Suggest a New Event</h1>
                <p className="suggestion-subtitle">
                    Know a convention, concert, or other event Doki visited (or is about to) that&apos;s missing from
                    the map? Submit it here and an admin will review it before it&apos;s added. Adding several? Use{" "}
                    <strong>Add to list</strong> after each one and send them all in a single submission.
                </p>

                <form className="suggestion-form" onSubmit={handleSubmit}>
                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-name">
                            Event Name <span className="suggestion-field-required">*</span>
                        </label>
                        <input
                            id="add-name"
                            className="suggestion-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required={batch.length === 0}
                            maxLength={200}
                        />
                    </div>

                    <div className="suggestion-field">
                        <span className="suggestion-field-label">
                            Event Type <span className="suggestion-field-required">*</span>{" "}
                            <span className="suggestion-field-hint">(pick all that apply)</span>
                        </span>
                        <div className="suggestion-checkbox-group">
                            {EVENT_TYPES.map((type) => (
                                <label key={type} className="suggestion-checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={types.includes(type)}
                                        onChange={() => toggleType(type)}
                                        disabled={!!busy}
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-date">
                            Date <span className="suggestion-field-required">*</span>{" "}
                            <span className="suggestion-field-hint">(the day Doki appeared)</span>
                        </label>
                        <input
                            id="add-date"
                            className="suggestion-input"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required={batch.length === 0}
                        />
                    </div>

                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-place">
                            Venue{" "}
                            <span className="suggestion-field-hint">
                                (e.g. Los Angeles Convention Center. Used to place the event on the map)
                            </span>
                        </label>
                        <input
                            id="add-place"
                            className="suggestion-input"
                            type="text"
                            value={place}
                            onChange={(e) => setPlace(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-city">
                            City <span className="suggestion-field-required">*</span>
                        </label>
                        <input
                            id="add-city"
                            className="suggestion-input"
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            required={batch.length === 0}
                            maxLength={100}
                        />
                    </div>

                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-country">
                            Country <span className="suggestion-field-required">*</span>
                        </label>
                        <input
                            id="add-country"
                            className="suggestion-input"
                            type="text"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            required={batch.length === 0}
                            maxLength={100}
                        />
                    </div>

                    <div className="suggestion-field">
                        <label className="suggestion-field-label" htmlFor="add-notes">
                            Notes{" "}
                            <span className="suggestion-field-hint">
                                (anything else for the reviewer, applies to the whole submission)
                            </span>
                        </label>
                        <textarea
                            id="add-notes"
                            className="suggestion-textarea"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={2000}
                        />
                    </div>

                    <div className="suggestion-field">
                        <span className="suggestion-field-label">
                            Heading Image{" "}
                            <span className="suggestion-field-hint">
                                (optional · up to {maxMb} MB · {(cfg.supported_formats ?? []).join(", ")})
                            </span>
                        </span>
                        <ImageDropZone
                            accept={acceptList}
                            onSelect={(file) => queueUpload(file, "heading")}
                            previewSrc={localPreviewUrl ?? uploadedImage?.urls?.preview}
                            overlay={overlayFor("heading")}
                            onClear={handleClearImage}
                            clearable={(pendingHeadingFile !== null || uploadedImage !== null) && !busy}
                            placeholder="Drop an image, or click to browse"
                            hint="Shown as the event's heading image"
                            disabled={busy === "submitting"}
                        />
                        {(pendingHeadingFile !== null || uploadedImage !== null) && (
                            <div className="suggestion-image-source-field">
                                <label className="suggestion-field-label" htmlFor="add-image-source">
                                    Image Source{" "}
                                    <span className="suggestion-field-hint">(link or credit for the image)</span>
                                </label>
                                <input
                                    id="add-image-source"
                                    className="suggestion-input"
                                    type="text"
                                    value={imageSource}
                                    onChange={(e) => setImageSource(e.target.value)}
                                    placeholder="https://x.com/… or @artist"
                                    maxLength={500}
                                />
                            </div>
                        )}
                    </div>

                    <div className="suggestion-field">
                        <span className="suggestion-field-label">
                            Media{" "}
                            <span className="suggestion-field-hint">
                                (optional · VODs, clips, photos and videos shown on the event page)
                            </span>
                        </span>
                        <MediaList
                            items={media}
                            onChange={handleMediaChange}
                            onRemove={handleMediaRemove}
                            disabled={!!busy}
                        />
                        <div className="suggestion-image-add-block">
                            <div className="suggestion-media-add-actions">
                                <button
                                    type="button"
                                    className="suggestion-media-add-link"
                                    onClick={() => setMedia((prev) => [...prev, emptyLinkDraft()])}
                                    disabled={!!busy}
                                >
                                    + Add a link
                                </button>
                                <span className="suggestion-field-hint">
                                    or upload files below (up to {maxMb} MB · {(cfg.supported_formats ?? []).join(", ")}
                                    )
                                </span>
                            </div>
                            <div className="suggestion-image-add-dropzone">
                                <ImageDropZone
                                    accept={acceptList}
                                    multiple
                                    onSelect={(file) => queueUpload(file, "media")}
                                    previewSrc={null}
                                    overlay={overlayFor("media")}
                                    placeholder="Drop photos or videos, or click to browse"
                                    hint="Set the description & credit on each row after upload"
                                    disabled={busy === "submitting"}
                                />
                            </div>
                        </div>
                        {mediaIncomplete && (
                            <div className="suggestion-status info">
                                Every link needs a URL and a platform before this event can be submitted.
                            </div>
                        )}
                    </div>

                    <div className="suggestion-batch-section">
                        <div className="suggestion-batch-actions">
                            <button
                                type="button"
                                className="suggestion-secondary-btn"
                                onClick={handleAddToList}
                                disabled={!canAddToList}
                            >
                                {batch.length === 0 ? "+ Add to list (submit several at once)" : "+ Add another"}
                            </button>
                            {!currentEmpty && (
                                <button
                                    type="button"
                                    className="suggestion-batch-clear"
                                    onClick={clearEntryFields}
                                    disabled={!!busy}
                                >
                                    Clear entry
                                </button>
                            )}
                        </div>

                        {batch.length > 0 && (
                            <div className="suggestion-batch-list">
                                <span className="suggestion-field-label">
                                    Queued events ({batch.length})
                                    <span className="suggestion-field-hint">sent together as one submission</span>
                                </span>
                                {batch.map((entry, index) => (
                                    <div
                                        key={`${entry.name}-${entry.dateIso}-${index}`}
                                        className="suggestion-batch-row"
                                    >
                                        {entry.uploadedImage?.urls?.preview ? (
                                            <img
                                                className="suggestion-batch-row-thumb"
                                                src={entry.uploadedImage.urls.preview}
                                                alt=""
                                            />
                                        ) : (
                                            <div className="suggestion-batch-row-thumb suggestion-batch-row-placeholder">
                                                {entry.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="suggestion-batch-row-info">
                                            <span className="suggestion-batch-row-name">{entry.name}</span>
                                            <span className="suggestion-batch-row-meta">
                                                {entry.types.join(", ")} · {entry.dateIso} · {entry.city},{" "}
                                                {entry.country}
                                                {entry.media.length > 0 && ` · ${entry.media.length} media`}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="suggestion-batch-row-edit"
                                            onClick={() => handleEditEntry(index)}
                                            disabled={!!busy}
                                            aria-label={`Edit ${entry.name}`}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="suggestion-batch-row-remove"
                                            onClick={() => handleRemoveEntry(index)}
                                            disabled={!!busy}
                                            aria-label={`Remove ${entry.name}`}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {turnstileEnabled && (
                        <div className="suggestion-turnstile-block">
                            <span className="suggestion-field-hint">Human verification:</span>
                            <TurnstileWidget
                                enabled={turnstileEnabled}
                                siteKey={cfg.turnstile_site_key}
                                onToken={setTurnstileToken}
                                resetRef={turnstileResetRef}
                            />
                        </div>
                    )}

                    {error && <div className="suggestion-status error">{error}</div>}

                    {batch.length > 0 && !currentEmpty && !currentValid && (
                        <div className="suggestion-status info">
                            The entry you&apos;re working on is incomplete. Finish it, add it to the list, or clear it
                            before submitting.
                        </div>
                    )}

                    <div className="suggestion-actions">
                        <button type="submit" className="suggestion-submit-btn" disabled={!canSubmit}>
                            {busy === "submitting"
                                ? "Submitting…"
                                : totalCount > 1
                                  ? `Submit ${totalCount} Events`
                                  : "Submit Suggestion"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
