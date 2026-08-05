import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchSuggestionStatuses } from "../utils/contentApi";
import {
    isValidSuggestionId,
    loadSavedSuggestions,
    removeSuggestionId,
    saveSuggestionId,
} from "../utils/suggestionIds";
import { siteName } from "../config";
import { LOG_ERROR } from "../utils/debug";
import "./SuggestionForms.css";
import "./SuggestionStatus.css";

const STATUS_MEANINGS = {
    pending: "Waiting for review.",
    approved: "Accepted! The change is being worked on.",
    completed: "Done, the change is live on the site.",
    rejected: "Not accepted.",
};

const KIND_LABELS = {
    new: "New",
    edit: "Edit",
    delete: "Deletion",
};

const formatDate = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export default function SuggestionStatus() {
    const [entries, setEntries] = useState([]);
    const [statuses, setStatuses] = useState({});
    const [notFound, setNotFound] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [manualId, setManualId] = useState("");
    const [manualError, setManualError] = useState(null);
    const [adding, setAdding] = useState(false);

    const refresh = useCallback(async (ids) => {
        if (!ids.length) {
            setStatuses({});
            setNotFound([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchSuggestionStatuses(ids);
            const byId = {};
            for (const suggestion of data.suggestions) {
                byId[suggestion.id] = suggestion;
            }
            setStatuses(byId);
            setNotFound(data.not_found);
        } catch (err) {
            LOG_ERROR("Failed to fetch suggestion statuses", err);
            setError(`Failed to load statuses: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const saved = loadSavedSuggestions();
        setEntries(saved);
        refresh(saved.map((entry) => entry.id));
    }, [refresh]);

    const handleManualAdd = async (e) => {
        e.preventDefault();
        const id = manualId.trim();
        if (!id || adding) return;
        if (!isValidSuggestionId(id)) {
            setManualError("That doesn't look like a valid suggestion id (letters, digits, - and _ only).");
            return;
        }
        if (entries.some((entry) => entry.id === id)) {
            setManualError("That suggestion is already in your list.");
            return;
        }
        setManualError(null);
        setAdding(true);
        try {
            // Look the id up before saving it. The lookup is scoped to this
            // site server-side, so ids from another site come back not_found.
            const data = await fetchSuggestionStatuses([id]);
            const suggestion = data.suggestions.find((s) => s.id === id);
            if (!suggestion) {
                setManualError(
                    `No ${siteName} suggestion was found with that id. It may belong to another site, have been removed, or the id is wrong.`,
                );
                return;
            }
            const updated = saveSuggestionId(id);
            setEntries(updated);
            setStatuses((prev) => ({ ...prev, [id]: suggestion }));
            setManualId("");
        } catch (err) {
            LOG_ERROR("Failed to look up suggestion", err);
            setManualError(`Lookup failed: ${err.message}`);
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = (id) => {
        const updated = removeSuggestionId(id);
        setEntries(updated);
        setStatuses((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setNotFound((prev) => prev.filter((missingId) => missingId !== id));
    };

    const handleRefresh = () => {
        if (loading) return;
        refresh(entries.map((entry) => entry.id));
    };

    return (
        <div className="suggestion-page">
            <Link to="/" className="suggestion-back">
                <span className="back-arrow">←</span> Back to Map
            </Link>
            <div className="suggestion-card glass-panel">
                <div className="status-header">
                    <div>
                        <h1 className="suggestion-title">My Suggestions</h1>
                        <p className="suggestion-subtitle">
                            Suggestions you&apos;ve submitted from this device, with their review status and any admin
                            feedback. Removing one here only clears it from this list, it stays with the admins.
                        </p>
                    </div>
                    {entries.length > 0 && (
                        <button
                            type="button"
                            className="suggestion-secondary-btn status-refresh-btn"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            {loading ? "Refreshing…" : "Refresh"}
                        </button>
                    )}
                </div>

                {error && <div className="suggestion-status error">{error}</div>}

                {entries.length === 0 && !loading && (
                    <div className="suggestion-status info">
                        No saved suggestions yet. When you submit a suggestion, its reference id is saved here
                        automatically, or paste an id below to track one from another device.
                    </div>
                )}

                {entries.length > 0 && loading && Object.keys(statuses).length === 0 && (
                    <div className="suggestion-loading">Checking suggestion statuses…</div>
                )}

                <ul className="status-list">
                    {entries.map((entry) => {
                        const suggestion = statuses[entry.id];
                        const isMissing = notFound.includes(entry.id);

                        return (
                            <li key={entry.id} className="status-row">
                                <div className="status-row-header">
                                    {suggestion && (
                                        <span className={`status-pill ${suggestion.status}`}>{suggestion.status}</span>
                                    )}
                                    {isMissing && <span className="status-pill not-found">not found</span>}
                                    {suggestion && (
                                        <span className="status-kind">
                                            {KIND_LABELS[suggestion.kind] ?? suggestion.kind}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="status-remove-btn"
                                        onClick={() => handleRemove(entry.id)}
                                        aria-label={`Remove ${entry.id} from this list`}
                                        title="Remove from this list (doesn't delete the suggestion)"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {suggestion?.summary && <p className="status-summary">{suggestion.summary}</p>}

                                {suggestion && (
                                    <>
                                        <p className="status-meaning">{STATUS_MEANINGS[suggestion.status] ?? ""}</p>
                                        {suggestion.admin_context !== "" && (
                                            <div className="status-feedback">
                                                <span className="status-feedback-label">Admin feedback</span>
                                                <p className="status-feedback-text">{suggestion.admin_context}</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {isMissing && (
                                    <p className="status-meaning">
                                        Not found, it may have been removed by an admin, belong to another site, or the
                                        id is invalid. You can remove it from this list with the ✕ button.
                                    </p>
                                )}

                                {!suggestion && !isMissing && (
                                    <p className="status-meaning">{loading ? "Checking…" : "Status unavailable."}</p>
                                )}

                                <p className="status-dates">
                                    {suggestion && (
                                        <>
                                            Submitted {formatDate(suggestion.submitted_at)}
                                            {suggestion.updated_at !== suggestion.submitted_at && (
                                                <> · Updated {formatDate(suggestion.updated_at)}</>
                                            )}{" "}
                                            ·{" "}
                                        </>
                                    )}
                                    <code className="status-id">{entry.id}</code>
                                </p>
                            </li>
                        );
                    })}
                </ul>

                <form className="status-add-form" onSubmit={handleManualAdd}>
                    <label className="suggestion-field-label" htmlFor="status-add-id">
                        Track another suggestion{" "}
                        <span className="suggestion-field-hint">
                            (paste a reference id from another device. {siteName} suggestions only)
                        </span>
                    </label>
                    <div className="status-add-row">
                        <input
                            id="status-add-id"
                            className="suggestion-input"
                            type="text"
                            value={manualId}
                            onChange={(e) => {
                                setManualId(e.target.value);
                                setManualError(null);
                            }}
                            placeholder="sug_…"
                            maxLength={64}
                        />
                        <button
                            type="submit"
                            className="suggestion-submit-btn"
                            disabled={manualId.trim().length === 0 || loading || adding}
                        >
                            {adding ? "Checking…" : "Add"}
                        </button>
                    </div>
                    {manualError && <div className="suggestion-status error">{manualError}</div>}
                </form>
            </div>
        </div>
    );
}
