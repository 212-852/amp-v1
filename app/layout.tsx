import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { LiffAutoLogin } from "@/components/access/liff";
import { PwaRuntime } from "@/components/pwa/runtime";
import { AccessPresence } from "@/components/access/presence";
import { OverlayProvider } from "@/components/overlay";
import { ToastProvider } from "@/components/ui/toast_provider";
import { LocaleProvider } from "@/src/components/locale/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PET TAXI",
  description: "AMP v1 user app shell",
  manifest: "/manifest.json",
  icons: {
    icon: "/images/icon.svg",
    shortcut: "/images/icon.svg",
    apple: "/images/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "PET TAXI",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <LocaleProvider>
          <ToastProvider>
            <OverlayProvider>
              <PwaRuntime />
              <AccessPresence />
              <LiffAutoLogin />
              {children}
            </OverlayProvider>
          </ToastProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
