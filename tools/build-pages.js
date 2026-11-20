// Builds the standalone website version of the app for GitHub Pages.
// index.html is written for claude.ai, which adds the HTML document wrapper when publishing.
// This script adds the same wrapper so the page also works on its own website.
// Usage: node tools/build-pages.js   ->   writes _site/index.html
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (/^\s*<!doctype/i.test(app)) throw new Error('index.html already has a document wrapper; expected the claude.ai page format.');
const head = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta name="description" content="Retirement Runway: see how long your money lasts, which account should pay the bills, and how much to convert to Roth each year, using real federal and state tax rules. Runs in your browser; nothing you type is sent anywhere.">',
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>',
  '</head>',
  '<body>'
].join('\n');
const out = head + '\n' + app + '\n</body>\n</html>\n';
const dir = path.join(root, '_site');
fs.mkdirSync(dir, {recursive: true});
fs.writeFileSync(path.join(dir, 'index.html'), out);
fs.writeFileSync(path.join(dir, '.nojekyll'), '');
// Tool 2, Open This First, is published in its own folder with the same wrapper.
const otf = fs.readFileSync(path.join(root, 'open-this-first', 'index.html'), 'utf8');
if (/^\s*<!doctype/i.test(otf)) throw new Error('open-this-first/index.html already has a document wrapper.');
const otfHead = head.replace(/<meta name="description"[^\n]*/, '<meta name="description" content="Open This First: a short interview that makes a one-page guide for your family: who to call, where things are, and what not to do yet. Runs in your browser; nothing you type is sent anywhere.">');
fs.mkdirSync(path.join(dir, 'open-this-first'), {recursive: true});
fs.writeFileSync(path.join(dir, 'open-this-first', 'index.html'), otfHead + '\n' + otf + '\n</body>\n</html>\n');
console.log('Wrote _site/open-this-first/index.html');
console.log('Wrote _site/index.html (' + Math.round(out.length / 1024) + ' KB)');
