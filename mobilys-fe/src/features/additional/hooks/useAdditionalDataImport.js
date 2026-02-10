import React from "react";
import { useSearchParams } from "react-router-dom";

const TAB_VALUES = ["poi", "onedetailed", "ridership", "od"];

function normalizeTabParam(value) {
  const raw = String(value || "");
  // Backward compatibility: old tab param.
  if (raw === "ikken-meisai") return "onedetailed";
  return raw;
}

export function useAdditionalDataImport() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParamRaw = searchParams.get("tab");
  const tabParam = normalizeTabParam(tabParamRaw);
  const tab = TAB_VALUES.includes(tabParam) ? tabParam : "poi";

  React.useEffect(() => {
    if (tabParam && TAB_VALUES.includes(tabParam)) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tab, tabParam]);

  const setTab = React.useCallback(
    (value) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", value);
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  return {
    tab,
    setTab,
  };
}

