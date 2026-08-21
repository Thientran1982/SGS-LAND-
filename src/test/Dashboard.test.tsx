import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VisitorFunnelWidget } from "../../pages/Dashboard";
import { analyticsApi } from "../../services/api/analyticsApi";

function renderWidget() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <VisitorFunnelWidget days={30} language="en" />
    </QueryClientProvider>,
  );
}

describe("VisitorFunnelWidget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps loading and error states visible", async () => {
    const request = vi
      .spyOn(analyticsApi, "getVisitorFunnel")
      .mockReturnValueOnce(new Promise(() => undefined));
    const { unmount } = renderWidget();

    expect(document.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByText("Unable to load funnel data.")).toBeNull();
    unmount();
    request.mockRestore();

    vi.spyOn(analyticsApi, "getVisitorFunnel").mockRejectedValueOnce(new Error("offline"));
    renderWidget();
    expect(await screen.findByText("Unable to load funnel data.", {}, { timeout: 3000 })).toBeVisible();
  });

  it("renders zero-safe values for empty data and page_leave events without duration", async () => {
    vi.spyOn(analyticsApi, "getVisitorFunnel").mockResolvedValueOnce({
      events: [{ eventType: "page_leave" }],
      sessions: 0,
      pageLeaves: 0,
      averageTimeOnPageMs: undefined,
      propertyViews: undefined,
      engagedSessions: undefined,
      scroll50: undefined,
      ctaInteractions: undefined,
      returningVisitors48h: undefined,
      topProjects: [],
      topSources: [],
    });

    renderWidget();

    expect(await screen.findByText("Avg. view time")).toBeVisible();
    expect(screen.getAllByText("0s").length).toBe(1);
    expect(screen.getAllByText("0%").length).toBe(1);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(7);

    const funnel = screen.getByRole("region", { name: "Viewer behavior funnel" });
    expect(funnel.textContent).not.toMatch(/NaN|undefined/);
  });

  it("falls back to zero for malformed and non-finite funnel metrics", async () => {
    vi.spyOn(analyticsApi, "getVisitorFunnel").mockResolvedValueOnce({
      sessions: "not-a-number",
      pageLeaves: Infinity,
      averageTimeOnPageMs: NaN,
      propertyViews: "-",
      engagedSessions: Number.POSITIVE_INFINITY,
      scroll50: Number.NEGATIVE_INFINITY,
      ctaInteractions: "invalid",
      returningVisitors48h: undefined,
      topProjects: [],
      topSources: [],
    });

    renderWidget();

    await screen.findByText("Avg. view time");
    const funnel = screen.getByRole("region", { name: "Viewer behavior funnel" });
    expect(funnel.textContent).not.toMatch(/NaN|undefined|Infinity/);
    expect(screen.getByText("0s")).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(7);
  });
});
