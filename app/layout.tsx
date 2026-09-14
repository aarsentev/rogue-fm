import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MiniDock } from "@/components/player/MiniDock";
import { ThemeSync } from "@/components/ui/ThemeSync";
import "./globals.css";

// Set the theme before first paint so there's no flash of the wrong palette.
const NO_FLASH_THEME = `
try {
  var s = JSON.parse(localStorage.getItem('roguefm.settings') || '{}');
  document.documentElement.dataset.theme = s.lightMode ? 'light' : 'dark';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rogue FM",
  description: "Personal radio broadcast simulator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME }} />
        <ThemeSync />
        {children}
        <MiniDock />
      </body>
    </html>
  );
}
