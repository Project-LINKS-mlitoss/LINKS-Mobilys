// Copyright (c) 2025-2026 MLIT Japan
// SPDX-License-Identifier: MIT
import { useAuthStore } from "../state/authStore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthGuard({ children }) {
  const isLoggedIn = useAuthStore(
    (state) => state.access !== null && state.access !== "null"
  );
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate("/login", { replace: true });
    } else {
      setChecked(true);
    }
  }, [isLoggedIn, navigate]);

  if (!checked) return null;
  return children;
}
