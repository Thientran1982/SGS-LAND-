import React from "react";
// The Next app intentionally has an isolated React installation; its server
// renderer has no declaration entry point visible from the root test project.
// @ts-expect-error -- use the renderer paired with the component under test.
import { renderToStaticMarkup } from "../../apps/nextjs/node_modules/react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GeneratedLandingPage, {
  type GeneratedLandingData,
} from "../../apps/nextjs/app/landing/GeneratedLandingPage";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a {...props}>{children}</a>
  ),
}));

const basePage: GeneratedLandingData = {
  id: "landing-1",
  project_name: "Tên dự án gốc",
  slug: "ten-du-an",
  status: "draft",
  visitor_key: "owner-key",
  sections: [
    {
      stage: "hero",
      title: "Tiêu đề do AI tạo",
      body: "Mô tả được tạo từ brief.",
    },
    {
      stage: "gallery",
      title: "Bộ sưu tập hình ảnh",
      images: ["/uploads/gallery-one.webp", "/uploads/gallery-two.webp"],
    },
  ],
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("GeneratedLandingPage", () => {
  function renderPage(page: GeneratedLandingData) {
    document.body.innerHTML = renderToStaticMarkup(
      React.createElement(GeneratedLandingPage, {
        page,
        visitorKey: "owner-key",
      }),
    );
    return document.body;
  }

  it.each(["draft", "published"] as const)(
    "keeps generated hero and gallery content visible for %s pages",
    (status) => {
      const page = renderPage({ ...basePage, status });

      expect(page.querySelector("h1")?.textContent).toBe("Tiêu đề do AI tạo");
      expect(page.querySelector("h1")?.textContent).not.toBe("Tên dự án gốc");
      expect(page.querySelector('img[alt="Tên dự án gốc - hình ảnh 1"]')).toHaveAttribute(
        "src",
        "/uploads/gallery-one.webp",
      );
      expect(page.querySelector('img[alt="Tên dự án gốc - hình ảnh 2"]')).toHaveAttribute(
        "src",
        "/uploads/gallery-two.webp",
      );
    },
  );

  it("renders every section in the fixed order with accessible empty fallbacks", () => {
    const page = renderPage(basePage);

    expect(
      Array.from(page.querySelectorAll("header[id], section[id]")).map((element) => element.id),
    ).toEqual(["hero", "gallery", "legal", "price", "amenities", "contact"]);
    for (const text of [
      "Nội dung pháp lý đang được cập nhật.",
      "Nội dung giá & thanh toán đang được cập nhật.",
      "Nội dung tiện ích đang được cập nhật.",
    ]) {
      expect(
        Array.from(page.querySelectorAll('[role="status"]')).some((element) =>
          element.textContent?.includes(text),
        ),
      ).toBe(true);
    }
  });
});