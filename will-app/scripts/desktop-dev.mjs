import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const server = await createServer({
  root, server: { host: '127.0.0.1', port: Number(process.env.WILL_DEV_PORT || 5177), strictPort: true },
})
await server.listen()
const address = server.httpServer.address()
const url = `http://127.0.0.1:${address.port}/`
console.log(`Will PC development: ${url}`)
const child = spawn(require('electron'), [root, ...process.argv.slice(2)], {
  stdio: 'inherit', windowsHide: false,
  env: { ...process.env, WILL_DEV_SERVER_URL: url },
})
let stopping = false
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  child.kill()
  await server.close()
  process.exitCode = code
}
child.once('exit', code => void stop(code || 0))
child.once('error', error => { console.error(error); void stop(1) })
process.once('SIGINT', () => void stop())
process.once('SIGTERM', () => void stop())
