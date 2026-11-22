// End-to-end run against the real built app (electron + preload + main + renderer),
// with providers pointed at e2e/fake-server.mjs. Run via: npm run test:e2e (needs a display, e.g. xvfb-run).
import { _electron as electron } from 'playwright-core'
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startFakeServer, BROKEN_WITH_FALLBACK } from './fake-server.mjs'

const root = path.resolve(import.meta.dirname, '..')
const shots = path.join(root, 'e2e/.artifacts')
mkdirSync(shots, { recursive: true })

const certDir = mkdtempSync(path.join(tmpdir(), 'nd-cert-'))
execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${certDir}/k.pem -out ${certDir}/c.pem -days 2 -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1"`, { stdio: 'ignore' })
const server = await startFakeServer({ key: readFileSync(`${certDir}/k.pem`), cert: readFileSync(`${certDir}/c.pem`) })
const userData = mkdtempSync(path.join(tmpdir(), 'nd-user-'))

let app
let page
const pageErrors = []
const consoleErrors = []
const results = []

async function launch() {
  app = await electron.launch({
    cwd: root,
    args: [path.join(root, 'out/main/index.js'), '--no-sandbox', '--disable-gpu', '--ignore-certificate-errors', `--user-data-dir=${userData}`],
    env: { ...process.env, NEEDLEDROP_DEEZER_BASE: `${server.base}/deezer`, NEEDLEDROP_ITUNES_BASE: `${server.base}/itunes` }
  })
  page = await app.firstWindow()
  page.on('pageerror', (e) => pageErrors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 })
}

