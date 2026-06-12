import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Start talking — conversation-first language learning",
  description: "Conversation-first language learning",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
