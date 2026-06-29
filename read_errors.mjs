import fs from 'fs';

try {
  const content = fs.readFileSync('errors.txt', 'utf16le');
  console.log(content.slice(0, 2000));
} catch (e) {
  console.error("Error reading in UTF-16LE, trying default:", e);
  const content = fs.readFileSync('errors.txt', 'utf8');
  console.log(content.slice(0, 2000));
}
