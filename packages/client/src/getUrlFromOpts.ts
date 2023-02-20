import { BasedOpts } from './types'
import fetch from 'cross-fetch'

export default async (
  opts: BasedOpts
): Promise<string | (() => Promise<string>)> => {
  if (opts.url) {
    return opts.url
  }

  const discoveryUrls = opts.discoveryUrls || [
    `https://${opts.org}-${opts.project}-${opts.env}.based.io`,
  ]

  for (const hubDiscoveryUrl of discoveryUrls) {
    const dUrl = `${hubDiscoveryUrl}/status?hub=${
      opts.name || '@based/env-hub'
    }&key=${opts.key}`
    const res = await fetch(dUrl)

    if (res.ok) {
      const hubs = (await res.json()) as [string, string][]
      const [hubUrl] = hubs[~~(Math.random() * hubs.length)]
      return `ws://${hubUrl}`
    }
  }
}