async function step(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log('PASS', name)
  } catch (err) {
    results.push({ name, ok: false })
    console.log('FAIL', name, '\n     ', String(err.message).split('\n')[0])
    try {
      await page.screenshot({ path: path.join(shots, `FAIL-${name.replace(/\W+/g, '-')}.png`) })
    } catch {}
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const nav = (label) => page.click(`nav[aria-label="Main"] button:has-text("${label}")`)
const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`) })

async function playOutTournament() {
  const done = page.locator('button:has-text("Full bracket")')
  let skips = 0
  let picks = 0
  let shotTaken = false
  for (let i = 0; i < 40; i++) {
    if (await done.count()) return { skips, picks }
    await page.waitForSelector('section[aria-label^="Side A"], button:has-text("Full bracket")', { timeout: 15000 })
    if (await done.count()) return { skips, picks }
    if (!shotTaken) {
      shotTaken = true
      await page.waitForTimeout(500)
      await shot('04-stage')
    }
    // Wait until both songs have been tried (played or reported unavailable).
    await page.waitForFunction(
      () => {
        const a = document.querySelector('section[aria-label^="Side A"]')
        const b = document.querySelector('section[aria-label^="Side B"]')
        if (!a || !b) return true
        const tried = (s) => (!s.textContent.includes('Not played yet') || s.textContent.includes('No preview could be played')) && !s.querySelector('[role="status"]')
        return tried(a) && tried(b)
      },
      null,
      { timeout: 20000 }
    )
    const skip = page.locator('button:has-text("Skip it")')
    if (await skip.count()) {
      await skip.first().click()
      skips++
    } else {
      await page.locator('button:has-text("Pick this one")').nth(i % 2).click()
      picks++
    }
    await page.waitForTimeout(1300)
  }
  throw new Error('tournament did not finish')
}

await launch()

await step('app starts with isolated renderer and the preload API', async () => {
  expect((await page.title()) === 'Needledrop', 'window title')
  const env = await page.evaluate(() => ({
    api: typeof window.api?.music?.searchTracks,
    require: typeof window.require,
    process: typeof window.process
  }))
  expect(env.api === 'function', 'window.api missing')
  expect(env.require === 'undefined' && env.process === 'undefined', 'node leaked into renderer')
  expect(await page.locator('h1:has-text("Which song wins?")').isVisible(), 'home heading')
  await shot('01-home')
})

await step('discover: search songs, play a preview, progress moves, it ends', async () => {
  await nav('Discover')
  await page.fill('input[type="search"]', 'neon')
  await page.waitForSelector('li:has-text("Midnight Static")', { timeout: 10000 })
  await shot('02-discover')
  await page.locator('button[aria-label^="Play Midnight Static"]').first().click()
  await page.waitForSelector('footer button[aria-label="Pause"]', { timeout: 10000 })
  await page.waitForTimeout(700)
  const pos = Number(await page.locator('footer input[aria-label="Song position"]').inputValue())
  expect(pos > 0.2, `position did not advance (${pos})`)
  await page.waitForSelector('footer button[aria-label="Play"]', { timeout: 15000 })
  expect([...server.hits.keys()].some((k) => k.startsWith('/audio/1')), 'audio file was never requested')
})

await step('discover: artist and album detail views list playable songs', async () => {
  await page.click('button[role="tab"]:has-text("Artists")')
  await page.waitForSelector('button:has-text("Neon Harbor")', { timeout: 10000 })
  await page.click('button:has-text("Neon Harbor")')
  await page.waitForSelector('h2:has-text("Neon Harbor")')
  expect((await page.locator('li:has-text("Midnight Static")').count()) >= 1, 'artist top songs missing')
  await page.click('button:has-text("Back to results")')
  await page.click('button[role="tab"]:has-text("Albums")')
  await page.waitForSelector('button:has-text("Midnight Static")', { timeout: 10000 })
  await page.click('button:has-text("Midnight Static")')
  await page.waitForSelector('li:has-text("Paper Moons")', { timeout: 10000 })
  expect((await page.locator('main li').count()) === 5, 'album should list 5 tracks')
})

await step('tournament: build a 17-song bracket from three artists', async () => {
  await nav('Tournaments')
  await page.click('[role="radio"]:has-text("Hits from artists")')
  for (const name of ['Neon', 'Glass', 'Glitch']) {
    await page.fill('input[type="search"]', name)
    await page.waitForSelector(`button[aria-pressed]:has-text("${name}")`, { timeout: 10000 })
    await page.click(`button[aria-pressed]:has-text("${name}")`)
  }
  await page.waitForSelector('text=3 picks')
  await page.click('button:has-text("Custom")')
  await page.fill('input[type="number"]', '17')
  await shot('03-setup')
  await page.click('button:has-text("Build the bracket")')
  await page.waitForSelector('section[aria-label^="Side A"]', { timeout: 20000 })
  expect(await page.locator('h1:has-text("Round of 32")').isVisible(), '17 contestants should start in a Round of 32')
  expect(await page.locator('text=left out').count() > 0, 'songs without a preview should be reported')
})

let outcome
await step('tournament: play every match to a champion (skips, byes, fallback)', async () => {
  outcome = await playOutTournament()
  await page.waitForSelector('text=Champion', { timeout: 10000 })
  expect(outcome.skips >= 1, 'an unplayable song should have been skippable')
  await shot('05-results')
})

await step('providers: broken preview URL fell back to iTunes', async () => {
  const searched = [...server.hits.keys()].some((k) => k.startsWith('itunes-search:') && k.includes('Glitch Parade') && k.includes('Signal Fire'))
  expect(searched, 'iTunes fallback search never happened')
  expect(server.hits.get(`/audio/it-${BROKEN_WITH_FALLBACK}.wav`) >= 1, 'fallback audio was never played')
})

await step('results: bracket drawer and match history', async () => {
  await page.click('button:has-text("Full bracket")')
  await page.waitForSelector('[role="dialog"] >> text=Final', { timeout: 5000 })
  await shot('06-bracket')
  await page.click('[role="tab"]:has-text("Match history")')
  expect((await page.locator('[role="dialog"] ol li').count()) === 16, 'history should list 16 decided matches')
  await page.click('button[aria-label="Close"]')
})

await step('home: champion recorded in history', async () => {
  await nav('Home')
  await page.waitForSelector('text=Your champions')
  expect((await page.locator('text=Won a bracket of 17').count()) === 1, 'champion missing on Home')
})

await step('quick start from charts builds a Round of 16', async () => {
  await page.click('button:has-text("Quick 16")')
  await page.waitForSelector('h1:has-text("Round of 16")', { timeout: 20000 })
  for (let i = 0; i < 2; i++) {
    await page.waitForSelector('button:has-text("Pick this one")')
    await page.locator('button:has-text("Pick this one")').first().click()
    await page.waitForTimeout(1300)
  }
  expect(await page.locator('text=Match 3 of 8').count() > 0, 'should be on match 3 of 8')
})

await step('settings: volume and source toggles', async () => {
  await nav('Settings')
  await page.locator('main input[aria-label="Volume"]').fill('0.3')
  await page.locator('label:has(span:text-is("Apple iTunes")) input[type="checkbox"]').uncheck()
  expect(await page.locator('label:has(span:text-is("Deezer")) input[type="checkbox"]').isDisabled(), 'last source must not be switchable off')
  await page.locator('label:has(span:text-is("Apple iTunes")) input[type="checkbox"]').check()
  await shot('07-settings')
})

await app.close()
await launch()

await step('restart: tournament in progress, history and volume survive', async () => {
  expect(await page.locator('text=Tournament in progress').isVisible(), 'in-progress card missing')
  expect((await page.locator('text=Won a bracket of 17').count()) === 1, 'history lost')
  await page.click('button:has-text("Continue")')
  await page.waitForSelector('h1:has-text("Round of 16")')
  expect((await page.locator('text=Match 3 of 8').count()) > 0, 'progress lost')
  await nav('Settings')
  expect((await page.locator('main input[aria-label="Volume"]').inputValue()) === '0.3', 'volume lost')
})

await step('no uncaught errors in the renderer', async () => {
  const real = consoleErrors.filter((m) => !/404|Failed to load resource/.test(m))
  expect(pageErrors.length === 0, `page errors: ${pageErrors.join(' | ')}`)
  expect(real.length === 0, `console errors: ${real.join(' | ')}`)
})

await app.close()
await server.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} e2e steps passed`)
process.exit(failed.length ? 1 : 0)
