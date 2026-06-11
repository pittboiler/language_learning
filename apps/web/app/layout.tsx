import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Macedonian — start talking",
  description: "Conversation-first language learning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
