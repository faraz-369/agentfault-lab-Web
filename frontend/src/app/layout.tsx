import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentFault Lab — Agent reliability, under pressure",
  description:
    "Run reproducible fault-injection experiments, compare recovery policies, and inspect AI-agent execution traces.",
  applicationName: "AgentFault Lab",
};

export const viewport: Viewport = {
  themeColor: "#090d16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
