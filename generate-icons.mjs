import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgData = readFileSync(path.join(__dirname, 'public/favicon.svg'), 'utf-8');

for (const size of [192, 512]) {
  const resvg = new Resvg(svgData, {
    fitTo: { mode: 'width', value: size },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  writeFileSync(path.join(__dirname, `public/icons/icon-${size}x${size}.png`), pngBuffer);
  console.log(`✓ icon-${size}x${size}.png generado`);
}
console.log('Íconos PWA listos!');
