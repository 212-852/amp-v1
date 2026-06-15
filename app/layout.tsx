import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ContactPresence } from "@/components/contacts/presence";
import { OverlayProvider } from "@/components/overlay";
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
  icons: {
    apple: "/images/apple_icon.png",
    icon: [
      { url: "/images/icon_192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon_512.png", sizes: "512x512", type: "image/png" },
    ],
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
        <OverlayProvider>
          <ContactPresence />
          {children}
        </OverlayProvider>
      </body>
    </html>
  );
}
