# Hex Map Generator

A modern, interactive hex map generator built with Next.js and React. This project creates beautiful, procedurally generated island maps with a variety of terrain types, settlements, roads, and a responsive, user-friendly UI.

## Features

- **Procedural Hex Map Generation**: Generates unique island maps with each click, using a seeded random algorithm.
- **Terrain Types**: Supports water, grassland, forest, desert, mountain, hills, swamp, and brush, each with distinct colors and symbols.
- **Settlements & Roads**: Cities, towns, and villages are placed based on terrain suitability, and connected by organic, winding roads.
- **Responsive UI**: The map and legend adapt to any screen size. On mobile, the legend is centered at the bottom; on larger screens, it's bottom-right aligned.
- **Legend**: Compact, visually consistent legend with all terrain types, roads, and settlements, always visible for easy reference.
- **Map Title**: The map's name is generated and displayed at the top, replacing the need for a windrose.
- **Clean, Minimalist Design**: No unnecessary controls—just a floating generate button and a clear, modern look.

## Getting Started

### 1. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 2. Run the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

## Usage

- Click the green floating button in the top-left to generate a new random map.
- The map will resize responsively to your window.
- The legend explains all map symbols and is always visible (bottom center on mobile, bottom right on desktop).

## Development

- Main map logic and UI: `src/components/HexMap.tsx`
- Edit `HexMap.tsx` to change map generation, rendering, or UI.
- The app uses [Tailwind CSS](https://tailwindcss.com/) for styling.
- All debug logging has been removed for production cleanliness.

## Deployment

You can deploy this app to Vercel, Netlify, or any platform that supports Next.js. For Vercel, simply connect your GitHub repo and follow their instructions.

## License

MIT (or specify your license here)

---

Built with [Next.js](https://nextjs.org/) and ❤️ by [your name or team].
