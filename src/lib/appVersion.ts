// Build-time version info, injected by vite.config.ts (`define`). Falls back gracefully under
// tests or tooling that does not run through Vite.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILT__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
export const APP_COMMIT: string = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";
export const APP_BUILT: string = typeof __APP_BUILT__ === "string" ? __APP_BUILT__ : "";

/** e.g. "Version 0.1.0" (the commit and build date are in the tooltip only). */
export const APP_VERSION_LABEL = `Version ${APP_VERSION}`;
/** Tooltip: build date, when known. */
export const APP_VERSION_TITLE = [`Version ${APP_VERSION}`, APP_COMMIT && `build ${APP_COMMIT}`, APP_BUILT && `built ${APP_BUILT}`].filter(Boolean).join(" · ");
