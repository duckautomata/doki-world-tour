import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVersionCheck } from "../utils/useVersionCheck";
import "./UpdateAlert.css";

const UpdateAlert = () => {
    const { updateAvailable } = useVersionCheck();
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        // Navigate to root to bypass GitHub 404 query string caching issues, then reload
        navigate("/", { replace: true });
        setTimeout(() => {
            window.location.reload(true);
        }, 100);
    };

    if (!updateAvailable) return null;

    return (
        <div className="update-alert-container">
            <div className="update-alert-content">
                <div className="update-alert-text">
                    <h4 className="update-alert-title">Update Available</h4>
                    <h5 className="update-alert-message">
                        Refresh the page or click the update button to update the website.
                    </h5>
                </div>
                <button
                    className={`update-alert-button ${refreshing ? "loading" : ""}`}
                    onClick={handleRefresh}
                    disabled={refreshing}
                >
                    {refreshing ? (
                        <>
                            <span className="spinner"></span>
                            Updating...
                        </>
                    ) : (
                        "Update"
                    )}
                </button>
            </div>
        </div>
    );
};

export default UpdateAlert;
