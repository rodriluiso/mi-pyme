"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useAppContext();
  const theme = isDarkMode ? "dark" : "light";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
