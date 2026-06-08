# Repository Guidelines

## Project Structure & Module Organization

This is a Vite React 19 + TypeScript app for a Grasshopper-style Rete.js node editor. Application entry points are `src/main.tsx`, `src/App.tsx`, and global styling in `src/style.css`. Editor logic lives under `src/editor/`: `setup.ts` initializes Rete plugins and the default scene, `nodeRegistry.ts` exposes node categories, `engine/` contains dataflow execution, `nodes/` contains node implementations, and `components/` contains React renderers and modal editors. Static assets live in `public/`, including local Pyodide files under `public/pyodide/`. `dist/` is generated build output and should not be edited manually.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the Vite development server.
- `npm run build`: run TypeScript checking with `tsc`, then create a production build in `dist/`.
- `npm run preview`: serve the built app locally for smoke testing.

There is no configured test script yet; use `npm run build` as the minimum validation before submitting changes.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Match the existing 2-space indentation and semicolon-free style. Components use `PascalCase` file names such as `PythonEditor.tsx`; editor utilities and node modules use descriptive lower camel case or category names such as `engineEvents.ts` and `nodes/fluid.ts`.

`tsconfig.json` enables `verbatimModuleSyntax`; import types with `import type { X } from './module'`. Keep node execution code in `nodes/` and shared event dispatch in `engineEvents.ts` or `helpEvents.ts` to avoid circular imports.

## Testing Guidelines

No automated test framework is currently present. For behavior changes, manually verify the editor in `npm run dev`, including node creation, connection changes, recalculation, and relevant modals. For Pyodide or report changes, test initial load plus the Python Script or Report node workflow. Always run `npm run build` to catch unused variables, unused parameters, and type-only import errors.

## Commit & Pull Request Guidelines

This checkout has no Git history, so use concise imperative commit subjects, for example `Add report node formatting` or `Fix dataflow cache invalidation`. Keep commits focused on one behavior or module.

Pull requests should include a short summary, the validation performed, and screenshots or screen recordings for UI changes. Link related issues when available and call out changes to Pyodide assets, generated `dist/` output, or default scene behavior.

## Agent-Specific Instructions

Do not edit `node_modules/` or generated `dist/` files unless explicitly requested. When adding nodes, register them in `src/editor/nodeRegistry.ts`, add help text in `src/editor/helpDocs.ts`, and keep Rete setup changes localized to `src/editor/setup.ts`.
