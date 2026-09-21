import type { Metadata } from "next";
import { FavoritesPage } from "@/components/public/FavoritesPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BĐS đã yêu thích | SGS LAND",
  description: "Xem lại các bất động sản bạn đã lưu trên SGS LAND.",
};

export default function FavoritesRoute() {
  return <FavoritesPage />;
}