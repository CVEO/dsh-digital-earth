<div align="center">

# Digital Earth

**A DeepSeek Harness panel for 3D Tiles and 3DGS layers on a CesiumJS globe**

[中文](README.md) · [English](README.en.md)

![version](https://img.shields.io/badge/version-1.0.0-4f8cff)
![license](https://img.shields.io/badge/license-MIT-2ea44f)
![platform](https://img.shields.io/badge/platform-Web-8b5cf6)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.1-0ea5e9)

</div>

![Preview](preview.png)

Digital Earth adds a CesiumJS globe to the DSH main workspace so photogrammetry and Gaussian-splatting deliverables can be explored in one panel. CesiumJS 1.147 is self-hosted: no Cesium ion token, no external static assets.

## Features

| Capability | Details |
| --- | --- |
| 3D Tiles & 3DGS | Recursive `tileset.json` discovery from a local folder; 3D Tiles 1.0 / 1.1 (b3dm, glb) and 3DGS (`KHR_gaussian_splatting`, SPZ included); multiple layers with show / hide, fly-to and remove |
| Online & local paths | Paste an `http(s)` URL or an absolute local path; cross-origin failures fall back to the host proxy automatically |
| Basemaps | Built-in Esri presets plus custom XYZ (TMS, projection, subdomains, max level) / WMS / ArcGIS services; the no-basemap mode stays fully usable |
| Terrain | ArcGIS WorldElevation3D built in; any Cesium or ArcGIS terrain service can be added |
| Local tiles | Point at a local XYZ / TMS tile folder and use it as a basemap offline |
| Source management | Add, edit, delete, select and restore defaults in the settings panel; persisted to `$DSH_HOME/digital-earth/sources.json` |
| Cursor HUD | Longitude / latitude plus elevation on the bare globe, terrain and 3D surfaces; ~8 Hz sampling without React re-renders |
| Measurement | Distance, area, height difference, 3D Tiles property picking, PNG snapshot, reset view |
| Layer statistics | Tiles, pending tiles, triangles and cache per layer; global FPS and camera height / heading |
| Bilingual | Follows the DSH language and switches between Chinese and English at runtime |
| Theme | Follows DSH or the system; explicit light / dark override scoped to this panel |

## Requirements

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0`
- A modern browser with WebGL / WebGL2
- Network access to the public ArcGIS services (`server.arcgisonline.com`, `elevation3d.arcgis.com`)

## Install

Search for “Digital Earth” in the plugin market, or use the CLI:

```bash
# from the npm registry
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# from a local folder or tarball
dsh plugin --profile <profile> add "<path-to-plugin>"
dsh plugin --profile <profile> add "./cveo-dsh-digital-earth-1.0.0.tgz"
```

Fully quit and reopen DSH after installing or updating: client bundles are registered when the host starts, so reloading the page alone is not enough. The “Digital Earth” entry then appears in the sidebar.

## Usage

| Entry | What it does |
| --- | --- |
| **Data ▾** | Open a local folder (`tileset.json` discovery), load an online URL or local path, clear measurements and picking results |
| **Basemap ▾ / Terrain ▾** | Switch between configured sources, or turn basemap / terrain off |
| **Measure ▾** | Distance, area, height, property picking; left click to add a point, double click to finish |
| **Layers n** | Layer list: click a name to fly to it, ◉ toggles visibility, ✕ removes it |
| **Appearance** | Follow system / light / dark |
| **Settings** | Source management (imagery / terrain) and appearance |

Cursor coordinates are sampled at roughly 8 Hz: a ray–ellipsoid intersection keeps the readout alive on the bare globe, the depth buffer provides 3D Tiles / 3DGS surface elevations, and `globe.getHeight` corrects terrain. HUD text is written straight to the DOM, so it never triggers React re-renders.

## Data sources

All built-in presets are token-free ArcGIS public services and can be enabled in one click from the settings panel:

| Kind | Presets |
| --- | --- |
| Imagery | Esri World Imagery, World Topographic, World Street Map, Light Gray Canvas, World Shaded Relief, World Ocean, World Hillshade |
| Terrain | ArcGIS WorldElevation3D |

Custom sources support:

- **XYZ tiles** — `{z}/{x}/{y}` templates, TMS (south-origin Y), Web Mercator / geographic projection, subdomains, maximum level, attribution
- **WMS** — service URL plus layer names
- **ArcGIS** — MapServer URL (level metadata is read automatically)
- **Cesium terrain** — terrain service URL with optional vertex normals / water mask
- **Local tile folders** — pick a folder right from the XYZ form; the host exposes it through its directory whitelist

Selections persist with the rest of the catalog, so changing ports or restarting DSH never loses them.

## How it works

- **Host** (`index.js`) registers the `/api/3dviewer/*` routes: Cesium static assets, local folder scanning and whitelisting, tile serving, the cross-origin proxy and catalog persistence.
- **Client** (`client.js`) loads as a DSH client module, claims the `sidebar.panellist` and `main` slots, and dynamically imports the self-hosted CesiumJS build.
- **Security**: every route is bound to the DSH `connection` session and same-origin checks with a one-time token; `/tiles` only serves directories opened through the file picker; the `/remote` proxy rejects loopback and private addresses to prevent SSRF. The plugin never uploads data or reaches out on its own.
- **Self-hosted CesiumJS**: `vendor/cesium` ships with the plugin — no CDN, no Cesium ion token.

## Known limitations

- The `/remote` proxy does not forward query strings yet, so WMS / WMTS requires a service that allows direct cross-origin requests; proxy query and redirect validation are planned.
- Public Esri services can be unreachable on some networks; the basemap then renders empty, and a local tile source can be used instead.

## Layout

```text
dsh-digital-earth/
├── index.js            # host plugin: routes, proxy, local assets, persistence
├── client.js           # client panel: Cesium scene, toolbar, source settings
├── cordis.patch.yml    # bundle patch
├── locale/             # plugin market metadata (zh / en)
├── vendor/cesium/      # self-hosted CesiumJS 1.147
├── icon.svg
└── preview.png
```

## Feedback

Issues and suggestions are welcome in the [issue tracker](https://github.com/CVEO/dsh-digital-earth/issues). Please make sure `node --check index.js && node --check client.js` passes before opening a pull request.

## Team

Maintained by the **CVEO Research Group, Wuhan University** · <https://www.whu-cveo.com/>

## License

MIT. CesiumJS is distributed under Apache-2.0; see [`NOTICE`](NOTICE) for third-party attribution.
