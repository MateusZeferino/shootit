import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/user";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return children;
}
