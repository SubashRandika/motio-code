import { requireUser } from "@/features/auth/session";
import { AppHeader } from "@/features/shell/app-header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader user={user} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
