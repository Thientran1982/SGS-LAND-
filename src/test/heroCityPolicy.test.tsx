import { describe, expect, it, vi } from "vitest";
import {
  decideHeroScene,
  getHeroQualitySettings,
  INITIAL_CONTEXT_RECOVERY,
  transitionContextRecovery,
} from "../../apps/nextjs/components/public/hero-city/heroCityPolicy";
import { createHeroResourceCleanup } from "../../apps/nextjs/components/public/hero-city/heroCityResources";

describe("hero city scene policy", () => {
  const capableDevice = {
    reducedMotion: false,
    webgl2Available: true,
    hardwareConcurrency: 8,
    deviceMemory: 8,
  };

  it("uses the static image for reduced-motion users", () => {
    expect(decideHeroScene({ ...capableDevice, reducedMotion: true })).toEqual({
      mode: "fallback",
      reason: "reduced-motion",
    });
  });

  it("uses the static image when WebGL2 is unavailable", () => {
    expect(decideHeroScene({ ...capableDevice, webgl2Available: false })).toEqual({
      mode: "fallback",
      reason: "webgl2-unavailable",
    });
  });

  it("uses the static image on very weak or data-saving devices", () => {
    expect(decideHeroScene({ ...capableDevice, hardwareConcurrency: 2 })).toEqual({
      mode: "fallback",
      reason: "weak-device",
    });
    expect(decideHeroScene({ ...capableDevice, saveData: true })).toEqual({
      mode: "fallback",
      reason: "data-saver",
    });
  });

  it("keeps full settings on capable desktop and lowers quality on constrained hardware", () => {
    expect(decideHeroScene(capableDevice)).toEqual({ mode: "scene", lowPerformance: false });
    expect(decideHeroScene({ ...capableDevice, deviceMemory: 4 })).toEqual({
      mode: "scene",
      lowPerformance: true,
    });
    expect(getHeroQualitySettings(false, false)).toEqual({
      buildingCount: 1200,
      particleCount: 300,
      postprocessing: true,
      dpr: [1, 1.5],
    });
    expect(getHeroQualitySettings(false, true)).toEqual({
      buildingCount: 600,
      particleCount: 150,
      postprocessing: false,
      dpr: 1,
    });
    expect(getHeroQualitySettings(true, true)).toEqual({
      buildingCount: 180,
      particleCount: 64,
      postprocessing: false,
      dpr: 1,
    });
  });
});

describe("hero city WebGL recovery", () => {
  it("retries once after context restoration and falls back after another loss", () => {
    const lost = transitionContextRecovery(INITIAL_CONTEXT_RECOVERY, "context-lost");
    expect(lost.action).toBe("wait-for-restore");

    const restored = transitionContextRecovery(lost.state, "context-restored");
    expect(restored.action).toBe("retry");
    expect(restored.state).toEqual({ phase: "retrying", attempts: 1, generation: 1 });

    const ready = transitionContextRecovery(restored.state, "renderer-ready");
    expect(ready.action).toBe("recovered");
    expect(ready.state.phase).toBe("ready");

    const lostAgain = transitionContextRecovery(ready.state, "context-lost");
    expect(lostAgain.action).toBe("fallback");
    expect(lostAgain.state.phase).toBe("failed");
  });

  it("falls back if the context does not restore or rendering fails", () => {
    const lost = transitionContextRecovery(INITIAL_CONTEXT_RECOVERY, "context-lost");
    expect(transitionContextRecovery(lost.state, "timeout").state.phase).toBe("failed");
    expect(transitionContextRecovery(INITIAL_CONTEXT_RECOVERY, "render-error").state.phase).toBe("failed");
  });
});

describe("hero city resource cleanup", () => {
  it("disposes each manually owned GPU resource once when cleanup runs", () => {
    const geometry = { dispose: vi.fn() };
    const material = { dispose: vi.fn() };
    const cleanup = createHeroResourceCleanup([geometry, material, geometry]);

    expect(geometry.dispose).not.toHaveBeenCalled();
    expect(material.dispose).not.toHaveBeenCalled();
    cleanup();

    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(material.dispose).toHaveBeenCalledTimes(1);
  });
});