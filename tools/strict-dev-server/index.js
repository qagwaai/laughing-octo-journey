/**
 * Strict dev-server builder.
 *
 * Wraps the standard `@angular/build:dev-server` builder and injects an HTTP
 * middleware that blocks ALL requests with a 503 error page while the latest
 * rebuild has failed. This prevents the default behavior where the dev server
 * silently keeps serving the last successful bundle to new page loads, which
 * can make QA sessions run against stale code without any visible error.
 *
 * The error page auto-reloads every 2 seconds, so once the build succeeds the
 * app loads without manual intervention.
 */
'use strict';

const { createBuilder } = require('@angular-devkit/architect');
const { executeDevServerBuilder } = require('@angular/build');

const ERROR_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Build failed — not serving</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #1b1b1f; color: #e8e8ec; font-family: ui-monospace, Consolas, monospace; }
  main { max-width: 42rem; padding: 2rem; border: 1px solid #ff5555; border-radius: 8px; background: #26262b; }
  h1 { color: #ff5555; font-size: 1.25rem; margin-top: 0; }
  p { line-height: 1.5; }
  code { background: #1b1b1f; padding: 0.1rem 0.35rem; border-radius: 4px; }
</style>
</head>
<body>
<main>
  <h1>&#9888; Application build failed</h1>
  <p>The dev server is refusing to serve the app because the latest compile failed.
     The previously built (stale) bundle will <strong>not</strong> be served.</p>
  <p>Check the <code>npm run start</code> terminal for the compiler errors,
     fix them, and this page will reload automatically.</p>
</main>
<script>setTimeout(function () { location.reload(); }, 2000);</script>
</body>
</html>
`;

async function* execute(options, context) {
  const buildState = { failing: false };

  const blockWhileFailingMiddleware = (req, res, next) => {
    if (!buildState.failing) {
      next();
      return;
    }

    res.statusCode = 503;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(ERROR_PAGE);
  };

  const results = executeDevServerBuilder(options, context, {
    middleware: [blockWhileFailingMiddleware],
  });

  for await (const result of results) {
    const failing = result.success === false;
    if (failing && !buildState.failing) {
      context.logger.error(
        'strict-dev-server: build failed — all requests now return a 503 error page until the build succeeds.',
      );
    }
    if (!failing && buildState.failing) {
      context.logger.info('strict-dev-server: build recovered — serving resumed.');
    }
    buildState.failing = failing;
    yield result;
  }
}

module.exports = createBuilder(execute);
