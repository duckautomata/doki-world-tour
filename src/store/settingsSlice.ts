import { SettingsSlice, AppSliceCreator } from "./types";

export const createSettingsSlice: AppSliceCreator<SettingsSlice> = (set) => ({
    theme: "system",
    setTheme: (theme) => set({ theme }),
});
