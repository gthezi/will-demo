import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const { packager } = await import('@electron/packager')
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const electronVersion = require('electron/package.json').version
const output = path.join(root, 'out/windows')
const build = path.join(output, `${pkg.version}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const stage = path.join(build, 'source')
if (path.relative(root, build).startsWith('..')) throw new Error('Output must stay inside the application directory')
await mkdir(stage, { recursive: true })
await cp(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true })
await cp(path.join(root, 'electron'), path.join(stage, 'electron'), { recursive: true })
await writeFile(path.join(stage, 'package.json'), JSON.stringify({
  name: 'will-pc', productName: 'Will PC', version: pkg.version, main: 'electron/main.cjs', author: 'Will PC',
}, null, 2))
const [directory] = await packager({
  dir: stage, out: build, name: 'WillPC', executableName: 'WillPC',
  platform: 'win32', arch: 'x64', electronVersion, asar: true, prune: false,
  download: { checksums: require('electron/checksums.json') },
  appVersion: pkg.version, appCopyright: 'Will PC demo',
  win32metadata: { ProductName: 'Will PC', FileDescription: 'Will PC personal scheduling demo' },
})
const zip = path.join(build, `WillPC-${pkg.version}-windows-x64.zip`)
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File',
  path.join(root, 'scripts/archive-desktop.ps1'), '-Source', directory, '-Destination', zip,
], { stdio: 'inherit', windowsHide: true })
const metadata = {
  version: pkg.version, electronVersion, platform: 'win32', arch: 'x64',
  directory, executable: path.join(directory, 'WillPC.exe'), zip,
  bytes: (await stat(zip)).size, sha256: createHash('sha256').update(await readFile(zip)).digest('hex'),
}
await writeFile(path.join(output, 'latest.json'), JSON.stringify(metadata, null, 2) + '\n')
console.log(JSON.stringify(metadata, null, 2))
