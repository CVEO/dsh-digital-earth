<div align="center">

<img src="https://cdn.jsdelivr.net/npm/@cveo/dsh-digital-earth@1.5.1/icon.svg" width="76" height="76" alt="Digital Earth icon">

# Digital Earth

**Browse, measure and analyze 3D Tiles and 3DGS right inside the DSH chat.**

By the CVEO Research Group, Wuhan University · the 3D component of the Jingwei Guanshu spatio-temporal agent family

[中文](README.md) · [English](README.en.md) · [Changelog](CHANGELOG.md) · [License](LICENSE)

![version](https://img.shields.io/badge/version-1.5.1-4f8cff)
![license](https://img.shields.io/badge/license-MIT-2ea44f)
![DSH](https://img.shields.io/badge/DSH-plugin-0ea5e9)

<img src="https://cdn.jsdelivr.net/npm/@cveo/dsh-digital-earth@1.5.1/preview.png" alt="Digital Earth: globe panel, layers and measurements beside the chat" width="100%">

</div>

Open DSH, click the globe button in the chat header, and a CesiumJS globe opens in the right sidebar. Load local or online 3D Tiles and 3DGS next to the conversation, browse, measure and analyze, or let the Agent read the scene, annotate, capture screenshots and write reports.

No GIS server, no Cesium ion token, no CesiumJS learning curve. CesiumJS and the UI assets ship with the plugin, so it works offline and your data stays on your machine.

## 30-second setup

```bash
# Search "Digital Earth" in the plugin market, or install from npm / a tgz:
dsh plugin --profile <profile> add @cveo/dsh-digital-earth
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.1.tgz
```

1. Quit and reopen DSH completely (the client bundle is registered at startup; a page refresh is not enough).
2. Click the globe button in the chat header to open the Digital Earth tab.
3. Data ▾ → Open local folder and pick a folder containing `tileset.json`; or paste an online URL / enter lon,lat to fly there.

Then just tell the Agent:

> Load the tileset.json from that folder, fly to its centre, switch to satellite imagery and take a screenshot.

The first time you open a new folder the panel asks for one confirmation; after that the folder loads directly.

## What it does

- **View** — stack multiple 3D Tiles / 3DGS layers, toggle, fly to and pick objects. Layers live in two tabs (map / 3D), with Collapsible panels, and a compass that resets north on click.
- **Measure** — distance, area and height difference with on-globe results and labels; the cursor readout samples at about 5–6 Hz and the identify card reports surface height plus a geometric height estimate.
- **Terrain analysis** — profile, flood, sunlight, clipping and skyline, one analysis at a time, drawn directly in the scene.
- **Deliver** — Clean snapshots (Manual and Agent snapshots keep only the 3D view by default), HTML / Markdown scene reports, evidence packs and per-session scene restore; the capture folder keeps the latest 50 files, ready for documents, reviews and handover.
- **Agent-ready** — Six built-in tools (`earth_scene`, `earth_capture`, `earth_draw`, `earth_measure`, `earth_analyze`, `earth_shader`) let the chat read and drive the scene. Shader presets are white-listed, support 1–3 stacked presets and a before/after comparison.
- **Data entry** — Scan a local folder, use an absolute local path or an `http(s)` URL; local paths are authorised once and never read outside that folder.

## Screenshots

<div align="center">

<img src="https://cdn.jsdelivr.net/npm/@cveo/dsh-digital-earth@1.5.1/assets/readme/identify.jpg" alt="Annotations and measurement: distance, area and result labels" width="49%">
<img src="https://cdn.jsdelivr.net/npm/@cveo/dsh-digital-earth@1.5.1/assets/readme/analysis.jpg" alt="Profile analysis: relief, slope and cut/fill" width="49%">

<img src="https://cdn.jsdelivr.net/npm/@cveo/dsh-digital-earth@1.5.1/assets/readme/shader.jpg" alt="Shader workbench: stacked presets and parameter sliders" width="100%">

</div>

**Annotate and measure**: measure distance, area and height on the globe, or let the Agent draw GeoJSON points, lines and polygons; results stay in the panel and can be captured at any time.

**Profile**: in the 3D tab choose "Draw profile" and pick the start and end points; the card reports relief, slope, cut/fill and the profile line.

**Shaders**: five white-listed presets — elevation ramp, contour, scan, water and water depth — applied per layer, with stacking, sliders and an original-view comparison.

## Data and accuracy

- **3D Tiles**: standard 1.0 / 1.1 (b3dm, glb); the root tile must carry a world placement (`root.transform` or `root.boundingVolume.region`).
- **3DGS**: `KHR_gaussian_splatting`, including SPZ compression. Splats are great for browsing, picking and overlays; they do not provide a sampleable surface height, so profile / flood / skyline should be used with terrain or mesh 3D Tiles.
- **Imagery and terrain**: built-in Esri imagery, ArcGIS terrain and other common services; add your own XYZ / ArcGIS / WMS sources in Settings, or turn the basemap off when offline.
- **Heights and areas**: panel heights come from the 3D Tiles surface or online terrain and Cesium uses ellipsoidal heights; areas are local planar approximations. For precision-critical work, trust your production GIS results and tell us which convention you need.
- **Large data**: hundreds of MB of photogrammetry and thousands of tiles load directly; captures and reports keep only the most recent files.

## Agent tools

Six tools are registered by the Host with stable names and parameters, shared by the panel and the chat:

| Tool | What it does |
| --- | --- |
| `earth_scene` | Read or change camera, layers, imagery, terrain and visibility; `load` / `remove` / `visible` / `fly` / `reset` / `pick` / `inspect` / `report` |
| `earth_capture` | Save a snapshot and return its absolute host path; JPEG / PNG, size and HUD options |
| `earth_draw` | Draw GeoJSON points, lines, polygons and labels; clear earlier Agent overlays |
| `earth_measure` | Geodesic distance, polygon area and height difference with on-globe labels |
| `earth_analyze` | Terrain analysis: `profile` / `flood` / `sunlight` / `clip` / `skyline` / `clear` |
| `earth_shader` | Apply / reset / list white-listed shader presets; 1–3 presets can be stacked |

The `/earth` command in chat covers status, capture, report and clearing annotations.

## Citation and papers

If Digital Earth helps your research, teaching or project, a citation is appreciated (not required, but it genuinely helps us):

> CVEO Research Group, Wuhan University. Digital Earth: a CesiumJS 3D globe plugin for DeepSeek Harness (v1.5.1) [CP/OL]. 2026.

    @software{cveo_digital_earth_2026,
      author  = {{CVEO Research Group, Wuhan University}},
      title   = {Digital Earth: a CesiumJS 3D globe plugin for DeepSeek Harness},
      year    = {2026},
      version = {1.5.1},
      url     = {https://www.whu-cveo.com/},
      note    = {Jingwei Guanshu spatio-temporal agent product line}
    }

Recent papers from the group on 3D reconstruction, digital twins and spatio-temporal intelligence:

- FACTS: Training-free zero-shot diffusion framework for facade texture restoration in 3D urban models — *Advanced Engineering Informatics*, 2026. <a href="https://doi.org/10.1016/j.aei.2026.104385">paper</a>
- From Roof Structure to 3D Building Models: A RoofStructNet-Based Framework for Roof Extraction Towards Multi-Level 3D Reconstruction — *Expert Systems with Applications*, 2026. <a href="https://www.sciencedirect.com/science/article/pii/S0957417426023006">paper</a>
- TriGeoNet: A Triple-Feature-Split network with geometry-statistics co-optimization for high-accuracy satellite stereo matching — *International Journal of Applied Earth Observation and Geoinformation*, 2026. <a href="https://doi.org/10.1016/j.jag.2026.105232">paper</a>
- RoofMapNet: Utilizing geometric primitives for depicting planar building roof structure from high-resolution remote sensing imagery — *International Journal of Applied Earth Observation and Geoinformation*, 2025. <a href="https://doi.org/10.1016/j.jag.2025.104630">paper</a>
- STARS: Shared-specific Translation and Alignment for missing-modality Remote Sensing Semantic Segmentation — *International Journal of Applied Earth Observation and Geoinformation*, 2026. <a href="https://www.sciencedirect.com/science/article/pii/S1569843226002943">paper</a>
- MSSDF: Modality-shared self-supervised distillation for high-resolution multi-modal remote sensing image learning — *Information Fusion*, 2026. <a href="https://doi.org/10.1016/j.inffus.2025.104006">paper</a>

The full publication list is on the group website: <a href="https://www.whu-cveo.com/research/">whu-cveo.com/research</a>.

## Team and commercial services

**Official releases**: npm (`@cveo/dsh-digital-earth`), the DSH plugin market (publisher CVEO) and the group website <a href="https://www.whu-cveo.com/">whu-cveo.com</a>. The source repository is in private development and will be opened later; please verify the publisher when installing from anywhere else.

The plugin itself is free under the MIT license. The group also offers services for teams:

- **Private deployment** — intranet / private cloud, offline tiles and terrain, upgrades and maintenance.
- **Team access control** — users and roles, project and data isolation, audit logs, single sign-on.
- **Jingwei Guanshu spatio-temporal agent** — industry collaboration, custom development and integration, training and support.

Contact: collaboration page <a href="https://www.whu-cveo.com/collaboration/">whu-cveo.com/collaboration</a> · zxdlmars@whu.edu.cn · WeChat: CVEO课题组, 珞珈经纬.

### License and credits

Released under the MIT license; see [LICENSE](LICENSE) and [NOTICE](NOTICE). CesiumJS is distributed under Apache-2.0 and shipped with the plugin; imagery and terrain are streamed from public ArcGIS services at runtime and remain subject to their providers' terms; the loading globe uses the public-domain Natural Earth II data bundled with CesiumJS.

Maintained by the **CVEO Research Group, Wuhan University** · <a href="https://www.whu-cveo.com/">www.whu-cveo.com</a>
