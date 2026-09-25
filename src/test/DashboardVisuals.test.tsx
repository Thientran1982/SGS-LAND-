import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardMetricRing, DashboardValueBars } from "../../components/dashboard/DashboardVisuals";

describe("DashboardValueBars", () => {
  it("keeps real zero values distinct from unavailable values", () => {
    render(
      <DashboardValueBars
        items={[
          { label: "Contracts", value: 0, href: "/contracts" },
          { label: "Approvals", value: null, href: "/approvals" },
        ]}
        locale="en-US"
        ariaLabel="Tasks & approvals"
        emptyText="Queue data unavailable"
      />,
    );

    expect(screen.getByRole("group", { name: "Tasks & approvals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contracts: 0" })).toHaveAttribute("href", "/contracts");
    expect(screen.getByRole("link", { name: "Approvals: —" })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses an explicit empty state when every value is unavailable", () => {
    render(
      <DashboardValueBars
        items={[{ label: "Zalo", value: null }, { label: "Facebook", value: null }]}
        locale="en-US"
        ariaLabel="Inbox channels"
        emptyText="Channel data unavailable"
      />,
    );

    expect(screen.getByText("Channel data unavailable")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Inbox channels" })).toBeNull();
  });
});

describe("DashboardMetricRing", () => {
  it("exposes its metric and unavailable state to assistive technology", () => {
    const { rerender } = render(<DashboardMetricRing value={92} label="AI automation: 92%" />);

    expect(screen.getByRole("img", { name: "AI automation: 92%" })).toBeInTheDocument();

    rerender(<DashboardMetricRing value={null} label="AI automation: unavailable" />);
    expect(screen.getByRole("img", { name: "AI automation: unavailable" })).toBeInTheDocument();
  });

  it("can keep the progress ring without repeating a KPI's displayed value", () => {
    render(<DashboardMetricRing value={92} label="AI automation: 92%" showValue={false} />);

    expect(screen.getByRole("img", { name: "AI automation: 92%" })).toBeInTheDocument();
    expect(screen.queryByText("92%")).toBeNull();
  });

  it("shows a non-percent KPI value inside the ring", () => {
    render(
      <DashboardMetricRing
        value={0}
        centerValue="0"
        size={82}
        label="Pipeline value: 0; target progress: 0%; win probability: 0%"
      />,
    );

    expect(screen.getByRole("img", { name: "Pipeline value: 0; target progress: 0%; win probability: 0%" })).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("0%")).toBeNull();
  });
});