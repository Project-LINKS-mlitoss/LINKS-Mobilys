import {
    fetchSimulationScenariosApi,
    fetchSimulationScenarioDetailApi,
    createSimulationScenarioApi,
    getOperatingEconomicsDefaultsApi,
    getUnionCalendarByDatesApi,
    getSimulationInitDataApi,
    runSimulationApi,
    getSpeedChangeDefaultsApi,
    getDetailCarRoutingApi,
    getDetailCarVolumeApi,
    getSimulationBenefitCalculationApi,
    getChangedRoutesApi,
    getRidershipChangesApi,
    getSimulationSummaryApi,
    renameSimulationScenarioApi,
    deleteSimulationScenarioApi,
    getCo2ByRouteApi,
    getCo2TotalsApi,
    validateAndSaveSimulationCsvApi,
    getValidationResultApi,
    deleteValidationResultApi,
} from "../api/simulationApi";
import { ERRORS as ERROR_MESSAGES } from "../constant";
import { handleApiCall } from "../utils/errors/handleApiCall";

//simulation scenario services
export async function fetchSimulationScenarios() {
    return handleApiCall(
        () => fetchSimulationScenariosApi(),
        ERROR_MESSAGES.simulation.listFetchFailed
    );
}

export async function fetchSimulationScenariosDetail(scenarioId) {
    if (!scenarioId) {
        throw new Error(
            "Scenario ID is required to fetch simulation scenario detail."
        );
    }

    return handleApiCall(
        () => fetchSimulationScenarioDetailApi(scenarioId),
        ERROR_MESSAGES.simulation.detailFetchFailed
    );
}

export async function createSimulationScenario(data) {
    if (!data) {
        throw new Error(
            "Data is required to create a new simulation scenario."
        );
    }

    return handleApiCall(
        () => createSimulationScenarioApi(data),
        ERROR_MESSAGES.simulation.createFailed
    );
}

//simulation operating economics services
export async function getOperatingEconomicsDefaults(simulationId) {
    return handleApiCall(
        () => getOperatingEconomicsDefaultsApi({ simulationId }),
        ERROR_MESSAGES.simulation.operatingEconomicsFetchFailed
    );
}

//simulation speed change services
export async function getSpeedChangeDefaults(simulationId) {
    return handleApiCall(
        () =>
            getSpeedChangeDefaultsApi({
                simulationId,
            }),
        ERROR_MESSAGES.simulation.speedChangeDefaultsFetchFailed
    );
}

export async function getUnionCalendarByDates({ date, simulationID }) {
    return handleApiCall(
        () =>
            getUnionCalendarByDatesApi({
                date,
                simulationID,
            }),
        ERROR_MESSAGES.simulation.unionCalendarFetchFailed
    );
}

export async function getSimulationInitData(id) {
    return handleApiCall(
        () => getSimulationInitDataApi(id),
        ERROR_MESSAGES.simulation.initDataFetchFailed
    );
}

export async function runSimulation(file, data) {
    return handleApiCall(
        () => runSimulationApi(file, data),
        ERROR_MESSAGES.simulation.runFailed
    );
}

export async function getDetailCarRoutingService(simulationID) {
    return handleApiCall(
        () => getDetailCarRoutingApi(simulationID),
        ERROR_MESSAGES.simulation.carRoutingDetailFetchFailed
    );
}

export async function getDetailCarVolumeService(simulationID) {
    return handleApiCall(
        () => getDetailCarVolumeApi(simulationID),
        ERROR_MESSAGES.simulation.carVolumeFetchFailed
    );
}

export async function getChangedRoutes({ simulationId, serviceId }) {
    try {
        const res = await getChangedRoutesApi({
            simulation: simulationId,
            service_id: serviceId,
        });
        return res?.data?.data || [];
    } catch (err) {
        throw new Error(
            err?.response?.data?.message || "変更路線の取得に失敗しました。"
        );
    }
}

export async function getRidershipChanges({ simulationId }) {
    return handleApiCall(
        () =>
            getRidershipChangesApi({
                simulation: String(simulationId),
            }),
        ERROR_MESSAGES.simulation.ridershipChangesFetchFailed
    );
}

export async function getSimulationBenefitCalculationService(simulationID) {
    return handleApiCall(
        () => getSimulationBenefitCalculationApi(simulationID),
        ERROR_MESSAGES.simulation.benefitCalculationFetchFailed
    );
}

export async function getSimulationSummaryService(simulationID) {
    return handleApiCall(
        () =>
            getSimulationSummaryApi({
                simulationID: simulationID,
            }),
        ERROR_MESSAGES.simulation.summaryFetchFailed
    );
}

export async function renameSimulationScenarioSvc(scenarioId, name) {
    if (!scenarioId) {
        throw new Error(
            "Scenario ID is required to rename a simulation scenario."
        );
    }
    if (!name) {
        throw new Error("Name is required to rename a simulation scenario.");
    }

    return handleApiCall(
        () => renameSimulationScenarioApi(scenarioId, name),
        ERROR_MESSAGES.simulation.renameFailed
    );
}

export async function deleteSimulationScenarioSvc(scenarioId) {
    if (!scenarioId) {
        throw new Error(
            "Scenario ID is required to delete a simulation scenario."
        );
    }

    return handleApiCall(
        () => deleteSimulationScenarioApi(scenarioId),
        ERROR_MESSAGES.simulation.deleteFailed,
        { validateResponse: false, extractData: false }
    );
}

// ---------- NEW: Block 7 (CO₂) summary ----------

export async function getCo2ByRoute({ simulationId }) {
    return handleApiCall(
        () => getCo2ByRouteApi({ simulation: String(simulationId) }),
        ERROR_MESSAGES.simulation.co2FetchFailed
    );
}

export async function getCo2Totals({ simulationId }) {
    try {
        return await handleApiCall(
            () => getCo2TotalsApi({ simulation: String(simulationId) }),
            ERROR_MESSAGES.simulation.co2FetchFailed
        );
    } catch {
        // not fatal for the tab; caller can fall back to client sum
        return null;
    }
}

// Validation services

export async function validateAndSaveSimulationCsv({
    simulationId,
    file,
    simulationInputId = null,
}) {
    return handleApiCall(
        () =>
            validateAndSaveSimulationCsvApi({
                simulationId,
                file,
                simulationInputId,
            }),
        ERROR_MESSAGES.simulation.csvValidationFailed
    );
}

export async function getValidationResult({ simulationId }) {
    try {
        return await handleApiCall(
            () => getValidationResultApi({ simulationId }),
            ERROR_MESSAGES.simulation.validationResultFetchFailed
        );
    } catch (err) {
        // 404 means "no validation yet" → return null for a smoother UX
        if (String(err?.statusCode ?? err?.response?.status) === "404") return null;
        throw err;
    }
}

export async function deleteValidationResult({ simulationId }) {
    return handleApiCall(
        () => deleteValidationResultApi({ simulationId }),
        ERROR_MESSAGES.simulation.validationResultDeleteFailed,
        { validateResponse: false, extractData: false }
    );
}
