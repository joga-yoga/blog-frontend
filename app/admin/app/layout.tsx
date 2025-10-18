import type { ReactNode } from "react";

export const dynamic = "force-static";

export default function AdminAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
