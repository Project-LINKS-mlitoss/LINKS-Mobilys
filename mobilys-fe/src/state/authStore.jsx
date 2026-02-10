import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import { clearAllIndexedDB } from "../utils/indexDb";
import { norm, uniq, enforceUserManagementAccess, extractCodesFromUser } from "../utils/accessControl";

// --- helpers ---
const safeParse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

export const useAuthStore = create((set) => ({
  // tokens & misc from localStorage
  access: localStorage.getItem("access") || null,
  refresh: localStorage.getItem("refresh") || null,
  mapUrl: localStorage.getItem("map_url") || null,

  // session-scoping
  projectId: localStorage.getItem("project_id") || null,
  projectName: localStorage.getItem("project_name") || null, // optional (for display)
  roleLevel: localStorage.getItem("role_level") || null,

  // minimal user identity
  userId: localStorage.getItem("user_id") || null,
  username: localStorage.getItem("username") || null,
  email: localStorage.getItem("email") || null,

  // role-based access codes (null = loading state at app start)
  accessCodes: safeParse(localStorage.getItem("access_codes"), null),

  setTokens: (payload) => {
    const { access, refresh } = payload || {};
    if (typeof access !== "string" || typeof refresh !== "string") return;

    // 1) Persist tokens
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);

    // 2) Optional: map_url from JWT
    let mapUrl = null;
    try {
      const jwt = jwtDecode(access);
      if (typeof jwt.map_url === "string") {
        mapUrl = jwt.map_url;
        localStorage.setItem("map_url", mapUrl);
      } else {
        localStorage.removeItem("map_url");
      }
    } catch {
      localStorage.removeItem("map_url");
    }

    // 3) Extract project/role 
    const projectId = payload.projectId ?? payload.project?.id ?? null;
    const projectName = payload.projectName ?? payload.project?.name ?? null;
    const roleLevel = payload.roleLevel ?? payload.user?.role?.level ?? null;

    // 4) Extract user identity 
    let userId = payload.userId ?? payload.user?.id ?? null;
    let username = payload.username ?? payload.user?.username ?? null;
    let email = payload.email ?? payload.user?.email ?? null;

    try {
      if (!userId || !username || !email) {
        const jwt = jwtDecode(access);
        userId = userId ?? (jwt.user_id ?? jwt.uid ?? jwt.sub ?? jwt.id ?? null);
        username = username ?? (jwt.username ?? jwt.user_name ?? jwt.preferred_username ?? null);
        email = email ?? jwt.email ?? null;
      }
    } catch {

    }

    // 5) Access codes: prefer payload > user > preserve existing
    const state = useAuthStore.getState();
    let nextAccessCodes = null;
    if (Array.isArray(payload?.accessCodes)) {
      nextAccessCodes = payload.accessCodes;
    } else if (payload?.user) {
      nextAccessCodes = extractCodesFromUser(payload.user);
    } else {
      nextAccessCodes = state.accessCodes; // preserve
    }
    const roleInfo =
      payload?.user?.role ||
      (roleLevel ? { level: roleLevel } : null) ||
      (state.roleLevel ? { level: state.roleLevel } : null);
    const normalizedCodes = Array.isArray(nextAccessCodes)
      ? enforceUserManagementAccess(nextAccessCodes, roleInfo)
      : null;

    if (Array.isArray(normalizedCodes)) {
      localStorage.setItem("access_codes", JSON.stringify(normalizedCodes));
    }

    // 6) Persist identity & project so they survive refresh
    if (projectId != null) localStorage.setItem("project_id", String(projectId));
    else localStorage.removeItem("project_id");
    if (projectName) localStorage.setItem("project_name", projectName);
    else localStorage.removeItem("project_name");
    if (roleLevel != null) localStorage.setItem("role_level", String(roleLevel));
    else localStorage.removeItem("role_level");

    if (userId != null) localStorage.setItem("user_id", String(userId));
    else localStorage.removeItem("user_id");
    if (username) localStorage.setItem("username", username);
    else localStorage.removeItem("username");
    if (email) localStorage.setItem("email", email);
    else localStorage.removeItem("email");

    // 7) Update store
    set({
      access,
      refresh,
      mapUrl,
      projectId: projectId || null,
      projectName: projectName || null,
      roleLevel: roleLevel || null,
      userId: userId != null ? String(userId) : null,
      username: username || null,
      email: email || null,
      accessCodes: Array.isArray(normalizedCodes) ? normalizedCodes : state.accessCodes,
    });
  },

  setAccessCodes: (codes) => {
    if (codes === null) {
      localStorage.removeItem("access_codes");
      set({ accessCodes: null });
      return;
    }
    const list = Array.isArray(codes) ? codes.filter(Boolean).map(norm) : [];
    const normalized = uniq(list);
    localStorage.setItem("access_codes", JSON.stringify(normalized));
    set({ accessCodes: normalized });
  },

  hasAccess: (code) => {
    // Access control disabled - all users can access all menus
    return true;
  },

  // Update only user info 
  setUserInfo: ({ userId, username, email }) => {
    userId != null ? localStorage.setItem("user_id", String(userId)) : localStorage.removeItem("user_id");
    username ? localStorage.setItem("username", username) : localStorage.removeItem("username");
    email ? localStorage.setItem("email", email) : localStorage.removeItem("email");

    set({
      userId: userId != null ? String(userId) : null,
      username: username || null,
      email: email || null,
    });
  },

  setMapUrl: (url) => {
    url ? localStorage.setItem("map_url", url) : localStorage.removeItem("map_url");
    set({ mapUrl: url || null });
  },

  logout: () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("map_url");
    localStorage.removeItem("project_id");
    localStorage.removeItem("project_name");
    localStorage.removeItem("role_level");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("access_codes");

    clearAllIndexedDB();

    set({
      access: null,
      refresh: null,
      mapUrl: null,
      projectId: null,
      projectName: null,
      roleLevel: null,
      userId: null,
      username: null,
      email: null,
      accessCodes: [],
    });
  },
}));