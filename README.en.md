<div align="center">

# Digital Earth

**A DeepSeek Harness panel for 3D Tiles and 3DGS layers on a CesiumJS globe, built to work alongside an Agent conversation**

[中文](README.md) · [English](README.en.md)

![version](https://img.shields.io/badge/version-1.6.0-4f8cff)
![license](https://img.shields.io/badge/license-MIT-2ea44f)
![platform](https://img.shields.io/badge/platform-Web-8b5cf6)
![DSH](https://img.shields.io/badge/DSH-%3E%3D0.2.1--rc.1-0ea5e9)

</div>

![Preview](preview.png)

Digital Earth adds a CesiumJS globe to DSH. It opens beside the conversation so photogrammetry and Gaussian-splatting deliverables can be explored while you chat, and it lets the Agent read and drive the scene in natural language. CesiumJS 1.147 is self-hosted: no Cesium ion token, no external static assets.

## Features

| Capability | Details |
| --- | --- |
| Beside the chat | A session-scoped “Digital Earth” tab in the right sidebar sits next to the conversation and opens by itself when the Agent calls an earth tool; the globe button in the chat header opens it at any time, and a full-screen immersive mode is one click away |
| Agent integration | Six built-in tools — `earth_scene` for scene control, `earth_capture` for snapshots, `earth_draw` for annotations, `earth_measure` for measurements, `earth_analyze` for terrain analysis and `earth_shader` for shader presets; every call gets a tool row in the conversation, all driven by natural language |
| 3D Tiles & 3DGS | Recursive `tileset.json` discovery from a local folder; 3D Tiles 1.0 / 1.1 (b3dm, glb) and 3DGS (`KHR_gaussian_splatting`, SPZ included); multiple layers with show / hide, fly-to and remove |
| Online & local paths | Paste an `http(s)` URL or an absolute local path; if a local path lies outside the chosen folders the panel asks once for authorisation, registers the folder and continues; cross-origin failures fall back to the host proxy automatically |
| Standard data contract | Only standard 3D Tiles 1.0 / 1.1: the root tile must carry a world placement (`root.transform` or `boundingVolume.region`). Datasets without one are never rewritten silently; the data health check reports `tileset_not_georeferenced` instead. Re-export with a root `transform` / `region` |
| Basemaps | Built-in Esri presets plus custom XYZ (TMS, projection, subdomains, max level) / WMS / ArcGIS services; the no-basemap mode stays fully usable |
| Terrain | ArcGIS WorldElevation3D built in; any Cesium or ArcGIS terrain service can be added |
| Local tiles | Point at a local XYZ / TMS tile folder and use it as a basemap offline |
| Source management | Add, edit, delete, select and restore defaults in the settings panel; persisted to `$DSH_HOME/digital-earth/sources.json` |
| Cursor HUD | Longitude / latitude plus elevation on the bare globe, terrain and 3D surfaces; ~5–6 Hz sampling, paused while dragging and refreshed once when the drag ends, without React re-renders; FPS is measured from real Cesium render passes (`scene.postRender`) and shows `—` after 2 s of an idle scene instead of a fake 0 |
| Measurement | Distance, area, height difference, 3D Tiles property picking, snapshot, reset view |
| Terrain analysis | `earth_analyze`: profile (with an SVG profile card), flood, sunlight, clip and skyline; one active analysis at a time, results shown as map overlays and numbers; clear removes the overlays and restores the previous lighting / shadow state for sunlight |
| Shader presets | `earth_shader`: four white-listed presets (elevation ramp, contour, scan, water) per 3D Tiles layer — apply, reset or list; 3DGS is unsupported and custom GLSL is not accepted |
| Collapsible panels | The layer card and coordinate HUD can be collapsed / expanded from the toolbar, and the layer card can also be closed from its header; the show switches persist |
| Display modes & terrain occlusion | Docked sidebar / main area / **real fullscreen** (DOM Fullscreen, Esc exits); the “Terrain occludes 3D layers (depth test)” switch is off by default so underground pipes and buried models stay visible, and on it lets terrain hide what is below it |
| Render quality tiers | Settings → Appearance offers “Balanced” (default, smoother) or “High” (sharper): Balanced lowers the render resolution and the terrain / 3D Tiles LOD and enlarges the terrain cache so dragging stays smooth; High restores full resolution and Cesium’s default LOD. Switching applies live (the anti-aliasing tier takes effect after the panel is reopened); the active tier and effective scale are reported in `earth_scene status` → `render` |
| Clean snapshots | Manual and Agent snapshots keep only the 3D view by default; pass `include_hud` per call or enable the settings switch to burn the coordinate HUD and team credit into the image |
| Layer statistics | Tiles, pending tiles, triangles and cache per layer; global FPS and camera height / heading |
| Data health check | One click per layer inspects the `tileset.json`: asset version, root geometric error, LOD depth, tile / content counts, external tilesets, `extensionsUsed`, missing content and bounding-volume problems; the report is persisted and the Agent can run the same check through `earth_scene` |
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
dsh plugin --profile <profile> add "./cveo-dsh-digital-earth-1.6.0.tgz"
```

Fully quit and reopen DSH after installing or updating: client bundles are registered when the host starts, so reloading the page alone is not enough. The “Digital Earth” entry then appears in the sidebar, and a globe button appears in the conversation header.

## Usage

| Entry | What it does |
| --- | --- |
| **Globe button in the chat header** | Opens the Digital Earth tab beside the conversation; the tab toolbar also offers real fullscreen |
| **Ask Agent** | Toolbar button inside a session tab: captures the current view when possible and injects a scene summary into the conversation's Agent, then you just type your question; it never wakes an idle Agent |
| **Data ▾** | Open a local folder (`tileset.json` discovery), re-scan one from “Recently opened”, load an online URL or an absolute local path (a one-time prompt authorises the folder when needed), clear measurements and picking results, export a scene report (HTML), and clear Agent annotations when overlays are present |
| **Measure ▾** | Distance, area, height, property picking; left click to add a point, double click to finish |
| **Layers n** | Unified layer panel (v1.6): **L1 terrain**, **L2 imagery basemap**, **L3 raster overlays** (WMS/XYZ/ArcGIS, multiple layers with opacity / visibility / ordering / removal and an inline add form), **L4 vector overlays** (Agent draw + measure counts, clear), **spatial analysis** (active analysis + one-click clear), and the **3D Tiles content list** (fly / visibility / health / remove); the header ⛶ frames all visible layers; it opens even with no 3D Tiles loaded |
| **Double-click the globe** | Flies the point under the cursor to the centre (keeping heading / pitch / height); with a measurement tool active, double-click still finishes the measurement |
| **Layers / coordinate HUD** | Toolbar buttons collapse / expand the layer panel and the coordinate HUD; the show switches persist |
| **Shader** | The toolbar shader button opens the workbench: pick a visible 3D Tiles layer and one of four white-listed presets, adjust its parameters, then apply or reset |
| **Appearance** | Follow system / light / dark |
| **Settings** | Source management (imagery / terrain), appearance (including “open automatically on Agent calls”, “show layer card” and “show coordinate HUD”), the snapshot annotation switch and an About tab (version, GitHub repository and issues, team) |

Cursor coordinates are sampled at roughly 5–6 Hz, paused while dragging and refreshed once when the drag ends: a ray–ellipsoid intersection keeps the readout alive on the bare globe, the depth buffer provides 3D Tiles / 3DGS surface elevations, and `globe.getHeight` corrects terrain. HUD text is written straight to the DOM, so it never triggers React re-renders; hiding the HUD stops pointer sampling.

## Working with the Agent

When the Agent calls the earth tools the plugin opens the globe tab on the conversational side by itself and waits up to about 8 seconds for it to connect, so no manual opening is needed. Folders the user picked in the panel are remembered and can still be loaded after a DSH restart. The panel then connects to the current conversation through an SSE command bridge, so the model can read and change the scene in natural language. The Agent can also pass an absolute local path; when it lies outside the chosen folders the panel asks once for authorisation. All six tools get a tool row in the conversation, and `/earth` slash commands also drive the panel without a model turn:

| Tool | Parameters | What it does |
| --- | --- | --- |
| `earth_scene` | `action` (`status` / `list` / `load` / `remove` / `visible` / `basemap` / `terrain` / `fly` / `reset` / `pick` / `inspect` / `report`) | Read scene state and layer statistics; load / remove / show or hide layers; switch basemap and terrain; fly to coordinates; pick whatever sits at the view centre; run a data health check (`layer` / `path` / `url`, plus optional `deep`); export a scene report (`format` / `title` / `include_capture`) |
| `earth_capture` | `width`, `format`, `include_hud`, `label` | Capture a snapshot and return its absolute host path; by default the image keeps only the clean 3D view, and `include_hud=true` burns the coordinate HUD and team credit into the picture |
| `earth_draw` | `features` (GeoJSON string: a FeatureCollection, a Feature or a bare geometry), `style` (`accent` / `alert` / `success` / `warm` / `violet`), `label`, `clear` | Draw points / lines / polygons and text labels — `properties.name` becomes the per-feature label; up to 500 features / 20000 coordinates per call, `clear=true` removes all earlier Agent overlays; returns the feature count and bounding box |
| `earth_measure` | `mode` (`distance` / `area` / `height`), `points` (`[lon,lat]` or `[lon,lat,height]`, up to 200), `draw`, `clear` | Geodesic distance, planar area (perimeter included) or height difference (with horizontal distance and slope); drawn on the globe by default, `draw=false` returns numbers only; results are JSON in metres / kilometres |
| `earth_analyze` | `action` (`profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear`), `layer`, `from` / `to` (observer/target for skyline), `samples`, `region`, `water_height`, `grid`, `datetime`, `show_shadows`, `height` (clip plane height), `keep` (`below` / `above`) | Terrain analysis: profile (length, relief / gain / loss and sample points, with an SVG profile card), flood (area, inundated ratio and depth), sunlight (sun altitude / azimuth, toggling lighting and shadows) and clear; one active analysis at a time, defaulting to the topmost visible 3D Tiles layer; returns an actionable error instead of guessing when no elevation data is available |
| `earth_shader` | `action` (`apply` / `reset` / `list`), `layer`, `preset` (`height-false-color` / `contour` / `scan` / `water`), `min_height` / `max_height`, `interval`, `speed`, `amplitude`, `opacity` | Apply / reset a white-listed shader preset on one 3D Tiles layer, or list the active presets; one shader per layer, parameters validated per preset; 3DGS layers are unsupported and custom GLSL is not accepted |

| `/earth` command | What it does |
| --- | --- |
| `/earth status` | One-screen summary of the camera, layers, basemap / terrain and Agent overlay counts |
| `/earth capture [label]` | Capture a snapshot and return its absolute host path, with an optional label |
| `/earth report [html\|markdown]` | Export a scene report and return its absolute host path; HTML by default (self-contained, screenshot embedded) |
| `/earth clear` | Clear the Agent annotations and measurement overlays |
| `/earth open` | Guidance: the next earth tool call opens the tab automatically, or click the globe button in the chat header |
| `/earth` (no arguments) | Show usage |

Command results stay in the command bubble and never enter the model context; when the panel is not connected, the command returns a command error instead of a model message.

- **Ask Agent**: the toolbar button turns the current scene (camera, layers and visibility, basemap / terrain, Agent annotations / measurements, the active terrain analysis, the shader presets per layer, plus a best-effort snapshot path) into a bounded text summary and sends it through the host's token-protected inject route into the current conversation's Agent; the context lands on the next admitted step and never wakes an idle Agent, so you simply type your follow-up question afterwards. Text is capped at 4000 characters and the request body at 16 KiB; the injected content is a context line rather than a user message and never contains the instance token; when the Agent is not running or the host has no Agent runtime, 409 / 503 come back as actionable toast errors.
- **Agent annotations and measurements**: what `earth_draw` / `earth_measure` draw stays on the panel until a tool call passes `clear=true` or the user picks **Data ▾ → Clear Agent annotations**; `status.annotations` from `earth_scene` reports the current drawn-feature, measured-point and overlay counts.
- **Scene stays put**: after switching sessions / windows or when the right sidebar recycles the panel, reopening the earth tab (or the next Agent call opening it automatically) restores this session's camera, loaded layers (reloaded from their original local path or URL), layer visibility, Agent annotations / measurements, the active terrain analysis result and the shader presets per layer; snapshots live on the host under `$DSH_HOME/digital-earth/scenes` first (one JSON per session, atomic write, about 512 KB each, latest 50 sessions kept, read and written through a token-protected panel-only route, never part of any tool result), with this browser's localStorage only as a fast cache / fallback, so a DSH restart or a page origin / port change still restores the scene; basemap and terrain keep following the source settings.
- **Snapshot annotations**: the panel toolbar and HUD are DOM chrome, so they can never be exported with the WebGL canvas. Snapshots keep only the clean 3D view by default; pass `include_hud=true` per Agent call or turn on **Settings → Overlay coordinate HUD and credits in snapshots** to redraw the cursor coordinates, camera parameters and team credit onto the image canvas; it applies to manual and Agent captures alike.
- **Local data**: the Agent can load folders the user chose through the panel’s **Data → Open local folder**, or pass an absolute local path directly. When a path lies outside the whitelist the host first asks the panel for a one-time authorisation; once the user allows it, the folder is registered as a local source and the original load / health check continues. A denial returns `access_denied` without retrying, and an unanswered request returns `access_timeout` after 30 seconds. The whitelist, real-path and root checks stay in place, and neither the command bridge nor any tool result exposes the plugin token, so the model cannot widen the whitelist itself. Folders the user picked are remembered in `$DSH_HOME/digital-earth/directories.json`, so they stay loadable after a DSH restart.
- **Standard data contract**: only standard 3D Tiles 1.0 / 1.1 are accepted — the root tile must carry a world placement (`root.transform` or `root.boundingVolume.region`). Many OSGB converters only write local coordinates: the root has no `transform` / `region` and the origin lives in a sibling `tileset_info.json` as `srs` + `srs_origin`. Cesium then reads those local metres as ECEF, so the dataset collapses near the earth’s centre: `flyTo` dives to the core (which looks like “the globe is not centred”) and tiles flicker in and out of the frustum. Since v1.5 the plugin **no longer compensates** for that: the host serves the file bytes unchanged and the data health check reports a `tileset_not_georeferenced` error explaining the symptom. Fix it at export time by writing a root `transform` or `region`; the plugin performs no implicit rewriting, so the bytes Cesium receives always equal the bytes on disk. A nested external tileset is placed by its parent `tileset.json` root transform and is never transformed twice.
- **Terrain analysis**: `earth_analyze` keeps one active analysis — a new one replaces the previous one. Profile returns length, relief / gain / loss and sample points with an SVG profile card; flood returns area, inundated ratio and depth; sunlight toggles lighting and shadows. `clear` removes the analysis overlays; after a sunlight analysis it also restores the previous lighting / shadow / clock state. When no valid elevation data is available it returns an actionable error instead of guessing values.
- **Shader presets**: `earth_shader` offers exactly four presets — elevation ramp, contour, scan and water — applied, reset or listed per layer. One shader is kept per layer and parameters are validated per preset. 3DGS layers are unsupported, and neither the model nor the panel can inject custom GLSL.
- **Scene report**: ask for “export a scene report” and it runs `earth_scene`'s `report`; the panel's **Data ▾ → Export scene report** and the chat's `/earth report [html|markdown]` command do the same. The report covers the camera, layers and visibility, basemap / terrain, Agent annotations and measured values, the active terrain analysis, shader presets and a best-effort snapshot: HTML is a single self-contained file (screenshot embedded as base64, inline CSS) while Markdown links the captured image; files go to `$DSH_HOME/digital-earth/exports` (latest 200 kept), and the tool returns the absolute path with a hint to open it via `present`.
- **Snapshots and multimodal models**: captures are written to `$DSH_HOME/digital-earth/captures`, and each `earth_capture` tool row in the conversation shows a small clickable thumbnail linking to the full image — the URL is assembled from page metadata and protected by the instance token, so the model still only sees the file path. Models that understand images can call `read_image` on the returned path; models without vision fall back to the `status` JSON from `earth_scene` instead of guessing the picture.
- **Data health check**: ask for “a data health check on this layer”. In `layer` mode the panel resolves the original source and adds live runtime counters; `path` / `url` modes also work while the panel is closed. Reports go to `$DSH_HOME/digital-earth/reports` (latest 100 are kept); the tool returns a compact summary plus `report_path`, and the file can be read for details.
- **Try saying**: “Open Digital Earth, switch to satellite imagery, fly to Wuhan University and take a snapshot”; “Load the tileset from the folder I just picked”; “Hide the second layer and report the camera height”; “Run a data health check on the current layer and look for missing content”; “Connect these three points into a route, label it and take a snapshot”; “Measure the height difference, horizontal distance and slope between these two points”; “Draw a terrain profile from this start point to that end point”; “Apply contour lines to the current layer”.

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

- **Host** (`index.js` entry + `src/host/**`) registers the `/api/3dviewer/*` routes: Cesium static assets, local folder scanning and whitelisting, the remembered-folder list, per-session scene snapshots (`$DSH_HOME/digital-earth/scenes`), tile serving, the cross-origin proxy, catalog persistence, plus the six Agent tools, the `/earth` slash command and the session command bridge. Since v1.5 the entry is only `inject`/`apply` plus public re-exports; the implementation lives in 27 modules by responsibility (routes, bridge, inspect, storage, tools).
- **Client** (`src/client/**` → the `client.js` artifact) loads as a DSH client module, claims the `sidebar.panellist`, `main` and right-sidebar tab slots, and dynamically imports the self-hosted CesiumJS build. The tab panel uses `EventSource` to receive Agent commands, executes them in order and posts an acknowledgement. Sources live in 22 modules bundled by esbuild into one `window.__ModuleLoader__` artifact (`npm run build:client`); `client.js` is build output and CI rejects a stale one, so do not edit it by hand.
- **Agent bridge**: `GET /api/3dviewer/bridge?session=…` pushes commands, `POST /api/3dviewer/bridge` acknowledges them; within one session only the most recently opened globe tab executes commands, so nothing loads twice. Snapshots are written by `POST /api/3dviewer/capture` and read back through `/api/3dviewer/files`; data health checks go through `POST /api/3dviewer/inspect` and are written to the report folder.
- **Security**: every route is bound to the DSH `connection` session and same-origin checks with a plugin-instance token that is only handed to the page and never appears in tool results; `/tiles` only serves directories opened through the file picker, and Agent-side local loads obey the same whitelist with a real-path check; the whitelist registration endpoint `/scan` accepts only the panel’s own request header, so a model cannot trigger it through a same-origin Cesium fetch; `/inspect` requires the same panel header, validates local paths against the whitelist plus realpath and reuses the `/remote` rules for remote URLs; the `/remote` proxy rejects literal loopback and private addresses plus 3xx redirects to prevent direct SSRF; it does not resolve DNS, so a hostname that resolves to an internal address can still slip through (see Known limitations). The plugin never uploads data or reaches out on its own.
- **Self-hosted CesiumJS**: `vendor/cesium` ships with the plugin — no CDN, no Cesium ion token.

## Known limitations

- When the same session opens the globe tab in several browser tabs, only the most recently connected one executes Agent commands; the others stay read-only.
- Terrain analysis depends on loaded 3D Tiles or terrain elevation. Without data or valid sample points it returns an error instead of estimated values, and only one analysis result is kept at a time.
- Shader presets only work on ordinary 3D Tiles; 3DGS layers return an error. The four presets are visual treatments (the water ripples are not real refraction), and custom GLSL is not accepted.
- Frame rate while dragging with terrain enabled depends on the GPU, window size and data volume; on this machine's real-GPU browser it measured about 30 FPS. This is not a fixed FPS promise, and headless / SwiftShader numbers do not represent the actual experience.
- Agent captures require the globe tab to be visible: switching to another tab or backgrounding the window returns a clear “panel is not visible” error instead of a blank image.
- The capture folder keeps only the latest 50 images, the health-report folder the latest 100 reports, and scene snapshots only the latest 50 sessions, so they cannot grow without bound.
- The `/remote` proxy forwards query strings (up to 2048 characters; overlong queries get 400, control characters or invalid encoding get 403), so WMS / WMTS and signed tile URLs work through it; health checks read external `tileset.json` files (at most 50, local and remote), remote `deep` mode only checks the root tile content, and local `deep` mode checks at most 200 content files.
- The `/remote` proxy classifies internal addresses literally and does not resolve DNS; do not expose it to an untrusted model/user mix on untrusted networks. DNS resolution plus post-resolve checks are planned.
- Public Esri services can be unreachable on some networks; the basemap then renders empty, and a local tile source can be used instead.

## Layout

```text
dsh-digital-earth/
├── index.js            # host entry: inject/apply + public re-exports (<=80 lines)
├── src/host/           # host implementation: routes, bridge, inspect, storage, six tools, /earth
├── src/client/         # client sources: scene panel, toolbar, dialogs, shader/analysis, i18n
├── client.js           # client artifact (generated by npm run build:client, do not edit)
├── scripts/            # build-client (esbuild bundle) and check-size (architecture budgets)
├── docs/               # audit, frozen spec, direction, protocol research, delivery checklist (not shipped)
├── test/               # module unit tests / contract tests / artifact smoke
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
