// oxlint-disable react/only-export-components
import { createBrowserRouter, useOutletContext } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Animate from "./pages/Animate";
import AddEvent from "./pages/AddEvent";
import EditEvent from "./pages/EditEvent";
import Suggestion from "./pages/Suggestion";
import SuggestionStatus from "./pages/SuggestionStatus";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

const HomeRoute = () => {
    const { data } = useOutletContext();
    return <Home data={data} />;
};

const AnimateRoute = () => {
    const { data } = useOutletContext();
    return <Animate data={data} />;
};

const EditEventRoute = () => {
    const { data } = useOutletContext();
    return <EditEvent data={data} />;
};

const errorElement = <RouteErrorBoundary />;

export const router = createBrowserRouter(
    [
        {
            path: "/",
            element: <App />,
            errorElement,
            children: [
                { index: true, element: <HomeRoute />, errorElement },
                { path: "animate", element: <AnimateRoute />, errorElement },
                { path: "add", element: <AddEvent />, errorElement },
                { path: "edit/:event_id", element: <EditEventRoute />, errorElement },
                { path: "suggestion", element: <Suggestion />, errorElement },
                { path: "my-suggestions", element: <SuggestionStatus />, errorElement },
            ],
        },
    ],
    { basename: "/doki-world-tour/" },
);
