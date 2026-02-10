import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../features/Home";
import Login from "../features/Login";
import Scenarios from "../features/gtfs/Scenarios";
import Simulation from "../features/simulation/Simulation";
import SimulationDetail from "../features/simulation/SimulationDetail";
import GTFSImport from "../features/gtfs/GTFSImport";
import AuthGuard from "../components/AuthGuard";
import ScenarioDetail from "../features/gtfs/ScenarioDetail";
import { useAuthStore } from "../state/authStore";
import GTFSEditEntryPage from "../features/edit/GTFSEditEntryPage";
import GTFSEdit from "../features/edit/GTFSEdit";
import { MapSelector } from "../features/MapSelector";
import NumberOfBusRunningVisualization from "../features/visualization/bus-running-visualization/NumberOfBusRunningVisualization";
import BufferAnalysis from "../features/visualization/network-analysis/BufferAnalysis";
import RoadNetworkAnalysis from "../features/visualization/network-analysis/RoadNetworkAnalysis";
import RoadNetworkAnalysisDRM from "../features/visualization/network-analysis/RoadNetworkAnalysisDRM";
import StopRadiusAnalysis from "../features/visualization/stop-radius-analysis/StopRadiusAnalysis";
import ODDataAnalysis from "../features/visualization/od-analysis/ODDataAnalysis";
import AdditionalDataImport from "../features/additional/AdditionalDataImport";
import BoardingAlightingAnalysis from "../features/visualization/boarding-alighting-analysis/BoardingAlightingAnalysis";
import UserManagement from "../features/userManagement/UserManagement";
import RouteTimetableVisualization from "../features/visualization/route-timetable/RouteTimetableVisualization";
import PasswordChange from "../features/userManagement/PasswordChange";
import EasyTripFrequencyPage from "../features/edit/EasyTripFrequencyPage";

// JS version (no type annotations)
function RequireAccess({ code, children }) {
  const isLoggedIn = useAuthStore((s) => !!s.access);
  const has = useAuthStore((s) => s.hasAccess ? s.hasAccess(code) : true);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!has) return <Navigate to="/scenarios" replace />;
  return children;
}

const AppRoutes = () => {
  const isLoggedIn = useAuthStore((state) => !!state.access);

  return (
    <Routes>
      {!isLoggedIn && (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </>
      )}
      {isLoggedIn && (
        <>
          <Route path="/login" element={<Navigate to="/scenarios" />} />
          <Route path="/" element={<Navigate to="/scenarios" replace />} />
        </>
      )}

      {/* Public-to-logged-in */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <Home />
          </AuthGuard>
        }
      />
      <Route
        path="/scenarios"
        element={
          <AuthGuard>
            <RequireAccess code="scenarios">
              <Scenarios />
            </RequireAccess>	
          </AuthGuard>
        }
      />
      <Route
        path="/scenario/:scenarioId"
        element={
          <AuthGuard>
			<RequireAccess code="scenarios">
				<ScenarioDetail />
			</RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/map-settings"
        element={
          <AuthGuard>
            <MapSelector />
          </AuthGuard>
        }
      />
      <Route
        path="/password-change/"
          element={
            <AuthGuard>
              <RequireAccess code="password-change">
                <PasswordChange />
              </RequireAccess>
            </AuthGuard>
          }
      />
      <Route
        path="/user-management/"
          element={
            <AuthGuard>
              <RequireAccess code="user-management">
                <UserManagement />
              </RequireAccess>
            </AuthGuard>
          }
      />

      <Route
        path="/import-data/"
        element={
          <AuthGuard>
            <RequireAccess code="import-data">
              <GTFSImport />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/additional-data"
        element={
          <AuthGuard>
            <RequireAccess code="additional-data">
              <AdditionalDataImport />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/edit-data/"
        element={
          <AuthGuard>
            <RequireAccess code="edit-data">
              <GTFSEditEntryPage />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/edit-data/:scenarioId"
        element={
          <AuthGuard>
            <RequireAccess code="edit-data">
              <GTFSEdit />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/sim/simple"
        element={
          <AuthGuard>
            <RequireAccess code="edit-data">
              <EasyTripFrequencyPage />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/number-of-bus-running-visualization/"
        element={
          <AuthGuard>
            <RequireAccess code="number-of-bus-running-visualization">
              <NumberOfBusRunningVisualization />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/buffer-analysis/"
        element={
          <AuthGuard>
            <RequireAccess code="buffer-analysis">
              <BufferAnalysis />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/road-network-analysis/"
        element={
          <AuthGuard>
            <RequireAccess code="road-network-analysis">
              <RoadNetworkAnalysis />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/road-network-analysis-drm/"
        element={
          <AuthGuard>
            <RequireAccess code="road-network-analysis-drm">
              <RoadNetworkAnalysisDRM />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/stop-radius-analysis/"
        element={
          <AuthGuard>
            <RequireAccess code="stop-radius-analysis">
              <StopRadiusAnalysis />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/route-timetable/"
        element={
          <AuthGuard>
            <RequireAccess code="route-timetable">
              <RouteTimetableVisualization />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/od-analysis/"
        element={
          <AuthGuard>
            <RequireAccess code="od-analysis">
              <ODDataAnalysis />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/boarding-alighting-analysis/"
        element={
          <AuthGuard>
            <RequireAccess code="boarding-alighting-analysis">
              <BoardingAlightingAnalysis />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/simulation/"
        element={
          <AuthGuard>
            <RequireAccess code="simulation">
              <Simulation />
            </RequireAccess>
          </AuthGuard>
        }
      />
      <Route
        path="/simulation/:simulationId"
        element={
          <AuthGuard>
            <RequireAccess code="simulation">
              <SimulationDetail />
            </RequireAccess>
          </AuthGuard>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
