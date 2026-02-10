import { post, get} from "./middleware";

export const getCalendarApi = (scenarioId) =>
    get(`/gtfs/data/calendar/?scenario_id=${scenarioId}`);

export const previewShapeApi = (data) =>
    post(`/gtfs/data/preview-shape/`, data);