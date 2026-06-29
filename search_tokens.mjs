import fs from 'fs';
import path from 'path';

const searchDir = 'C:\\Users\\nauze\\OneDrive\\Documentos\\Abitraje Report';

function scan(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scan(fullPath);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.sql'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('sbp_')) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('sbp_')) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

scan(searchDir);
