import { fetchMapListData, updateUserMaps } from "../api/userApi";
import { handleApiCall } from "../utils/errors/handleApiCall";
import { ERRORS } from "../constant/errorMessages";

export async function fetchMapListSvc() {
  return handleApiCall(() => fetchMapListData(), ERRORS.fetch.mapList);
}

export async function updateUserMapSvc(mapData) {
  return handleApiCall(() => updateUserMaps(mapData), ERRORS.user.updateMap);
}

