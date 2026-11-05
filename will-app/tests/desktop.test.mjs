import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { createRequire } from 'node:module'

const { assetPath, devServerUrl, allowedNavigation } = createRequire(import.meta.url)('../electron/asset-path.cjs')
const root = path.resolve('desktop-test-assets')

test('desktop assets resolve only within the fixed application origin and directory', () => {
  assert.equal(assetPath('will://app/', root), path.join(root, 'index.html'))
  assert.equal(assetPath('will://app/assets/index.js?v=1', root), path.join(root, 'assets/index.js'))
  for (const url of [
    'https://app/index.html', 'will://other/index.html', 'will://user:password@app/index.html',
    'will://app:123/index.html', 'will://app/%2e%2e%2foutside.txt',
    'will://app/%2e%2e%5coutside.txt', 'will://app/%zz',
  ]) assert.throws(() => assetPath(url, root), url)
})

test('desktop development loading permits only an explicit loopback HTTP origin', () => {
  assert.equal(devServerUrl('http://127.0.0.1:5177'), 'http://127.0.0.1:5177/')
  for (const url of [
    'https://example.com/', 'http://localhost:5177/', 'file:///index.html',
    'http://name:secret@127.0.0.1:5177/', 'http://127.0.0.1:5177/path', 'http://127.0.0.1:5177/?q=test',
  ]) assert.throws(() => devServerUrl(url), url)
})

test('desktop navigation rejects other schemes even when URL origins are null', () => {
  assert.equal(allowedNavigation('will://app/#calendar', 'will://app/'), true)
  assert.equal(allowedNavigation('http://127.0.0.1:5177/', 'http://127.0.0.1:5177/'), true)
  for (const url of ['file:///index.html', 'other://app/', 'will://other/', 'will://user@app/', 'bad url']) {
    assert.equal(allowedNavigation(url, 'will://app/'), false)
  }
  assert.equal(allowedNavigation('http://127.0.0.1:5178/', 'http://127.0.0.1:5177/'), false)
})
