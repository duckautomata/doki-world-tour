import "./ConfirmSubmitModal.css";

/**
 * Confirmation modal shown before a suggestion form actually submits.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible.
 * @param {string} [props.title]
 * @param {import("react").ReactNode} [props.message]
 * @param {string} [props.confirmLabel]
 * @param {boolean} [props.danger] - Style the confirm button as destructive.
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export default function ConfirmSubmitModal({
    open,
    title = "Submit suggestion?",
    message = "Your suggestion will be sent for review.",
    confirmLabel = "Submit",
    danger = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    return (
        <div className="confirm-modal-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
            <div className="confirm-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                <h3 className="confirm-modal-title">{title}</h3>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-actions">
                    <button type="button" className="suggestion-secondary-btn" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`suggestion-submit-btn ${danger ? "danger" : ""}`}
                        onClick={onConfirm}
                        autoFocus
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
