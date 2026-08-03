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
  "A free hex map maker for tabletop RPGs and worldbuilding. Generates procedural terrain, settlements, and roads on a hex grid — click once for a new island. Open source, runs in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kohlhofer.com"),
  title: TITLE,
  description: DESCRIPTION,
  // "hexmap" (one word) and "maker" earn impressions on this page today
  // without appearing anywhere in its copy. They belong in the text as well
  // as here — see page.tsx.
  keywords: [
    "hex map generator",
    "hex map maker",
    "hexmap generator",
    "hexmap maker",
    "hex grid map maker",
    "hexagon map generator",
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
    "Settlement generation with cities, towns, and villages",
    "Road networks routed between settlements",
    "Hand-drawn SVG terrain symbols",
    "Runs entirely in the browser, nothing to install",
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
