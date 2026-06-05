import { Outlet } from "@tanstack/react-router";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { RightRail } from "@/components/layout/RightRail";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto flex max-w-[1440px]">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
          <Outlet />
        </main>
        <RightRail />
      </div>
    </div>
  );
}
