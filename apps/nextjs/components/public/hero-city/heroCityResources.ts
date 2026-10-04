export type HeroDisposableResource = {
  dispose: () => void;
};

export function disposeHeroResources(
  resources: readonly (HeroDisposableResource | null | undefined)[],
): void {
  const disposed = new Set<HeroDisposableResource>();
  for (const resource of resources) {
    if (!resource || disposed.has(resource)) continue;
    disposed.add(resource);
    resource.dispose();
  }
}

export function createHeroResourceCleanup(
  resources: readonly (HeroDisposableResource | null | undefined)[],
): () => void {
  return () => disposeHeroResources(resources);
}