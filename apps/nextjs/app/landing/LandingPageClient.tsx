// @ts-nocheck
"use client";
import { useEffect, useRef } from "react";
interface Props {
  slug: string;
}
/**
 * Handles all client-side interactivity for landing pages:
 * – Sticky nav scroll class
 * – Burger menu toggle
 * – Chip / interest selector
 * – Lead form submission (POST /api/leads)
 * – Scroll-reveal IntersectionObserver
 */
export default function LandingPageClient({ slug }: Props) {
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // ── Sticky nav ──────────────────────────────────
    const nav = document.getElementById("lp-nav");
    const onScroll = () => {
      if (nav) nav.classList.toggle("lp-scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    // ── Burger menu ─────────────────────────────────
    const burger = document.getElementById("lp-burger");
    const navLinks = document.getElementById("lp-nav-links");
    if (burger && navLinks) {
      burger.addEventListener("click", () => {
        const open = navLinks.classList.toggle("lp-open");
        burger.setAttribute("aria-expanded", String(open));
      });
      // Close on link click
      navLinks.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
          navLinks.classList.remove("lp-open");
          burger.setAttribute("aria-expanded", "false");
        });
      });
    }
    // ── Interest chips ───────────────────────────────
    document.querySelectorAll(".lp-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        chip.classList.toggle("on");
      });
    });
    // ── Lead form submission ─────────────────────────
    const form = document.getElementById("lp-lead-form") as HTMLFormElement | null;
    const successEl = document.getElementById("lp-form-success");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector(".lp-btn-submit");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Đang gửi...";
        }
        const interests = Array.from(          form.querySelectorAll(".lp-chip.on"),
        ).map((c) => c.textContent ?? "");
        const payload = {
          name: (form.elements.namedItem("name") as HTMLInputElement)?.value ?? "",
          phone: (form.elements.namedItem("phone") as HTMLInputElement)?.value ?? "",
          email: (form.elements.namedItem("email") as HTMLInputElement)?.value ?? "",
          budget: (form.elements.namedItem("budget") as HTMLSelectElement)?.value ?? "",
          interests,
          source: `landing-${slug}`,
          project: slug,
          marketingEmailConsent:
            (form.elements.namedItem("marketingEmailConsent") as HTMLInputElement)?.checked === true,
        };
        try {
          const res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok || res.status === 201) {
            form.style.display = "none";
            if (successEl) successEl.style.display = "block";
          } else {
            throw new Error("server_error");
          }
        } catch {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Gửi yêu cầu tư vấn";
          }
          alert("Có lỗi xảy ra. Vui lòng gọi trực tiếp 0379 281 445 để được hỗ trợ.");
        }
      });
    }
    // ── Scroll reveal ────────────────────────────────
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("lp-in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12 },
      );
      document.querySelectorAll(".lp-reveal").forEach((el) => io.observe(el));
    } else {
      // Fallback: show all immediately
      document.querySelectorAll(".lp-reveal").forEach((el) => {
        el.classList.add("lp-in");
      });
    }
    return () => {      window.removeEventListener("scroll", onScroll);
    };
  }, [slug]);
  return null;
}