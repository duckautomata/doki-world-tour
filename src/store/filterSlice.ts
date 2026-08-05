import { FilterSlice, AppSliceCreator } from "./types";

export const createFilterSlice: AppSliceCreator<FilterSlice> = (set) => ({
    searchText: "",
    setSearchText: (text) => set({ searchText: text }),
    dateRange: null,
    setDateRange: (range) => set({ dateRange: range }),
    filterCountry: "",
    setFilterCountry: (country) => set({ filterCountry: country }),
    filterEventType: "",
    setFilterEventType: (type) => set({ filterEventType: type }),
    selectedCityKey: null,
    setSelectedCityKey: (key) => set({ selectedCityKey: key }),
    showList: false,
    setShowList: (show) => set({ showList: show }),
});
