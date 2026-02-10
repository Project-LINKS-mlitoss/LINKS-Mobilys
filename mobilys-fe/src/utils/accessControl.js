// src/utils/accessControl.js

export const norm = (v) => String(v).toLowerCase().trim();
export const uniq = (arr) => Array.from(new Set(arr));

export const enforceUserManagementAccess = (codes, roleOrLevel) => {
  const list = Array.isArray(codes) ? codes.filter(Boolean).map(norm) : [];

  let levelVal = "";
  if (roleOrLevel && typeof roleOrLevel === "object") {
    levelVal = norm(roleOrLevel.level);
  } else if (typeof roleOrLevel === "string") {
    levelVal = norm(roleOrLevel);
  } else {
    levelVal = "";
  }

  console.log("Role level for enforcement:", levelVal);
  const isSuperUser = levelVal === "super_user";

  if (isSuperUser) {
    return uniq([...list, "user-management"]);
  }

  // If we don't know the level, don't strip user-management
  if (!levelVal) {
    return list;
  }

  return list.filter((c) => c !== "user-management");
};

export const extractCodesFromUser = (user) => {
  const raw = user?.role?.accesses ?? [];
  const arr = Array.isArray(raw) ? raw : [];
  const mapped = arr
    .map((x) => {
      if (!x) return null;
      if (typeof x.access_code === "string") return x.access_code;
      if (typeof x.code === "string") return x.code;
      return null;
    })
    .filter(Boolean)
    .map(norm);
  return uniq(mapped);
};
