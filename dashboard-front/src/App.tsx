import { useState } from "react";
import { EnterpriseNavigation } from "./components/EnterpriseNavigation";
import { Dashboard } from "./components/Dashboard";
import { TeamSection } from "./components/TeamSection";
import { ProjectsSection } from "./components/ProjectsSection";
import { FinancesSection } from "./components/FinancesSection";
import { ClientsSection } from "./components/ClientsSection";
import { CalendarSection } from "./components/CalendarSection";
import { ReportsSection } from "./components/ReportsSection";
import { UndoButton } from "./components/UndoButton";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  const [activeSection, setActiveSection] = useState("dashboard");

  const renderActiveSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <Dashboard />;
      case "team":
        return <TeamSection />;
      case "projects":
        return <ProjectsSection />;
      case "finances":
        return <FinancesSection />;
      case "clients":
        return <ClientsSection />;
      case "calendar":
        return <CalendarSection />;
      case "reports":
        return <ReportsSection />;
      case "settings":
        return (
          <div className="p-6">
            <h1 className="text-3xl mb-2">Settings</h1>
            <p className="text-muted-foreground">Configure your enterprise management system.</p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">General Settings</h3>
                <p className="text-sm text-muted-foreground">Company information, timezone, and preferences</p>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">User Management</h3>
                <p className="text-sm text-muted-foreground">Manage user accounts and permissions</p>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Integrations</h3>
                <p className="text-sm text-muted-foreground">Connect with third-party services</p>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Security</h3>
                <p className="text-sm text-muted-foreground">Security settings and access controls</p>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Notifications</h3>
                <p className="text-sm text-muted-foreground">Configure email and system notifications</p>
              </div>
              <div className="p-6 border rounded-lg">
                <h3 className="font-medium mb-2">Billing</h3>
                <p className="text-sm text-muted-foreground">Subscription and payment settings</p>
              </div>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <EnterpriseNavigation
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />
      <div className="flex-1 flex flex-col">
        {/* Header con botón de undo */}
        <header className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center justify-end px-6 sticky top-0 z-10">
          <UndoButton />
        </header>

        {/* Contenido principal */}
        <main className="flex-1 overflow-auto">
          {renderActiveSection()}
        </main>
      </div>

      {/* Toast notifications */}
      <Toaster position="top-right" richColors />
    </div>
  );
}