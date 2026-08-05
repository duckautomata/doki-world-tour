import { useCallback } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import "./UnsavedChangesGuard.css";

/**
 * Renders a confirmation modal when the user tries to navigate away (in-app or
 * via browser unload) while `when` is true. Pair with form pages that have
 * unsaved input so the user doesn't lose work by misclicking a back link.
 *
 * @param {Object} props
 * @param {boolean} props.when - True while the form has unsaved changes.
 * @param {string} [props.title]
 * @param {string} [props.message]
 */
export default function UnsavedChangesGuard({
    when,
    title = "Discard changes?",
    message = "You've made changes on this page. Leaving now will discard them.",
}) {
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
    );

    useBeforeUnload(
        useCallback(
            (e) => {
                if (!when) return;
                e.preventDefault();
                e.returnValue = "";
            },
            [when],
        ),
    );

    if (!blocker || blocker.state !== "blocked") return null;

    const onStay = () => blocker.reset?.();
    const onLeave = () => blocker.proceed?.();

    return (
        <div className="unsaved-modal-overlay" role="dialog" aria-modal="true" onClick={onStay}>
            <div className="unsaved-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                <h3 className="unsaved-modal-title">{title}</h3>
                <p className="unsaved-modal-message">{message}</p>
                <div className="unsaved-modal-actions">
                    <button type="button" className="suggestion-secondary-btn" onClick={onStay}>
                        Stay on page
                    </button>
                    <button type="button" className="suggestion-submit-btn danger" onClick={onLeave}>
                        Discard &amp; leave
                    </button>
                </div>
            </div>
        </div>
    );
}
