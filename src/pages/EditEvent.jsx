import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TurnstileWidget from "../components/TurnstileWidget";
import ImageDropZone from "../components/ImageDropZone";
import UnsavedChangesGuard from "../components/UnsavedChangesGuard";
import ConfirmSubmitModal from "../components/ConfirmSubmitModal";
import { fetchPublicConfig, uploadImage, submitSuggestion, validateImageFile } from "../utils/contentApi";
import { saveSuggestionId } from "../utils/suggestionIds";
import { isoToCsvDate, msToIsoDate, isValidCoordinate, parseEventDate, EVENT_TYPES } from "../utils/dataLoader";
import { LOG_ERROR } from "../utils/debug";
import notFoundImage from "../assets/404.png";
import "./SuggestionForms.css";

/**
 * @typedef {import("../store/types").EventData} EventData
 */

// Field names as they read in the one-line summary sent with an edit.
const FIELD_LABELS = {
    date: "date",
    event_name: "name",
    event_type: "event type",
    image_source: "image source",
    place: "venue",
    city: "city",
    country: "country",
    latitude: "latitude",
    longitude: "longitude",
};

// Normalizes a type list to the canonical EVENT_TYPES order so click order
// (or CSV order) never registers as a change.
const normalizeTypes = (list) => EVENT_TYPES.filter((t) => (list ?? []).includes(t));

/**
 * @param {Object} props
 * @param {EventData[]} props.data
 */
