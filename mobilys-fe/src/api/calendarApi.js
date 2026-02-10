import { get } from "./middleware";

export const getServicePerScenario = (params = {}) =>
  get(`/gtfs/data/calendar`, params);