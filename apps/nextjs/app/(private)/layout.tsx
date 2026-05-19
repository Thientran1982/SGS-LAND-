"use client";

import { CrmShell } from "@/components/private/CrmShell";

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
