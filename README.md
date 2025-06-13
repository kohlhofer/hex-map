# Hex Map Generator

A beautiful, interactive hex map generator built with Next.js and TypeScript. Generate fantasy maps with different terrain types, settlements, and roads.

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

### Dynamic Hosting (Recommended)
- **Vercel**: Connect your GitHub repository for automatic deployments
- **Netlify**: Deploy directly from Git with automatic builds
- **Railway/Render**: Full Next.js hosting with server-side features

### Static Hosting
After running the appropriate build command:
- **GitHub Pages**: Use `npm run build:github-pages`, then deploy the `out/` folder to your `gh-pages` branch
- **AWS S3 + CloudFront**: Upload the `out/` folder contents
- **Google Cloud Storage**: Upload static files from `out/` directory  
- **Azure Static Web Apps**: Deploy the `out/` folder
- **Any web server**: Upload the `out/` folder contents to your server's web directory

#### GitHub Pages Deployment Example
```bash
# Build for GitHub Pages
npm run build:github-pages

# The out/ directory now contains files ready for GitHub Pages
# Deploy these to your gh-pages branch or configure GitHub Pages to use this output
```

## Technology Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **SVG Graphics**: Custom terrain and settlement symbols
- **Canvas API**: Hex grid rendering and interactions

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
