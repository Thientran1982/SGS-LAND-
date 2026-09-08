import { describe, expect, it } from "vitest";
import { renderChatContent } from "../../packages/chat-widget/src/renderChatContent";

describe("renderChatContent", () => {
  it("renders public landing URLs as links", () => {
    const output = renderChatContent(
      "Trang landing của bạn: https://example.com/landing/aqua-city",
    );
    const container = document.createElement("div");
    container.innerHTML = output;

    const link = container.querySelector<HTMLAnchorElement>(
      '[data-chat-landing-link="true"]',
    );

    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(
      "https://example.com/landing/aqua-city",
    );
    expect(link?.textContent).toBe("https://example.com/landing/aqua-city");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener noreferrer");
  });

  it("renders draft landing URLs as links", () => {
    const output = renderChatContent(
      "Bạn có thể chỉnh sửa tại /landing-ai/chinh-sua/aqua-city",
    );
    const container = document.createElement("div");
    container.innerHTML = output;

    const link = container.querySelector<HTMLAnchorElement>(
      '[data-chat-landing-link="true"]',
    );

    expect(link?.getAttribute("href")).toBe(
      "/landing-ai/chinh-sua/aqua-city",
    );
    expect(link?.textContent).toBe("/landing-ai/chinh-sua/aqua-city");
  });

  it("keeps visitorKey query parameters inside the clickable URL", () => {
    const output = renderChatContent(
      "Mở landing tại /landing/aqua-city?visitorKey=visitor-123&source=chat",
    );
    const container = document.createElement("div");
    container.innerHTML = output;

    const link = container.querySelector<HTMLAnchorElement>(
      '[data-chat-landing-link="true"]',
    );

    expect(link?.getAttribute("href")).toBe(
      "/landing/aqua-city?visitorKey=visitor-123&source=chat",
    );
    expect(link?.textContent).toBe(
      "/landing/aqua-city?visitorKey=visitor-123&source=chat",
    );
  });

  it("keeps sentence punctuation outside the link", () => {
    const output = renderChatContent(
      "Xem landing tại https://example.com/landing/aqua-city.",
    );
    const container = document.createElement("div");
    container.innerHTML = output;

    const link = container.querySelector<HTMLAnchorElement>(
      '[data-chat-landing-link="true"]',
    );

    expect(link?.getAttribute("href")).toBe(
      "https://example.com/landing/aqua-city",
    );
    expect(link?.textContent).toBe("https://example.com/landing/aqua-city");
    expect(container.textContent).toBe(
      "Xem landing tại https://example.com/landing/aqua-city.",
    );
  });

  it("escapes HTML while still rendering a safe landing link", () => {
    const output = renderChatContent(
      '<img src=x onerror="alert(1)"> Xem /landing/aqua-city?visitorKey=abc&source=chat',
    );
    const container = document.createElement("div");
    container.innerHTML = output;

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector<HTMLAnchorElement>(
      '[data-chat-landing-link="true"]',
    )?.getAttribute("href")).toBe(
      "/landing/aqua-city?visitorKey=abc&source=chat",
    );
    expect(output).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });
});