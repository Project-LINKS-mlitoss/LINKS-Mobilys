import { useCallback, useEffect, useState } from "react";

export default function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(
    !!(document.fullscreenElement ||
       document.webkitFullscreenElement ||
       document.msFullscreenElement)
  );

  const request = useCallback((el) => {
    if (!el) return;
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (fn) fn.call(el);
  }, []);

  const exit = useCallback(() => {
    const fn =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;
    if (fn) fn.call(document);
  }, []);

  const toggle = useCallback(
    (el) => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;
      if (fsEl) exit();
      else request(el);
    },
    [exit, request]
  );

  useEffect(() => {
    const handler = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    document.addEventListener("MSFullscreenChange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
      document.removeEventListener("MSFullscreenChange", handler);
    };
  }, []);

  return { isFullscreen, request, exit, toggle };
}
