export type HeroFallbackReason =
  | "reduced-motion"
  | "webgl2-unavailable"
  | "data-saver"
  | "weak-device"
  | "render-error"
  | "webgl-context-lost"
  | "webgl-context-recovery-failed";

export type HeroSceneDecision =
  | { mode: "fallback"; reason: "reduced-motion" | "webgl2-unavailable" | "data-saver" | "weak-device" }
  | { mode: "scene"; lowPerformance: boolean };

export type HeroSceneInputs = {
  reducedMotion: boolean;
  webgl2Available: boolean;
  saveData?: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
};

export function decideHeroScene(input: HeroSceneInputs): HeroSceneDecision {
  if (input.reducedMotion) return { mode: "fallback", reason: "reduced-motion" };
  if (!input.webgl2Available) return { mode: "fallback", reason: "webgl2-unavailable" };
  if (input.saveData) return { mode: "fallback", reason: "data-saver" };

  const veryLimitedCpu = input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 2;
  const veryLimitedMemory = input.deviceMemory !== undefined && input.deviceMemory <= 2;
  if (veryLimitedCpu || veryLimitedMemory) {
    return { mode: "fallback", reason: "weak-device" };
  }

  const limitedCpu = input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 4;
  const limitedMemory = input.deviceMemory !== undefined && input.deviceMemory <= 4;
  return {
    mode: "scene",
    lowPerformance: limitedCpu || limitedMemory,
  };
}

export type HeroQualitySettings = {
  buildingCount: number;
  particleCount: number;
  postprocessing: boolean;
  dpr: number | [number, number];
};

export function getHeroQualitySettings(
  mobile: boolean,
  lowPerformance: boolean,
): HeroQualitySettings {
  if (lowPerformance) {
    return {
      buildingCount: mobile ? 180 : 600,
      particleCount: mobile ? 64 : 150,
      postprocessing: false,
      dpr: 1,
    };
  }

  if (mobile) {
    return {
      buildingCount: 300,
      particleCount: 96,
      postprocessing: false,
      dpr: 1,
    };
  }

  return {
    buildingCount: 1200,
    particleCount: 300,
    postprocessing: true,
    dpr: [1, 1.5],
  };
}

export type ContextRecoveryPhase = "ready" | "lost" | "retrying" | "failed";

export type ContextRecoveryState = {
  phase: ContextRecoveryPhase;
  attempts: number;
  generation: number;
};

export type ContextRecoveryEvent =
  | "context-lost"
  | "context-restored"
  | "renderer-ready"
  | "timeout"
  | "render-error";

export type ContextRecoveryAction =
  | "wait-for-restore"
  | "retry"
  | "recovered"
  | "fallback"
  | "ignored";

export const INITIAL_CONTEXT_RECOVERY: ContextRecoveryState = {
  phase: "ready",
  attempts: 0,
  generation: 0,
};

export function transitionContextRecovery(
  state: ContextRecoveryState,
  event: ContextRecoveryEvent,
): { state: ContextRecoveryState; action: ContextRecoveryAction } {
  if (event === "render-error") {
    return {
      state: { ...state, phase: "failed" },
      action: "fallback",
    };
  }

  if (event === "context-lost") {
    if (state.phase === "ready" && state.attempts === 0) {
      return {
        state: { ...state, phase: "lost" },
        action: "wait-for-restore",
      };
    }
    return {
      state: { ...state, phase: "failed" },
      action: "fallback",
    };
  }

  if (event === "context-restored") {
    if (state.phase === "lost" && state.attempts === 0) {
      return {
        state: {
          ...state,
          phase: "retrying",
          attempts: 1,
          generation: state.generation + 1,
        },
        action: "retry",
      };
    }
    return {
      state: { ...state, phase: "failed" },
      action: "fallback",
    };
  }

  if (event === "renderer-ready" && state.phase === "retrying") {
    return {
      state: { ...state, phase: "ready" },
      action: "recovered",
    };
  }

  if ((event === "timeout" && (state.phase === "lost" || state.phase === "retrying"))) {
    return {
      state: { ...state, phase: "failed" },
      action: "fallback",
    };
  }

  return { state, action: "ignored" };
}