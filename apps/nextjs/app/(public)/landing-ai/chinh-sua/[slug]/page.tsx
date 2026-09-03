/**
 * Landing page editor (owner view). URL: /landing-ai/chinh-sua/<slug>?k=<visitorKey>
 * Server shell: load the page data once, then hand it to the client form.
 * The visitor key given when the page was created (k) is the owner key.
 */
import { notFound } from "next/navigation";
import EditorForm from "./EditorForm";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5001";

interface LandingSection {
  stage: string;
  title?: string;
  body?: string;
  items?: string[];
  phone?: string;
  contactName?: string;
  tokens: number;
}

interface GeneratedLandingPage {
  id: string;
  project_name: string;
  slug: string;
  brochure_name: string | null;
  sections: LandingSection[];
  status: string;
  language: string;
  updated_at: string;
}

export default async function LandingEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug } = await params;
  const { k } = await searchParams;
  let page: GeneratedLandingPage | null = null;
  try {
    const res = await fetch(BACKEND_URL + "/api/landing-pages/" + encodeURIComponent(slug), {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      page = data?.page ?? null;
    }
  } catch {
    page = null;
  }
  if (!page) notFound();
  return <EditorForm initialPage={page} initialKey={k || ""} />;
}
