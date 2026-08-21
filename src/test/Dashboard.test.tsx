import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
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

  it("keeps filter controls usable when filter lists are missing or malformed", async () => {
    vi.spyOn(analyticsApi, "getVisitorFunnel").mockResolvedValueOnce({
      sessions: 4,
      topProjects: [
        null,
        "not-an-option",
        { value: "Villa A" },
        { value: undefined },
      ],
      topSources: {
        value: "not-an-array",
      },
    });

    renderWidget();

    await screen.findByText("Avg. view time");
    const listingFilter = screen.getByRole("combobox", { name: "Filter by listing" });
    const sourceFilter = screen.getByRole("combobox", { name: "Filter by traffic source" });

    expect(listingFilter).toHaveTextContent("All listings");
    expect(listingFilter).toHaveTextContent("Villa A");
    expect(sourceFilter).toHaveTextContent("All sources");
    expect(sourceFilter).not.toHaveTextContent("not-an-array");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("clears a selected listing when a refresh removes it", async () => {
    const getVisitorFunnel = vi.spyOn(analyticsApi, "getVisitorFunnel")
      .mockResolvedValueOnce({
        sessions: 4,
        topProjects: [{ value: "Villa A" }, { value: "Villa B" }],
        topSources: [{ value: "direct" }],
      })
      .mockResolvedValueOnce({
        sessions: 3,
        topProjects: [{ value: "Villa B" }],
        topSources: [{ value: "direct" }],
      })
      .mockResolvedValueOnce({
        sessions: 3,
        topProjects: [{ value: "Villa B" }],
        topSources: [{ value: "direct" }],
      });
    const user = userEvent.setup();
    renderWidget();

    const listingFilter = await screen.findByRole("combobox", { name: "Filter by listing" });
    await screen.findByRole("option", { name: "Villa A" });
    await user.selectOptions(listingFilter, "Villa A");

    await waitFor(() => expect(getVisitorFunnel).toHaveBeenCalledWith(30, { projectCode: "Villa A" }));
    await waitFor(() => expect(listingFilter).toHaveValue(""));
  });

  it("clears a selected traffic source when a refresh removes it", async () => {
    const getVisitorFunnel = vi.spyOn(analyticsApi, "getVisitorFunnel")
      .mockResolvedValueOnce({
        sessions: 4,
        topProjects: [{ value: "Villa A" }],
        topSources: [{ value: "google" }, { value: "direct" }],
      })
      .mockResolvedValueOnce({
        sessions: 3,
        topProjects: [{ value: "Villa A" }],
        topSources: [{ value: "direct" }],
      })
      .mockResolvedValueOnce({
        sessions: 3,
        topProjects: [{ value: "Villa A" }],
        topSources: [{ value: "direct" }],
      });
    const user = userEvent.setup();
    renderWidget();

    const sourceFilter = await screen.findByRole("combobox", { name: "Filter by traffic source" });
    await screen.findByRole("option", { name: "google" });
    await user.selectOptions(sourceFilter, "google");

    await waitFor(() => expect(getVisitorFunnel).toHaveBeenCalledWith(30, { source: "google" }));
    await waitFor(() => expect(sourceFilter).toHaveValue(""));
  });
});
