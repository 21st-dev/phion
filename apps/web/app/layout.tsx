import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <div className="min-h-screen bg-background">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
