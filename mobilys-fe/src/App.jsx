// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import MainLayout from "./layouts/MainLayout";
import AppRoutes from "./routes/AppRoutes";
import GlobalSnackbar from "./components/GlobalSnackbar";

export default function App() {
  return (
    <MainLayout>
      <AppRoutes />
      <GlobalSnackbar />
    </MainLayout>
  );
}
