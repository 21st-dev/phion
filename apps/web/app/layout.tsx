import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import { QueryProvider } from "@/lib/query-client"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Phion",
  description:
    "Just craft in Cursor. We handle versioning, publishing, architecture rules, and everything else. Focus on creating, not configuring.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Phion",
    description:
      "Just craft in Cursor. We handle versioning, publishing, architecture rules, and everything else. Focus on creating, not configuring.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Phion - Focus on creating, not configuring",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Phion",
    description:
      "Just craft in Cursor. We handle versioning, publishing, architecture rules, and everything else. Focus on creating, not configuring.",
    images: ["/og.png"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className={`${GeistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <div className="min-h-screen bg-background">{children}</div>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
