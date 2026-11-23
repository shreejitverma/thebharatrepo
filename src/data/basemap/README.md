# Basemap

`south-asia.json` is the offline basemap of the Kaalchakra Map view.
It covers 0 E to 140 E and 20 S to 62 N: the subcontinent and its neighbours, from Greece and Mesopotamia to Japan, and from northern Australia to southern Siberia.
The Map view clamps its viewport by its edges to these bounds (`MAP_LIMITS` in `src/components/kaalchakra/mapState.ts`), so no view shows anything past them.

## Source and licence

Made with Natural Earth, free vector and raster map data at https://www.naturalearthdata.com.
Natural Earth is in the public domain: "You may use the maps in any manner, including modifying the content and design, electronic dissemination, and offset printing", and no permission or credit is required (https://www.naturalearthdata.com/about/terms-of-use/).
The derived file in this directory is therefore also free of restrictions; the site credits Natural Earth beneath the map as a courtesy.

Layers used, from the GeoJSON conversion at https://github.com/nvkelso/natural-earth-vector (version 5.x):

| Layer | Used for |
|---|---|
| `ne_50m_land` | Land and coastline |
| `ne_50m_lakes` | Large lakes and inland seas |
| `ne_10m_rivers_lake_centerlines` | Rivers, to scalerank 9 inside the subcontinent and scalerank 5 outside it |

## What is deliberately absent

No political boundary is included.
Modern borders are anachronistic for most of the archive and are contested in places, so the map shows physical geography only: land, water and rivers.
Polity extents are drawn only from sourced `extents` data on an entity, never from the basemap.

## Format

Each layer is one SVG path string, already projected with the spherical Mercator in `src/lib/geo/projection.ts`: `x = lon * scale` and `y = -mercatorY(lat) * scale`, with `scale` 100 and integer coordinates.
The client draws the paths under a single transform, so no geometry is processed in the browser.

`land` and `lakes` are filled rings, clipped to the bounds, so a ring cut by the bounds runs straight along them.
Those cuts are not shorelines, so the outlines are separate stroked paths: `coast` and `shores` are the same rings without the edges that lie along the bounds.
The map fills `land` and `lakes` without a stroke and strokes only `coast` and `shores`.

## Rebuilding

The file is committed and is rebuilt by hand only when the extent or the level of detail changes.

```sh
mkdir -p /tmp/natural-earth && cd /tmp/natural-earth
for f in ne_50m_land ne_50m_lakes ne_10m_rivers_lake_centerlines; do
  curl -fLO "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/$f.geojson"
done
cd - && npx tsx scripts/build-basemap.ts /tmp/natural-earth
```

The script clips each layer to the bounds, simplifies it (Douglas-Peucker, 0.02 degrees inside the subcontinent and 0.1 degrees outside), drops very small islands and lakes, and writes about 82 KB of JSON (about 26 KB gzipped, since the outlines repeat the rings).
