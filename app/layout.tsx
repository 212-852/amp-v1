import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { LiffAutoLogin } from "@/components/access/liff";
import { AccessPresence } from "@/components/access/presence";
import { OverlayProvider } from "@/components/overlay";
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
          <OverlayProvider>
            <AccessPresence />
            <LiffAutoLogin />
            {children}
          </OverlayProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
