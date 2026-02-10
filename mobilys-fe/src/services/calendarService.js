import { getServicePerScenario } from "../api/calendarApi";

export const getServicePerScenarioData = async (params = {}) => {
  const response = await getServicePerScenario(params);
  return response;
}