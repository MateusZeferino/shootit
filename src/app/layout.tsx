import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { PwaRegistration } from "./pwa-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Shootit",
    template: "%s | Shootit",
  },
  description: "Organize e compartilhe suas galerias de fotografia.",
  appleWebApp: { capable: true, title: "Shootit", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f172a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
