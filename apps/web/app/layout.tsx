import "./tokens.css";
import "./globals.css";
import type { ReactNode } from "react";
import { Golos_Text, Literata } from "next/font/google";

// Self-hosted by next/font (no request to Google at runtime). Literata carries the Macedonian text and
// headings, Golos Text the interface; both include Cyrillic.
const golos = Golos_Text({ subsets: ["latin", "cyrillic"], variable: "--font-golos", display: "swap" });
const literata = Literata({ subsets: ["latin", "cyrillic"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-literata", display: "swap" });

export const metadata = {
  title: "Start talking — conversation-first language learning",
  description: "Conversation-first language learning",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEEBE5" },
    { media: "(prefers-color-scheme: dark)", color: "#141110" },
  ],
};

// Apply a chosen light/dark theme before first paint (the setting itself syncs with progress; this is
// the local copy Home mirrors it to), so a dark-mode learner never sees a flash of linen.
const themeBoot = `try{var t=localStorage.getItem("ll-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${golos.variable} ${literata.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
