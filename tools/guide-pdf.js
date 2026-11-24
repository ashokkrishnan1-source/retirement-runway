#!/usr/bin/env node
'use strict';
/* A guide as a PDF to print. The owner asked for Prism's on 2026-11-24, once it had its line-by-line part.

     node tools/guide-pdf.js prism <out.pdf>        (or: runway)

   The PDF is made from the guide itself (prism/guide/index.html, guide/index.html): every lesson, opened, in the
   guide's own order and the guide's own words. Nothing is written here that the guide does not say, so a printed
   copy cannot say something else. Left out: the "Show me" links and the notes about them, which need the page.

   It needs Playwright with Chromium. Where pdftotext (poppler) is on the machine, the contents page gets page
   numbers: the guide is printed once, each lesson is looked up in the result, and it is printed again with the
   numbers filled in. Without it, the contents page lists the lessons by number only.
   The PDF is never committed (*.pdf is ignored). It is not part of the checks or of the workflow. */
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
const GUIDES = {prism: 'prism/guide/index.html', runway: 'guide/index.html'};
const [which, out] = process.argv.slice(2);
if (!GUIDES[which] || !out || !/\.pdf$/i.test(out)) { console.error('usage: node tools/guide-pdf.js prism|runway <out.pdf>'); process.exit(1); }
const root = path.join(__dirname, '..'), src = fs.readFileSync(path.join(root, GUIDES[which]), 'utf8');
/* the lessons, without the page's styles and scripts */
const a = src.indexOf('<div class="wrap"'), b = src.indexOf('<script>', a);
if (a < 0 || b < 0) { console.error('Cannot find the lessons in ' + GUIDES[which]); process.exit(1); }
const css = fs.readFileSync(path.join(__dirname, 'guide-print.css'), 'utf8');
const today = new Date(), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = today.getDate() + ' ' + MON[today.getMonth()] + ' ' + today.getFullYear();

/* Runs in the browser: turns the guide's own markup into the printed layout, changing no word of a lesson. */
function build(day) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wrap = document.querySelector('#src .wrap'), head = wrap.querySelector('header');
  const title = head.querySelector('h1').textContent.trim(), tool = title.replace(/^How to use /, '');
  let n = 0, body = '', toc = '';
  wrap.querySelectorAll('section').forEach(sec => {
    const h2 = sec.querySelector('h2'), small = h2.querySelector('small'), name = [...h2.childNodes].filter(x => x !== small).map(x => x.textContent).join('').trim();
    body += '<section class="chapter"><h2>' + esc(name) + (small ? ' <small>' + esc(small.textContent) + '</small>' : '') + '</h2>';
    toc += '<h2>' + esc(name) + '</h2><ol>';
    sec.querySelectorAll('details.lesson').forEach(d => { n++;
      const q = d.querySelector('.q').textContent.trim(), where = d.querySelector('.where').textContent.trim(), text = d.querySelector('.body').cloneNode(true);
      /* what needs the page is left out: the "Show me" links, and a name that was itself a link becomes a plain name */
      text.querySelectorAll('.go, .needs-tool, script, style').forEach(x => x.remove());
      text.querySelectorAll('a').forEach(x => { const k = document.createElement('b'); k.className = x.className; k.textContent = x.textContent; x.replaceWith(k); });
      text.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
      body += '<article class="lesson"><div class="ln">Lesson <b>' + n + '</b></div><h3>' + esc(q) + '</h3><p class="where">' + esc(where) + '</p>' + text.innerHTML + '</article>';
      toc += '<li><span class="tn">' + n + '</span><span class="tq">' + esc(q) + '</span><span class="dots"></span><span class="tp" data-l="' + n + '"></span></li>'; });
    body += '</section>'; toc += '</ol>'; });
  const last = [...wrap.children].filter(x => x.matches('p.note')).pop();
  const front = '<div class="front"><div class="eyebrow">' + esc(head.querySelector('.eyebrow').textContent.trim()) + '</div><h1>' + esc(title) + '</h1>' +
    '<p class="sub">' + head.querySelector('.sub').innerHTML + '</p>' +
    [...head.querySelectorAll('p.note:not(.needs-tool)')].map(x => '<p class="line">' + x.innerHTML + '</p>').join('') +
    '<p class="how">Words set <b class="k">like this</b> are the names of buttons, headings and tags, exactly as ' + esc(tool) + ' shows them. Printed from the guide on ' + day + '. The guide inside ' + esc(tool) + ' is always the latest copy: open it with <b class="k">Guide: how to use this page</b>, at the top.</p>' +
    '<nav class="toc"><div class="toch">The lessons</div>' + toc + '</nav></div>';
  return {html: front + body + (last ? '<p class="end">' + last.innerHTML + '</p>' : ''), title, lessons: n};
}

(async () => {
  let pw; try { pw = require('playwright'); } catch (e) { console.error('This needs Playwright with Chromium to print the PDF.'); process.exit(1); }
  const br = await pw.chromium.launch(), p = await br.newPage({viewport: {width: 816, height: 1056}});
  await p.setContent('<!doctype html><meta charset="utf-8"><div id="src">' + src.slice(a, b) + '</div>');
  const g = await p.evaluate(build, day);
  await p.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + g.title + '</title><style>' + css + '</style></head><body>' + g.html + '</body></html>');
  await p.evaluate(() => document.fonts.ready);
  const foot = '<div style="width:100%;padding:0 0.75in;font:8pt Inter,Arial,sans-serif;color:#6b6380;display:flex;justify-content:space-between"><span>' + g.title + '</span><span>page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>';
  const print = () => p.pdf({path: out, width: '8.5in', height: '11in', printBackground: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: foot, margin: {top: '0.7in', bottom: '0.85in', left: '0.75in', right: '0.75in'}});
  await print();
  /* where each lesson landed: its label, "Lesson 12", is looked up page by page */
  let pages = null; try { pages = execFileSync('pdftotext', ['-layout', out, '-'], {encoding: 'utf8', maxBuffer: 64e6}).split('\f'); if (pages[pages.length - 1].trim() === '') pages.pop(); } catch (e) { pages = null; }
  let said = 'no page numbers on the contents page (pdftotext is not on this machine)';
  if (pages) { const at = {}; for (let n = 1; n <= g.lessons; n++) { const i = pages.findIndex(t => new RegExp('\\bLESSON\\s+' + n + '\\b').test(t)); if (i >= 0) at[n] = i + 1; }
    if (Object.keys(at).length === g.lessons) { await p.evaluate(at => document.querySelectorAll('.tp[data-l]').forEach(x => { x.textContent = at[x.dataset.l]; }), at); await print();
      const again = execFileSync('pdftotext', ['-layout', out, '-'], {encoding: 'utf8', maxBuffer: 64e6}).split('\f').filter((t, i, all) => i < all.length - 1 || t.trim() !== '');
      const moved = Object.keys(at).filter(n => !new RegExp('\\bLESSON\\s+' + n + '\\b').test(again[at[n] - 1] || ''));
      if (moved.length) { console.error('The page numbers moved when they were filled in: lessons ' + moved.join(', ')); process.exit(1); }
      said = again.length + ' pages, with page numbers on the contents page'; }
    else said = pages.length + ' pages; ' + (g.lessons - Object.keys(at).length) + ' lessons could not be found, so the contents page has no page numbers'; }
  await br.close();
  console.log('Wrote ' + out + ': ' + g.lessons + ' lessons, ' + said);
})();
