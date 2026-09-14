import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import seoApi from "../../services/api/seoApi";
import { GeoMonitor30Days } from "../../pages/SeoManager";

type ChartPoint = { date: string; [key: string]: string | number | null };

vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  function LineChart({
    data,
    children,
  }: {
    data: ChartPoint[];
    children?: React.ReactNode;
  }) {
    return (
      <div data-testid="geo-chart">
        {React.Children.map(children, (child) =>
          React.isValidElement(child) && child.type === Line
            ? React.cloneElement(child, { data } as Partial<LineProps>)
            : child,
        )}
      </div>
    );
  }

  type LineProps = {
    dataKey?: string;
    connectNulls?: boolean;
    data?: ChartPoint[];
  };

  function Line({ dataKey, connectNulls, data }: LineProps) {
    return (
      <output data-testid={`geo-line-${dataKey}`}>
        {JSON.stringify({ connectNulls, values: data?.map((point) => point[dataKey ?? ""]) })}
      </output>
    );
  }

  return {
    CartesianGrid: passthrough,
    Legend: passthrough,
    Line,
    LineChart,
    ResponsiveContainer: passthrough,
    Tooltip: passthrough,
    XAxis: passthrough,
    YAxis: passthrough,
  };
});


const snapshots = [
  {
    date: "2026-09-10",
    aiMentions: { engines: {}, totals: {} },
    gscTop20: { keywords: [{ keyword: "Aqua City", position: 3 }] },
    gscSync: {
      ok: true,
      status: "ok" as const,
      reason: "synced",
      keywordsChecked: 1,
      positionsUpdated: 1,
    },
    backlinks: null,
    lighthouse: null,
    createdAt: "2026-09-10T04:30:00.000Z",
  },
  {
    date: "2026-09-11",
    aiMentions: { engines: {}, totals: {} },
    // This stale position must not be presented as a measurement.
    gscTop20: { keywords: [{ keyword: "Aqua City", position: 4 }] },
    gscSync: {
      ok: false,
      status: "missing_credentials" as const,
      reason: "GSC credentials not configured",
    },
    backlinks: null,
    lighthouse: null,
    createdAt: "2026-09-11T04:30:00.000Z",
  },
  {
    date: "2026-09-12",
    aiMentions: { engines: {}, totals: {} },
    // This stale position must also remain a chart gap.
    gscTop20: { keywords: [{ keyword: "Aqua City", position: 5 }] },
    gscSync: {
      ok: false,
      status: "error" as const,
      reason: "GSC query failed: HTTP 403 permission denied",
    },
    backlinks: null,
    lighthouse: null,
    createdAt: "2026-09-12T04:30:00.000Z",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GeoMonitor30Days", () => {
  it("keeps mixed GSC statuses, reasons, and unmeasured chart days explicit", async () => {
    const listGeoSnapshots = vi
      .spyOn(seoApi, "listGeoSnapshots")
      .mockResolvedValue({ days: 30, snapshots });

    render(<GeoMonitor30Days />);

    expect(await screen.findByText("Đồng bộ Google Search Console theo snapshot")).toBeVisible();
    expect(listGeoSnapshots).toHaveBeenCalledWith(30);

    const history = screen.getByRole("table");
    expect(within(history).getByText("2026-09-10")).toBeVisible();
    expect(within(history).getByText("Đồng bộ thành công")).toBeVisible();
    expect(within(history).getByText("synced")).toBeVisible();
    expect(within(history).getByText("Thiếu credential")).toBeVisible();
    expect(within(history).getByText("GSC credentials not configured")).toBeVisible();
    expect(within(history).getByText("API lỗi")).toBeVisible();
    expect(within(history).getByText("GSC query failed: HTTP 403 permission denied")).toBeVisible();

    const positionLine = screen.getByTestId("geo-line-Aqua City");
    expect(JSON.parse(positionLine.textContent ?? "")).toEqual({
      connectNulls: false,
      values: [3, null, null],
    });
  });
});