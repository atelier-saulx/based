import getPort from 'get-port'
import { networkInterfaces } from 'node:os'
import { getBasedFiles } from './getBasedFiles.js'
import { bundle } from '@based/bundle'

export const dev = async () => {
  devServer()
}

const devServer = async ({ port = 1234 } = {}) => {
  const [devPort, liveReloadPort] = await Promise.all([
    getPort({ port }),
    getPort({ port: 4000 }),
  ])
  const ip = getMyIp()
  const wsURL = `ws://${ip}:${devPort}`
  const staticURL = `http://${ip}:${devPort}/static/`

  process.env.BASED_DEV_SERVER_LOCAL_URL = `http://localhost:${devPort}`
  process.env.BASED_DEV_SERVER_PUBLIC_URL = `http://${ip}:${devPort}`

  // TODO: mapping does not need to come from getBasedFiles()
  const { entryPoints, mapping } = await getBasedFiles()

  const bundled = await bundle({ entryPoints })
  console.log({ bundled }, bundled.result.metafile)
}

export const getMyIp = () => {
  const nets = networkInterfaces()
  const results: Record<string, string[]> = {}

  for (const name in nets) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results[name] ??= []
        results[name].push(net.address)
      }
    }
  }

  let ip = results.en0?.[0]

  if (!ip) {
    for (const k in results) {
      ip = results[k][0]
      if (ip) {
        return ip
      }
    }
  }

  return ip
}
