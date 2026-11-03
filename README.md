# Docsmith — PDF & Image Tools in Your Browser

A modern, mobile-first document toolkit. Every tool runs **entirely in the browser**, so files are never uploaded to a server.

Built with React 18, TypeScript, Tailwind CSS 4, Vite 6, pdf-lib, PDF.js, JSZip, dnd-kit and Lucide icons.

## Features

| PDF tools | Image tools |
| --- | --- |
| Image to PDF (reorder, rotate, A4/Letter/Original, orientation, margins, fit/fill) | JPG → PNG, PNG → JPG, WEBP → JPG, WEBP → PNG |
| PDF to JPG / PDF to PNG (72/150/300 dpi, page ranges) | Image Compressor (quality, format, max size, before/after) |
| Merge PDF (drag to reorder) | Resize Image (percentage or pixels, keep aspect) |
| Split PDF (ranges, every page, fixed chunks, extract to one file) | Crop Image (free or fixed aspect ratios, keyboard support) |
| Compress PDF (lossless, recommended, extreme) | Rotate & flip images (batch) |
| Rotate PDF, Delete Pages, Reorder Pages | Combine images into a PDF |
| Extract Images from PDF | |

Also included: drag-and-drop uploads, file validation with clear error messages, progress overlay, success screens, ZIP “Download all”, session-only recent files, dark mode, Ctrl/⌘ + K tool search, category filters, a homepage that suggests tools for dropped files, mobile bottom-sheet settings, keyboard accessibility and per-page SEO metadata.

## Requirements

- Node.js 18.18+ (tested with Node 22)
- npm 9+

## Install and run

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # TypeScript only
```

## Project structure

```
src/
  App.tsx                 Routes (tool pages are lazy-loaded)
  main.tsx, index.css     Entry point and design tokens (Tailwind @theme)
  context/                theme (dark mode), toast notifications, session (recent files, homepage hand-off)
  lib/
    files.ts              validation, formatting, downloads, ZIP
    image.ts              canvas helpers (draw/rotate/crop/scale, encode, EXIF orientation)
    pdf.ts                PDF.js loader, page rendering, thumbnails, page-range parser
    tools.ts              tool registry (titles, routes, icons, search)
    seo.ts                per-page title/description, site constants
  components/
    ui/                   Button, Dropzone, Segmented, Slider, Toggle, ProgressBar, SortableGrid…
    layout/               Navbar, Footer, SearchPalette, Layout
    tool/                 ToolLayout (shared tool page shell), ResultPanel, useToolRun,
                          useImageItems, usePdfDoc, PageThumb, ImageBatchTool
  pages/                  Home, category pages, About, Contact, Privacy, Terms, 404
  tools/                  One file per tool
```

### Adding a tool

1. Add an entry to `TOOLS` in `src/lib/tools.ts`.
2. Create a component in `src/tools/` using `ToolLayout` + `useToolRun` (or `ImageBatchTool` for per-image work).
3. Register the route in `src/App.tsx`.

## Configuration

- **Contact email**: `CONTACT_EMAIL` in `src/lib/seo.ts` (used by the Contact page’s Gmail and email-app buttons).
- **Brand name**: `SITE_NAME` in `src/lib/seo.ts`, plus `index.html` and `components/layout/Logo.tsx`.
- **Brand colour**: the `--color-brand-*` tokens in `src/index.css`.

## Deployment

The app is a static single-page app. Build with `npm run build` and host the `dist/` folder anywhere. Because it uses client-side routing, the host must serve `index.html` for unknown paths:

- **Vercel**: import the repo, framework “Vite”. `vercel.json` already contains the SPA rewrite.
- **Netlify**: import the repo; `netlify.toml` already sets the build command, output folder and SPA rule.
- **Cloudflare (Workers or Pages)**: build command `npm run build`, deploy command `npx wrangler deploy` (Workers) or output directory `dist` (Pages). `wrangler.jsonc` already configures SPA routing.
- **GitHub Pages / other static hosts**: copy `dist/index.html` to `dist/404.html` after building so deep links work.
- **Nginx**: `location / { try_files $uri /index.html; }`

Make sure the host serves `.mjs` files as `text/javascript` (the PDF.js worker uses this extension; all the hosts above do this by default).

No backend, database or environment variables are required.

## Privacy and limits

- Files are read with browser file APIs, processed in memory, and released when the user clears files, starts over, or closes the tab. Nothing is persisted except the theme preference.
- “Recommended” and “Extreme” PDF compression render pages to JPEG images, so text in the compressed copy is no longer selectable. “Basic” is lossless. If compression would not reduce the size, the original is returned and the user is told.
- PNG output from the image compressor is saved as WEBP (or JPG on browsers without WEBP encoding), because canvas PNG encoding is lossless and would not shrink the file.
- Password-protected PDFs are detected and reported. They must be unlocked first.
- Canvas sizes are capped at about 16 megapixels so very large images and high-DPI renders don’t crash iOS Safari.
- Very large documents (hundreds of pages) depend on device memory, especially on phones.
