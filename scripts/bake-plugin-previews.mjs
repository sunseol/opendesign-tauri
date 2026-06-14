#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BAKE_VERSION = 4;
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:17579').replace(/\/+$/, '');
const RENDER_W = 1440;
const VIEW_H = 1099;
const DECK_W = 1760;
const DECK_H = 1344;
const SLIDE_MS = 1150;
const MAX_SLIDES = 6;
const MAX_WALK_MS = 8000;
const DECK_SCAN_CAP = 600;
const OUT_W = Number(process.env.PREVIEW_W || 640);
const FPS = Number(process.env.PREVIEW_FPS || 30);
const VELOCITY = 0.3;
const MAX_PAN = 7500;
const HOLD_MS = 2500;
const CRF = Number(process.env.PREVIEW_CRF || 28);

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function argList(name) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === `--${name}` && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

const OUT = path.resolve(arg('out', '.tmp/plugin-previews'));
const LIMIT = Number(arg('limit', '0')) || 0;
const ONLY = argList('id');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeFilePart(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function resolveChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (resolved) return resolved;
  throw new Error('No Chrome found. Set CHROME=/path/to/chrome.');
}

function pluginItems(data) {
  if (Array.isArray(data)) return data;
  return data.plugins || data.items || data.available || [];
}

async function discoverIds() {
  if (ONLY.length) return ONLY;
  const response = await fetch(`${BASE_URL}/api/plugins`);
  const data = await response.json();
  const ids = pluginItems(data)
    .map((item) => (typeof item === 'string' ? item : item.id || item.slug))
    .filter(Boolean);
  return LIMIT ? ids.slice(0, LIMIT) : ids;
}

async function loadMotionMap() {
  const map = {};
  try {
    const response = await fetch(`${BASE_URL}/api/plugins`);
    const data = await response.json();
    for (const item of pluginItems(data)) {
      if (!item || typeof item !== 'object') continue;
      const id = item.id || item.slug;
      const motion = item.manifest?.od?.preview?.motion;
      if (id && (motion === 'scroll' || motion === 'deck' || motion === 'static')) {
        map[id] = motion;
      }
    }
  } catch {
    // A missing motion map only disables author hints; preview discovery still runs.
  }
  return map;
}

function deckSignal(cap) {
  const parts = [location.hash];
  const elements = document.querySelectorAll('*');
  const count = Math.min(elements.length, cap || 600);
  for (let index = 0; index < count; index += 1) {
    const element = elements[index];
    const rect = element.getBoundingClientRect();
    if (rect.width > window.innerWidth * 1.5 || rect.height > window.innerHeight * 1.5) {
      parts.push(getComputedStyle(element).transform);
    }
    if (element.scrollWidth > element.clientWidth + 4) parts.push(`sl${element.scrollLeft}`);
  }
  const active = document.querySelector(
    '.active,.is-active,[aria-current="true"],[data-active="true"]',
  );
  if (active) parts.push((active.id || '') + (active.className || ''));
  return parts.join('|').slice(0, 4000);
}

async function driveDeck(page, driver) {
  if (driver === 'arrow') {
    await page.keyboard.press('ArrowRight');
    return;
  }
  if (driver === 'wheel') {
    await page.evaluate(() => {
      const event = () => new WheelEvent('wheel', { deltaY: 800, bubbles: true, cancelable: true });
      (document.querySelector('#deck,main,section') || document.body).dispatchEvent(event());
      window.dispatchEvent(event());
    });
    return;
  }
  await page.evaluate(() => {
    const button = document.querySelector(
      '[class*="next" i],[aria-label*="next" i],[data-dir="next"],.arrow-right,.next',
    );
    if (button) button.click();
  });
}

async function probeDeckDriver(page) {
  const initial = await page.evaluate(deckSignal, DECK_SCAN_CAP);
  await driveDeck(page, 'arrow');
  await sleep(900);
  if ((await page.evaluate(deckSignal, DECK_SCAN_CAP)) !== initial) return 'arrow';
  await driveDeck(page, 'wheel');
  await sleep(900);
  if ((await page.evaluate(deckSignal, DECK_SCAN_CAP)) !== initial) return 'wheel';
  return null;
}

async function walkSlides(page, driver) {
  if (!driver) return SLIDE_MS;
  const started = Date.now();
  for (let slide = 0; slide < MAX_SLIDES; slide += 1) {
    if (Date.now() - started > MAX_WALK_MS) break;
    const before = await page.evaluate(deckSignal, DECK_SCAN_CAP);
    await driveDeck(page, driver);
    await sleep(SLIDE_MS);
    if ((await page.evaluate(deckSignal, DECK_SCAN_CAP)) === before) break;
  }
  return Math.max(SLIDE_MS, Date.now() - started);
}

