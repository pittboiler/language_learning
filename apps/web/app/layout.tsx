import "./tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import { Literata, Nunito } from "next/font/google";

// Self-hosted by next/font (no request to Google at runtime). Literata carries the Macedonian text and
// headings, Nunito the interface (the Café look's rounded sans); both include Cyrillic.
const nunito = Nunito({ subsets: ["latin", "cyrillic"], variable: "--font-nunito", display: "swap" });
const literata = Literata({ subsets: ["latin", "cyrillic"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-literata", display: "swap" });

export const metadata = {
  title: "Start talking: conversation-first language learning",
  description: "Conversation-first language learning",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F1E8" },
    { media: "(prefers-color-scheme: dark)", color: "#1C1611" },
  ],
};

// Apply a chosen light/dark theme before first paint (the setting itself syncs with progress; this is
// the local copy Home mirrors it to), so a dark-mode learner never sees a flash of cream.
const themeBoot = `try{var t=localStorage.getItem("ll-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