export default function EditEvent({ data }) {
    const { event_id } = useParams();
    const event = useMemo(() => data.find((c) => c.event_id === event_id), [data, event_id]);

    const [cfg, setCfg] = useState(null);
    const [cfgError, setCfgError] = useState(null);

    const [mode, setMode] = useState("edit");

    const [name, setName] = useState(event?.event_name ?? "");
    const [types, setTypes] = useState(event?.eventTypes ?? []);
    const [date, setDate] = useState(event ? msToIsoDate(event.dateValue) : "");
    const [place, setPlace] = useState(event?.place ?? "");
    const [city, setCity] = useState(event?.city ?? "");
    const [country, setCountry] = useState(event?.country ?? "");
    const [latitude, setLatitude] = useState(event ? String(event.latitude) : "");
    const [longitude, setLongitude] = useState(event ? String(event.longitude) : "");
    const [notes, setNotes] = useState("");
    const [reason, setReason] = useState("");

    // Events have a single heading image. A newly picked file replaces
    // any previous upload; removeImage suggests dropping the current one.
    const [pickedFile, setPickedFile] = useState(null);
    const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [imageSource, setImageSource] = useState(event?.image_source ?? "");

    // `null` = waiting on the widget; `""` = Turnstile disabled by the server
    // (submit-ready immediately); any other string = an actual issued token.
    // The page is submittable whenever this is non-null, so `=== null` is the
    // canonical "still waiting" check.
    const [turnstileToken, setTurnstileToken] = useState(null);
    const turnstileResetRef = useRef(null);
    const isUploadingRef = useRef(false);

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

    useEffect(() => {
        if (!pickedFile) {
            setLocalPreviewUrl(null);
            return undefined;
        }
        const url = URL.createObjectURL(pickedFile);
        setLocalPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [pickedFile]);

    useEffect(() => {
        if (!pickedFile || turnstileToken === null || busy) return;
        if (isUploadingRef.current) return;
        isUploadingRef.current = true;

        const token = turnstileToken;
        const file = pickedFile;
        setBusy("uploading");
        setError(null);

        (async () => {
            try {
                const result = await uploadImage({ token, file });
                setUploadedImage({ ...result, file_name: file.name });
                setRemoveImage(false);
            } catch (err) {
                LOG_ERROR("Upload failed", err);
                setError(`Upload failed: ${err.message}`);
            } finally {
                setPickedFile(null);
                isUploadingRef.current = false;
                setBusy(null);
                turnstileResetRef.current?.();
            }
        })();
    }, [pickedFile, turnstileToken, busy]);

    const toggleType = (type) => {
        setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
    };

    const editChanges = useMemo(() => {
        if (!event) return {};
        const changes = {};
        if (name.trim() !== event.event_name) changes.event_name = name.trim();
        const newTypes = normalizeTypes(types);
        if (newTypes.join(", ") !== normalizeTypes(event.eventTypes).join(", ")) changes.event_type = newTypes;
        const parsedDate = date ? parseEventDate(isoToCsvDate(date)) : null;
        if (parsedDate && parsedDate.getTime() !== event.dateValue) changes.date = isoToCsvDate(date);
        if (place.trim() !== (event.place ?? "")) changes.place = place.trim();
        if (city.trim() !== event.city) changes.city = city.trim();
        if (country.trim() !== event.country) changes.country = country.trim();
        if (isValidCoordinate(latitude, 90) && Number(latitude.trim()) !== event.latitude) {
            changes.latitude = latitude.trim();
        }
        if (isValidCoordinate(longitude, 180) && Number(longitude.trim()) !== event.longitude) {
            changes.longitude = longitude.trim();
        }
        if (imageSource.trim() !== (event.image_source ?? "")) changes.image_source = imageSource.trim();
        return changes;
    }, [event, name, types, date, place, city, country, latitude, longitude, imageSource]);

    if (!event) {
        return (
            <div className="suggestion-page">
                <Link to="/" className="suggestion-back">
                    <span className="back-arrow">←</span> Back to Map
                </Link>
                <div className="suggestion-card glass-panel">
                    <img src={notFoundImage} alt="Not found" className="not-found-image" />
                    <h1 className="suggestion-title">Event not found</h1>
                    <p className="suggestion-subtitle">
                        No event was found with id <code>{event_id}</code>.
                    </p>
                </div>
            </div>
        );
    }

    const imageAction = uploadedImage ? "replace" : removeImage ? "remove" : "keep";
    const editHasChanges = Object.keys(editChanges).length > 0 || imageAction !== "keep";
    const canSubmitEdit =
        editHasChanges &&
        name.trim().length > 0 &&
        types.length > 0 &&
        date.length > 0 &&
        city.trim().length > 0 &&
        country.trim().length > 0 &&
        isValidCoordinate(latitude, 90) &&
        isValidCoordinate(longitude, 180) &&
        turnstileToken !== null &&
        !busy;
    const canSubmitDelete = reason.trim().length > 0 && turnstileToken !== null && !busy;

    const isDirty =
        !success &&
        (mode === "edit" ? editHasChanges || pickedFile !== null || notes.trim().length > 0 : reason.trim().length > 0);

    const handleFileSelected = (file) => {
        setError(null);
        setSuccess(null);
        const validationError = validateImageFile(file, cfg);
        if (validationError) {
            setError(validationError);
            return;
        }
        setUploadedImage(null);
        setPickedFile(file);
    };

    const handleClearImage = () => {
        if (busy) return;
        setPickedFile(null);
        setUploadedImage(null);
        setError(null);
    };

    // Validate the active mode and open the confirmation modal; nothing is
    // sent until the user confirms.
    const handleSubmit = (e) => {
        e.preventDefault();
        if (mode === "edit" ? !canSubmitEdit : !canSubmitDelete) return;
        setError(null);
        setConfirmOpen(true);
    };

    const performSubmit = async () => {
        setConfirmOpen(false);
        setError(null);

        if (mode === "edit") {
            if (!canSubmitEdit) return; // re-check; state may have changed
            setBusy("submitting");
            try {
                const payload = {
                    target_id: event.event_id,
                    changes: editChanges,
                    image_action: imageAction,
                    notes: notes.trim(),
                };
                if (uploadedImage) {
                    payload.new_image = { image_id: uploadedImage.id, file_name: uploadedImage.file_name };
                }
                const changedFields = Object.keys(editChanges).map((field) => FIELD_LABELS[field] ?? field);
                if (imageAction === "replace") changedFields.push("heading image");
                if (imageAction === "remove") changedFields.push("image removal");
                const result = await submitSuggestion({
                    token: turnstileToken,
                    kind: "edit",
                    payload,
                    imageIds: uploadedImage ? [uploadedImage.id] : [],
                    summary: changedFields.length
                        ? `Update the ${changedFields.join(", ")} on '${event.event_name}'`
                        : `Edit the event '${event.event_name}'`,
                });
                saveSuggestionId(result.id);
                setSuccess(result);
            } catch (err) {
                LOG_ERROR("Submit failed", err);
                setError(`Submission failed: ${err.message}`);
            } finally {
                setBusy(null);
                turnstileResetRef.current?.();
            }
        } else {
            if (!canSubmitDelete) return; // re-check; state may have changed
            setBusy("submitting");
            try {
                const result = await submitSuggestion({
                    token: turnstileToken,
                    kind: "delete",
                    payload: {
                        target_id: event.event_id,
                        reason: reason.trim(),
                    },
                    summary: `Remove the event '${event.event_name}'`,
                });
                saveSuggestionId(result.id);
                setSuccess(result);
            } catch (err) {
                LOG_ERROR("Submit failed", err);
                setError(`Submission failed: ${err.message}`);
            } finally {
                setBusy(null);
                turnstileResetRef.current?.();
            }
        }
    };

    const handleModeChange = (newMode) => {
        if (busy || success) return;
        setMode(newMode);
        setError(null);
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
                        Your {mode === "delete" ? "removal" : "edit"} suggestion has been submitted for review.
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

    let dropzoneOverlay = null;
    if (busy === "uploading") {
        dropzoneOverlay = "Uploading…";
    } else if (pickedFile && turnstileToken === null) {
        dropzoneOverlay = "Waiting for verification…";
    }

    return (
        <div className="suggestion-page">
            <UnsavedChangesGuard when={isDirty} />
            <ConfirmSubmitModal
                open={confirmOpen}
                title={mode === "edit" ? "Submit edit?" : "Request removal?"}
                message={
                    mode === "edit" ? (
                        <>
                            Submit your correction for <strong>{event.event_name}</strong>?
                        </>
                    ) : (
                        <>
                            Request removal of <strong>{event.event_name}</strong>? An admin will review the request
                            before anything is removed.
                        </>
                    )
                }
                confirmLabel={mode === "edit" ? "Submit" : "Request Removal"}
                danger={mode === "delete"}
                onConfirm={performSubmit}
                onCancel={() => setConfirmOpen(false)}
            />
            <Link to="/" className="suggestion-back">
                <span className="back-arrow">←</span> Back to Map
            </Link>
            <div className="suggestion-card glass-panel">
                <h1 className="suggestion-title">Suggest a Correction</h1>
                <p className="suggestion-subtitle">
                    Editing <strong>{event.event_name}</strong>. An admin will review before any changes go live.
                </p>

                <div className="suggestion-mode-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        className={`suggestion-mode-tab ${mode === "edit" ? "active" : ""}`}
                        aria-selected={mode === "edit"}
                        onClick={() => handleModeChange("edit")}
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        role="tab"
                        className={`suggestion-mode-tab ${mode === "delete" ? "active" : ""}`}
                        aria-selected={mode === "delete"}
                        onClick={() => handleModeChange("delete")}
                    >
                        Remove
                    </button>
                </div>

                <form className="suggestion-form" onSubmit={handleSubmit}>
                    {mode === "edit" ? (
                        <>
                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-name">
                                    Event Name <span className="suggestion-field-required">*</span>
                                </label>
                                <input
                                    id="edit-name"
                                    className="suggestion-input"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
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
                                <label className="suggestion-field-label" htmlFor="edit-date">
                                    Date <span className="suggestion-field-required">*</span>
                                </label>
                                <input
                                    id="edit-date"
                                    className="suggestion-input"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-place">
                                    Venue
                                </label>
                                <input
                                    id="edit-place"
                                    className="suggestion-input"
                                    type="text"
                                    value={place}
                                    onChange={(e) => setPlace(e.target.value)}
                                    maxLength={200}
                                />
                            </div>

                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-city">
                                    City <span className="suggestion-field-required">*</span>
                                </label>
                                <input
                                    id="edit-city"
                                    className="suggestion-input"
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    required
                                    maxLength={100}
                                />
                            </div>

                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-country">
                                    Country <span className="suggestion-field-required">*</span>
                                </label>
                                <input
                                    id="edit-country"
                                    className="suggestion-input"
                                    type="text"
                                    value={country}
                                    onChange={(e) => setCountry(e.target.value)}
                                    required
                                    maxLength={100}
                                />
                            </div>

                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-latitude">
                                    Latitude <span className="suggestion-field-required">*</span>{" "}
                                    <span className="suggestion-field-hint">(-90 to 90)</span>
                                </label>
                                <input
                                    id="edit-latitude"
                                    className="suggestion-input"
                                    type="text"
                                    inputMode="decimal"
                                    value={latitude}
                                    onChange={(e) => setLatitude(e.target.value)}
                                    required
                                    maxLength={32}
                                />
                            </div>

                            <div className="suggestion-field">
                                <label className="suggestion-field-label" htmlFor="edit-longitude">
                                    Longitude <span className="suggestion-field-required">*</span>{" "}
                                    <span className="suggestion-field-hint">(-180 to 180)</span>
                                </label>
                                <input
                                    id="edit-longitude"
                                    className="suggestion-input"
                                    type="text"
                                    inputMode="decimal"
                                    value={longitude}
                                    onChange={(e) => setLongitude(e.target.value)}
                                    required
                                    maxLength={32}
                                />
                                <span className="suggestion-field-hint">
                                    Tip: right-click the venue on Google Maps to copy its coordinates.
                                </span>
                            </div>

                            <div className="suggestion-field">
                                <span className="suggestion-field-label">
                                    Heading Image{" "}
                                    <span className="suggestion-field-hint">
                                        (up to {maxMb} MB · {(cfg.supported_formats ?? []).join(", ")})
                                    </span>
                                </span>
                                {event.urlThumb && !uploadedImage && !removeImage && (
                                    <div className="suggestion-current-image">
                                        <img src={event.urlThumb} alt="Current heading" />
                                        <span className="suggestion-field-hint">Current image</span>
                                    </div>
                                )}
                                <ImageDropZone
                                    accept={acceptList}
                                    onSelect={handleFileSelected}
                                    previewSrc={localPreviewUrl ?? uploadedImage?.urls?.preview}
                                    overlay={dropzoneOverlay}
                                    onClear={handleClearImage}
                                    clearable={(pickedFile !== null || uploadedImage !== null) && !busy}
                                    placeholder="Drop a replacement image, or click to browse"
                                    hint="Replaces the current heading image"
                                    disabled={busy === "submitting"}
                                />
                                {event.urlThumb && (
                                    <label className="suggestion-checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={removeImage}
                                            disabled={uploadedImage !== null || !!busy}
                                            onChange={(e) => setRemoveImage(e.target.checked)}
                                        />
                                        Suggest removing the current image
                                    </label>
                                )}
                                {(event.urlThumb || pickedFile !== null || uploadedImage !== null) && !removeImage && (
                                    <div className="suggestion-image-source-field">
                                        <label className="suggestion-field-label" htmlFor="edit-image-source">
                                            Image Source{" "}
                                            <span className="suggestion-field-hint">
                                                (link or credit for the image)
                                            </span>
                                        </label>
                                        <input
                                            id="edit-image-source"
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
                                <label className="suggestion-field-label" htmlFor="edit-notes">
                                    Notes{" "}
                                    <span className="suggestion-field-hint">(anything else for the reviewer)</span>
                                </label>
                                <textarea
                                    id="edit-notes"
                                    className="suggestion-textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    maxLength={2000}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="suggestion-field">
                            <label className="suggestion-field-label" htmlFor="delete-reason">
                                Why should this event be removed? <span className="suggestion-field-required">*</span>
                            </label>
                            <textarea
                                id="delete-reason"
                                className="suggestion-textarea"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                maxLength={2000}
                            />
                        </div>
                    )}

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

                    {mode === "edit" && !editHasChanges && (
                        <div className="suggestion-status info">Nothing changed yet. Edit a field above first.</div>
                    )}

                    <div className="suggestion-actions">
                        <button
                            type="submit"
                            className="suggestion-submit-btn"
                            disabled={mode === "edit" ? !canSubmitEdit : !canSubmitDelete}
                        >
                            {busy === "submitting"
                                ? "Submitting…"
                                : mode === "edit"
                                  ? "Submit Correction"
                                  : "Request Removal"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
