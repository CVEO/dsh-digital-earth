<div align="center">

<img src="https://github.com/CVEO/dsh-digital-earth/raw/main/icon.svg" width="72" height="72" alt="Digital Earth icon">

# Digital Earth

**3D Tiles and 3DGS in the DSH conversation workspace, readable and testable by the Agent.**

[中文](README.md) · [English](README.en.md) · [Issues](https://github.com/CVEO/dsh-digital-earth/issues) · [Changelog](CHANGELOG.md)

![version](https://img.shields.io/badge/version-1.5.1-4f8cff)
![CI](https://github.com/CVEO/dsh-digital-earth/actions/workflows/ci.yml/badge.svg)
![license](https://img.shields.io/badge/license-MIT-2ea44f)
![DSH plugin](https://img.shields.io/badge/DSH-plugin-0ea5e9)
![platform](https://img.shields.io/badge/platform-Web-64748b)

</div>

![Digital Earth panel: shader workbench, two layer tabs and compass](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/panel-overview.jpg)

Digital Earth brings a CesiumJS 3D scene into the DeepSeek Harness (DSH) conversation workspace: browse 3D Tiles and 3DGS, and let the Agent read and drive the scene, annotate, measure, analyze terrain and apply shader presets. CesiumJS and the UI assets ship with the plugin — no external static assets and no Cesium ion token.

## Screenshots

**Annotate and measure**: draw an extent, measure a distance on the globe, or annotate from GeoJSON; coordinates, areas and results stay in the panel.

![Annotate and measure](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/identify.jpg)

**Profile**: in the 3D tab select "Draw profile", then choose the start and end points on the globe; the card reports relief, slope, cut/fill and the profile line.

![Profile](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/analysis.jpg)

**Shaders**: five white-listed presets per 3D Tiles layer, such as water and elevation; the workbench stacks 1–3 presets, tunes sliders and compares against the original look.

![Shaders](https://github.com/CVEO/dsh-digital-earth/raw/main/assets/readme/shader.jpg)

## Features

- **Scene**: 3D Tiles 1.0 / 1.1 (b3dm, glb) and 3DGS (`KHR_gaussian_splatting`, SPZ included); multiple layers with show / hide, fly-to and remove.
- **Data entry**: recursively scan a local folder for `tileset.json`, paste an `http(s)` URL, or use an absolute local path; paths outside the whitelist ask for one authorisation in the panel.
- **Layer groups**: L1 terrain, L2 imagery, L3 raster overlays (WMS / XYZ / ArcGIS), L4 vector overlays; terrain, basemap and rasters remain reachable even without 3D Tiles.
- **Measure and identify**: distance, area, height and 3D Tiles property picking; the identify card shows coordinates, surface elevation, a geometric height estimate and confidence, and exports an evidence pack.
- **Terrain analysis**: profile, flood, sunlight, clip and skyline; one active analysis at a time, shown as a scene overlay plus an analysis card.
- **Shader presets**: elevation ramp, contour, scan, water and water-depth; one shader per layer, with 1–3 presets stacked.
- **Hand-off**: Clean snapshots (Manual and Agent snapshots keep only the 3D view by default), HTML / Markdown scene reports, evidence packs and per-session scene restore.
- **Local data**: reads only folders opened in the panel or authorised once; it does not upload scenes, snapshots or annotations.
- **Interface**: bilingual UI, light / dark themes, Collapsible panels; the layer card has Map / 3D tabs, the compass faces north on click, and the coordinate HUD samples at 5–6 Hz.
- **Six built-in tools**: `earth_scene`, `earth_capture`, `earth_draw`, `earth_measure`, `earth_analyze`, `earth_shader`; every call gets a tool row in the conversation.

## Install & quick start

**Requirements**

- DeepSeek Harness `>=0.2.1-rc.1 <0.3.0-0` (same range as `engines.dsh` in `package.json`).
- A modern browser with WebGL / WebGL2; the panel is part of the DSH Web UI.
- Online basemaps, terrain and tiles need to reach the selected public services; offline, use local tiles or turn the basemap off.
- Node.js 22 or 24 is needed only for development and builds; there are no runtime dependencies.

**Data requirement**: standard 3D Tiles 1.0 / 1.1 with a world placement on the root tile (`root.transform` or `root.boundingVolume.region`). OSGB conversions can add the root `transform` once with `scripts/georef-osgb.mjs`.

**Install**

```bash
# from the npm registry
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# or from a local tarball (run in the repository root)
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

You can also search for "Digital Earth" in the plugin market. After installing or updating, **fully quit and reopen DSH**: client bundles are registered when the host starts, so reloading the page is not enough. The globe button then appears in the chat header and a Digital Earth entry appears in the sidebar.

**Load your first dataset**

1. Select the globe button in the chat header, or have the Agent call an earth tool; the panel opens and waits for the connection.
2. Use **Data ▾ → Open local folder…** and pick a folder containing `tileset.json`, or **Data ▾ → Load address or coordinates…** and paste an `http(s)` URL / absolute local path, or enter `lon,lat[,height]` to fly there.
3. If the folder is outside the whitelist, the panel requests authorisation once; grant it to continue.
4. Drag to explore, use Measure to take a distance, or ask the Agent: "run a data health check on the current layer".

Quick check: open the globe, load one tileset, measure a distance and ask the Agent for a snapshot. Use standard 3D Tiles; example prompt: `Load D:\data\city\tileset.json, fly to the city centre and take a snapshot` (replace the path with your data path).

## Using the panel

| Entry | What it does |
| --- | --- |
| Globe button | Opens the Digital Earth tab beside the conversation; the toolbar has the fullscreen entry (DOM Fullscreen, Esc exits) |
| Data ▾ | Open a local folder, re-scan a recent one, load an address or coordinates, clear Agent annotations and measurements, export a scene report |
| Measure ▾ | Distance / area / height / property picking; left click to add a point, double click to finish, Esc or "End" to leave |
| Draw profile | In the 3D tab select "Draw profile", then choose the start and end points; the result opens in the analysis card |
| Sun timeline | In the 3D tab enable it, then drag the date / time to watch day/night tone and terrain shadow changes |
| Identify | Select an object to open the selection card with approach, height measurement and evidence export |
| Layers | Two tabs: Map (terrain / imagery / raster) and 3D (vector / 3D content / spatial analysis / sun / view bookmarks) |
| Shader | Opens the workbench: choose a 3D Tiles layer and a preset, tune parameters, apply / reset / compare with the original |
| Ask Agent | Adds the current view and a concise scene summary to the current conversation context, then lets you type the question; it applies on the next step and does not start an idle conversation |
| Settings | Data sources, appearance, render quality, Detailed HUD, snapshot annotation and an About tab |

Local folders are remembered in `$DSH_HOME/digital-earth/directories.json`; the scene is saved per session — camera, layers, annotations / measurements, analysis results and shader presets survive switching sessions or restarting DSH. Snapshots keep only the 3D view by default, and the capture folder keeps the latest 50 images; reports and exports return their paths.

## Agent tools

Six tools are registered by the host with stable names and parameters. Tool results describe scene state and file paths; they do not replace the rendered frame. Analysis runs through `earth_analyze`; profile and sun are also available in the panel.

| Tool | What it does |
| --- | --- |
| `earth_scene` | Read and modify camera, layers, basemap, terrain and visibility; `load` / `remove` / `visible` / `fly` / `pick` / `inspect` / `report` |
| `earth_capture` | Captures a snapshot and returns its absolute host path; optional JPEG / PNG, size and HUD |
| `earth_draw` | Draws points, lines, polygons and labels from GeoJSON; clears earlier Agent overlays |
| `earth_measure` | Measures geodesic distance, planar area or height difference; points use `[lon, lat]` or `[lon, lat, height]` |
| `earth_analyze` | Terrain analysis: `profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear` |
| `earth_shader` | Applies, resets or lists white-listed shader presets |

**Example prompts**

> Load `D:\data\city\tileset.json`, switch to satellite imagery, fly to the scene centre and take a snapshot.

> Run a data health check on the current layer and list the content-integrity results; then measure the height difference from the view centre to a point 300 m north-east.

**`/earth` commands**

- `/earth status`: camera, layers, basemap / terrain and Agent overlay summary.
- `/earth capture [label]`: capture a snapshot and return its absolute host path.
- `/earth report [html|markdown]`: export a scene report.
- `/earth clear`: clear Agent-drawn annotations and measurements.
- `/earth open`: guidance for opening the panel.

**Return convention**

- Tool results include a `[code]` and a `next:` step.
- A local path outside the whitelist returns `access_denied` or `access_timeout`; the user can authorise it again from the panel.
- When elevation data is unavailable, the shader target is unsupported or the panel is hidden, the tool returns the relevant error code and next step.

## Contributing

Issues and suggestions are welcome in the [issue tracker](https://github.com/CVEO/dsh-digital-earth/issues). Development, build, test and release steps are in [CONTRIBUTING.md](CONTRIBUTING.md); keep the six tools' names, parameters and action sets unchanged.

## License & credits

Released under the MIT license; see [LICENSE](LICENSE) and [NOTICE](NOTICE) for third-party attribution.

- CesiumJS 1.147, distributed under Apache-2.0 and self-hosted with the plugin.
- DeepSeek Harness for the plugin runtime, command bridge and tool-call UI.
- Sample data: a project-owned LOD18 photogrammetry scene; the 3DGS sample Svirnas Alyt comes from WilliamLiu's 3D-Tiles-RendererJS-3DGS-Plugin (Apache-2.0).
- Imagery and terrain come from public ArcGIS services accessed at runtime and remain subject to their providers' terms.

Maintained by the **CVEO Research Group, Wuhan University** · <https://www.whu-cveo.com/>
