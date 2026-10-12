import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/lib/router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError, useOverview } from "@/lib/api";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/Button";

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-ops-bg px-4">{children}</div>;
}

function Gate({ children }: { children: React.ReactNode }) {
  // The overview call doubles as the access check: the API answers 403 to anyone who is not a
  // Django superuser, whatever role they hold.
  const { logout } = useAuth();
  const overview = useOverview();

  if (overview.isLoading) {
    return (
      <FullScreen>
        <Loader2 className="w-6 h-6 animate-spin text-brand-blue" aria-label="Loading" />
      </FullScreen>
    );
  }
  if (overview.error instanceof ApiError && overview.error.status === 403) {
    return (
      <FullScreen>
        <div className="max-w-sm text-center bg-white border border-border rounded-2xl shadow-lift p-8">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <ShieldAlert className="w-6 h-6" />
          </span>
          <h2 className="font-serif text-2xl font-medium text-text-primary">Not a platform account</h2>
          <p className="text-sm text-text-secondary mt-2">
            This console is for platform superusers only. Agency and vendor accounts use their own
            portals.
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => void logout().catch(() => undefined)}>
            Sign out
          </Button>
        </div>
      </FullScreen>
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLogin) router.replace("/login");
    if (user && isLogin) router.replace("/");
  }, [user, isLoading, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (isLoading || !user) {
    return (
      <FullScreen>
        <Loader2 className="w-6 h-6 animate-spin text-brand-blue" aria-label="Loading" />
      </FullScreen>
    );
  }

  return (
    <Gate>
      <div className="flex h-screen bg-ops-bg overflow-x-hidden">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-ops-bg bg-ops-grid custom-scrollbar">
            <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 animate-page-enter">{children}</div>
          </main>
        </div>
      </div>
    </Gate>
  );
}