async function waitForVisualResources(page) {
  try {
    await page.evaluate((capMs) => {
      const cap = new Promise((resolve) => setTimeout(resolve, capMs));
      const fonts = document.fonts
        ? document.fonts.ready
            .catch(() => {})
            .then(() =>
              Promise.all(
                Array.from(document.fonts).map((font) =>
                  font.status === 'loaded' ? null : font.load().catch(() => {}),
                ),
              ),
            )
            .then(() => document.fonts.ready)
            .catch(() => {})
        : Promise.resolve();
      const images = Array.from(document.images)
        .filter((image) => !image.complete)
        .map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }),
        );
      const videos = Array.from(document.querySelectorAll('video')).map((video) => {
        try {
          video.muted = true;
          const promise = video.play();
          if (promise?.catch) promise.catch(() => {});
        } catch {
          // loadeddata below is still enough for a poster-like first frame.
        }
        if (video.readyState >= 2) return Promise.resolve();
        return new Promise((resolve) => {
          video.addEventListener('loadeddata', resolve, { once: true });
          video.addEventListener('error', resolve, { once: true });
        });
      });
      const backgroundUrls = new Set();
      document.querySelectorAll('*').forEach((element) => {
        const background = getComputedStyle(element).backgroundImage;
        if (!background || background === 'none') return;
        const pattern = /url\((['"]?)(.*?)\1\)/g;
        let match;
        while ((match = pattern.exec(background))) {
          if (match[2] && !match[2].startsWith('data:')) backgroundUrls.add(match[2]);
        }
      });
      const backgrounds = Array.from(backgroundUrls).map(
        (url) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = image.onerror = resolve;
            image.src = url;
          }),
      );
      return Promise.race([cap, Promise.all([fonts, ...images, ...videos, ...backgrounds])]);
    }, 12000);
  } catch {
    // Timed-out resources should not fail the whole bake.
  }
  await sleep(600);
}

async function preparePage(browser, id) {
  const page = await browser.newPage();
  await page.setViewport({ width: RENDER_W, height: VIEW_H, deviceScaleFactor: 1 });
  try {
    const response = await page.goto(`${BASE_URL}/api/plugins/${encodeURIComponent(id)}/preview`, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    if (!response || !response.ok()) {
      await page.close();
      return { skipped: `status ${response ? response.status() : 'none'}` };
    }
  } catch (error) {
    await page.close();
    return { skipped: `load ${error.message}` };
  }
  await sleep(1000);
  return { page };
}

async function chooseMode(page, motion) {
  if (motion === 'scroll' || motion === 'static') return { mode: motion, deckDriver: null };
  if (motion === 'deck') return { mode: 'deck', deckDriver: await probeDeckDriver(page) };
  const verticallyScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight * 1.15,
  );
  if (verticallyScrollable) return { mode: 'scroll', deckDriver: null };
  const deckDriver = await probeDeckDriver(page);
  return { mode: deckDriver ? 'deck' : 'static', deckDriver };
}

async function lazyLoadPage(page) {
  await page.evaluate(async () => {
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y <= height; y += Math.round(window.innerHeight * 0.8)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
  });
}

