const path = require('node:path')

function assetPath(rawUrl, root) {
  const url = new URL(rawUrl)
  if (url.protocol !== 'will:' || url.hostname !== 'app' || url.username || url.password || url.port) {
    throw new Error('Unknown application origin')
  }
  const pathname = decodeURIComponent(url.pathname)
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
  const relative = path.relative(root, target)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Asset outside application')
  }
  return target
}

function devServerUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Development server must use a local HTTP origin')
  }
  return url.href
}

function allowedNavigation(value, start) {
  try {
    const url = new URL(value)
    const expected = new URL(start)
    return url.protocol === expected.protocol && url.host === expected.host
      && !url.username && !url.password
  } catch {
    return false
  }
}

module.exports = { assetPath, devServerUrl, allowedNavigation }
