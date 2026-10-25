# Commons Collage Studio Pro

Commons Collage Studio Pro is an open-source, web-based photo editor and composite collage builder designed for Wikimedia Commons contributors, Wikipedia editors, researchers, and digital archivists.

The application allows users to search and import public domain and Creative Commons media directly from the Wikimedia Commons API, arrange multi-image layouts or freeform compositions, apply non-destructive photographic adjustments, and export high-resolution assets accompanied by automatic Wikimedia attribution manifests.

---

## Key Features

### Wikimedia Commons API Integration
* Direct search querying the Wikimedia Commons API (`generator=search`, namespace 6).
* Automated metadata extraction: author/artist, licensing, publication date, original source URLs, and description.
* Built-in curated collection of archival and historical sample imagery.
* Support for local image uploads via drag-and-drop or file selection.

### Composition and Layout Engine
* Preset structured grids: Single Image, Horizontal Split, Vertical Split, 2x2 Grid, Featured 3-Panel, 3-Column Filmstrip, and 3x2 Grid.
* Interactive Freeform Canvas: arbitrary placement, layer reordering, scaling with aspect-ratio locking, and 360-degree rotation.
* Adjustable spacing, canvas padding, corner radius, and background color styling (including checkerboard transparency support).
* Multi-aspect ratio support: 1:1 Square, 4:3 Standard, 16:9 Widescreen, 3:2 Photography, 9:16 Story, and 2:3 Portrait.

### Photographic Processing and Color Grading
* Basic light controls: Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks, and Gamma.
* Color controls: Color Temperature, Tint, Vibrance, Saturation, Hue Rotation, and Matte Fade.
* Three-way color grading: independent Shadow, Midtone, and Highlight split-toning with balance controls.
* Individual RGB channel gain adjustments.
* Photographic toning treatments: Monochrome (B&W), Sepia, Cyanotype, Platinum, and Warm Bronze.
* Detail enhancement: Sharpening (Laplacian convolution), Clarity, Gaussian Blur, Vignette, and procedural Film Grain.
* Background Cutout: Chroma-key background extraction with adjustable tolerance and edge feathering.
* Selective privacy zones: rectangular blur or mosaic pixelation to redact faces, license plates, or sensitive metadata.
* Retouch brushes: Spot Healing, Photographic Dodge, Photographic Burn, Local Blur, and Saturation Sponge.

### Vector Annotations and Callouts
* Customizable typography overlays: titles, captions, and text blocks with custom fonts, colors, and background badges.
* Numbered marker pins for educational diagrams and architectural callouts.
* Vector directional arrows with interactive anchor dragging.
* Geometric shapes: rounded rectangles, circles, and speech callouts.

### Professional Export and Wikimedia Attribution
* High-resolution rendering at 1x, 2x (High-DPI), and 3x (4K Ultra) scales.
* Format support: Lossless PNG, JPEG (with automatic solid background fill), and WebP with quality compression control.
* Automated WikiText generator: produces standard Wikimedia Commons `{{Information}}` template blocks listing each source photo, author credit, license, and source link.
* Automated Markdown attribution generator for documentation and external publishing.
* Non-destructive project serialization: export and restore full studio workspace state via JSON.

---

## Technology Stack

* Core: HTML5 Canvas API, Vanilla JavaScript (ES Modules)
* Styling: Vanilla CSS with custom pastel design system
* Icons: Lucide Icons
* Build System: Vite
* Deployment Target: Wikimedia Toolforge (Kubernetes static webservice)

---

## Getting Started

### Prerequisites

* Node.js (version 18 or later recommended)
* npm (version 9 or later)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SarthakSingh2003/WikiCommonCollageStudio.git
   cd WikiCommonCollageStudio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local server address (default: `http://localhost:5173`).

### Production Build

To generate an optimized production bundle:

```bash
npm run build
```

The compiled assets will be placed in the `dist/` directory.

To preview the production bundle locally:

```bash
npm run preview
```

---

## Deployment to Wikimedia Toolforge

This application can be deployed as an `nginx-static` webservice on Toolforge:

1. Connect to the Toolforge login bastion via SSH:
   ```bash
   ssh <username>@login.toolforge.org
   ```

2. Switch to your tool account:
   ```bash
   become wikicommons-collage-studio
   ```

3. Clone the repository and build the assets:
   ```bash
   git clone https://github.com/SarthakSingh2003/WikiCommonCollageStudio.git app
   cd app
   npm install
   npm run build
   ```

4. Link the production output to the web root:
   ```bash
   ln -s /data/project/wikicommons-collage-studio/app/dist /data/project/wikicommons-collage-studio/public_html
   ```

5. Start the Kubernetes static webservice:
   ```bash
   toolforge webservice --backend=kubernetes nginx-static start
   ```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` / `Cmd + Z` | Undo last change |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo change |
| `Ctrl + C` / `Cmd + C` | Copy image adjustments from active photo |
| `Ctrl + V` / `Cmd + V` | Paste copied adjustments to active photo |
| `Ctrl + D` / `Cmd + D` | Duplicate selected annotation |
| `Delete` / `Backspace` | Delete selected annotation |
| `Arrow Keys` | Nudge active photo in Freeform layout (hold `Shift` for 10px steps) |

---

## License

This project is licensed under the **GNU General Public License v3.0 or later** (GPL-3.0-or-later). See the [LICENSE](LICENSE) file for the full license text.

Copyright (C) 2026 Sarthak Singh.
