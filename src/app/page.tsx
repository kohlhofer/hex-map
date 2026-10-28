import HexMap from '@/components/HexMap';

const REPO = 'https://github.com/kohlhofer/hex-map';
const POST = 'https://notsocommonthoughts.com/blog/revisiting-the-world-of-weewar/';

// The generator is the page, but a crawler previously saw 127 words and an h1
// containing the generated map's name — nothing that said what this is. The
// copy below is the page's actual subject, and it uses the vocabulary the page
// already earns impressions for: "hexmap" as one word, "map maker", plus the
// long tail of synonyms Search Console shows — "hexagon map", "hexagonal
// grid", "creator", "random", "online", "D&D" — and the tool really is all of
// those things, so none of it is decoration.
export default function Home() {
  return (
    <main>
      <h1 className="sr-only">
        Hex Map Generator — a free fantasy hexmap maker
      </h1>

      <HexMap />

      <section className="mx-auto max-w-2xl px-6 py-16 text-[#223344]">
        <h2 className="font-serif text-xl mb-4">About this hex map generator</h2>

        <div className="space-y-4 text-[15px] leading-relaxed opacity-90">
          <p>
            This is a free hex map maker for tabletop role-playing games — D&amp;D
            and the rest of them — and for worldbuilding, and for anyone who wants
            an island that did not exist a moment ago. Open it in a browser, press
            the button, and it draws a new one: terrain across a hex grid,
            settlements placed where the land suits them, and roads routed between
            those settlements.
          </p>
          <p>
            Every hexagon map here sits on a hexagonal grid of flat-topped hexes.
            Eight terrain types are generated — water, mountains, forest, grassland,
            hills, desert, swamp and brush — each with its own hand-drawn symbol
            rather than a flat fill. Rivers run down from the mountains to the sea,
            settlements come in three sizes, cities down to villages, and every map
            gets a name.
          </p>
          <p>
            The generation is random: every press rolls a different island, and the
            map fills whatever screen it lands on, phone to widescreen. Nothing is
            uploaded and nothing is stored. The whole hexmap generator runs in your
            browser, needs no account, and costs nothing — a free online hex map
            maker that works anywhere a browser does. Press the button again for a
            different world.
          </p>
        </div>

        <h2 className="font-serif text-xl mt-10 mb-4">Open source</h2>
        <div className="space-y-4 text-[15px] leading-relaxed opacity-90">
          <p>
            The generator is MIT licensed and the source is on GitHub. Terrain is
            grown from a seed so coastlines stay plausible, settlements are scored
            against the land under them, and roads are then routed between
            settlements around whatever the terrain makes expensive to cross.
          </p>
          <p>
            <a
              href={REPO}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-4 hover:opacity-70"
            >
              Read the code on GitHub &rarr;
            </a>
          </p>
        </div>

        <h2 className="font-serif text-xl mt-10 mb-4">The story</h2>
        <div className="space-y-4 text-[15px] leading-relaxed opacity-90">
          <p>
            Why a hex map generator at all goes back to Weewar, a browser strategy
            game from the mid-2000s that built its worlds on exactly this kind of
            grid.{' '}
            <a
              href={POST}
              target="_blank"
              rel="noopener"
              className="underline underline-offset-4 hover:opacity-70"
            >
              The long version, on my blog &rarr;
            </a>
          </p>
        </div>

        <p className="mt-10 text-[13px] opacity-60">
          Built by{' '}
          <a
            href="https://kohlhofer.com/"
            className="underline underline-offset-4 hover:opacity-100"
          >
            Alexander Kohlhofer
          </a>
          .
        </p>
      </section>
    </main>
  );
}
