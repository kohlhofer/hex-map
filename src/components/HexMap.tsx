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
  settlement?: null | 'city' | 'town' | 'village';
}

interface Point {
  x: number;
  y: number;
}

interface TerrainSymbol {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  type: 'evergreen' | 'broadleaf';
}

interface Hex {
  q: number;
  r: number;
  terrain: TerrainType;
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
  // Even-q offset directions (for flat-topped hexes)
  const evenq_directions = [
    [+1,  0], [+1, -1], [0, -1],  // E, NE, NW
    [-1,  0], [0, +1], [+1, +1]   // W, SW, SE
  ];
  const oddq_directions = [
    [+1,  0], [0, -1], [-1, -1],  // E, NE, NW  
    [-1,  0], [-1, +1], [0, +1]   // W, SW, SE
  ];
  const directions = tile.q % 2 === 0 ? evenq_directions : oddq_directions;
  const neighbors = directions
    .map(([dq, dr]) => tileMap[`${tile.q + dq},${tile.r + dr}`])
    .filter(n => n);
  return neighbors;
}

const createGrid = (size: number): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x < 1; x += size) {
    for (let y = 0; y < 1; y += size) {
      points.push({ x, y });
    }
  }
  return points;
};

// Helper to darken a hex color by a given factor (0-1)
function darkenColor(hex: string, factor: number = 0.5): string {
  hex = hex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.floor(r * factor);
  g = Math.floor(g * factor);
  b = Math.floor(b * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get color for terrain type
const getTerrainColor = (terrain: TerrainType): string => {
  switch (terrain) {
    case TerrainType.WATER:
      return '#4A90E2';
    case TerrainType.GRASSLAND:
      return '#9CAF7F'; // desaturated green
    case TerrainType.FOREST:
      return '#6B8E6B'; // desaturated dark green
    case TerrainType.DESERT:
      return '#D4B483'; // desaturated sand
    case TerrainType.MOUNTAIN:
      return '#8B8B8B'; // desaturated gray
    case TerrainType.HILLS:
      return '#9CAF7F'; // same as grassland
    case TerrainType.SWAMP:
      return '#8B9E6B'; // desaturated olive
    case TerrainType.BRUSH:
      return '#B2A76B'; // already desaturated
    default:
      return '#000000';
  }
};

// Helper to get a good symbol color for each terrain
function getSymbolColor(terrain: TerrainType): string {
  const base = getTerrainColor(terrain);
  let color: string;
  switch (terrain) {
    case TerrainType.DESERT:
      color = '#7a5a2b'; // Strong brown for desert symbols
      break;
    case TerrainType.FOREST:
    case TerrainType.MOUNTAIN:
      color = darkenColor(base, 0.6);
      break;
    case TerrainType.GRASSLAND:
    case TerrainType.HILLS:
    case TerrainType.SWAMP:
    case TerrainType.BRUSH:
      color = darkenColor(base, 0.65);
      break;
    default:
      color = darkenColor(base, 0.7);
  }
  // Minimum contrast: if color is too close to background, use #333
  const rgb = parseInt(color.replace('#', ''), 16);
  if (rgb > 0xcccccc || rgb < 0x222222) {
    color = '#333';
  }
  return color;
}

export default function HexMap() {
  const [tiles, setTiles] = useState<HexTile[]>([]);
  const [tileMap, setTileMap] = useState<Record<string, HexTile>>({});
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [mapWidth, setMapWidth] = useState(35); // width of the map (in hexes)
  const [mapHeight, setMapHeight] = useState(20); // height of the map (in hexes)
  const [hexSize, setHexSize] = useState(20); // size of hexagons in pixels (smaller)
  const [seed, setSeed] = useState('12345');
  const [seedInput, setSeedInput] = useState('12345');
  // Set of road segments where each key is "id1|id2" (ids sorted)
  const [roadSegments, setRoadSegments] = useState<Set<string>>(new Set());
  const [roadPaths, setRoadPaths] = useState<Point[][]>([]);

  // Convert axial coordinates to pixel coordinates (flat-topped, rectangular grid)
  const axialToPixel = (q: number, r: number): Point => {
    const x = hexSize * 1.5 * q;
    const y = hexSize * Math.sqrt(3) * 0.7 * (r + 0.5 * (q % 2)); // 30% less tall
    return { x, y };
  };

  // Generate hexagon points for SVG
  const getHexPoints = (center: Point): string => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = 2 * Math.PI / 6 * i;
      const x = center.x + hexSize * Math.cos(angle);
      const y = center.y + hexSize * 0.7 * Math.sin(angle); // 30% less tall
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
      [TerrainType.DESERT]: { count: Math.max(1, Math.floor(landTiles.length / 80)), size: Math.max(4, Math.floor(landTiles.length / 20)) },
      [TerrainType.MOUNTAIN]: { count: Math.max(1, Math.floor(landTiles.length / 80)), size: Math.max(3, Math.floor(landTiles.length / 30)) },
      [TerrainType.HILLS]: { count: Math.max(1, Math.floor(landTiles.length / 60)), size: Math.max(4, Math.floor(landTiles.length / 20)) },
      [TerrainType.SWAMP]: { count: Math.max(1, Math.floor(landTiles.length / 100)), size: Math.max(3, Math.floor(landTiles.length / 25)) },
      [TerrainType.BRUSH]: { count: Math.max(1, Math.floor(landTiles.length / 80)), size: Math.max(4, Math.floor(landTiles.length / 20)) },
      [TerrainType.WATER]: { count: 0, size: 0 },
      [TerrainType.GRASSLAND]: { count: Math.max(2, Math.floor(landTiles.length / 50)), size: Math.max(6, Math.floor(landTiles.length / 15)) },
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
        } while (seedTile.terrain !== TerrainType.GRASSLAND && tries < 20);
        if (!seedTile || seedTile.terrain !== TerrainType.GRASSLAND) continue;
        // --- Custom cluster seeding for SWAMP and BRUSH ---
        if (terrain === TerrainType.SWAMP) {
          // Prefer grassland tiles adjacent to water, river, or forest
          const swampCandidates = landTiles.filter(t =>
            t.terrain === TerrainType.GRASSLAND &&
            getNeighbors(t, tileMap).some(n =>
              n.terrain === TerrainType.WATER || n.terrain === TerrainType.FOREST
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
            !getNeighbors(t, tileMap).some(n => n.terrain === TerrainType.WATER)
          );
          if (brushCandidates.length > 0) {
            seedTile = brushCandidates[Math.floor(rand() * brushCandidates.length)];
          }
        }
        seedTile.terrain = terrain;
        // Grow cluster
        let frontier = [seedTile];
        // Adjust size based on terrain type
        const adjustedSize = terrain === TerrainType.SWAMP ? Math.floor(size * 0.7) : size;
        for (let j = 0; j < adjustedSize; j++) {
          if (frontier.length === 0) break;
          const current = frontier[Math.floor(rand() * frontier.length)];
          // Get unassigned grassland neighbors
          let neighbors = getNeighbors(current, tileMap).filter(n => n.terrain === TerrainType.GRASSLAND);
          // For SWAMP, allow to grow into forest or river-adjacent tiles
          if (terrain === TerrainType.SWAMP) {
            neighbors = neighbors.concat(getNeighbors(current, tileMap).filter(n =>
              n.terrain === TerrainType.FOREST
            ));
            // Make swamp growth more restrictive
            if (rand() < 0.4) {
              frontier = frontier.filter(t => t !== current);
            }
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
        if (rand() < 0.2) { // Reduced chance of desert spread
          tile.terrain = TerrainType.DESERT;
        }
      }
    }

    // --- River Generation ---
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

    // Helper: check if a path would create a river loop or connection that could cut off land
    function wouldCreateRiverLoop(path: HexTile[]): boolean {
      for (const tile of path) {
        const neighbors = getNeighbors(tile, tileMap);
        for (const n of neighbors) {
          if (n.river && !path.includes(n)) {
            const landNeighbors = neighbors.filter(n => n.terrain !== TerrainType.WATER && !n.river);
            if (landNeighbors.length <= 1) {
              return true;
            }
          }
        }
      }
      return false;
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

    // Hex distance heuristic for A*
    function hexDistance(a: HexTile, b: HexTile) {
      return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
    }

    // Deterministic neighbor sort (by q, then r, then id)
    function sortedNeighbors(tile: HexTile, tileMap: Record<string, HexTile>, seed: string) {
      const neighbors = getNeighbors(tile, tileMap);
      // Deterministically shuffle neighbors based on tile id and global seed
      const rand = createSeededRandom(seed + '-' + tile.id);
      return neighbors.slice().sort((a, b) => rand() - 0.5);
    }

    // A* pathfinding for rivers (prefers lower elevation, shortest path, deterministic)
    function findRiverPath(start: HexTile, isGoal: (t: HexTile) => boolean): HexTile[] | null {
      const open: [number, number, HexTile, HexTile[]][] = [[0, 0, start, [start]]]; // [f, g, tile, path]
      const closed = new Set<string>();
      let iterations = 0;
      const MAX_ITER = 2000;
      while (open.length && iterations++ < MAX_ITER) {
        open.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const [f, g, tile, path] = open.shift()!;
        if (isGoal(tile)) return path;
        closed.add(tile.id);
        const neighbors = sortedNeighbors(tile, tileMap, seed)
          .filter(n => n.terrain !== TerrainType.WATER && !n.river && !closed.has(n.id));
        for (const n of neighbors) {
          const moveCost = 1 + Math.max(0, terrainElevation(n.terrain) - terrainElevation(tile.terrain));
          const g2 = g + moveCost;
          const h = hexDistance(n, start); // heuristic: distance to start (to break ties deterministically)
          open.push([g2 + h, g2, n, [...path, n]]);
        }
      }
      if (iterations >= MAX_ITER) {
        console.warn('River pathfinding exceeded max iterations');
      }
      return null;
    }

    // Find river sources (mountains not adjacent to sea)
    const riverSources = landTiles.filter(t => 
      t.terrain === TerrainType.MOUNTAIN && 
      !isAdjacentToSea(t) &&
      // Ensure source has at least one non-mountain neighbor
      getNeighbors(t, tileMap).some(n => n.terrain !== TerrainType.MOUNTAIN)
    );

    // Calculate number of rivers based on map size
    const riverCount = Math.max(1, Math.floor(landTiles.length / 100));
    let riversMade = 0;
    let riverAttempts = 0;

    while (riversMade < riverCount && riverAttempts < 30) {
      riverAttempts++;
      // Deterministically pick a source (sort by id, then pick by riversMade)
      const sortedSources = riverSources.slice().sort((a, b) => a.id.localeCompare(b.id));
      const source = sortedSources[riversMade % sortedSources.length];
      if (!source) break;

      // Use A* to find shortest, most direct path to sea
      const foundPath = findRiverPath(source, isAdjacentToSea);

      if (foundPath && foundPath.length > 3) {
        if (wouldCreateRiverLoop(foundPath)) {
          continue;
        }
        for (const t of foundPath) t.river = true;
        if (isIslandConnected()) {
          riversMade++;
        } else {
          for (const t of foundPath) t.river = false;
        }
      }
    }

    // Convert river tiles to water
    for (const tile of newTiles) {
      if (tile.river) {
        tile.terrain = TerrainType.WATER;
        tile.river = true; // explicitly preserve river flag for rendering
      }
    }

    // --- Settlement Placement ---
    // Helper: score tile for settlement suitability
    function settlementScore(tile: HexTile) {
      if (tile.terrain === TerrainType.WATER || tile.terrain === TerrainType.MOUNTAIN || tile.terrain === TerrainType.SWAMP) return -1000;
      let score = 0;
      // Prefer grassland, hills, forest edge
      if (tile.terrain === TerrainType.GRASSLAND) score += 5;
      if (tile.terrain === TerrainType.HILLS) score += 3;
      if (tile.terrain === TerrainType.FOREST) score += 1;
      if (tile.terrain === TerrainType.DESERT) score -= 2;
      // Prefer near river or coast
      const neighbors = getNeighbors(tile, tileMap);
      if (neighbors.some(n => n.river)) score += 4; // Reduced bonus for river
      if (neighbors.some(n => n.terrain === TerrainType.WATER)) score += 3; // Reduced bonus for coast
      
      // Add some randomness to encourage spread
      score += (mulberry32(seedNum + tile.q * 1000 + tile.r * 17)() * 4); // More random influence
      
      // Add distance from center bonus to encourage using the whole island
      const centerQ = Math.floor(mapWidth / 2);
      const centerR = Math.floor(mapHeight / 2);
      const distFromCenter = Math.sqrt((tile.q - centerQ) ** 2 + (tile.r - centerR) ** 2);
      const normalizedDist = distFromCenter / (Math.sqrt(mapWidth * mapWidth + mapHeight * mapHeight) / 2);
      score += normalizedDist * 3; // Bonus for being away from center
      
      return score;
    }

    // Determine counts
    const landCount = newTiles.filter(t => t.terrain !== TerrainType.WATER).length;
    // Calculate a map size factor (smaller maps should have fewer settlements)
    const mapSizeFactor = Math.min(1, Math.sqrt(mapWidth * mapHeight) / 25);
    
    // Adjust counts based on map size
    const cityCount = Math.min(2, Math.max(1, Math.floor(landCount / 2000 * mapSizeFactor))); // Maximum 2 cities per map
    const townCount = Math.min(3, Math.max(1, Math.floor(landCount / 300 * mapSizeFactor))); // Cut towns in half
    const villageCount = Math.min(4, Math.max(2, Math.floor(landCount / 120 * mapSizeFactor))); // Cut villages in half
    
    console.log(`Map size: ${mapWidth}x${mapHeight}, Land tiles: ${landCount}, Size factor: ${mapSizeFactor.toFixed(2)}`);
    console.log(`Settlements: ${cityCount} cities, ${townCount} towns, ${villageCount} villages`);

    // Place settlements largest to smallest
    const taken = new Set<string>();
    function placeSettlements(type: 'city' | 'town' | 'village', count: number, minDist: number) {
      let candidates = newTiles.filter(t => t.terrain !== TerrainType.WATER && !taken.has(t.id));
      // Score and sort
      candidates = candidates
        .map(t => ({ t, score: settlementScore(t) }))
        .sort((a, b) => b.score - a.score)
        .map(x => x.t);
      
      // For better distribution, divide the map into regions and try to place at least one settlement in each region
      const regionsX = 3; // 3x3 grid of regions
      const regionsY = 3;
      const regionWidth = mapWidth / regionsX;
      const regionHeight = mapHeight / regionsY;
      
      // Skip regional distribution for cities to ensure we only get the absolute best location
      let placedInFirstPass = 0;
      let remainingToPlace = count;
      
      if (type !== 'city') {
        // First pass: try to place one settlement in each region if possible
        const regionSettlements = new Map<string, boolean>();
        for (let rx = 0; rx < regionsX; rx++) {
          for (let ry = 0; ry < regionsY; ry++) {
            const regionKey = `${rx},${ry}`;
            // Find candidates in this region
            const regionCandidates = candidates.filter(t => {
              const regionX = Math.floor(t.q / regionWidth);
              const regionY = Math.floor(t.r / regionHeight);
              return regionX === rx && regionY === ry;
            });
            
            if (regionCandidates.length > 0) {
              // Score and pick best candidate in this region
              const bestCandidate = regionCandidates
                .map(t => ({ t, score: settlementScore(t) }))
                .sort((a, b) => b.score - a.score)[0].t;
              
              // Check minimum distance to existing settlements
              let tooClose = false;
              for (const t of newTiles) {
                if (t.settlement && Math.abs(t.q - bestCandidate.q) + Math.abs(t.r - bestCandidate.r) < minDist) {
                    tooClose = true;
                    break;
                }
              }
              
              if (!tooClose) {
                bestCandidate.settlement = type;
                taken.add(bestCandidate.id);
                regionSettlements.set(regionKey, true);
              }
            }
          }
        }
        
        // Count how many we've placed in the first pass
        placedInFirstPass = Array.from(regionSettlements.values()).filter(v => v).length;
        remainingToPlace = count - placedInFirstPass;
      }
      
      let placed = 0;
      let i = 0;
      while (placed < remainingToPlace && i < candidates.length) {
        const tile = candidates[i];
        // Skip if already taken in region pass
        if (taken.has(tile.id)) {
          i++;
          continue;
        }
        
        // Check min distance to other settlements
        let ok = true;
        for (const t of newTiles) {
          if (t.settlement && Math.abs(t.q - tile.q) + Math.abs(t.r - tile.r) < minDist) {
            ok = false;
            break;
          }
        }
        if (ok) {
          tile.settlement = type;
          taken.add(tile.id);
          placed++;
        }
        i++;
      }
    }
    placeSettlements('city', cityCount, 5); // Reduced minimum distance
    placeSettlements('town', townCount, 3); // Reduced minimum distance
    placeSettlements('village', villageCount, 2); // Same for villages

    // --- Road Generation ---
    // Disallowed terrains for roads
    const blockedTerrains = new Set<TerrainType>([
      TerrainType.WATER,
      TerrainType.MOUNTAIN,
      TerrainType.SWAMP,
    ]);

    // Helper: axial distance
    function axialDistance(a: HexTile, b: HexTile) {
      const dq = a.q - b.q;
      const dr = a.r - b.r;
      return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
    }

    // Pathfinding (A* with cost and deterministic neighbor order) for roads
    function findPath(start: HexTile, goal: HexTile): HexTile[] | null {
      // Use a Map for O(1) lookups of visited nodes
      const closed = new Map<string, number>();
      const open = new Map<string, [number, number, HexTile, HexTile[]]>(); // [f, g, tile, path]
      open.set(start.id, [0, 0, start, [start]]);
      
      let iterations = 0;
      const MAX_ITER = 2000;
      
      while (open.size > 0 && iterations++ < MAX_ITER) {
        // Find the node with lowest f score
        let lowestF = Infinity;
        let currentId = '';
        for (const [id, [f]] of open) {
          if (f < lowestF) {
            lowestF = f;
            currentId = id;
          }
        }
        
        const [f, g, tile, path] = open.get(currentId)!;
        open.delete(currentId);
        
        if (tile.id === goal.id) {
          return path;
        }
        
        closed.set(tile.id, g);
        
        // Get neighbors and sort them by distance to goal for better path quality
        const neighbors = sortedNeighbors(tile, tileMap, seed)
          .filter(n => {
            // Skip if already visited with a better path
            const existingG = closed.get(n.id);
            if (existingG !== undefined && existingG <= g) return false;
            
            // Skip if in open set with better path
            const openNode = open.get(n.id);
            if (openNode && openNode[1] <= g) return false;
            
            return true;
          });
        
        for (const n of neighbors) {
          const terrain = n.terrain;
          const moveCost = roadCost[terrain] ?? 1000;
          const g2 = g + moveCost;
          const h = hexDistance(n, goal);
          const f2 = g2 + h;
          
          // Only add if not in open set or has better path
          const openNode = open.get(n.id);
          if (!openNode || g2 < openNode[1]) {
            open.set(n.id, [f2, g2, n, [...path, n]]);
          }
        }
      }
      
      if (iterations >= MAX_ITER) {
        console.warn('Road pathfinding exceeded max iterations');
      }
      return null;
    }

    const roadSet: Set<string> = new Set();
    const paths: Point[][] = [];

    // Helper to record road segments from a tile path
    function addPathToRoads(path: HexTile[]) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i].id;
        const b = path[i + 1].id;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        roadSet.add(key);
      }

      // Build a more organic, winding path
      const pixelPath: Point[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        const pA = axialToPixel(a.q, a.r);
        const pB = axialToPixel(b.q, b.r);
        // Always add the start point
        if (i === 0) pixelPath.push(pA);
        // Add several intermediate points with smooth, seeded random offsets
        const segSeed = seed + '-' + a.id + '-' + b.id;
        const segRand = createSeededRandom(segSeed);
        const numMid = 5 + Math.floor(segRand() * 2); // 5-6 midpoints for more smoothing
        for (let j = 1; j <= numMid; j++) {
          const t = j / (numMid + 1);
          // Linear interpolation
          let x = pA.x * (1 - t) + pB.x * t;
          let y = pA.y * (1 - t) + pB.y * t;
          // Offset perpendicular to the segment
          const dx = pB.x - pA.x;
          const dy = pB.y - pA.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          // Sine-based smoothness and reduced random amplitude
          const sine = Math.sin(Math.PI * t);
          const amp = (0.12 + segRand() * 0.22) * hexSize * sine; // up to ~0.34 hexSize (was ~0.7)
          x += nx * amp * (segRand() - 0.5) * 2;
          y += ny * amp * (segRand() - 0.5) * 2;
          pixelPath.push({ x, y });
        }
        // Always add the end point of the segment (except for the very last, which will be added by the next segment or after loop)
        pixelPath.push(pB);
      }
      paths.push(pixelPath);
    }

    const settlementsWithType = newTiles.filter(t => t.settlement);
    const cities = settlementsWithType.filter(t => t.settlement === 'city');
    const towns = settlementsWithType.filter(t => t.settlement === 'town');

    // --- Minimum Spanning Tree (MST) for roads among cities and towns ---
    const roadNodes = [...cities, ...towns];
    if (roadNodes.length > 1) {
      // Prim's algorithm for MST
      const connected: HexTile[] = [roadNodes[0]];
      const unconnected: HexTile[] = roadNodes.slice(1);
      while (unconnected.length > 0) {
        let bestFrom: HexTile | null = null;
        let bestTo: HexTile | null = null;
        let bestCost = Infinity;
        let bestPath: HexTile[] | null = null;
        for (const from of connected) {
          for (const to of unconnected) {
            const path = findPath(from, to);
            if (!path) continue;
            // Calculate total cost
            let cost = 0;
            for (let i = 0; i < path.length - 1; i++) {
              const t = path[i + 1];
              cost += roadCost[t.terrain] ?? 1000;
            }
            if (cost < bestCost) {
              bestCost = cost;
              bestFrom = from;
              bestTo = to;
              bestPath = path;
            }
          }
        }
        if (bestPath && bestTo) {
          addPathToRoads(bestPath);
          connected.push(bestTo);
          const idx = unconnected.findIndex(t => t.id === bestTo!.id);
          if (idx !== -1) unconnected.splice(idx, 1);
        } else {
          // No path found, break to avoid infinite loop
          break;
        }
      }
    }

    setRoadSegments(roadSet);
    setRoadPaths(paths);

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

  useEffect(() => {
    generateMap();
  }, [mapWidth, mapHeight, seed]);

  // Helper function to create a seeded random generator for consistent symbol placement
  const createSeededRandom = (seed: string) => {
    let seedNum = 0;
    for (let i = 0; i < seed.length; i++) {
      seedNum = (seedNum * 31 + seed.charCodeAt(i)) & 0xffffffff;
    }
    return mulberry32(seedNum);
  };

  // Build a local map from tiles for rendering
  const renderTileMap: Record<string, HexTile> = {};
  tiles.forEach(t => { renderTileMap[`${t.q},${t.r}`] = t; });

  const generateTerrainOverlay = (terrain: TerrainType, hex: Hex): TerrainSymbol[] => {
    switch (terrain) {
      case 'forest':
        // Create a denser grid for forests
        const forestGridSize = 0.15; // Smaller grid cells for more symbols
        const forestGrid = createGrid(forestGridSize);
        const forestSymbols = forestGrid
          .filter(() => Math.random() < 0.85) // Higher chance of placing a symbol
          .map(({ x, y }): TerrainSymbol => {
            const jitterX = (Math.random() - 0.5) * forestGridSize * 0.5;
            const jitterY = (Math.random() - 0.5) * forestGridSize * 0.5;
            const scale = 0.8 + Math.random() * 0.4; // Slightly smaller base size
            const rotation = Math.random() * 360;
            return {
              x: x + jitterX,
              y: y + jitterY,
              scale,
              rotation,
              type: Math.random() < 0.6 ? 'evergreen' : 'broadleaf' // More evergreens
            };
          });
        return forestSymbols;
      default:
        return [];
    }
  };

  // Helper to brush symbol positions for a given terrain type, excluding river tiles
  function brushTerrainSymbolPositions(terrain: TerrainType, sizeRange: [number, number]) {
    const terrainTiles = tiles.filter(t => t.terrain === terrain);
    const visited = new Set<string>();
    const clusters: any[] = [];
    // 2. BFS to find contiguous clusters
    for (const tile of terrainTiles) {
      if (visited.has(tile.id)) continue;
      const cluster: any[] = [];
      const queue = [tile];
      visited.add(tile.id);
      while (queue.length) {
        const t = queue.shift()!;
        cluster.push(t);
        for (const n of getNeighbors(t, renderTileMap)) {
          if (n.terrain === terrain && !visited.has(n.id)) {
            visited.add(n.id);
            queue.push(n);
          }
        }
      }
      clusters.push(cluster);
    }
    // 3. For each cluster, scatter symbol positions
    const positions: { x: number; y: number; size: number; clusterIdx: number; gridX: number; gridY: number }[] = [];
    clusters.forEach((cluster, clusterIdx) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const t of cluster) {
        const { x, y } = axialToPixel(t.q, t.r);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const spacing = hexSize * 0.85;
      const gridMinX = minX - spacing * 0.5;
      const gridMaxX = maxX + spacing * 0.5;
      const gridMinY = minY - spacing * 0.5;
      const gridMaxY = maxY + spacing * 0.5;
      let rowIdx = 0;
      let symbolIdx = 0;
      for (let gx = gridMinX; gx <= gridMaxX; gx += spacing) {
        const gridX = Math.round((gx - gridMinX) / spacing);
        for (let gy = gridMinY; gy <= gridMaxY; gy += spacing * 0.9) {
          const gridY = Math.round((gy - gridMinY) / (spacing * 0.9));
          // Create seeded random for consistent tree positioning
          const treeSeed = `tree-${clusterIdx}-${gridX}-${gridY}`;
          const treeRand = createSeededRandom(treeSeed);
          // Add slight random jitter to position
          const jitterX = (treeRand() - 0.5) * hexSize * 0.35;
          const jitterY = (treeRand() - 0.5) * hexSize * 0.35;
          // Offset every other grid row for better coverage
          const offsetY = (rowIdx % 2 === 0) ? 0 : spacing * 0.45;
          const px = gx + jitterX;
          const py = gy + jitterY + offsetY;
          // Find the nearest forest tile center
          let nearest: HexTile | null = null;
          let nearestDist = Infinity;
          for (const t of cluster) {
            const { x, y } = axialToPixel(t.q, t.r);
            const dist = (px - x) ** 2 + (py - y) ** 2;
            if (dist < nearestDist) {
              nearest = t;
              nearestDist = dist;
            }
          }
          // Increase threshold for edge coverage
          if (nearest && nearestDist < (hexSize * 0.95) ** 2) {
            const [minS, maxS] = sizeRange;
            const size = hexSize * (minS + treeRand() * (maxS - minS));
            positions.push({ x: px, y: py, size, clusterIdx, gridX, gridY });
          }
        }
        rowIdx++;
      }
    });
    return positions;
  }

  // --- Map Name Generation ---
  const nameTemplates = [
    'The Island of {name}',
    'The Kingdom of {name}',
    'The Dark Island of {name}',
    'The Shores of {name}',
    'The Realm of {name}',
    'The Lost Isle of {name}',
    'The Wilds of {name}',
    'The Peninsula of {name}',
    'The Highlands of {name}',
    'The Domain of {name}',
  ];
  const nameParts = [
    'Aeloria', 'Brightholm', 'Cindervale', 'Duskmoor', 'Eldermist', 'Frostmere', 'Gloamwood', 'Hallowmere',
    'Ironreach', 'Jadewind', 'Kingsfall', 'Lornspire', 'Mistvale', 'Nightriver', 'Oakenshade', 'Pyrecoast',
    'Quillhaven', 'Ravenrock', 'Stormhold', 'Thornwild', 'Umberdeep', 'Vastwood', 'Wyrmrest', 'Zephyris',
  ];
  // Seeded random for name
  const nameRand = createSeededRandom(seed + '-name');
  const template = nameTemplates[Math.floor(nameRand() * nameTemplates.length)];
  const name = nameParts[Math.floor(nameRand() * nameParts.length)];
  const mapName = template.replace('{name}', name);

  // Road cost by terrain
  const roadCost: Record<TerrainType, number> = {
    [TerrainType.WATER]: 1000,      // Extremely high, but not infinite
    [TerrainType.MOUNTAIN]: 200,    // Very high
    [TerrainType.SWAMP]: 120,       // Very high
    [TerrainType.FOREST]: 12,      // Increased to make forest less likely
    [TerrainType.HILLS]: 5,
    [TerrainType.GRASSLAND]: 3,
    [TerrainType.DESERT]: 7,
    [TerrainType.BRUSH]: 8,
  };

  // Helper: Catmull-Rom to Bezier spline for smooth SVG path
  function pointsToSmoothPath(points: Point[]): string {
    if (points.length < 2) return '';
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      // Catmull-Rom to Bezier
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Floating Generate Button (restored, fixed top-left) */}
      <div className="fixed top-4 left-4 z-20">
        <button
          onClick={() => { const s = randomSeed(); setSeed(s); setSeedInput(s); }}
          className="w-10 h-10 flex items-center justify-center bg-white bg-opacity-80 rounded-full shadow hover:bg-green-100 transition-colors border border-gray-300"
          title="Generate New Map"
          aria-label="Generate New Map"
        >
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M19.418 9A7.978 7.978 0 0012 4a8 8 0 00-7.418 5M4.582 15A7.978 7.978 0 0012 20a8 8 0 007.418-5" />
          </svg>
        </button>
      </div>
      {/* Map SVG edge-to-edge, top of page */}
      <div className="w-full" style={{ margin: 0, padding: 0 }}>
        <div className="relative w-full" style={{ height: `${bounds.maxY - bounds.minY}px`, margin: 0, padding: 0 }}>
          <svg
            className="w-full h-full block"
            style={{ display: 'block', margin: 0, padding: 0 }}
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
                  <>
                    <clipPath id="map-clip">
                      <rect x={clipX} y={clipY} width={clipWidth} height={clipHeight} />
                    </clipPath>
                    {/* Shoreline wave symbol variations */}
                    <symbol id="shore-wave-1" viewBox="-8 -4 16 8" stroke="#dbeafe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-6,-1 Q-5,0 -4,-1" />
                      <path d="M-2,1 Q-1,2 0,1" />
                      <path d="M3,0 Q4,1 5,0" />
                    </symbol>
                    <symbol id="shore-wave-2" viewBox="-8 -4 16 8" stroke="#dbeafe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-5,0 Q-4,1 -3,0" />
                      <path d="M0,-1 Q1,0 2,-1" />
                    </symbol>
                    <symbol id="shore-wave-3" viewBox="-8 -4 16 8" stroke="#dbeafe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-6,0 Q-5,1 -4,0" />
                      <path d="M-1,1 Q0,2 1,1" />
                      <path d="M4,-1 Q5,0 6,-1" />
                    </symbol>
                    <symbol id="shore-wave-4" viewBox="-8 -4 16 8" stroke="#dbeafe" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-7,-1 Q-6,0 -5,-1" />
                      <path d="M-2,0 Q-1,1 0,0" />
                    </symbol>
                    {/* Simplified evergreen tree symbol */}
                    <symbol id="forest-evergreen" viewBox="-10 -16 20 32" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="0" y1="12" x2="0" y2="-12" />
                      <polyline points="0,-12 -4,0 4,0 0,-12" />
                    </symbol>
                    {/* Broadleaf tree symbol: circle with trunk */}
                    <symbol id="forest-broadleaf" viewBox="-10 -14 20 28" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="0" y1="10" x2="0" y2="2" />
                      <circle cx="0" cy="-2" r="6" />
                    </symbol>
                    {/* Stylized mountain peak symbol */}
                    <symbol id="mountain-peak" viewBox="-12 -12 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="-10,10 0,-10 6,0 10,6" />
                      <polyline points="0,-10 2,-2 6,0" />
                    </symbol>
                    {/* Stylized hill symbol: gentle arch */}
                    <symbol id="hill-arch" viewBox="-12 -8 24 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-8,6 Q0,-4 8,6" />
                    </symbol>
                    {/* Grassland: tuft of grass (three blades, base at (0,-6), blades curve up to (0,0)) */}
                    <symbol id="grass-tuft" viewBox="-10 -10 20 20" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M-2,-6 Q-3,-2 0,0" />
                      <path d="M0,-6 Q0,-2 0,0" />
                      <path d="M2,-6 Q3,-2 0,0" />
                    </symbol>
                    {/* Desert: stylized rocks (three types) */}
                    <symbol id="desert-rock1" viewBox="-10 -6 20 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="0" cy="2" rx="5" ry="3" />
                    </symbol>
                    <symbol id="desert-rock2" viewBox="-10 -6 20 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="-2" cy="2" rx="3" ry="2" />
                      <ellipse cx="3" cy="3" rx="2" ry="1.2" />
                    </symbol>
                    <symbol id="desert-rock3" viewBox="-10 -6 20 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="0" cy="3" rx="2.5" ry="1.2" />
                      <ellipse cx="-3" cy="1" rx="1.2" ry="0.7" />
                      <ellipse cx="3" cy="1" rx="1.2" ry="0.7" />
                    </symbol>
                    {/* Swamp: marsh grass/cattail */}
                    <symbol id="swamp-marsh" viewBox="-10 -10 20 20" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="-3" y1="4" x2="-1" y2="-4" />
                      <line x1="0" y1="4" x2="0" y2="-2" />
                      <line x1="3" y1="4" x2="1" y2="-3" />
                      <ellipse cx="-1" cy="-4" rx="1" ry="2" />
                    </symbol>
                    {/* Brush: bush/scrub */}
                    <symbol id="brush-bush" viewBox="-10 -8 20 16" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <ellipse cx="0" cy="2" rx="6" ry="4" />
                      <ellipse cx="-3" cy="0" rx="2" ry="1.5" />
                      <ellipse cx="3" cy="0" rx="2" ry="1.5" />
                    </symbol>
                    {/* Desert: sand dot */}
                    <symbol id="desert-dot" viewBox="-2 -2 4 4" stroke="currentColor" strokeWidth="1" fill="none">
                      <circle cx="0" cy="0" r="0.7" />
                    </symbol>
                    {/* Classic Windrose SVG symbol */}
                    <symbol id="windrose" viewBox="-45 -50 90 100">
                      {/* Outer circle (no fill) */}
                      <circle cx="0" cy="0" r="30" fill="none" stroke="#222" strokeWidth="1.2" />
                      {/* Dotted border */}
                      {Array.from({length: 32}).map((_, i) => {
                        const angle = (i / 32) * 2 * Math.PI;
                        const r = 27.5;
                        return (
                          <circle key={i} cx={Math.cos(angle)*r} cy={Math.sin(angle)*r} r={0.9} fill="#222" />
                        );
                      })}
                      {/* Secondary points (light) */}
                      <polygon points="0,-22 2.5,-8 0,-13 -2.5,-8" fill="#bcd" />
                      <polygon points="0,22 2.5,8 0,13 -2.5,8" fill="#bcd" />
                      <polygon points="-22,0 -8,2.5 -13,0 -8,-2.5" fill="#bcd" />
                      <polygon points="22,0 8,2.5 13,0 8,-2.5" fill="#bcd" />
                      <polygon points="15,-15 8,-8 13,-13 8,-8" fill="#bcd" />
                      <polygon points="-15,-15 -8,-8 -13,-13 -8,-8" fill="#bcd" />
                      <polygon points="15,15 8,8 13,13 8,8" fill="#bcd" />
                      <polygon points="-15,15 -8,8 -13,13 -8,8" fill="#bcd" />
                      {/* Main points (dark, chunky, inside ring) */}
                      <polygon points="0,-22 8,-8 0,-15 -8,-8" fill="#223344" />
                      <polygon points="0,22 8,8 0,15 -8,8" fill="#223344" />
                      <polygon points="-22,0 -8,8 -15,0 -8,-8" fill="#223344" />
                      <polygon points="22,0 8,8 15,0 8,-8" fill="#223344" />
                      {/* Inner circle (no fill) */}
                      <circle cx="0" cy="0" r="7" fill="none" stroke="#222" strokeWidth="0.8" />
                      <circle cx="0" cy="0" r="2.5" fill="#223344" />
                      {/* Cardinal directions (outside ring, more margin) */}
                      <text x="0" y="-43" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#223344" fontWeight="bold">N</text>
                      <text x="0" y="48" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#223344" fontWeight="bold">S</text>
                      <text x="-41" y="5" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#223344" fontWeight="bold">W</text>
                      <text x="41" y="5" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#223344" fontWeight="bold">E</text>
                    </symbol>
                    {/* Settlement symbols */}
                    <symbol id="settlement-city" viewBox="-10 -10 20 20">
                      {/* Side buildings (shorter) */}
                      <path d="M-8,-2 L-8,4 L-5,4 L-5,-2 L-6.5,-4 Z" fill="#444" stroke="#222" strokeWidth="0.5" />
                      <path d="M5,-2 L5,4 L8,4 L8,-2 L6.5,-4 Z" fill="#444" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Middle layer buildings */}
                      <path d="M-4,-3 L-4,5 L-1,5 L-1,-3 L-2.5,-5 Z" fill="#333" stroke="#222" strokeWidth="0.5" />
                      <path d="M1,-3 L1,5 L4,5 L4,-3 L2.5,-5 Z" fill="#333" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Foreground buildings - larger central structure */}
                      <path d="M-2,-6 L-2,6 L2,6 L2,-6 L0,-9 Z" fill="#222" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Windows/details */}
                      <rect x="-1" y="0" width="0.8" height="1" fill="#fff" />
                      <rect x="0.2" y="0" width="0.8" height="1" fill="#fff" />
                      <rect x="-1" y="-3" width="0.8" height="1" fill="#fff" />
                      <rect x="0.2" y="-3" width="0.8" height="1" fill="#fff" />
                      <rect x="-3" y="1" width="0.8" height="1" fill="#fff" />
                      <rect x="2.2" y="1" width="0.8" height="1" fill="#fff" />
                      <rect x="-7" y="1" width="0.8" height="1" fill="#fff" />
                      <rect x="6.2" y="1" width="0.8" height="1" fill="#fff" />
                    </symbol>
                    <symbol id="settlement-town" viewBox="-10 -10 20 20">
                      {/* Background buildings */}
                      <path d="M-6,-2 L-6,3 L-3,3 L-3,-2 L-4.5,-4 Z" fill="#444" stroke="#222" strokeWidth="0.5" />
                      <path d="M3,-2 L3,3 L6,3 L6,-2 L4.5,-4 Z" fill="#444" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Main buildings */}
                      <path d="M-2,-4 L-2,4 L1,4 L1,-4 L-0.5,-6 Z" fill="#333" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Foreground building */}
                      <path d="M-1,4 L-1,6 L3,6 L3,4 L1,2 Z" fill="#222" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Windows/details */}
                      <rect x="-1" y="0" width="0.6" height="0.8" fill="#fff" />
                      <rect x="-5" y="0" width="0.6" height="0.8" fill="#fff" />
                      <rect x="4" y="0" width="0.6" height="0.8" fill="#fff" />
                      <rect x="0.5" y="4.5" width="0.6" height="0.8" fill="#fff" />
                    </symbol>
                    <symbol id="settlement-village" viewBox="-10 -10 20 20">
                      {/* Small field/land */}
                      <path d="M-5,3 L-5,5 L-2,5 L-2,3 Z" fill="#555" stroke="none" />
                      <path d="M2,3 L2,5 L5,5 L5,3 Z" fill="#555" stroke="none" />
                      
                      {/* Main farmhouse */}
                      <path d="M-3,-1 L-3,3 L1,3 L1,-1 L-1,-3 Z" fill="#333" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Barn/outbuilding */}
                      <path d="M2,0 L2,3 L4,3 L4,0 L3,-1 Z" fill="#222" stroke="#222" strokeWidth="0.5" />
                      
                      {/* Fence or field boundary */}
                      <line x1="-5" y1="5" x2="5" y2="5" stroke="#222" strokeWidth="0.3" />
                      <line x1="-5" y1="5" x2="-5" y2="3" stroke="#222" strokeWidth="0.3" />
                      <line x1="5" y1="5" x2="5" y2="3" stroke="#222" strokeWidth="0.3" />
                      
                      {/* Window */}
                      <rect x="-2" y="0.5" width="0.6" height="0.6" fill="#fff" />
                    </symbol>
                  </>
                );
              })()}
            </defs>
            <g clipPath="url(#map-clip)">
              {/* Layer 1: Base terrain hexes */}
              {tiles.map((tile) => {
                const center = axialToPixel(tile.q, tile.r);
                const isWater = tile.terrain === TerrainType.WATER;
                // Use settlement-specific color for settlement tiles
                let fillColor;
                if (tile.settlement) {
                  fillColor = '#c5c5c5'; // Lighter gray for settlements
                } else {
                  fillColor = isWater ? '#4A90E2' : getTerrainColor(tile.terrain);
                }
                return (
                  <polygon
                    key={`terrain-${tile.id}`}
                    points={getHexPoints(center)}
                    fill={fillColor}
                    stroke="none"
                    strokeWidth="0"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredTile(tile.id)}
                    onMouseLeave={() => setHoveredTile(null)}
                  />
                );
              })}

              {/* Layer 2: Hover overlay */}
              {hoveredTile && (() => {
                const tile = tiles.find(t => t.id === hoveredTile);
                if (!tile) return null;
                const center = axialToPixel(tile.q, tile.r);
                return (
                  <polygon
                    key={`hover-${tile.id}`}
                    points={getHexPoints(center)}
                    fill="white"
                    stroke="none"
                    strokeWidth="0"
                    opacity="0.15"
                    pointerEvents="none"
                  />
                );
              })()}

              {/* Layer 3: Shoreline waves */}
              {tiles.map((tile) => {
                const center = axialToPixel(tile.q, tile.r);
                const isWater = tile.terrain === TerrainType.WATER;
                return (
                  <g key={`waves-${tile.id}`}>
                    {/* Draw shoreline waves on water tiles adjacent to land */}
                    {isWater && !tile.river && (() => {
                      const landNeighbors = getNeighbors(tile, renderTileMap).filter(n => n.terrain !== TerrainType.WATER);
                      if (landNeighbors.length === 0) return null;
                      // Compute average direction to all adjacent land tiles
                      let avgX = 0, avgY = 0;
                      landNeighbors.forEach(landNeighbor => {
                        const landCenter = axialToPixel(landNeighbor.q, landNeighbor.r);
                        avgX += landCenter.x - center.x;
                        avgY += landCenter.y - center.y;
                      });
                      avgX /= landNeighbors.length;
                      avgY /= landNeighbors.length;
                      // Angle for wave orientation
                      const angle = Math.atan2(avgY, avgX) * 180 / Math.PI + 90;
                      // Move the wave even closer to the center of the water tile
                      const px = center.x + avgX * 0.2;
                      const py = center.y + avgY * 0.2;
                      // Pick a random wave symbol variation for each shoreline wave
                      const waveVariants = ["shore-wave-1", "shore-wave-2", "shore-wave-3", "shore-wave-4"];
                      // Use a seeded random for consistency per tile
                      let hash = 0;
                      for (let i = 0; i < tile.id.length; i++) hash = ((hash << 5) - hash) + tile.id.charCodeAt(i);
                      const variant = waveVariants[Math.abs(hash) % waveVariants.length];
                      return (
                        <use
                          key={`wave-${tile.id}`}
                          href={`#${variant}`}
                          x={px}
                          y={py}
                          width={hexSize * 0.7}
                          height={hexSize * 0.35}
                          transform={`rotate(${angle},${px},${py})`}
                          opacity={0.4}
                        />
                      );
                    })()}
                  </g>
                );
              })}

              {/* Layer 4: Terrain symbols */}
              {/* Forest brushing: detect clusters and scatter tree symbols (now rendered after polygons) */}
              {(() => {
                // 1. Find all forest tiles
                const forestTiles = tiles.filter(t => t.terrain === TerrainType.FOREST && !t.settlement);
                const visited = new Set<string>();
                const clusters: any[] = [];
                // 2. BFS to find contiguous clusters
                for (const tile of forestTiles) {
                  if (visited.has(tile.id)) continue;
                  const cluster: any[] = [];
                  const queue = [tile];
                  visited.add(tile.id);
                  while (queue.length) {
                    const t = queue.shift()!;
                    cluster.push(t);
                    for (const n of getNeighbors(t, renderTileMap)) {
                      if (n.terrain === TerrainType.FOREST && !visited.has(n.id)) {
                        visited.add(n.id);
                        queue.push(n);
                      }
                    }
                  }
                  clusters.push(cluster);
                }
                // 3. For each cluster, scatter tree symbols
                const treeUses: any[] = [];
                const positions = brushTerrainSymbolPositions(TerrainType.FOREST, [0.85, 1.0]);
                let symbolIdx = 0;
                positions.forEach((pos: any) => {
                  // Randomly choose tree type: evergreen or broadleaf
                  const treeSeed = `tree-${pos.clusterIdx}-${pos.gridX}-${pos.gridY}`;
                  const treeRand = createSeededRandom(treeSeed);
                  const treeType = treeRand() < 0.5 ? 'forest-evergreen' : 'forest-broadleaf';
                  const strokeColor = getSymbolColor(TerrainType.FOREST);
                  treeUses.push(
                    <g key={`tree-${pos.clusterIdx}-${pos.gridX}-${pos.gridY}-${symbolIdx++}`} style={{ color: strokeColor }}>
                      <use
                        href={`#${treeType}`}
                        x={pos.x}
                        y={pos.y}
                        width={pos.size}
                        height={pos.size}
                        transform={`translate(${-pos.size / 2},${-pos.size * 0.8})`}
                        stroke={strokeColor}
                        fill="none"
                      />
                    </g>
                  );
                });
                // --- Mountain and hill brushing ---
                // Helper to brush symbols for a given terrain type and symbol, excluding river tiles
                function brushTerrainSymbols(terrain: TerrainType, symbolId: string, sizeRange: [number, number]) {
                  const terrainTiles = tiles.filter(t => t.terrain === terrain && !t.settlement);
                  const visited = new Set<string>();
                  const clusters: any[] = [];
                  // 2. BFS to find contiguous clusters
                  for (const tile of terrainTiles) {
                    if (visited.has(tile.id)) continue;
                    const cluster: any[] = [];
                    const queue = [tile];
                    visited.add(tile.id);
                    while (queue.length) {
                      const t = queue.shift()!;
                      cluster.push(t);
                      for (const n of getNeighbors(t, renderTileMap)) {
                        if (n.terrain === terrain && !visited.has(n.id)) {
                          visited.add(n.id);
                          queue.push(n);
                        }
                      }
                    }
                    clusters.push(cluster);
                  }
                  // 3. For each cluster, scatter symbols
                  const uses: any[] = [];
                  clusters.forEach(cluster => {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    for (const t of cluster) {
                      const { x, y } = axialToPixel(t.q, t.r);
                      minX = Math.min(minX, x);
                      maxX = Math.max(maxX, x);
                      minY = Math.min(minY, y);
                      maxY = Math.max(maxY, y);
                    }
                    const spacing = hexSize * 0.85;
                    const gridMinX = minX - spacing * 0.5;
                    const gridMaxX = maxX + spacing * 0.5;
                    const gridMinY = minY - spacing * 0.5;
                    const gridMaxY = maxY + spacing * 0.5;
                    let rowIdx = 0;
                    for (let gx = gridMinX; gx <= gridMaxX; gx += spacing) {
                      for (let gy = gridMinY; gy <= gridMaxY; gy += spacing * 0.9) {
                        // Create seeded random for consistent symbol positioning
                        const symbolSeed = `${symbolId}-${cluster[0].id}-${gx.toFixed(1)}-${gy.toFixed(1)}`;
                        const symbolRand = createSeededRandom(symbolSeed);
                        const jitterX = (symbolRand() - 0.5) * hexSize * 0.35;
                        const jitterY = (symbolRand() - 0.5) * hexSize * 0.35;
                        const offsetY = (rowIdx % 2 === 0) ? 0 : spacing * 0.45;
                        const px = gx + jitterX;
                        const py = gy + jitterY + offsetY;
                        // Find the nearest terrain tile center
                        let nearest: HexTile | null = null;
                        let nearestDist = Infinity;
                        for (const t of cluster) {
                          const { x, y } = axialToPixel(t.q, t.r);
                          const dist = (px - x) ** 2 + (py - y) ** 2;
                          if (dist < nearestDist) {
                            nearest = t;
                            nearestDist = dist;
                          }
                        }
                        if (nearest && nearestDist < (hexSize * 0.95) ** 2) {
                          const [minS, maxS] = sizeRange;
                          const size = hexSize * (minS + symbolRand() * (maxS - minS));
                          // Adjust transform based on symbol type to position from bottom center
                          let transform = '';
                          switch (symbolId) {
                            case 'hill-arch':
                              transform = `translate(${-size / 2},${-size * 0.3})`; // Hill sits higher
                              break;
                            case 'mountain-peak':
                              transform = `translate(${-size / 2},${-size * 0.6})`; // Mountain sits higher
                              break;
                            case 'forest-evergreen':
                            case 'forest-broadleaf':
                              transform = `translate(${-size / 2},${-size * 0.7})`; // Trees sit higher
                              break;
                            case 'swamp-marsh':
                              transform = `translate(${-size / 2},${-size * 0.4})`; // Marsh sits higher
                              break;
                            case 'brush-bush':
                              transform = `translate(${-size / 2},${-size * 0.3})`; // Brush sits higher
                              break;
                            case 'grass-tuft':
                              transform = `translate(${-size / 2},${-size * 0.2})`; // Grass sits higher
                              break;
                            case 'desert-dot':
                              transform = `translate(${-size / 2},${-size * 0.1})`; // Dots sit higher
                              break;
                            case 'desert-rock1':
                            case 'desert-rock2':
                            case 'desert-rock3':
                              transform = `translate(${-size / 2},${-size * 0.2})`; // Rocks sit higher
                              break;
                            default:
                              transform = `translate(${-size / 2},${-size * 0.5})`;
                          }
                          // Use darkened color for this terrain
                          const strokeColor = getSymbolColor(terrain);
                          uses.push(
                            <g key={`${symbolId}-${cluster[0].id}-${gx},${gy}`} style={{ color: strokeColor }}>
                              <use
                                href={`#${symbolId}`}
                                x={px}
                                y={py}
                                width={size}
                                height={size}
                                transform={transform}
                                stroke={strokeColor}
                                fill="none"
                              />
                            </g>
                          );
                        }
                      }
                      rowIdx++;
                    }
                  });
                  return uses;
                }
                // For grassland and desert, make symbols sparse by skipping ~60% of grid spots
                function sparseBrushTerrainSymbols(terrain: TerrainType, symbolId: string, sizeRange: [number, number], skipProb: number) {
                  const uses = brushTerrainSymbols(terrain, symbolId, sizeRange);
                  // Filter out a random portion of the uses
                  return uses.filter((_, index) => {
                    const filterSeed = `filter-${terrain}-${symbolId}-${index}`;
                    const filterRand = createSeededRandom(filterSeed);
                    return filterRand() > skipProb;
                  });
                }
                // Add mountain peaks and hill arches (no rivers)
                const mountainUses = brushTerrainSymbols(TerrainType.MOUNTAIN, 'mountain-peak', [0.8, 1.1]);
                const hillUses = brushTerrainSymbols(TerrainType.HILLS, 'hill-arch', [0.7, 1.0]);
                // Add grassland, desert, swamp, and brush symbols (no rivers)
                const grasslandUses = sparseBrushTerrainSymbols(TerrainType.GRASSLAND, 'grass-tuft', [0.7, 1.0], 0.6);
                // For desert, randomly choose one of three rock symbols for each spot
                function denseDesertSymbols() {
                  // Use normal size and density for desert symbols
                  const positions = brushTerrainSymbolPositions(TerrainType.DESERT, [0.4, 0.6]);
                  const rockTypes = ['desert-rock1', 'desert-rock2', 'desert-rock3'];
                  const strokeColor = getSymbolColor(TerrainType.DESERT);
                  const desertTiles = tiles.filter(t => t.terrain === TerrainType.DESERT);
                  console.log('Desert tiles (no river):', desertTiles.length, 'Desert symbols:', positions.length);
                  return positions.map((pos, i) => {
                    const dotSeed = `desert-dot-${i}-${pos.x.toFixed(1)}-${pos.y.toFixed(1)}`;
                    const dotRand = createSeededRandom(dotSeed);
                    if (dotRand() < 0.8) {
                      return (
                        <g key={i} style={{ color: strokeColor }}>
                          <use
                            href="#desert-dot"
                            x={pos.x}
                            y={pos.y}
                            width={4}
                            height={4}
                            transform={`translate(-2,-2)`}
                            stroke={strokeColor}
                            fill="none"
                          />
                        </g>
                      );
                    } else {
                      const type = rockTypes[Math.floor(dotRand() * rockTypes.length)];
                      return (
                        <g key={i} style={{ color: strokeColor }}>
                          <use
                            href={`#${type}`}
                            x={pos.x}
                            y={pos.y}
                            width={8}
                            height={8}
                            transform={`translate(-4,-4)`}
                            stroke={strokeColor}
                            fill="none"
                          />
                        </g>
                      );
                    }
                  });
                }
                const desertUses = denseDesertSymbols();
                const swampUses = brushTerrainSymbols(TerrainType.SWAMP, 'swamp-marsh', [0.7, 1.0]);
                const brushUses = brushTerrainSymbols(TerrainType.BRUSH, 'brush-bush', [0.7, 1.0]);
                return [
                  ...treeUses,
                  ...mountainUses,
                  ...hillUses,
                  ...grasslandUses,
                  ...desertUses,
                  ...swampUses,
                  ...brushUses,
                ];
              })()}

              {/* Layer 5: Settlements */}
              {tiles.map((tile) => {
                if (!tile.settlement) return null;
                const center = axialToPixel(tile.q, tile.r);
                let symbolId, size;
                switch (tile.settlement) {
                  case 'city':
                    symbolId = 'settlement-city';
                    size = hexSize * 1.8;
                    break;
                  case 'town':
                    symbolId = 'settlement-town';
                    size = hexSize * 1.5;
                    break;
                  case 'village':
                  default:
                    symbolId = 'settlement-village';
                    size = hexSize * 1.3;
                    break;
                }
                return (
                  <g key={`settlement-${tile.id}`} transform={`translate(${center.x},${center.y}) scale(1,0.85)`}>
                    <use
                      href={`#${symbolId}`}
                      x={-size/2}
                      y={-size/2}
                      width={size}
                      height={size}
                    />
                  </g>
                );
              })}

              {/* Map Name and Windrose overlay (dynamically positioned/scaled over water) */}
              {(() => {
                // Find a large enough water region on the left or right edge
                const padding = 16;
                const minSize = 80; // minimum windrose+name size
                const maxSize = 120; // max windrose+name size
                const scanWidth = Math.ceil(mapWidth * 0.18); // scan 18% of map width from left/right
                const scanHeight = Math.ceil(mapHeight * 0.45); // scan 45% of map height from top
                // Helper to check if a region is all water
                function isWaterRegion(q0: number, r0: number, w: number, h: number) {
                  for (let q = q0; q < q0 + w; q++) {
                    for (let r = r0; r < r0 + h; r++) {
                      const t = renderTileMap[`${q},${r}`];
                      if (!t || t.terrain !== TerrainType.WATER) return false;
                    }
                  }
                  return true;
                }
                // Try left edge first, then right edge
                let found = false;
                let region = null;
                for (let side of ['left', 'right']) {
                  for (let h = scanHeight; h >= 2; h--) {
                    for (let w = scanWidth; w >= 2; w--) {
                      for (let r0 = 0; r0 <= mapHeight - h; r0++) {
                        let q0 = side === 'left' ? 0 : mapWidth - w;
                        if (isWaterRegion(q0, r0, w, h)) {
                          region = { q0, r0, w, h, side };
                          found = true;
                          break;
                        }
                      }
                      if (found) break;
                    }
                    if (found) break;
                  }
                  if (found) break;
                }
                // Fallback: bottom left corner
                if (!region) {
                  region = { q0: 0, r0: mapHeight - scanHeight, w: scanWidth, h: scanHeight, side: 'left' };
                }
                // Calculate pixel position and scale
                const { q0, r0, w, h, side } = region;
                // Center of region in pixel coords
                const centerQ = q0 + w / 2;
                const centerR = r0 + h / 2;
                const center = axialToPixel(centerQ, centerR);
                // Scale windrose+name to fit region
                const regionPxW = hexSize * 1.5 * w;
                const regionPxH = hexSize * Math.sqrt(3) * 0.7 * h;
                let windroseSize = Math.max(minSize, Math.min(maxSize, Math.min(regionPxW, regionPxH) - padding));
                let titleHeight = windroseSize * 0.38;
                let totalHeight = windroseSize + titleHeight;
                let scale = Math.min(1, (regionPxH - padding) / totalHeight, (regionPxW - padding) / windroseSize);
                // Add a line break after the first word or after 'of'
                let nameLines = mapName.split(' ');
                let breakIdx = nameLines.indexOf('of') !== -1 ? nameLines.indexOf('of') + 1 : 1;
                const line1 = nameLines.slice(0, breakIdx).join(' ');
                const line2 = nameLines.slice(breakIdx).join(' ');
                return (
                  <g style={{ mixBlendMode: 'multiply' }}>
                    <g transform={`translate(${center.x - windroseSize / 2},${center.y - totalHeight / 2}) scale(${scale},${scale * 0.85})`}>
                      <use href="#windrose" x={0} y={0} width={windroseSize} height={windroseSize} opacity={0.55} />
                    </g>
                    <g transform={`translate(${center.x},${center.y + windroseSize * 0.45}) scale(${scale},${scale * 0.85})`}>
                      <text
                        x={0}
                        y={0}
                        fontFamily="Georgia, Times, serif"
                        fontSize={Math.round(windroseSize * 0.16)}
                        fill="#4a6fa5"
                        style={{ fontStyle: 'normal', letterSpacing: '0.5px', mixBlendMode: 'multiply' }}
                        textAnchor="middle"
                      >
                        <tspan x={0} dy="0">{line1}</tspan>
                        <tspan x={0} dy="1.2em">{line2}</tspan>
                      </text>
                    </g>
                  </g>
                );
              })()}

              {/* Layer 2.5: Roads (smoothed paths) */}
              {roadPaths.map((points, idx) => (
                <path
                  key={`road-path-${idx}`}
                  d={pointsToSmoothPath(points)}
                  fill="none"
                  stroke="#333"
                  strokeWidth={hexSize * 0.13}
                  strokeDasharray={`${hexSize * 0.28},${hexSize * 0.18}`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.65}
                />
              ))}
            </g>
          </svg>
        </div>

        {/* Controls below map */}
        <div className="mt-8 space-y-4 max-w-6xl mx-auto px-4">
          <div className="flex justify-center gap-4 flex-wrap">
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
          </div>
          
          <div className="flex justify-center items-center gap-4">
            <form onSubmit={e => { e.preventDefault(); setSeed(seedInput); }} className="flex items-center gap-2">
              <input
                type="text"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                className="px-2 py-1 border rounded"
                placeholder="Seed"
                style={{ width: 100 }}
              />
              <button
                type="submit"
                className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400"
              >
                Set Seed
              </button>
            </form>
          </div>
          
          <p className="text-center text-gray-600">Map Width: {mapWidth}, Map Height: {mapHeight}</p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {Object.values(TerrainType).map((terrain) => (
            <div key={terrain} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border border-gray-400"
                style={{ backgroundColor: getTerrainColor(terrain) }}
              />
              <span className="capitalize text-gray-800">{terrain}</span>
              {terrain !== TerrainType.WATER && (
                <svg className="w-4 h-4" viewBox="-10 -10 20 20">
                  {terrain === TerrainType.FOREST && (
                    <>
                      <g style={{ color: getSymbolColor(TerrainType.FOREST) }}>
                        <use href="#forest-evergreen" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.FOREST)} />
                        <use href="#forest-broadleaf" width="16" height="16" transform="translate(0,-8)" stroke={getSymbolColor(TerrainType.FOREST)} />
                      </g>
                    </>
                  )}
                  {terrain === TerrainType.MOUNTAIN && (
                    <g style={{ color: getSymbolColor(TerrainType.MOUNTAIN) }}>
                      <use href="#mountain-peak" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.MOUNTAIN)} />
                    </g>
                  )}
                  {terrain === TerrainType.HILLS && (
                    <g style={{ color: getSymbolColor(TerrainType.HILLS) }}>
                      <use href="#hill-arch" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.HILLS)} />
                    </g>
                  )}
                  {terrain === TerrainType.GRASSLAND && (
                    <g style={{ color: getSymbolColor(TerrainType.GRASSLAND) }}>
                      <use href="#grass-tuft" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.GRASSLAND)} />
                    </g>
                  )}
                  {terrain === TerrainType.DESERT && (
                    <>
                      <g style={{ color: getSymbolColor(TerrainType.DESERT) }}>
                        <use href="#desert-dot" width="4" height="4" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.DESERT)} />
                        <use href="#desert-rock1" width="8" height="8" transform="translate(0,-8)" stroke={getSymbolColor(TerrainType.DESERT)} />
                      </g>
                    </>
                  )}
                  {terrain === TerrainType.SWAMP && (
                    <g style={{ color: getSymbolColor(TerrainType.SWAMP) }}>
                      <use href="#swamp-marsh" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.SWAMP)} />
                    </g>
                  )}
                  {terrain === TerrainType.BRUSH && (
                    <g style={{ color: getSymbolColor(TerrainType.BRUSH) }}>
                      <use href="#brush-bush" width="16" height="16" transform="translate(-8,-8)" stroke={getSymbolColor(TerrainType.BRUSH)} />
                    </g>
                  )}
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 