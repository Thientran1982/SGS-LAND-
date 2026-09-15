import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function VinhhomesHocMonTypoRedirect() {
  redirect("/du-an/vinhomes-hoc-mon");
}