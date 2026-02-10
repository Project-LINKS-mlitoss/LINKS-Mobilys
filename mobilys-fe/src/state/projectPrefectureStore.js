import { create } from "zustand";
import {
  getProjectPrefectureSelection,
  updateProjectPrefectureSelection,
} from "../api/visualizationApi";
import { useAuthStore } from "./authStore";

/**
 * Keep the current project's prefecture override in one place so
 * POI requests and UI stay in sync.
 */
export const useProjectPrefectureStore = create((set, get) => ({
  prefecture: null, // canonical name or null for default
  availablePrefectures: [],
  isDefault: true,
  projectId: null,
  loading: false,
  error: null,
  revision: 0, // bump when data changes to invalidate caches

  async fetchSelection(projectId) {
    const pid = projectId ?? useAuthStore.getState().projectId;
    const uid = useAuthStore.getState().userId;
    if (!pid && !uid) {
      set({
        prefecture: null,
        availablePrefectures: [],
        isDefault: true,
        projectId: null,
        error: "project_id or user_id is required to fetch prefecture selection",
        loading: false,
        revision: 0,
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await getProjectPrefectureSelection(pid);
      const data = res?.data?.data ?? res?.data ?? res ?? {};
      const pref = data.prefecture ?? null;
      set({
        prefecture: pref,
        availablePrefectures: Array.isArray(data.available_prefectures)
          ? data.available_prefectures
          : [],
        isDefault: data.is_default ?? pref === null,
        projectId: pid ?? null,
        loading: false,
        error: null,
        revision: Date.now(),
      });
    } catch (err) {
      set({
        loading: false,
        error:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load prefecture selection",
      });
    }
  },

  async saveSelection(prefecture) {
    const pid = get().projectId ?? useAuthStore.getState().projectId;
    const uid = useAuthStore.getState().userId;
    if (!pid && !uid) {
      const message = "project_id or user_id is required to update prefecture selection";
      set({ error: message });
      throw new Error(message);
    }
    set({ loading: true, error: null });
    try {
      const res = await updateProjectPrefectureSelection({
        projectId: pid,
        prefecture,
      });
      const data = res?.data?.data ?? res?.data ?? {};
      const pref = data.prefecture ?? null;
      set({
        prefecture: pref,
        isDefault: data.is_default ?? pref === null,
        projectId: pid,
        loading: false,
        error: null,
        revision: Date.now(),
      });
      return data;
    } catch (err) {
      set({
        loading: false,
        error:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update prefecture selection",
      });
      throw err;
    }
  },

  clear() {
    set({
      prefecture: null,
      availablePrefectures: [],
      isDefault: true,
      projectId: null,
      loading: false,
      error: null,
      revision: 0,
    });
  },
}));
