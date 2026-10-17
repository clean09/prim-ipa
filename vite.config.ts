import { defineConfig, type Plugin } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Nur im Entwicklungsserver: tools/icons.html rendert App-Icons und Startbildschirme im Browser
// und legt sie hier über POST /__save?path=… in den nativen Projekten ab.
function saveEndpoint(): Plugin {
  return {
    name: 'primsieb-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x');
        const rel = url.searchParams.get('path') ?? '';
        const target = resolve(__dirname, rel);
        if (!rel || !target.startsWith(resolve(__dirname, 'android')) && !target.startsWith(resolve(__dirname, 'ios')) && !target.startsWith(resolve(__dirname, 'resources'))) {
          res.statusCode = 400; res.end('bad path'); return;
        }
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000 },
  worker: { format: 'es' },
  server: { host: true },
  plugins: [saveEndpoint()],
});
