import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BIAI Corporate Intelligence",
  description: "Every lead. Every follow-up. One clear pipeline. AI-powered corporate sales intelligence for BIAI.",
  keywords: ["BIAI", "CRM", "sales pipeline", "corporate leads", "AI sales assistant", "data quality"],
  authors: [{ name: "BIAI Business Development" }],
  openGraph: {
    title: "BIAI Corporate Intelligence",
    description: "Every lead. Every follow-up. One clear pipeline.",
    siteName: "BIAI Corporate Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BIAI Corporate Intelligence",
    description: "Every lead. Every follow-up. One clear pipeline.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
