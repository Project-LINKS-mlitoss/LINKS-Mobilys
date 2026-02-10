import { useState, useEffect, useCallback } from "react";

/**
 * Shared hook for fullscreen functionality in map components.
 *
 * @param {Object} options
 * @param {React.RefObject} options.containerRef - Ref to the element to make fullscreen
 * @param {React.RefObject} [options.mapRef] - Optional map ref for auto-resizing on fullscreen change
 * @param {Function} [options.onFullscreenChange] - Optional callback when fullscreen state changes
 * @returns {{ isFullscreen: boolean, toggleFullscreen: () => void }}
 */
export function useFullscreen({ containerRef, mapRef, onFullscreenChange } = {}) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Check if any fullscreen element exists (cross-browser)
    const isAnyFullscreen = useCallback(() => {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFs = isAnyFullscreen();
            setIsFullscreen(isFs);
            onFullscreenChange?.(isFs);

            // Auto-resize map if mapRef provided
            if (mapRef?.current) {
                // Double resize with delay to ensure proper sizing
                setTimeout(() => mapRef.current.invalidateSize({ animate: false }), 60);
                setTimeout(() => mapRef.current.invalidateSize({ animate: false }), 250);
            }
        };

        // Listen to all fullscreen change events (cross-browser)
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("MSFullscreenChange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
        };
    }, [onFullscreenChange, mapRef, isAnyFullscreen]);

    const toggleFullscreen = useCallback(async () => {
        const el = containerRef?.current;
        if (!el) return;

        try {
            if (!isAnyFullscreen()) {
                // Request fullscreen (cross-browser)
                const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
                if (!req) return;

                if (req === el.requestFullscreen) {
                    await el.requestFullscreen({ navigationUI: "hide" });
                } else {
                    await req.call(el);
                }
            } else {
                // Exit fullscreen (cross-browser)
                const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
                if (exit) await exit.call(document);
            }
        } catch (e) {
            console.error("Fullscreen operation failed:", e);
        }
    }, [containerRef, isAnyFullscreen]);

    return { isFullscreen, toggleFullscreen };
}
