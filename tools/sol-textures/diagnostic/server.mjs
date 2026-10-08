import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(root, '..', '..', '..');
const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index];
  if (!['--landmarks', '--port', '--experiments'].includes(name) || !process.argv[index + 1]) {
    throw new Error(
      'Usage: node server.mjs --landmarks <external crops> [--port 43187] [--experiments <external trials>]',
    );
  }
  argumentsMap.set(name, process.argv[index + 1]);
}
if (!argumentsMap.has('--landmarks')) throw new Error('--landmarks is required');
const landmarks = path.resolve(argumentsMap.get('--landmarks'));
const port = Number(argumentsMap.get('--port') ?? 43187);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};
const routes = new Map([
  ['/', path.join(root, 'index.html')],
  ['/diagnostic.js', path.join(root, 'diagnostic.js')],
  ['/landmarks/index.json', path.join(landmarks, 'index.json')],
  ['/three/build/three.module.js', path.join(repository, 'node_modules', 'three', 'build', 'three.module.js')],
  ['/three/build/three.core.js', path.join(repository, 'node_modules', 'three', 'build', 'three.core.js')],
]);
for (const version of ['earth-july-v2', 'luna-v2', 'mars-v1', 'luna-v3', 'mars-v2']) {
  const folder = path.join(repository, 'assets', 'sol-textures', version);
  for (const file of fs.readdirSync(folder)) routes.set(`/textures/${version}/${file}`, path.join(folder, file));
}
for (const file of fs.readdirSync(landmarks)) {
  if (file.endsWith('.png')) routes.set(`/landmarks/${file}`, path.join(landmarks, file));
}
if (argumentsMap.has('--experiments')) {
  const experiments = path.resolve(argumentsMap.get('--experiments'));
  const relative = path.relative(repository, experiments);
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    throw new Error('Experimental normals must be outside repository');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(experiments, 'experiment-manifest.json'), 'utf8'));
  for (const entry of manifest.outputs) {
    if (!/^(luna|mars)-(low|standard)-(geodesic|transition)-normal\.png$/.test(entry.file)) {
      throw new Error(`Invalid experimental filename: ${entry.file}`);
    }
    routes.set(`/experiments/${entry.file}`, path.join(experiments, entry.file));
  }
}
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const file = routes.get(url.pathname);
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file)
    .on('error', (error) => {
      console.error(error);
      response.destroy(error);
    })
    .pipe(response);
});
server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Diagnostic server ready at http://127.0.0.1:${port}`));