async function bakeOne(browser, id, hash, motion) {
  const prepared = await preparePage(browser, id);
  if (prepared.skipped) return { id, skipped: prepared.skipped };
  const page = prepared.page;
  const { mode, deckDriver } = await chooseMode(page, motion);
  const isDeck = mode === 'deck';
  const isStatic = mode === 'static';
  let capW = RENDER_W;
  let capH = VIEW_H;

  if (isDeck) {
    capW = DECK_W;
    capH = DECK_H;
    await page.setViewport({ width: capW, height: capH, deviceScaleFactor: 1 });
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch {
      // Continue with the loaded document if reload races a custom preview.
    }
    await sleep(1000);
  }

  await lazyLoadPage(page);
  await waitForVisualResources(page);

  const frameDir = path.join(OUT, `.frames-${safeFilePart(id)}`);
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });

  const client = await page.createCDPSession();
  const frames = [];
  client.on('Page.screencastFrame', async (event) => {
    frames.push({ data: event.data, ts: event.metadata.timestamp });
    try {
      await client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    } catch {
      // A late ack after stopScreencast is harmless.
    }
  });

  const maxY =
    isDeck || isStatic
      ? 0
      : await page.evaluate(() =>
          Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
        );
  const windowScrolls =
    maxY > 0 &&
    (await page.evaluate(() => {
      const before = window.scrollY || document.documentElement.scrollTop;
      window.scrollTo(0, 160);
      const moved = (window.scrollY || document.documentElement.scrollTop) > before + 40;
      window.scrollTo(0, 0);
      return moved;
    }));

  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 80,
    everyNthFrame: 1,
    maxWidth: capW,
    maxHeight: capH,
  });
  await sleep(HOLD_MS);

  let durationMs;
  if (isDeck) {
    durationMs = await walkSlides(page, deckDriver);
  } else if (maxY <= 0) {
    durationMs = 2500;
    await sleep(durationMs);
  } else {
    durationMs = Math.min(MAX_PAN, Math.round(maxY / VELOCITY));
    if (windowScrolls) {
      await page.evaluate(
        (duration, yMax) =>
          new Promise((resolve) => {
            let start = null;
            function step(timestamp) {
              if (start === null) start = timestamp;
              const elapsed = Math.min(1, (timestamp - start) / duration);
              window.scrollTo(0, Math.round(yMax * elapsed));
              if (elapsed < 1) requestAnimationFrame(step);
              else resolve();
            }
            requestAnimationFrame(step);
          }),
        durationMs,
        maxY,
      );
    } else {
      await page.mouse.move(Math.round(capW / 2), Math.round(capH / 2));
      const tick = 40;
      const perTick = Math.max(8, Math.round(maxY / (durationMs / tick)));
      const start = Date.now();
      while (Date.now() - start < durationMs) {
        await page.mouse.wheel({ deltaY: perTick });
        await sleep(tick);
      }
    }
  }

  await client.send('Page.stopScreencast');
  await page.close();

  if (frames.length < 5) {
    rmSync(frameDir, { recursive: true, force: true });
    return { id, skipped: `frames ${frames.length}` };
  }

  const lines = [];
  for (let index = 0; index < frames.length; index += 1) {
    const framePath = path.join(frameDir, `f-${String(index).padStart(4, '0')}.jpg`);
    writeFileSync(framePath, Buffer.from(frames[index].data, 'base64'));
    if (index > 0) lines.push(`duration ${(frames[index].ts - frames[index - 1].ts).toFixed(4)}`);
    lines.push(`file '${framePath}'`);
  }
  lines.push(`file '${path.join(frameDir, `f-${String(frames.length - 1).padStart(4, '0')}.jpg`)}'`);
  const listPath = path.join(frameDir, 'list.txt');
  writeFileSync(listPath, lines.join('\n'));

  const slug = hash ? `${safeFilePart(id)}.${hash}` : safeFilePart(id);
  const video = path.join(OUT, `${slug}.mp4`);
  const poster = path.join(OUT, `${slug}.poster.jpg`);
  const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', ...args], { stdio: 'ignore' });
  ffmpeg([
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-vf',
    `scale=${OUT_W}:-2,fps=${FPS}`,
    '-c:v',
    'libx264',
    '-crf',
    String(CRF),
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-r',
    String(FPS),
    '-an',
    video,
  ]);
  ffmpeg([
    '-i',
    path.join(frameDir, 'f-0000.jpg'),
    '-vf',
    `scale=${OUT_W}:-2`,
    '-q:v',
    '5',
    '-frames:v',
    '1',
    poster,
  ]);
  rmSync(frameDir, { recursive: true, force: true });

  return {
    id,
    durationMs,
    holdMs: HOLD_MS,
    video: `${slug}.mp4`,
    poster: `${slug}.poster.jpg`,
    bytes: statSync(video).size,
    posterBytes: statSync(poster).size,
  };
}

mkdirSync(OUT, { recursive: true });
const ids = await discoverIds();
const motionMap = await loadMotionMap();
console.log(`baking ${ids.length} plugin previews from ${BASE_URL} -> ${OUT}`);

const browser = await puppeteer.launch({
  executablePath: resolveChrome(),
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const manifestPath = path.join(OUT, 'manifest.json');
  const previews = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')).previews || {}
    : {};
  let ok = 0;
  let skip = 0;
  let reused = 0;

  for (const id of ids) {
    const started = Date.now();
    let hash = null;
    try {
      const response = await fetch(`${BASE_URL}/api/plugins/${encodeURIComponent(id)}/preview`);
      const html = await response.text();
      hash = createHash('sha256')
        .update(html)
        .update(` ${BAKE_VERSION} ${motionMap[id] || ''}`)
        .digest('hex')
        .slice(0, 16);
    } catch {
      // The bake path below will report the load failure.
    }

    const previous = previews[id];
    const filesPresent =
      process.env.PREVIEW_REMOTE === '1' ||
      (previous &&
        existsSync(path.join(OUT, previous.video)) &&
        existsSync(path.join(OUT, previous.poster)));
    if (hash && previous && previous.hash === hash && filesPresent) {
      reused += 1;
      console.log(`  = ${id}: unchanged, reused`);
      continue;
    }

    let result;
    try {
      result = await bakeOne(browser, id, hash, motionMap[id]);
    } catch (error) {
      result = { id, skipped: `error ${error.message}` };
    }
    if (result.skipped) {
      skip += 1;
      console.log(`  ~ ${id}: skip (${result.skipped})`);
      continue;
    }

    previews[id] = {
      video: result.video,
      poster: result.poster,
      durationMs: result.durationMs,
      holdMs: result.holdMs,
      hash,
    };
    ok += 1;
    console.log(
      `  + ${id}: ${(result.bytes / 1024).toFixed(0)}KB mp4, ${(result.posterBytes / 1024).toFixed(0)}KB poster (${((Date.now() - started) / 1000).toFixed(1)}s)`,
    );
    writeFileSync(manifestPath, JSON.stringify({ generatedAt: null, previews }, null, 2));
  }

  console.log(`done: ${ok} baked, ${reused} reused (unchanged), ${skip} skipped -> ${manifestPath}`);
} finally {
  await browser.close();
}
