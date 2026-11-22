// Smoke test of the PACKAGED app (asar, isPackaged=true). Providers cannot be redirected here,
// so this checks startup, preload, CSP/asset loading and the offline error path.
import { _electron as electron } from 'playwright-core'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const exe = process.argv[2]
if (!exe) throw new Error('usage: node e2e/packaged-smoke.mjs <path to packaged executable>')
mkdirSync(path.join(root, 'e2e/.artifacts'), { recursive: true })

const app = await electron.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-gpu', `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'nd-pk-'))}`] })
const page = await app.firstWindow()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

let failed = 0
const check = (name, ok, extra = '') => {
  console.log(ok ? 'PASS' : 'FAIL', name, extra)
  if (!ok) failed++
}

await page.waitForSelector('nav[aria-label="Main"]', { timeout: 20000 })
check('title', (await page.title()) === 'Needledrop')
const info = await page.evaluate(() => window.api.app.getInfo())
check('packaged build reports isPackaged', info.packaged === true, JSON.stringify(info))
check('fonts and styles loaded (display font applied)', await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily.includes('Bricolage')))
check('CSP meta present in production', (await page.locator('meta[http-equiv="Content-Security-Policy"]').count()) === 1)

await page.click('nav[aria-label="Main"] button:has-text("Discover")')
await page.fill('input[type="search"]', 'daft punk')
await page.waitForSelector('[role="alert"], li:has-text("Daft")', { timeout: 40000 })
const alert = await page.locator('[role="alert"]').count()
check('offline or blocked network shows a readable error with a retry button', alert === 1 && (await page.locator('button:has-text("Try again")').count()) === 1, alert ? await page.locator('[role="alert"]').innerText() : 'results came back')
await page.screenshot({ path: path.join(root, 'e2e/.artifacts/08-packaged-offline.png') })
check('no uncaught page errors', errors.filter((m) => !/Failed to load resource|ERR_/.test(m)).length === 0, errors.join(' | ').slice(0, 300))

await app.close()
process.exit(failed ? 1 : 0)
