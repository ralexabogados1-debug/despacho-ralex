// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jurídico Legal",
  description: "Sistema de Gestión Jurídica",
  manifest: "/manifest.json",
  themeColor: "#3a5fb8",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jurídico Legal",
  },
  icons: {
    icon: "/img/icon-192x192.png",
    apple: "/img/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}