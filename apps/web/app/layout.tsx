import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";

export const metadata: Metadata = {
  title: "Shipvibes.dev - Frontend Code Editor with Auto-Deploy",
  description:
    "Edit frontend code locally with automatic synchronization, versioning, and deployment",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={`${GeistSans.className} antialiased`}>
        <QueryProvider>
          <div className="min-h-screen bg-background">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
