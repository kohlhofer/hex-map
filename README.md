# Hex Map Generator

**Live at [kohlhofer.com/hex-map](https://kohlhofer.com/hex-map/)**

A free hex map maker for tabletop RPGs and worldbuilding, built with Next.js and TypeScript. Press the button and it generates an island: procedural terrain across a hex grid, settlements placed where the land suits them, and roads routed between them.

Runs entirely in the browser. No account, no server, nothing stored.

## Features

- **Interactive hex grid**: Click to generate new maps
- **Diverse terrain types**: Water, mountains, forests, grasslands, hills, deserts, swamps, and brush
- **Settlement generation**: Cities, towns, and villages placed strategically
- **Road networks**: Connecting settlements with pathfinding
- **Beautiful visual design**: Hand-crafted SVG symbols and terrain-specific styling
- **Responsive layout**: Works on desktop and mobile devices

## Getting Started

### Development

First, install the dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Build Commands

The project supports multiple build configurations for different deployment scenarios:

#### Standard Build
```bash
npm run build
```
Creates an optimized production build for standard hosting (root domain or custom domains).

#### Static Export (Root Domain)
```bash
npm run export
# or
npm run build:static
```
Generates static files in the `out/` directory for hosting on static file servers when deployed to the root of a domain.

#### GitHub Pages / Subfolder Deployment
```bash
npm run build:github-pages
```
Builds the application with `/hex-map` base path for deployment to GitHub Pages or other services that host in subfolders. All asset paths will be prefixed appropriately.

#### Custom Subfolder Deployment
```bash
NEXT_PUBLIC_BASE_PATH=/your-subfolder npm run build
```
You can specify any custom subfolder path by setting the `NEXT_PUBLIC_BASE_PATH` environment variable.

### Static File Output

All build commands generate static files in the `out/` directory that can be:
- Uploaded to any static hosting service
- Served from a CDN
- Deployed to GitHub Pages, Netlify, Vercel, or similar platforms

## Deployment

This repository deploys itself. `.github/workflows/deploy.yml` runs
`npm run build:github-pages` on every push to `main` and publishes `out/` to
GitHub Pages, which serves it at
[kohlhofer.com/hex-map](https://kohlhofer.com/hex-map/).

The base path matters: this is a *project* Pages site, served from `/hex-map/`
rather than a domain root. `NEXT_PUBLIC_BASE_PATH` sets Next's `basePath` and
`assetPrefix` (see `next.config.mjs`). Build without it and every asset URL is
absolute to `/` and 404s once deployed.

For anywhere else, `npm run build:static` produces a root-relative `out/` that
can be uploaded to any static host.

## Technology Stack

- **Next.js 14**: React framework with App Router, static export
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS v4**: Utility-first CSS, via `@tailwindcss/postcss`
- **Geist**: fonts via the standalone `geist` package rather than
  `next/font/google` — Geist only became a Google-font entry in Next 15
- **SVG Graphics**: Custom terrain and settlement symbols

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main application page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
└── components/
    └── HexMap.tsx        # Main hex map component
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).
