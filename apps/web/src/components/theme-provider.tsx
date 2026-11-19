"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Light / Dark / System. Sets the "light" or "dark" class on <html> before first paint (no flash);
 * the token scopes in globals.css key off those classes.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="tensorlm:theme"
    >
      {children}
    </NextThemesProvider>
  );
}
