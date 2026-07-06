import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar, SidebarContent } from "@/components/layout/Sidebar";
import { RightRail } from "@/components/layout/RightRail";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <Navbar onMenuClick={() => setMobileOpen(true)} />
      <div className="mx-auto flex max-w-[1440px]">
        <Sidebar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
          <Outlet />
        </main>
        <RightRail />
      </div>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
