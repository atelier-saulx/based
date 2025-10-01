export const getHostAndPortFromUrl = (url: string) => {
  const m = /^(http|ws)s?:\/\/([^/]*?)(?::(\d*))?\//.exec(url)
  if (m) {
    return { protocol: m[1], host: m[2], port: m[3] }
  }
  return null
}

export const discoverUrlToRestUrl = (discoverUrl: string) => {
  const { protocol, host, port } = getHostAndPortFromUrl(discoverUrl)
  return `${
    protocol === 'wss' || protocol === 'https' ? 'https' : 'http'
  }://${host}:${port}`
}
