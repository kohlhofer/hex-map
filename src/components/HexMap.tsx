'use client';

import { useState, useEffect } from 'react';

// Define terrain types
export enum TerrainType {
  WATER = 'water',
  GRASSLAND = 'grassland',
  FOREST = 'forest',
  DESERT = 'desert',
  MOUNTAIN = 'mountain',
  HILLS = 'hills',
  SWAMP = 'swamp',
  BRUSH = 'brush',
}

interface HexTile {
  id: string;
  q: number; // axial coordinates
  r: number;
  terrain: TerrainType;
  river?: boolean;
}

interface Point {
  x: number;
  y: number;
}

// Seeded RNG (mulberry32)
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Helper to generate a random seed string
function randomSeed() {
  return Math.floor(Math.random() * 1e9).toString(36);
}

// Helper: get neighbors for a tile (even-q offset for flat-topped hexes)
function getNeighbors(tile: HexTile, tileMap: Record<string, HexTile>) {
  // Even-q offset directions
  const evenq_directions = [
    [+1,  0], [0, -1], [-1, -1],
    [-1,  0], [-1, +1], [0, +1]
  ];
  const oddq_directions = [
    [+1,  0], [+1, -1], [0, -1],
    [-1,  0], [0, +1], [+1, +1]
  ];
  const directions = tile.q % 2 === 0 ? evenq_directions : oddq_directions;
  return directions
    .map(([dq, dr]) => tileMap[`${tile.q + dq},${tile.r + dr}`])
    .filter(n => n);
}

