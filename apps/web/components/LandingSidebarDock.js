"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import "./LandingSidebarDock.css";

const LS_PINNED = "rtvf_sidebar_pinned";
const LS_WIDTH = "rtvf_sidebar_width";
const LS_TIP = "rtvf_sidebar_tip_shown";

function loadBoolLs(key) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function loadWidthLs() {
  if (typeof window === "undefined") return 300;
  try {
    const w = parseInt(window.localStorage.getItem(LS_WIDTH), 10);
    if (Number.isNaN(w)) return 300;
    return Math.min(500, Math.max(220, w));
  } catch {
    return 300;
  }
}

/**
 * Hover/fixed discover sidebar: trigger strip, overlay panel, pin, resize.
 */
export default function LandingSidebarDock({
  children,
  enabled,
  mobileOpen,
  onMobileOpenChange,
  onMetricsChange,
}) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [width, setWidth] = useState(300);
  const [isMobile, setIsMobile] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [showTip, setShowTip] = useState(false);

  const closeTimerRef = useRef(null);
  const panelRef = useRef(null);
  const touchStartX = useRef(null);
  const resizingRef = useRef(false);
  const moveHandlerRef = useRef(null);
  const upHandlerRef = useRef(null);

  useEffect(() => {
    setPinned(loadBoolLs(LS_PINNED));
    setWidth(loadWidthLs());
    setHydrated(true);
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(LS_TIP) !== "1") {
        setShowTip(true);
        window.setTimeout(() => {
          setShowTip(false);
          try {
            window.localStorage.setItem(LS_TIP, "1");
          } catch {
            /* ignore */
          }
        }, 3000);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      const m = mq.matches;
      setIsMobile(m);
      if (m) {
        setHoverOpen(false);
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_PINNED, pinned ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [pinned, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_WIDTH, String(width));
    } catch {
      /* ignore */
    }
  }, [width, hydrated]);

  useEffect(() => {
    onMetricsChange?.({ pinned, width, isMobile });
  }, [pinned, width, isMobile, onMetricsChange]);

  useEffect(() => {
    if (isMobile && pinned) {
      onMobileOpenChange?.(true);
    }
  }, [isMobile, pinned, onMobileOpenChange]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (pinned || isMobile) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setHoverOpen(false);
      closeTimerRef.current = null;
    }, 300);
  }, [pinned, isMobile, clearCloseTimer]);

  const panelOpenDesktop = pinned || hoverOpen;
  const panelOpen = isMobile ? mobileOpen : panelOpenDesktop;

  const handleTriggerEnter = useCallback(() => {
    if (!enabled || isMobile) return;
    clearCloseTimer();
    setHoverOpen(true);
  }, [enabled, isMobile, clearCloseTimer]);

  const handlePanelEnter = useCallback(() => {
    clearCloseTimer();
    if (!isMobile) setHoverOpen(true);
  }, [isMobile, clearCloseTimer]);

  const handlePanelLeave = useCallback(() => {
    if (!enabled || isMobile) return;
    scheduleClose();
  }, [enabled, isMobile, scheduleClose]);

  const closeAll = useCallback(() => {
    clearCloseTimer();
    setHoverOpen(false);
    setPinned(false);
    onMobileOpenChange?.(false);
  }, [clearCloseTimer, onMobileOpenChange]);

  const handleBackdropClick = useCallback(() => {
    closeAll();
  }, [closeAll]);

  const handleCloseClick = useCallback(() => {
    closeAll();
  }, [closeAll]);

  const togglePin = useCallback(() => {
    setPinned((p) => {
      const next = !p;
      if (next) {
        clearCloseTimer();
        setHoverOpen(true);
        if (isMobile) onMobileOpenChange?.(true);
      } else if (isMobile) {
        onMobileOpenChange?.(false);
      }
      return next;
    });
  }, [clearCloseTimer, isMobile, onMobileOpenChange]);

  const startResize = useCallback(
    (e) => {
      if (isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      document.body.style.userSelect = "none";

      const onMove = (ev) => {
        if (!resizingRef.current || isMobile) return;
        const x = Math.min(500, Math.max(220, ev.clientX));
        setWidth(x);
      };
      const onUp = () => {
        resizingRef.current = false;
        document.body.style.userSelect = "";
        if (moveHandlerRef.current) {
          document.removeEventListener("mousemove", moveHandlerRef.current);
          moveHandlerRef.current = null;
        }
        if (upHandlerRef.current) {
          document.removeEventListener("mouseup", upHandlerRef.current);
          upHandlerRef.current = null;
        }
      };

      moveHandlerRef.current = onMove;
      upHandlerRef.current = onUp;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [isMobile]
  );

  useEffect(() => {
    return () => {
      if (moveHandlerRef.current) {
        document.removeEventListener("mousemove", moveHandlerRef.current);
        moveHandlerRef.current = null;
      }
      if (upHandlerRef.current) {
        document.removeEventListener("mouseup", upHandlerRef.current);
        upHandlerRef.current = null;
      }
      document.body.style.userSelect = "";
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (isMobile) {
        onMobileOpenChange?.((prev) => !prev);
      } else if (pinned) {
        setPinned(false);
        setHoverOpen(false);
      } else {
        setHoverOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, isMobile, mobileOpen, onMobileOpenChange, pinned]);

  const onTouchStart = useCallback((e) => {
    if (!isMobile) return;
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }, [isMobile]);

  const onTouchEnd = useCallback(
    (e) => {
      if (!isMobile || touchStartX.current == null) return;
      const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
      if (touchStartX.current - endX > 60) {
        onMobileOpenChange?.(false);
      }
      touchStartX.current = null;
    },
    [isMobile, onMobileOpenChange]
  );

  if (!enabled) return null;

  const panelWidthPx = isMobile
    ? "min(85vw, 320px)"
    : `${width}px`;

  const translateOpen = panelOpen ? "translateX(0)" : "translateX(-100%)";

  return (
    <>
      {!isMobile && (
        <div
          className="lsd-trigger-strip"
          onMouseEnter={handleTriggerEnter}
          aria-hidden={false}
        >
          {showTip && (
            <span className="lsd-trigger-tip" role="tooltip">
              Press [ to open
            </span>
          )}
        </div>
      )}

      <div
        className={`lsd-backdrop ${panelOpen ? "lsd-backdrop--visible" : ""}`}
        onClick={handleBackdropClick}
        onKeyDown={(e) => e.key === "Escape" && closeAll()}
        aria-hidden={!panelOpen}
      />

      <aside
        ref={panelRef}
        className={`lsd-panel ${panelOpen ? "lsd-panel--open" : ""}`}
        style={{
          width: panelWidthPx,
          transform: translateOpen,
        }}
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-hidden={!panelOpen}
      >
        <div className="lsd-panel__toolbar">
          <button
            type="button"
            className={`lsd-pin ${pinned ? "lsd-pin--active" : ""}`}
            onClick={togglePin}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
            title={pinned ? "Unpin" : "Pin open"}
          >
            📌
          </button>
          <button
            type="button"
            className="lsd-close"
            onClick={handleCloseClick}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>
        <div className="lsd-panel__scroll">{children}</div>
        {!isMobile && (
          <div
            className="lsd-resize-handle"
            onMouseDown={startResize}
            aria-hidden
          />
        )}
      </aside>
    </>
  );
}
