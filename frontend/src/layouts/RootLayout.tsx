import { useState } from "react";
import { Outlet } from "react-router-dom";
import ModernSidebar from "@/components/navigation/ModernSidebar";
import ModernHeader from "@/components/navigation/ModernHeader";
import OfflineIndicator from "@/components/common/OfflineIndicator";
import { useAppContext } from "@/contexts/AppContext";
import { Toaster } from "@/components/ui/sonner";

const RootLayout = () => {
  const { isDarkMode, isSidebarCollapsed } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className={`flex min-h-screen w-full ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-white">
        {/* Sidebar */}
        <ModernSidebar
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <ModernHeader
            onMenuClick={handleMobileMenuToggle}
            title="Dashboard"
          />

          {/* Page content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 overflow-auto">
            <Outlet />
          </main>
        </div>

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Toast notifications */}
        <Toaster position="top-right" richColors />
      </div>
    </div>
  );
};

export default RootLayout;