export default function HexMap() {
  const [tiles, setTiles] = useState<HexTile[]>([]);
  const [tileMap, setTileMap] = useState<Record<string, HexTile>>({});
  const [mapWidth, setMapWidth] = useState(20); // width of the map (in hexes)
  const [mapHeight, setMapHeight] = useState(14); // height of the map (in hexes)
  const [hexSize, setHexSize] = useState(20); // size of hexagons in pixels (smaller)
  const [seed, setSeed] = useState('12345');
  const [seedInput, setSeedInput] = useState('12345');

  // Convert axial coordinates to pixel coordinates (flat-topped, rectangular grid)
  const axialToPixel = (q: number, r: number): Point => {
    const x = hexSize * 1.5 * q;
    const y = hexSize * Math.sqrt(3) * (r + 0.5 * (q % 2));
    return { x, y };
  };

  // Generate hexagon points for SVG
  const getHexPoints = (center: Point): string => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = 2 * Math.PI / 6 * i;
      const x = center.x + hexSize * Math.cos(angle);
      const y = center.y + hexSize * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  // Generate the map
  const generateMap = () => {
    // Use seeded RNG
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) {
      seedNum = (seedNum * 31 + seed.charCodeAt(i)) & 0xffffffff;
    }
    const rand = mulberry32(seedNum);

    const newTiles: HexTile[] = [];
    const coords: [number, number][] = [];

    // Rectangular grid: q from 0 to mapWidth-1, r from 0 to mapHeight-1
    for (let q = 0; q < mapWidth; q++) {
      for (let r = 0; r < mapHeight; r++) {
        coords.push([q, r]);
        // Outermost tiles are water
        const isEdge = q === 0 || r === 0 || q === mapWidth - 1 || r === mapHeight - 1;
        const tile: HexTile = {
          id: `${q},${r}`,
          q,
          r,
          terrain: isEdge ? TerrainType.WATER : null as any // temp
        };
        tileMap[tile.id] = tile;
        newTiles.push(tile);
      }
    }

    // --- Island Generation: random walk blob ---
    // Start from center, grow a blob of land tiles
    const landTiles: HexTile[] = [];
    const centerQ = Math.floor(mapWidth / 2);
    const centerR = Math.floor(mapHeight / 2);
    const islandSize = Math.floor((mapWidth * mapHeight) * 0.4 + rand() * (mapWidth * mapHeight) * 0.1); // 40-50% land
    let blobFrontier = [tileMap[`${centerQ},${centerR}`]];
    tileMap[`${centerQ},${centerR}`].terrain = TerrainType.GRASSLAND;
    landTiles.push(tileMap[`${centerQ},${centerR}`]);
    while (landTiles.length < islandSize && blobFrontier.length > 0) {
      const current = blobFrontier[Math.floor(rand() * blobFrontier.length)];
      // Get neighbors within bounds
      const neighbors = getNeighbors(current, tileMap).filter(n => n.terrain !== TerrainType.WATER && !landTiles.includes(n));
      if (neighbors.length === 0) {
        blobFrontier = blobFrontier.filter(t => t !== current);
        continue;
      }
      const chosen = neighbors[Math.floor(rand() * neighbors.length)];
      chosen.terrain = TerrainType.GRASSLAND;
      landTiles.push(chosen);
      blobFrontier.push(chosen);
      if (rand() < 0.3) blobFrontier = blobFrontier.filter(t => t !== current); // organic shape
    }
    // All other non-edge, non-blob tiles are water
    for (const tile of newTiles) {
      if (!tile.terrain) tile.terrain = TerrainType.WATER;
    }

    // --- Improved Clustered Terrain Generation (tuned for more grassland) ---
    // Shuffle clusterTerrains for each map
    const clusterTerrains = [TerrainType.FOREST, TerrainType.DESERT, TerrainType.MOUNTAIN, TerrainType.HILLS, TerrainType.SWAMP, TerrainType.BRUSH];
    for (let i = clusterTerrains.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [clusterTerrains[i], clusterTerrains[j]] = [clusterTerrains[j], clusterTerrains[i]];
    }
    // Set cluster counts and sizes per terrain
    const clusterSettings: Record<TerrainType, {count: number, size: number}> = {
      [TerrainType.FOREST]: { count: Math.max(2, Math.floor(landTiles.length / 40)), size: Math.max(8, Math.floor(landTiles.length / 12)) },
      [TerrainType.DESERT]: { count: Math.max(2, Math.floor(landTiles.length / 50)), size: Math.max(6, Math.floor(landTiles.length / 15)) },
      [TerrainType.MOUNTAIN]: { count: Math.max(1, Math.floor(landTiles.length / 80)), size: Math.max(3, Math.floor(landTiles.length / 30)) },
      [TerrainType.HILLS]: { count: Math.max(1, Math.floor(landTiles.length / 60)), size: Math.max(4, Math.floor(landTiles.length / 20)) },
      [TerrainType.SWAMP]: { count: Math.max(1, Math.floor(landTiles.length / 60)), size: Math.max(4, Math.floor(landTiles.length / 18)) },
      [TerrainType.BRUSH]: { count: Math.max(1, Math.floor(landTiles.length / 60)), size: Math.max(4, Math.floor(landTiles.length / 18)) },
      [TerrainType.WATER]: { count: 0, size: 0 },
      [TerrainType.GRASSLAND]: { count: 0, size: 0 },
    };
    // Seed clusters
    for (const terrain of clusterTerrains) {
      const {count, size} = clusterSettings[terrain];
      for (let i = 0; i < count; i++) {
        // Pick a random grassland land tile as seed
        let seedTile;
        let tries = 0;
        do {
          seedTile = landTiles[Math.floor(rand() * landTiles.length)];
          tries++;
        } while (seedTile.terrain !== TerrainType.GRASSLAND && tries < 10);
        if (!seedTile || seedTile.terrain !== TerrainType.GRASSLAND) continue;
        // --- Custom cluster seeding for SWAMP and BRUSH ---
        if (terrain === TerrainType.SWAMP) {
          // Prefer grassland tiles adjacent to water, river, or forest
          const swampCandidates = landTiles.filter(t =>
            t.terrain === TerrainType.GRASSLAND &&
            getNeighbors(t, tileMap).some(n =>
              n.terrain === TerrainType.WATER || n.river || n.terrain === TerrainType.FOREST
            )
          );
          if (swampCandidates.length > 0) {
            seedTile = swampCandidates[Math.floor(rand() * swampCandidates.length)];
          }
        } else if (terrain === TerrainType.BRUSH) {
          // Prefer grassland/hills tiles adjacent to desert, but not adjacent to water
          const brushCandidates = landTiles.filter(t =>
            (t.terrain === TerrainType.GRASSLAND || t.terrain === TerrainType.HILLS) &&
            getNeighbors(t, tileMap).some(n => n.terrain === TerrainType.DESERT) &&
            !getNeighbors(t, tileMap).some(n => n.terrain === TerrainType.WATER || n.river)
          );
          if (brushCandidates.length > 0) {
            seedTile = brushCandidates[Math.floor(rand() * brushCandidates.length)];
          }
        }
        seedTile.terrain = terrain;
        // Grow cluster
        let frontier = [seedTile];
        for (let j = 0; j < size; j++) {
          if (frontier.length === 0) break;
          const current = frontier[Math.floor(rand() * frontier.length)];
          // Get unassigned grassland neighbors
          let neighbors = getNeighbors(current, tileMap).filter(n => n.terrain === TerrainType.GRASSLAND);
          // For SWAMP, allow to grow into forest or river-adjacent tiles
          if (terrain === TerrainType.SWAMP) {
            neighbors = neighbors.concat(getNeighbors(current, tileMap).filter(n =>
              n.terrain === TerrainType.FOREST && !n.river
            ));
          }
          // For BRUSH, allow to grow into hills
          if (terrain === TerrainType.BRUSH) {
            neighbors = neighbors.concat(getNeighbors(current, tileMap).filter(n => n.terrain === TerrainType.HILLS));
          }
          if (neighbors.length === 0) continue;
          const chosen = neighbors[Math.floor(rand() * neighbors.length)];
          chosen.terrain = terrain;
          frontier.push(chosen);
          if (rand() < 0.3) frontier = frontier.filter(t => t !== current); // organic shape
        }
      }
    }
    // Fill remaining land tiles with grassland
    for (const tile of landTiles) {
      if (tile.terrain === null) tile.terrain = TerrainType.GRASSLAND;
    }

    // --- Make hills more likely around mountains ---
    for (const tile of landTiles) {
      if (tile.terrain === TerrainType.MOUNTAIN) continue;
      const neighbors = getNeighbors(tile, tileMap).filter(n => n.terrain === TerrainType.MOUNTAIN);
      if (neighbors.length > 0 && tile.terrain !== TerrainType.HILLS) {
        if (rand() < 0.5) {
          tile.terrain = TerrainType.HILLS;
        }
      }
    }

    // --- Make deserts more likely around grassland/hills ---
    for (const tile of landTiles) {
      if (tile.terrain === TerrainType.DESERT) continue;
      if (tile.terrain !== TerrainType.GRASSLAND && tile.terrain !== TerrainType.HILLS) continue;
      const neighbors = getNeighbors(tile, tileMap).filter(n => n.terrain === TerrainType.DESERT);
      if (neighbors.length > 0) {
        if (rand() < 0.4) {
          tile.terrain = TerrainType.DESERT;
        }
      }
    }

    // --- River Generation (improved: BFS path, connectivity check) ---
    function isAdjacentToSea(tile: HexTile) {
      return getNeighbors(tile, tileMap).some(n => n.terrain === TerrainType.WATER);
    }
    function terrainElevation(terrain: TerrainType) {
      switch (terrain) {
        case TerrainType.MOUNTAIN: return 5;
        case TerrainType.HILLS: return 4;
        case TerrainType.FOREST: return 3;
        case TerrainType.GRASSLAND: return 2;
        case TerrainType.DESERT: return 1;
        default: return 0;
      }
    }
    // Helper: check if all land tiles are connected (BFS)
    function isIslandConnected() {
      const land = newTiles.filter(t => t.terrain !== TerrainType.WATER);
      if (land.length === 0) return true;
      const visited = new Set<string>();
      const queue = [land[0]];
      visited.add(land[0].id);
      while (queue.length) {
        const t = queue.shift()!;
        for (const n of getNeighbors(t, tileMap)) {
          if (n.terrain !== TerrainType.WATER && !visited.has(n.id)) {
            visited.add(n.id);
            queue.push(n);
          }
        }
      }
      return visited.size === land.length;
    }
    // Find river sources (mountains not adjacent to sea)
    const riverSources = landTiles.filter(t => t.terrain === TerrainType.MOUNTAIN && !isAdjacentToSea(t));
    const riverCount = Math.max(1, Math.floor(landTiles.length / 80));
    let riversMade = 0;
    let riverAttempts = 0;
    while (riversMade < riverCount && riverAttempts < 30) {
      riverAttempts++;
      const source = riverSources[Math.floor(rand() * riverSources.length)];
      if (!source) break;
      // BFS to find shortest path to sea, preferring lower elevation
      const queue: {tile: HexTile, path: HexTile[]}[] = [{tile: source, path: [source]}];
      const visited = new Set([source.id]);
      let foundPath: HexTile[] | null = null;
      while (queue.length) {
        // Sort queue by elevation (lowest first)
        queue.sort((a, b) => terrainElevation(a.tile.terrain) - terrainElevation(b.tile.terrain));
        const {tile, path} = queue.shift()!;
        if (isAdjacentToSea(tile)) {
          foundPath = path;
          break;
        }
        for (const n of getNeighbors(tile, tileMap)) {
          if (n.terrain !== TerrainType.WATER && !n.river && !visited.has(n.id)) {
            visited.add(n.id);
            queue.push({tile: n, path: [...path, n]});
          }
        }
      }
      if (foundPath && foundPath.length > 3) {
        // Mark river
        for (const t of foundPath) t.river = true;
        // Check connectivity
        if (isIslandConnected()) {
          riversMade++;
        } else {
          // Undo river
          for (const t of foundPath) t.river = false;
        }
      }
    }
    setTiles(newTiles);
    setTileMap(tileMap);
  };

  // --- Dynamic SVG viewBox calculation ---
  // Find min/max pixel coordinates (crop half a hex inside the outermost hexes)
  const getMapBounds = () => {
    // For even-q offset, flat-topped hexes:
    // Leftmost hex center: q=0, x=0
    // Rightmost hex center: x = hexSize * 1.5 * (mapWidth - 1)
    // Each hex extends hexSize to left/right from center
    const hexWidth = hexSize * 2;
    const hexHeight = Math.sqrt(3) * hexSize;
    const minX = -hexSize + hexWidth / 2; // crop half a hex inside
    const maxX = hexSize * 1.5 * (mapWidth - 1) + hexSize - hexWidth / 2; // crop half a hex inside
    // For y, topmost hex center: r=0, y=0 for even q=0, but for odd q, y is offset
    // We'll just compute min/max y from all hexes, then crop half a hex height inside
    let minY = Infinity, maxY = -Infinity;
    for (let q = 0; q < mapWidth; q++) {
      for (let r = 0; r < mapHeight; r++) {
        const { x, y } = axialToPixel(q, r);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    minY = minY - hexHeight / 2 + hexHeight / 2; // crop half a hex inside
    maxY = maxY + hexHeight / 2 - hexHeight / 2; // crop half a hex inside
    return {
      minX,
      maxX,
      minY,
      maxY
    };
  };
  const bounds = getMapBounds();

  // Get random terrain type (excluding water)
  const getRandomTerrain = (): TerrainType => {
    const terrains = [
      TerrainType.GRASSLAND,
      TerrainType.FOREST,
      TerrainType.DESERT,
      TerrainType.MOUNTAIN,
      TerrainType.HILLS
    ];
    return terrains[Math.floor(Math.random() * terrains.length)];
  };

  // Get color for terrain type
  const getTerrainColor = (terrain: TerrainType): string => {
    switch (terrain) {
      case TerrainType.WATER:
        return '#4A90E2';
      case TerrainType.GRASSLAND:
        return '#7CB342';
      case TerrainType.FOREST:
        return '#2E7D32';
      case TerrainType.DESERT:
        return '#FFB74D';
      case TerrainType.MOUNTAIN:
        return '#78909C';
      case TerrainType.HILLS:
        return '#8D6E63';
      case TerrainType.SWAMP:
        return '#6B8E23'; // olive green
      case TerrainType.BRUSH:
        return '#B2A76B'; // tan/gray-green
      default:
        return '#000000';
    }
  };

  useEffect(() => {
    generateMap();
  }, [mapWidth, mapHeight, seed]);

  // Build a local map from tiles for rendering
  const renderTileMap: Record<string, HexTile> = {};
  tiles.forEach(t => { renderTileMap[`${t.q},${t.r}`] = t; });

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Hexagonal Map Generator</h1>
          <div className="flex justify-center gap-4 mb-4 flex-wrap">
            <button
              onClick={() => setMapWidth(prev => Math.max(6, prev - 1))}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Decrease Width
            </button>
            <button
              onClick={() => setMapWidth(prev => Math.min(40, prev + 1))}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Increase Width
            </button>
            <button
              onClick={() => setMapHeight(prev => Math.max(6, prev - 1))}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Decrease Height
            </button>
            <button
              onClick={() => setMapHeight(prev => Math.min(30, prev + 1))}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Increase Height
            </button>
            <button
              onClick={() => { const s = randomSeed(); setSeed(s); setSeedInput(s); }}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Random Seed
            </button>
            <form onSubmit={e => { e.preventDefault(); setSeed(seedInput); }}>
              <input
                type="text"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                className="px-2 py-1 border rounded ml-2"
                placeholder="Seed"
                style={{ width: 100 }}
              />
              <button
                type="submit"
                className="ml-1 px-2 py-1 bg-gray-300 rounded hover:bg-gray-400"
              >
                Set Seed
              </button>
            </form>
          </div>
          <p className="text-lg text-gray-600">Map Width: {mapWidth}, Map Height: {mapHeight}</p>
        </div>

        <div className="relative" style={{ height: `${bounds.maxY - bounds.minY}px` }}>
          <svg
            className="w-full h-full"
            viewBox={`${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}`}
          >
            <defs>
              {/* Calculate hex dimensions */}
              {(() => {
                const hexHeight = Math.sqrt(3) * hexSize;
                // Use new bounds for clip rectangle
                const clipX = bounds.minX;
                const clipY = bounds.minY;
                const clipWidth = bounds.maxX - bounds.minX;
                const clipHeight = bounds.maxY - bounds.minY;
                return (
                  <clipPath id="map-clip">
                    <rect x={clipX} y={clipY} width={clipWidth} height={clipHeight} />
                  </clipPath>
                );
              })()}
            </defs>
            <g clipPath="url(#map-clip)">
              {tiles.map((tile) => {
                const center = axialToPixel(tile.q, tile.r);
                const isWater = tile.terrain === TerrainType.WATER;
                const isRiver = tile.river;
                // Shallow water color
                const deepWaterColor = '#4A90E2';
                const shallowWaterColor = '#7EC8E3';
                // Get all 6 neighbors
                const neighbors = getNeighbors(tile, renderTileMap);
                // Determine if this water tile is adjacent to river, desert, grassland, or swamp
                let isShallow = false;
                if (isWater) {
                  isShallow = neighbors.some(n =>
                    n.river || n.terrain === TerrainType.DESERT || n.terrain === TerrainType.GRASSLAND || n.terrain === TerrainType.SWAMP
                  );
                }
                // Use shallow color for river and shallow water, deep for other water
                const fillColor = isRiver
                  ? shallowWaterColor
                  : isWater && isShallow
                    ? shallowWaterColor
                    : isWater
                      ? deepWaterColor
                      : getTerrainColor(tile.terrain);
                return (
                  <g key={tile.id}>
                    <polygon
                      points={getHexPoints(center)}
                      fill={fillColor}
                      stroke="none"
                      strokeWidth="0"
                      className="transition-colors duration-200 hover:opacity-80 cursor-pointer"
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {Object.values(TerrainType).map((terrain) => (
            <div key={terrain} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-400"
                style={{ backgroundColor: getTerrainColor(terrain) }}
              />
              <span className="capitalize text-gray-800">{terrain}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 