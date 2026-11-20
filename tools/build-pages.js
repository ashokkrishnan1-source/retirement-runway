// Builds the Financial Tools of Life collection from the page-format sources:
//   home/index.html              the home page
//   index.html                   Retirement Runway
//   open-this-first/index.html   Open This First
//   prism/index.html             Prism
//   guide/index.html             the guide to Retirement Runway (a page of lessons; no data of its own)
//   prism/guide/index.html       the guide to Prism
// The sources are written for claude.ai, which adds the HTML document wrapper when publishing a page.
// This script adds the same wrapper where a page needs one, and writes two outputs (both git-ignored):
//   _site/       the standalone website for GitHub Pages: home at the top, each tool in its own folder
//   _artifact/   the tool pages for the claude.ai collection link (the home page itself is published from
//                home/index.html, and these files go beside it as runway.html, runway-guide.html,
//                open-this-first.html, prism.html and prism-guide.html)
// Usage: node tools/build-pages.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => { const s = fs.readFileSync(path.join(root, f), 'utf8'); if (/^\s*<!doctype/i.test(s)) throw new Error(f + ' already has a document wrapper; expected the claude.ai page format.'); return s };
const pages = {
  home: {src: read('home/index.html'), desc: 'Financial Tools of Life: plain tools for the money decisions that matter. They run in your browser; nothing you type is sent anywhere.'},
  runway: {src: read('index.html'), desc: 'Retirement Runway: see how long your money lasts, which account should pay the bills, and how much to convert to Roth each year, using real federal and state tax rules. Runs in your browser; nothing you type is sent anywhere.'},
  guide: {src: read('guide/index.html'), desc: 'How to use Retirement Runway: short lessons that show where each answer is on the page, from a first look with a sample couple to the yearly check-up.'},
  prismGuide: {src: read('prism/guide/index.html'), desc: 'How to use Prism: short lessons on reading its lists, from a first look with made-up companies to recording a verdict. Prism lists companies to research; it does not say what to buy.'},
  prism: {src: read('prism/index.html'), desc: 'Prism: turn a whole-market stock screener download into a short reading list: the best businesses in it, and which of them are on sale. Runs in your browser; the file you load is never uploaded.'},
  otf: {src: read('open-this-first/index.html'), desc: 'Open This First: a short interview that makes a one-page guide for your family: who to call, where things are, and what not to do yet. Runs in your browser; nothing you type is sent anywhere.'}
};
// `pre` is a small script placed before the page, telling it where the other pages of the collection are.
const wrap = (p, pre) => [
  '<!doctype html>', '<html lang="en">', '<head>', '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<meta name="description" content="' + p.desc + '">',
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,-apple-system,"Segoe UI",sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>',
  '</head>', '<body>', pre ? '<script>' + pre + '</script>' : '', p.src, '</body>', '</html>', ''].join('\n');
const write = (f, s) => { const p = path.join(root, f); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, s); console.log('Wrote ' + f + ' (' + Math.round(s.length / 1024) + ' KB)') };

// The standalone website
write('_site/index.html', wrap(pages.home, 'window.FTOL_LINKS={runway:"retirement-runway/",guide:"retirement-runway/guide/",otf:"open-this-first/",prism:"prism/",prismGuide:"prism/guide/"};'));
write('_site/retirement-runway/index.html', wrap(pages.runway, 'window.FTOL_HOME="../";window.FTOL_GUIDE="guide/";'));
write('_site/retirement-runway/guide/index.html', wrap(pages.guide, 'window.FTOL_HOME="../../";window.FTOL_TOOL="../";'));
write('_site/open-this-first/index.html', wrap(pages.otf, 'window.FTOL_HOME="../";'));
write('_site/prism/index.html', wrap(pages.prism, 'window.FTOL_HOME="../";window.FTOL_GUIDE="guide/";'));
write('_site/prism/guide/index.html', wrap(pages.prismGuide, 'window.FTOL_HOME="../../";window.FTOL_TOOL="../";'));
fs.writeFileSync(path.join(root, '_site', '.nojekyll'), '');

// The tool pages that sit beside the home page on the claude.ai collection link
// FTOL_SELF is the page's own file name. On claude.ai the address belongs to the whole collection, so a refresh reloads
// the home page; a tool uses its name to leave a note saying it was on show, and the home page goes back to it.
// FTOL_GUIDE tells a tool where its guide is, and FTOL_TOOL tells a guide where its tool is.
write('_artifact/runway.html', wrap(pages.runway, 'window.FTOL_HOME="index.html";window.FTOL_SELF="runway.html";window.FTOL_GUIDE="runway-guide.html";'));
write('_artifact/runway-guide.html', wrap(pages.guide, 'window.FTOL_HOME="index.html";window.FTOL_SELF="runway-guide.html";window.FTOL_TOOL="runway.html";'));
write('_artifact/open-this-first.html', wrap(pages.otf, 'window.FTOL_HOME="index.html";window.FTOL_SELF="open-this-first.html";'));
write('_artifact/prism.html', wrap(pages.prism, 'window.FTOL_HOME="index.html";window.FTOL_SELF="prism.html";window.FTOL_GUIDE="prism-guide.html";'));
write('_artifact/prism-guide.html', wrap(pages.prismGuide, 'window.FTOL_HOME="index.html";window.FTOL_SELF="prism-guide.html";window.FTOL_TOOL="prism.html";'));
