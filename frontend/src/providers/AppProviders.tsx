import type { PropsWithChildren } from "react";
import { AppProvider } from "@/contexts/AppContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { AuthProvider } from "@/contexts/AuthContext";

const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <AppProvider>
      <OfflineProvider>
        <AuthProvider>{children}</AuthProvider>
      </OfflineProvider>
    </AppProvider>
  );
};

export default AppProviders;
