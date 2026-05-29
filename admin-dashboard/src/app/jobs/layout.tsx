import { AdminShell } from "@/components/admin/shell";

export const dynamic = "force-dynamic";

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}

