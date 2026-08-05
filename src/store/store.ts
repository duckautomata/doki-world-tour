import { create } from "zustand";
import { persist } from "zustand/middleware";

import { AppStore } from "./types";
import { createSettingsSlice } from "./settingsSlice";
import { createFilterSlice } from "./filterSlice";

export const useAppStore = create<AppStore>()(
    persist(
        (set, get, api) => ({
            ...createFilterSlice(set, get, api),
            ...createSettingsSlice(set, get, api),
        }),
        {
            name: "doki-world-tour-settings", // The key in localStorage
            // Only the settings slice persists; map filters reset per visit.
            partialize: (state) => ({
                theme: state.theme,
            }),
        },
    ),
);
