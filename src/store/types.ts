import { StateCreator } from "zustand";

// Data Structure Interfaces

// One row of media.csv. A row is either a link (source + platform) or an
// uploaded file (media_id + media_ext, optionally credited); `index` is its
// position among the rows belonging to the same event.
export interface MediaItem {
    index: number;
    kind: "link" | "upload";
    description: string;
    source: string;
    platform: string;
    credit: string;
    media_id: string;
    media_ext: string;
    urlOrig: string | null;
    urlWebp: string | null;
    urlThumb: string | null;
}

export interface EventData {
    event_id: string;
    date: string;
    dateValue: number;
    event_name: string;
    eventTypes: string[];
    place: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    image_id: string;
    image_ext: string;
    image_source: string;
    urlOrig: string | null;
    urlWebp: string | null;
    urlThumb: string | null;
    media: MediaItem[];
}

// One map marker: every event sharing a city + country, positioned at the
// mean of the member coordinates (venues in a city are km apart at most,
// which is sub-pixel at world scale).
export interface CityGroup {
    key: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    events: EventData[];
}

// Slice Interfaces

export interface FilterSlice {
    searchText: string;
    setSearchText: (text: string) => void;
    dateRange: [number, number] | null;
    setDateRange: (range: FilterSlice["dateRange"]) => void;
    filterCountry: string;
    setFilterCountry: (country: string) => void;
    filterEventType: string;
    setFilterEventType: (type: string) => void;
    selectedCityKey: string | null;
    setSelectedCityKey: (key: string | null) => void;
    // Deliberately not persisted: the list starts collapsed on every visit.
    showList: boolean;
    setShowList: (show: boolean) => void;
}

export interface SettingsSlice {
    theme: "light" | "system" | "dark";
    setTheme: (theme: SettingsSlice["theme"]) => void;
}

// The combined store type
export type AppStore = FilterSlice & SettingsSlice;

// Helper type for creating slices
export type AppSliceCreator<T> = StateCreator<AppStore, [], [], T>;
