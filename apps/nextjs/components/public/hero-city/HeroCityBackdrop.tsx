"use client";

import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  decideHeroScene,
  INITIAL_CONTEXT_RECOVERY,
  transitionContextRecovery,
} from "./heroCityPolicy";
import type {
  ContextRecoveryEvent,
  ContextRecoveryState,
  HeroFallbackReason,
} from "./heroCityPolicy";

const HeroCityScene = lazy(() => import("./HeroCityScene"));

type MotionState = {
  pointerX: number;
  pointerY: number;
  scroll: number;
};

type Props = {
  activeRegion: string;
};

type BoundaryProps = {
  children: ReactNode;
  onFailure: () => void;
};

type BoundaryState = {
  hasError: boolean;
};

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.onFailure();
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

function hasWebGL2(): boolean {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2", {
      alpha: true,
      powerPreference: "low-power",
    });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function HeroCityBackdrop({ activeRegion }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<MotionState>({ pointerX: 0, pointerY: 0, scroll: 0 });
  const [firstPaint, setFirstPaint] = useState(false);
  const [inView, setInView] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [deviceLowPerformance, setDeviceLowPerformance] = useState(false);
  const [fpsLow, setFpsLow] = useState(false);
  const [recovery, setRecovery] = useState<ContextRecoveryState>(INITIAL_CONTEXT_RECOVERY);
  const recoveryRef = useRef<ContextRecoveryState>(INITIAL_CONTEXT_RECOVERY);
  const recoveryTimerRef = useRef<number | null>(null);
  const webgl2AvailableRef = useRef<boolean | null>(null);
  const warnedReasonsRef = useRef<Set<HeroFallbackReason>>(new Set());
  const lowPerformance = deviceLowPerformance || fpsLow;
  const contextUnavailable = recovery.phase === "lost" || recovery.phase === "retrying";

  const warnFallback = useCallback((reason: HeroFallbackReason) => {
    if (process.env.NODE_ENV === "production" || warnedReasonsRef.current.has(reason)) return;
    warnedReasonsRef.current.add(reason);
    console.warn(`[HeroCity] Showing static hero image: ${reason}`);
  }, []);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const advanceRecovery = useCallback((event: ContextRecoveryEvent) => {
    const result = transitionContextRecovery(recoveryRef.current, event);
    if (result.state !== recoveryRef.current) {
      recoveryRef.current = result.state;
      setRecovery(result.state);
    }
    return result;
  }, []);

  const failToStaticFallback = useCallback((reason: HeroFallbackReason) => {
    clearRecoveryTimer();
    advanceRecovery("render-error");
    setFailed(true);
    warnFallback(reason);
  }, [advanceRecovery, clearRecoveryTimer, warnFallback]);

  const scheduleRecoveryTimeout = useCallback((delayMs: number) => {
    clearRecoveryTimer();
    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = null;
      const result = advanceRecovery("timeout");
      if (result.action === "fallback") {
        setFailed(true);
        warnFallback("webgl-context-recovery-failed");
      }
    }, delayMs);
  }, [advanceRecovery, clearRecoveryTimer, warnFallback]);

  const handleRendererCreated = useCallback(() => {
    const result = advanceRecovery("renderer-ready");
    if (result.action === "recovered") clearRecoveryTimer();
  }, [advanceRecovery, clearRecoveryTimer]);

  const handleLowFps = useCallback(() => setFpsLow(true), []);

  useEffect(() => clearRecoveryTimer, [clearRecoveryTimer]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setFirstPaint(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const hero = host.closest<HTMLElement>(".lp-hero") ?? host;

    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(
        entries => setInView(Boolean(entries[0]?.isIntersecting)),
        { rootMargin: "0px", threshold: 0 },
      );
      observer.observe(hero);
      return () => observer.disconnect();
    }

    const checkVisibility = () => {
      const rect = hero.getBoundingClientRect();
      setInView(rect.bottom > 0 && rect.top < window.innerHeight);
    };
    checkVisibility();
    window.addEventListener("scroll", checkVisibility, { passive: true });
    window.addEventListener("resize", checkVisibility);
    return () => {
      window.removeEventListener("scroll", checkVisibility);
      window.removeEventListener("resize", checkVisibility);
    };
  }, []);

  useEffect(() => {
    const updateLayout = () => setMobile(window.innerWidth <= 767);
    updateLayout();
    window.addEventListener("resize", updateLayout, { passive: true });
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    if (!firstPaint) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      if (webgl2AvailableRef.current === null) {
        webgl2AvailableRef.current = hasWebGL2();
      }
      const device = navigator as Navigator & {
        deviceMemory?: number;
        connection?: { saveData?: boolean };
      };
      const decision = decideHeroScene({
        reducedMotion: preference.matches,
        webgl2Available: webgl2AvailableRef.current,
        saveData: device.connection?.saveData,
        hardwareConcurrency: device.hardwareConcurrency,
        deviceMemory: device.deviceMemory,
      });

      if (decision.mode === "fallback") {
        setAllowed(false);
        setDeviceLowPerformance(false);
        warnFallback(decision.reason);
        return;
      }

      setAllowed(true);
      setDeviceLowPerformance(decision.lowPerformance);
      if (inView) setSceneLoaded(true);
    };

    evaluate();
    preference.addEventListener("change", evaluate);
    return () => preference.removeEventListener("change", evaluate);
  }, [firstPaint, inView, warnFallback]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !sceneLoaded) return;

    const hero = host.closest<HTMLElement>(".lp-hero") ?? host;
    let animationFrame = 0;

    const updatePosition = () => {
      animationFrame = 0;
      const rect = hero.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const edgeFade = Math.max(100, viewportHeight * 0.16);
      const entering = clamp((viewportHeight - rect.top) / edgeFade, 0, 1);
      const leaving = clamp((rect.bottom + edgeFade) / edgeFade, 0, 1);
      const fade = Math.min(entering, leaving);
      host.style.opacity = contextUnavailable ? "0" : String(fade);

      motionRef.current.scroll = clamp(
        (viewportHeight - rect.top) / Math.max(rect.height, viewportHeight),
        0,
        1,
      );
    };

    const schedulePositionUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updatePosition);
    };
    const updatePointer = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        motionRef.current.pointerX = 0;
        motionRef.current.pointerY = 0;
        return;
      }
      motionRef.current.pointerX = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      motionRef.current.pointerY = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    };

    updatePosition();
    window.addEventListener("scroll", schedulePositionUpdate, { passive: true });
    window.addEventListener("resize", schedulePositionUpdate);
    window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", schedulePositionUpdate);
      window.removeEventListener("resize", schedulePositionUpdate);
      window.removeEventListener("pointermove", updatePointer);
    };
  }, [sceneLoaded, contextUnavailable]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let canvas: HTMLCanvasElement | null = null;
    const onContextLost = (event: Event) => {
      const result = advanceRecovery("context-lost");
      if (result.action === "wait-for-restore") {
        (event as WebGLContextEvent).preventDefault();
        host.style.opacity = "0";
        warnFallback("webgl-context-lost");
        scheduleRecoveryTimeout(3500);
        return;
      }
      failToStaticFallback("webgl-context-recovery-failed");
    };
    const onContextRestored = () => {
      const result = advanceRecovery("context-restored");
      if (result.action === "retry") {
        scheduleRecoveryTimeout(5000);
        return;
      }
      failToStaticFallback("webgl-context-recovery-failed");
    };
    const observeCanvas = () => {
      const nextCanvas = host.querySelector("canvas");
      if (nextCanvas === canvas) return;
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      canvas?.removeEventListener("webglcontextrestored", onContextRestored);
      canvas = nextCanvas;
      canvas?.addEventListener("webglcontextlost", onContextLost);
      canvas?.addEventListener("webglcontextrestored", onContextRestored);
    };
    observeCanvas();
    const observer = new MutationObserver(observeCanvas);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      canvas?.removeEventListener("webglcontextrestored", onContextRestored);
    };
  }, [
    advanceRecovery,
    failToStaticFallback,
    sceneLoaded,
    scheduleRecoveryTimeout,
    warnFallback,
  ]);

  const style: CSSProperties = {
    position: "absolute",
    zIndex: 1,
    inset: 0,
    overflow: "hidden",
    opacity: 0,
    transition: "opacity 700ms ease-out",
    pointerEvents: "none",
    contain: "strict",
    willChange: "opacity",
  };

  if (failed) {
    return <div ref={hostRef} aria-hidden="true" style={{ ...style, display: "none" }} />;
  }

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      data-active-region={activeRegion || undefined}
      style={style}
    >
      {sceneLoaded && allowed && (
        <SceneErrorBoundary onFailure={() => failToStaticFallback("render-error")}>
          <Suspense fallback={null}>
            <HeroCityScene
              key={recovery.generation}
              activeRegion={activeRegion}
              mobile={mobile}
              inView={inView && recovery.phase !== "lost"}
              lowPerformance={lowPerformance}
              motionRef={motionRef}
              onLowFps={handleLowFps}
              onRendererCreated={handleRendererCreated}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  );
}