// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

const DEV_API_PORT = 3000;

// Target the Forge server on the same host that served the page, so LAN/remote
// access via `npm run start:host` reaches the server instead of the client's own localhost.
function resolveDevApiUrl(): string {
  const location = typeof window !== 'undefined' ? window.location : undefined;
  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = location?.hostname || 'localhost';
  return `${protocol}//${hostname}:${DEV_API_PORT}`;
}

export const environment = {
  production: false,
  e2eTestApiEnabled: true,
  apiUrl: resolveDevApiUrl(),
  logLevel: 'debug',
  viewerQaEnabledByDefault: true,
  viewerForceHeroByDefault: true,
  viewerShowEffectiveProfileByDefault: true,
};
