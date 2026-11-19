import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono, Literata } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// All three are variable fonts: one file per style covers every weight we use (400/500/600).
// Only the interface face is preloaded; Literata (answers) and JetBrains Mono load on first use.
const hanken = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-hanken",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-literata",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "TensorLM",
  description: "Understand any paper, with diagrams that explain it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${literata.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
