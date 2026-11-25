// Gilded Sidebar — Host-side entry.
//
// This package is BOTH an installable DSH bundle (dsh.bundle.patch) and a
// pure-CSS skin asset set consumed by @linxin666/dsh-client-ui-skin-center.
// The skin center is the only skin loader: it does NOT scan node_modules, it
// only merges its built-in skins with `$DSH_HOME/skins/<id>/` user directories.
// Installing the tarball alone therefore leaves the skin invisible in the Web
// skin center.
//
// So on activation we self-deploy the five asset files into the very same user
// skins directory the skin center reads. That makes a plain GitHub tarball
// install sufficient: download -> pnpm install -> apply() -> skin center
// catalog picks the directory up (it invalidates by directory fingerprint, so
// a page refresh / reopening the card is enough; no restart needed).
//
// Rules of this deploy, learned the hard way:
//  - Resolve the directory exactly like the skin center (same host process,
//    same env): DSH_SKINS_HOME > DSH_SKINS_DIR > DSH_HOME/skins > ~/.dsh/skins.
//  - Idempotent: compare bytes and only write changed files. The skin center's
//    catalog cache keys on skin.json mtime, so needless rewrites would thrash
//    it on every activation.
//  - Never throw: a failed deploy must NEVER make the plugin activation fail
//    (an activation failure rolls the whole install back: MUTATION_FAILED).

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const SKIN_ID = 'gilded-sidebar'
const ASSETS = ['skin.json', 'skin.css', 'patches.css', 'light.png', 'dark.png']

/** Same precedence as skin-center's userSkinsDir()/resolveHarnessHome(). */
function userSkinsDir(env) {
  const home = env.DSH_SKINS_HOME
  if (home && home.trim() !== '') return resolve(home.trim())
  const dir = env.DSH_SKINS_DIR
  if (dir && dir.trim() !== '') return resolve(dir.trim())
  const harnessHome = (env.DSH_HOME && env.DSH_HOME.trim() !== '')
    ? env.DSH_HOME.trim()
    : join(homedir(), '.dsh')
  return join(resolve(harnessHome), 'skins')
}

function sameBytes(a, b) {
  try {
    if (!existsSync(b)) return false
    if (statSync(a).size !== statSync(b).size) return false
    return readFileSync(a).equals(readFileSync(b))
  } catch {
    return false
  }
}

function deploy(packageDir, env) {
  const dest = join(userSkinsDir(env), SKIN_ID)
  let changed = 0
  for (const name of ASSETS) {
    const src = join(packageDir, name)
    if (!existsSync(src)) continue
    const target = join(dest, name)
    if (sameBytes(src, target)) continue
    if (changed === 0) mkdirSync(dest, { recursive: true })
    copyFileSync(src, target)
    changed += 1
  }
  return { dest, changed }
}

export function apply() {
  try {
    const packageDir = dirname(fileURLToPath(import.meta.url))
    deploy(packageDir, process.env)
  } catch {
    // Swallow: deploying the skin is best-effort and must never break the
    // bundle activation. The skin center will simply show nothing.
  }
}
