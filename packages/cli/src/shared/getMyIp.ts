import { networkInterfaces } from 'node:os'

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
