<div align="center">

<img src="icon.svg" width="76" height="76" alt="Digital Earth icon">

# Digital Earth · 数字地球

**Digital Earth is a 3D scene plugin for DeepSeek Harness: it loads, browses, measures and analyses 3D Tiles / 3DGS data, and lets the Agent read and write the current scene.**

Built by the CVEO Research Group, Wuhan University — a 3D component for 3D cities, reality capture and multimodal Earth-observation data

[中文](README.md) · [English](README.en.md) · [Changelog](CHANGELOG.md) · [License](LICENSE)

![version](https://img.shields.io/badge/version-1.5.2-4f8cff)
![license](https://img.shields.io/badge/license-MIT-2ea44f)
![DSH](https://img.shields.io/badge/DSH-plugin-0ea5e9)
[![npm downloads](https://img.shields.io/npm/dm/@cveo/dsh-digital-earth?label=npm%20downloads&color=cb383f)](https://www.npmjs.com/package/@cveo/dsh-digital-earth)

<img src="assets/readme/hero.jpg" alt="Digital Earth panel: the old town and cathedral of Clermont-Ferrand, France (public CRAIG 3D Tiles, dataset centre about 45.7944°N, 3.1676°E)" width="78%">

</div>

After opening Digital Earth in DSH, the 3D scene panel appears beside the conversation. Load local or online 3D Tiles / 3DGS data, then browse, measure and run spatial analysis while continuing the conversation; the Agent can also read and write the scene, add annotations, capture images and export reports.

The 3D engine and UI assets ship with the plugin, so no additional GIS server is required; local layers need not be uploaded, while online imagery and terrain use the selected sources. When you choose AI-assisted selection, the current image is sent to the configured model and saved as a host attachment.

<p align="center"><img src="assets/readme/split-view.jpg" alt="DSH conversation and Digital Earth split view: chat on the left, 3D scene and tools on the right (real screenshot)" width="92%"></p>
<p align="center"><sub>DSH conversation and Digital Earth split view: chat on the left, 3D scene, layers and tools on the right</sub></p>

## Quick start

**Easiest install**: open the desktop DeepSeek Harness, click **Plugins** in the top-right corner, enter the full package name `@cveo/dsh-digital-earth` in the plugin market search box, and install "Digital Earth". Then restart DSH as described in step 1.

You can also install from npm or a local tgz in a terminal:

```bash
# npm
dsh plugin --profile <profile> add @cveo/dsh-digital-earth

# local tarball
dsh plugin --profile <profile> add ./cveo-dsh-digital-earth-1.5.2.tgz
```

1. Quit DSH completely and start it again (the client bundle registers at startup; a page refresh is not enough).
2. Click the "Digital Earth" card on the start page, or the globe button in the chat header, to open the Digital Earth tab on the right.
3. Data ▾ → open a local folder that contains a `tileset.json`, or paste an online URL / enter coordinates to fly there.

After loading data, send the Agent a direct instruction:

> Load the tileset.json in the folder I just opened, fly to the centre, measure the distance between two buildings, and take a snapshot.

When an unauthorised folder is accessed for the first time, the panel requests authorisation once; after approval the folder loads directly.

## Three-minute tour

No tool names or coordinates are required. After loading the sample data, say any of the following to the Agent, or use the panel directly.

| Say / do this | The plugin does | You see |
| --- | --- | --- |
| "Colour the buildings by height, then take a snapshot." | Applies the elevation-ramp effect and captures a clean image | A coloured scene and the snapshot path with camera metadata |
| "Take a clean snapshot of this view and tell me where the camera is." | Captures the image and reads camera longitude/latitude, height, heading, pitch and visible layers | A clean 3D image plus a JSON sidecar of the same name |
| "Generate a Markdown report of the current scene." | Collects layers, camera, measurements, analyses and captures | A report path with a ready-to-share Markdown / HTML file |
| Click a building or the ground. | Default identification reads the hit layer, coordinates, surface/geometric height and attributes | An identify card and object attributes; "Select around this point" creates a 15 m approximate AOI |
| Tools → Rectangle selection → drag → ask "What buildings and vegetation are in this area?" | Saves the selection image and coordinates, then sends them to the current conversation | A chat answer; the selection can be measured, exported or used for flood analysis |
| Tools → AI selection → click a target | Sends the image to the vision model and projects an approximate visible-surface outline | An approximate selection you can confirm; the default model must accept images |

> For a README screenshot, start with the first row: the elevation-ramp effect is visually obvious and shows both chat and the plugin at work.

## Core capabilities

- **Scene browsing**: stack multiple 3D Tiles / 3DGS layers with visibility, fly-to and attribute identification; the layer card manages data only — the 3D tab holds terrain and 3D Tiles/3DGS, the Map tab holds imagery, raster and vector overlays; measure, profile, sun, analysis, visual effects and view bookmarks live in a separate Tools card. Collapsible panels and a compass that resets north keep the globe readable.
- **Measurement and identification**: distance, area and height, plus drag-box ground selection that reports area/perimeter/boundary height and exports GeoJSON; the coordinate HUD samples at 5–6 Hz and the identify card reports surface height and an estimated geometric height.
- **Spatial analysis**: 3D profile, flood, sunlight, clip and skyline — one active analysis at a time, drawn in the scene with the height source (3D Tiles surface or terrain) stated in the result.
- **Deliverables**: Clean snapshots (Manual and Agent snapshots keep only the 3D view by default), HTML / Markdown scene reports, evidence packs and per-session scene restore; the snapshot folder keeps the last 50 files, suitable for reports, presentations and archives. Snapshots also report camera longitude/latitude, height, heading, pitch, time and visible layers, and write a JSON sidecar next to the image.
- **Agent integration**: Six built-in tools (`earth_scene`, `earth_capture`, `earth_draw`, `earth_measure`, `earth_analyze`, `earth_shader`) let the conversation read and write the scene; visual effects are white-listed presets (no custom GLSL), applied per layer with an original-look comparison.
- **Data access**: recursive local folder scan, an absolute local path and `http(s)` URLs; a local path is authorised once and never read outside the granted folders. The Map tab can also import a local GeoJSON or Shapefile (`.shp`, optionally with its `.dbf` table; up to 500 features / 20k coordinates), or you can drop the file straight onto the globe, as a vector overlay sharing the Agent overlay rendering and clear path.

## Interface and interaction

All screenshots below are from real panel sessions. Sample data: the public Clermont-Ferrand 3D Tiles dataset (France), ready to load: <a href="https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json">3d.craig.fr/datasets/Clermont/3dtiles/tileset.json</a>. The dataset root region is centred at about **45.7944°N, 3.1676°E (WGS84)**, and every screenshot below falls inside that old town.

<div align="center">

<img src="assets/readme/profile.jpg" alt="3D profile from the cathedral across the old town, with elevation source, relief and cut/fill statistics (public CRAIG Clermont-Ferrand 3D Tiles)" width="32%">
<img src="assets/readme/shader.jpg" alt="Visual-effects workbench: elevation-ramp colouring with adjustable height range (public CRAIG Clermont-Ferrand 3D Tiles)" width="32%">
<img src="assets/readme/tools.jpg" alt="Tools card: point, lasso, rectangle/object selection, AI selection, profile and sun timeline" width="32%">

<p align="center"><img src="assets/readme/tour.gif" alt="Digital Earth panel demo: identify, selection question, flood analysis, tools card and view tour" width="640"></p>


</div>

**Example conversation** (a real run; the tool calls below come from the same session):

> **You**: Load the Clermont-Ferrand 3D Tiles, measure the distance from the cathedral to Place de Jaude, and take a snapshot.
>
> **Agent**: `earth_scene load` → `earth_measure distance` → `earth_capture`
>
> **Result**: 381.12 m; the snapshot is saved in the snapshot folder with camera metadata and a JSON sidecar, and the measurement stays on the globe.

**Measure and annotate**: measure distance, area and height on the globe, or let the Agent draw points, lines and polygons from GeoJSON; results stay in the panel and can be captured at any time. **Clicking a scene object identifies it by default**: the card shows batch-table attributes (up to 8 when present), hit layer, coordinates, surface/geometric height and confidence — no tool mode to arm first. The card can also create a 15 m approximate AOI around the point (labelled as approximate, never as a building footprint).

**Tools card**: the toolbar opens a separate card for measurement, profile, sunlight, visual effects and view bookmarks. Finishing a point, lasso, box or object selection expands a question composer. Enter a question or choose a suggested question, then select “Send to current conversation”. Selection details and an optional saved view accompany the question; the reply appears in chat, queued if the Agent is busy. Valid surface regions also offer approximate area/perimeter, GeoJSON export and existing analyses. Object marquee selects existing annotations for batch deletion or export. AI-assisted selection uses the separate direct-vision workflow below. The original toolbar “Ask Agent” remains a context-only action followed by typing a question in chat.

**Ask after selecting**: open Tools → Box select, drag a region and release. The question card saves that view with the selected area outlined in cyan; moving the camera afterward does not change it. Images are limited to 1024 pixels on the longest side and sent only when you press Send. The host admits them as native image attachments to the current conversation model, so the Agent need not read a snapshot file. A model without image support produces an explicit error; switch models or send coordinates without the image when geometry is available. If the host lacks direct prompt support, copy the question and selection into chat. Context injection is never presented as an active answer. When delivery is uncertain, check chat first; retrying retains the same request identity.

Drag previews use screen coordinates; depth is sampled only on release. Surface picking is not building segmentation: roofs, walls and ground can fold the geographic boundary. Area estimates the horizontal projection. Missing depth or a self-intersecting ring preserves a screen selection for visual questions while disabling area and geometry export; select from above to retry. Flood analysis uses the selection's bounding rectangle, not an exact volume within an arbitrary polygon.

**3D profile**: choose Draw profile in the 3D tab. The first click on the start point shows a draft line immediately; move the mouse to preview it, then click the end point. The chart sits at the top of the analysis card, which also states whether the run used the 3D Tiles surface or terrain. It profiles the 3D surface (buildings and vegetation included), not the bare terrain.

**Visual effects**: elevation ramp, height scan, water ripples and flood analysis are the four primary effects, applied to one explicit target layer; the elevation ramp uses the sampled visible-surface range by default, ripples animate over time and nothing is left behind after reset or when a layer is hidden. Contours look jagged on 3D meshes, so they are removed from the UI (the tool whitelist still accepts the preset, so existing calls keep working).

**Sun timeline**: enable it in the 3D tab and drag the date/time slider; the zone can be scene mean solar time (default, derived from the current scene/layer longitude with its UTC offset shown), browser local (IANA zone) or UTC. With the timeline on, sky and sun are visible, darkness after sunset is labelled as real day/night rather than a render fault, and closing the timeline restores the original lighting.

## Data and accuracy

- **3D Tiles**: standard 1.0 / 1.1 (b3dm, glb); the root tile must carry a world placement (`root.transform` or `root.boundingVolume.region`). If an OSGB-converted dataset lacks that transform, run the `georef-osgb` script once in the repository (the npm package does not include the script).
- **3DGS**: `KHR_gaussian_splatting` (including SPZ compression). The panel reads content headers to tell mesh from 3DGS. Splats are great for browsing, identification and annotations, but they do not provide a sampleable surface height: 3D profile / flood / skyline need terrain or a mesh 3D Tiles layer.
- **Basemaps and terrain**: built-in Esri imagery, ArcGIS terrain and other common services, or your own XYZ / ArcGIS / WMS sources; turn the basemap off when offline.
- **Heights and areas**: heights come from the 3D surface or online terrain and are ellipsoidal; areas are a local planar approximation. One analysis uses exactly one height source (never mixed). For accuracy-critical work, use the results of your professional software and tell us the convention you need.
- **Large datasets**: reality-capture models of hundreds of MB and tilesets with thousands of tiles load directly; the snapshot and report folders keep the most recent files automatically.

Public sample data: <a href="https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json">Clermont-Ferrand 3D Tiles</a> (France, published by CRAIG, dataset centre about 45.7944°N, 3.1676°E) — paste the address into the panel to open it.

## AI-assisted selection (direct vision)

Click a scene target and choose “Outline this target with AI” on its card. Check the image preview, then choose “Use approximate selection”. The Tools card can export GeoJSON with approximation metadata or run existing analyses. Results approximate visible surfaces; area and analysis are indicative only. This is not a building footprint, precise segmentation or mesh extraction.

The panel calls the global default DSH vision model once, outside the Agent tool loop, without installing SAM or another inference runtime. The model must declare image support, and the host must provide LLM, attachment and default-model services; missing capabilities produce explicit messages. Images are limited to a 1024-pixel longest edge, with an approximately 20-second server timeout and no automatic retries. Model-provider charges apply. Cancellation signals the model to stop; it does not undo incurred charges or saved attachments.

The view stays fixed during recognition. Camera, layer, tile-detail or panel-size changes invalidate the result. Confirmation requires reliable 3D depth; if unavailable, explicitly switch to manual lasso. “Ask Agent” remains a separate action. After updating the local plugin, quit DSH completely and restart it to load the new host route.

## Agent tools

Six tools are registered by the Host; their names and parameters are a stable contract, and the panel and the conversation share the same operations:

| Tool | Purpose |
| --- | --- |
| `earth_scene` | Read or change camera, layers, basemap, terrain and visibility; `load` / `remove` / `visible` / `fly` / `reset` / `pick` / `inspect` / `report` |
| `earth_capture` | Save a snapshot and return its host path plus camera metadata (lon/lat/height/heading/pitch/time/visible layers); a JSON sidecar is written next to the image; optional JPEG / PNG, size and HUD |
| `earth_draw` | Draw points, lines, polygons and labels from GeoJSON; clear previous Agent overlays |
| `earth_measure` | Measure geodesic distance, polygon area and height difference, with values and labels |
| `earth_analyze` | Spatial analysis: `profile` (3D profile) / `flood` / `sunlight` / `clip` / `skyline` / `clear`; one height source (3D surface or terrain) per run |
| `earth_shader` | Apply / reset / list white-listed visual-effect presets; 1–3 presets can be composed |

Besides the tools, `/earth` commands in the conversation can read status, capture, write a report or clear annotations.

## Citation and papers

Digital Earth is part of the CVEO Research Group's long-term research. If it helps your research, teaching or project, a citation is welcome — these two papers are the most relevant to 3D city modelling and reconstruction:

[1] CHENG J X, HUANG X R, CHEN G Z, et al. FACTS: training-free zero-shot diffusion framework for facade texture restoration in 3D urban models[J]. Advanced Engineering Informatics, 2026, 71: 104385. DOI: 10.1016/j.aei.2026.104385.

[2] WANG J Q, CHEN G Z, ZHANG X D, et al. Utilizing geometric primitives for depicting planar building roof structure from high-resolution remote sensing imagery[J]. International Journal of Applied Earth Observation and Geoinformation, 2025, 141: 104630. DOI: 10.1016/j.jag.2025.104630.

More publications: <a href="https://www.whu-cveo.com/research/">whu-cveo.com/research</a>.

## Team and business collaboration

**Official channels**: npm (`@cveo/dsh-digital-earth`), the DSH plugin market (publisher CVEO) and the group website <a href="https://www.whu-cveo.com/">whu-cveo.com</a>. For questions, data-compatibility reports or feature requests, contact us through the group website.

The plugin is released under MIT and is free to use commercially. The group also offers team-oriented services:

- **Private deployment**: on-premises / private-cloud deployment, offline tiles and terrain, upgrades and maintenance, plus large-scale spatio-temporal data governance and domestic Xinchuang hardware deployment.
- **Team access control**: multi-user and role permissions, project and data isolation, audit logs, single sign-on.
- **Multimodal Earth-observation intelligence**: perception, understanding and analysis for SAR, multispectral, hyperspectral and point-cloud data — not just 8-bit RGB.
- **Jingwei Guanshu spatio-temporal agents**: industry collaborations, custom development and integration, training and technical support.

Contact: collaboration page <a href="https://www.whu-cveo.com/collaboration/">whu-cveo.com/collaboration</a> · WeChat official accounts "CVEO课题组" and "珞珈经纬".

### License and credits

Released under MIT; see [LICENSE](LICENSE) for the full text and [THIRD-PARTY.md](THIRD-PARTY.md) / [NOTICE](NOTICE) for third-party components and data. The 3D engine CesiumJS is distributed under Apache-2.0 and self-hosted with the plugin; imagery and terrain use ArcGIS public services at runtime and remain the property of their providers; the loading animation uses the public-domain Natural Earth II data shipped with CesiumJS. The screenshots use the publicly released Clermont-Ferrand 3D Tiles dataset published by CRAIG.

Maintained by the **CVEO Research Group, Wuhan University** · <a href="https://www.whu-cveo.com/">www.whu-cveo.com</a>
