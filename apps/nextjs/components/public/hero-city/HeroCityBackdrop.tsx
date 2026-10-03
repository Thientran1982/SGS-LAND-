"use client";

import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";

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

function hasCapableDevice(): boolean {
  const device = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (device.connection?.saveData) return false;
  if (typeof device.hardwareConcurrency === "number" && device.hardwareConcurrency <= 2) return false;
  if (typeof device.deviceMemory === "number" && device.deviceMemory <= 2) return false;
  return true;
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
    if (!firstPaint || !inView) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const evaluate = () => {
      const canRender = !preference.matches && hasCapableDevice() && hasWebGL2();
      setAllowed(canRender);
      if (canRender) setSceneLoaded(true);
    };

    evaluate();
    preference.addEventListener("change", evaluate);
    return () => preference.removeEventListener("change", evaluate);
  }, [firstPaint, inView]);

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
      host.style.opacity = String(fade);

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
  }, [sceneLoaded]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let canvas: HTMLCanvasElement | null = null;
    const onContextLost = () => setFailed(true);
    const observeCanvas = () => {
      const nextCanvas = host.querySelector("canvas");
      if (nextCanvas === canvas) return;
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      canvas = nextCanvas;
      canvas?.addEventListener("webglcontextlost", onContextLost);
    };
    observeCanvas();
    const observer = new MutationObserver(observeCanvas);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      canvas?.removeEventListener("webglcontextlost", onContextLost);
    };
  }, [sceneLoaded]);

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
        <SceneErrorBoundary onFailure={() => setFailed(true)}>
          <Suspense fallback={null}>
            <HeroCityScene
              activeRegion={activeRegion}
              mobile={mobile}
              inView={inView}
              motionRef={motionRef}
            />
          </Suspense>
        </SceneErrorBoundary>
      )}
    </div>
  );
}