import type { Metadata } from "next";
// The standalone `geist` package rather than next/font/google: Geist only
// became a Google-hosted font entry in Next 15, and this project is on 14.
// Importing it from next/font/google fails the build with "Unknown font
// `Geist`", which is why the repo could no longer reproduce what was deployed.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const SITE = "https://kohlhofer.com/hex-map/";
const TITLE = "Hex Map Generator — make a fantasy hexmap in one click";
const DESCRIPTION =
  "A free online hex map maker for D&D, tabletop RPGs and worldbuilding. Click once for a new random island: terrain, settlements and roads on a hex grid. Open source, runs in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kohlhofer.com"),
  title: TITLE,
  description: DESCRIPTION,
  // Google ignores this tag, but it is the one place the long tail can live
  // without cluttering the copy: "hexmap" (one word) and "maker" earn
  // impressions on this page today. The terms that matter show up in the
  // visible text as well — see page.tsx.
  keywords: [
    "hex map generator",
    "hex map maker",
    "hex map creator",
    "hexmap generator",
    "hexmap maker",
    "hex grid map maker",
    "hexagon map generator",
    "hexagon map maker",
    "free hex map maker",
    "free online hex map generator",
    "dnd hex map maker",
    "fantasy map generator",
    "tabletop RPG map",
    "procedural generation",
    "worldbuilding",
  ],
  authors: [{ name: "Alexander Kohlhofer", url: "https://kohlhofer.com" }],
  alternates: { canonical: SITE },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE,
    siteName: "Kohlhofer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Hex Map Generator",
  url: SITE,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web browser",
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Alexander Kohlhofer", url: "https://kohlhofer.com" },
  license: "https://opensource.org/licenses/MIT",
  isAccessibleForFree: true,
  featureList: [
    "Procedural hex grid terrain — water, mountains, forest, grassland, hills, desert, swamp, brush",
    "Random generation — every click draws a new island",
    "Settlement generation with cities, towns, and villages",
    "Road networks routed between settlements",
    "Hand-drawn SVG terrain symbols",
    "Runs entirely in the browser, nothing to install, works on any device",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
      </head>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
