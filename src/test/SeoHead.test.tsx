import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import React from "react";
import { SeoHead } from "../../components/SeoHead";

// Helper to get meta content from jsdom
function getMeta(name: string, attr: "name" | "property" = "name"): string {
  const el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  return el?.content ?? "";
}

function getTitle(): string {
  return document.title ?? "";
}

async function waitFor(assertion: () => void, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

async function renderAndWait(props: Partial<Parameters<typeof SeoHead>[0]> & { title: string; description: string }) {
  const { unmount } = render(
    <HelmetProvider>
      <SeoHead canonicalPath="/page" {...(props as any)} />
    </HelmetProvider>
  );
  // Wait for Helmet to update the DOM
  await waitFor(() => {
    expect(document.title).toBeTruthy();
  });
  return unmount;
}

describe("SeoHead", () => {
  afterEach(() => {
    // Clean up helmet-injected tags
    document.head.querySelectorAll("meta,title").forEach(el => {
      if (!(el as Element).hasAttribute("charset") && !(el as Element).hasAttribute("http-equiv")) {
        el.remove();
      }
    });
    // Clean up json-ld script tags
    document.head.querySelectorAll("#json-ld-schema").forEach(el => el.remove());
    document.title = "";
  });

  it("renders without crashing with required props", async () => {
    const { unmount } = render(
      <HelmetProvider>
        <SeoHead title="Test Page" description="Test description" canonicalPath="/test" />
      </HelmetProvider>
    );
    expect(document.title).toBe("Test Page");
    unmount();
  });

  it("sets page title", async () => {
    const unmount = await renderAndWait({ title: "My Awesome Page", description: "Desc" });
    expect(document.title).toBe("My Awesome Page");
    unmount();
  });

  it("sets description meta tag", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "My test description" });
    expect(getMeta("description")).toBe("My test description");
    unmount();
  });

  it("sets robots to index follow by default (noindex=false)", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc", noindex: false });
    expect(getMeta("robots")).toContain("index");
    unmount();
  });

  it("sets robots to noindex when noindex=true", async () => {
    const unmount = await renderAndWait({ title: "Hidden Page", description: "Desc", noindex: true });
    expect(getMeta("robots")).toContain("noindex");
    unmount();
  });

  it("sets og:type to website by default", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    expect(getMeta("og:type", "property")).toBe("website");
    unmount();
  });

  it("sets og:type to article when specified", async () => {
    const unmount = await renderAndWait({ title: "Article", description: "Desc", ogType: "article" });
    await waitFor(() => expect(getMeta("og:type", "property")).toBe("article"));
    unmount();
  });

  it("sets og:title", async () => {
    const unmount = await renderAndWait({ title: "OG Title Test", description: "Desc" });
    await waitFor(() => expect(getMeta("og:title", "property")).toBe("OG Title Test"));
    unmount();
  });

  it("sets og:description", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "OG Desc Test" });
    await waitFor(() => expect(getMeta("og:description", "property")).toBe("OG Desc Test"));
    unmount();
  });

  it("sets og:image to default when not specified", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    await waitFor(() => expect(getMeta("og:image", "property")).toContain("og-image.jpg"));
    unmount();
  });

  it("sets og:image to provided value", async () => {
    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      ogImage: "https://example.com/custom.jpg",
    });
    await waitFor(() => expect(getMeta("og:image", "property")).toContain("custom.jpg"));
    unmount();
  });

  it("sets og:image:alt to title when ogImageAlt not provided", async () => {
    const unmount = await renderAndWait({ title: "Alt Fallback Title", description: "Desc" });
    await waitFor(() => expect(getMeta("og:image:alt", "property")).toBe("Alt Fallback Title"));
    unmount();
  });

  it("sets og:image:alt to ogImageAlt when provided", async () => {
    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      ogImageAlt: "Custom image description",
    });
    await waitFor(() =>
      expect(getMeta("og:image:alt", "property")).toBe("Custom image description")
    );
    unmount();
  });

  it("sets og:site_name to SGS LAND", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    await waitFor(() => expect(getMeta("og:site_name", "property")).toBe("SGS LAND"));
    unmount();
  });

  it("sets og:locale to vi_VN", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    await waitFor(() => expect(getMeta("og:locale", "property")).toBe("vi_VN"));
    unmount();
  });

  it("sets twitter:card to summary_large_image", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    await waitFor(() =>
      expect(getMeta("twitter:card")).toBe("summary_large_image")
    );
    unmount();
  });

  it("sets twitter:site to @SGSLand", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc" });
    await waitFor(() => expect(getMeta("twitter:site")).toBe("@SGSLand"));
    unmount();
  });

  it("sets og:url using SITE_URL + canonicalPath", async () => {
    const unmount = await renderAndWait({ title: "Page", description: "Desc", canonicalPath: "/ai-valuation" });
    await waitFor(() =>
      expect(getMeta("og:url", "property")).toContain("sgsland.vn/ai-valuation")
    );
    unmount();
  });

  it("updates canonical-url element href on mount", async () => {
    const el = document.createElement("link");
    el.id = "canonical-url";
    document.head.appendChild(el);

    const unmount = await renderAndWait({ title: "Page", description: "Desc", canonicalPath: "/seo-page" });
    await waitFor(() => expect(el.href).toContain("sgsland.vn/seo-page"));

    document.head.removeChild(el);
    unmount();
  });

  it("uses window.location.pathname when canonicalPath is not provided", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/from-location" },
      writable: true,
    });
    const unmount = await renderAndWait({ title: "Page", description: "Desc" } as any);
    await waitFor(() =>
      expect(getMeta("og:url", "property")).toContain("sgsland.vn")
    );
    unmount();
  });

  it("creates json-ld-schema script tag with structuredData object", async () => {
    const structuredData = { "@type": "WebPage", name: "Test" };
    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      structuredData,
    });
    await waitFor(() => {
      const script = document.getElementById("json-ld-schema") as HTMLScriptElement;
      expect(script).toBeTruthy();
      expect(script.type).toBe("application/ld+json");
      const data = JSON.parse(script.textContent ?? "");
      expect(data["@context"]).toBe("https://schema.org");
      expect(data["@type"]).toBe("WebPage");
    });
    unmount();
  });

  it("creates json-ld-schema with @graph when structuredData is array", async () => {
    const structuredData = [
      { "@type": "WebPage", name: "Page" },
      { "@type": "Organization", name: "SGS LAND" },
    ];
    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      structuredData,
    });
    await waitFor(() => {
      const script = document.getElementById("json-ld-schema") as HTMLScriptElement;
      expect(script).toBeTruthy();
      const data = JSON.parse(script.textContent ?? "");
      expect(data["@context"]).toBe("https://schema.org");
      expect(Array.isArray(data["@graph"])).toBe(true);
      expect(data["@graph"]).toHaveLength(2);
    });
    unmount();
  });

  it("removes existing json-ld-schema when structuredData is not provided", async () => {
    // Setup: create an existing script
    const existingScript = document.createElement("script");
    existingScript.id = "json-ld-schema";
    existingScript.textContent = "{}";
    document.head.appendChild(existingScript);

    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      // no structuredData
    });
    await waitFor(() => {
      const script = document.getElementById("json-ld-schema");
      expect(script).toBeNull();
    });
    unmount();
  });

  it("reuses existing json-ld-schema script tag instead of creating new one", async () => {
    // Pre-create the script tag
    const existingScript = document.createElement("script");
    existingScript.id = "json-ld-schema";
    existingScript.type = "application/ld+json";
    existingScript.textContent = "{}";
    document.head.appendChild(existingScript);

    const structuredData = { "@type": "WebPage", name: "Reuse Test" };
    const unmount = await renderAndWait({
      title: "Page",
      description: "Desc",
      structuredData,
    });
    await waitFor(() => {
      const scripts = document.querySelectorAll("#json-ld-schema");
      expect(scripts).toHaveLength(1); // Should reuse, not duplicate
      const data = JSON.parse(scripts[0].textContent ?? "");
      expect(data["@type"]).toBe("WebPage");
    });
    unmount();
    // Cleanup
    document.getElementById("json-ld-schema")?.remove();
  });
});
