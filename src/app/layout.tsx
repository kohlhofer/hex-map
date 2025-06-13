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
  title: "Hex Map Generator | Kohlhofer",
  description: "Interactive fantasy hex map generator with procedural terrain, settlements, and roads. Create beautiful island maps for tabletop gaming and world building.",
  keywords: ["hex map", "fantasy map", "tabletop gaming", "procedural generation", "world building", "RPG maps"],
  authors: [{ name: "Kohlhofer" }],
  openGraph: {
    title: "Hex Map Generator | Kohlhofer",
    description: "Interactive fantasy hex map generator with procedural terrain, settlements, and roads.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
