import { dirname, join } from 'node:path'
import { createWriteStream } from 'node:fs'
import { stat, mkdir, readFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { BasedClient, encodeAuthState } from '@based/client'
import { hash } from '@based/hash'
import { SOURCEMAPS_DIR } from '../constants.js'
import { getHostAndPortFromUrl } from '../utils/index.js'

const exists = (path: string) =>
  stat(path)
    .then(() => true)
    .catch(() => false)

const downloadInProgress = new Map<number, Promise<void>>()
const _downloadFile = async (url: string, path: string) => {
  const folder = dirname(path)
  if (!(await exists(folder))) {
    await mkdir(folder, { recursive: true })
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 5e3)
  let response: Awaited<ReturnType<typeof fetch>>
  try {
    response = await fetch(url, {
      signal: controller.signal,
    })
  } catch (error) {
    return null
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    throw new Error('Error downloading ' + response.statusText)
  }
  await pipeline(response.body, createWriteStream(path))
}

const downloadFile = async (url: string, path: string) => {
  const key = hash([url, path])
  if (!downloadInProgress.has(key)) {
    downloadInProgress.set(
      key,
      _downloadFile(url, path).then((res) => {
        downloadInProgress.delete(key)
        return res
      }),
    )
  }
  return downloadInProgress.get(key)
}

const sourcemapsCache: {
  [key: string]: any
} = {}

let envAdminHubHost: string | undefined
let envAdminHubPort: string | undefined

export const getSourcemap = async (
  client: BasedClient,
  checksum: string,
  envId: string,
) => {
  const key = `${envId}-${checksum}`
  if (!sourcemapsCache[key]) {
    const cachedSourcemapPath = join(
      SOURCEMAPS_DIR,
      envId + '-' + checksum + '.map',
    )
    if (!(await exists(cachedSourcemapPath))) {
      if (!envAdminHubHost) {
        ;({ host: envAdminHubHost, port: envAdminHubPort } =
          getHostAndPortFromUrl(await client.url()))
      }

      const url = `http://${envAdminHubHost}:${
        envAdminHubPort || '80'
      }/based:get-sourcemap?checksum=${checksum}&envId=${envId}&token=${encodeAuthState(client.authState)}`
      try {
        await downloadFile(url, cachedSourcemapPath)
      } catch (error) {
        if (error.message !== 'Error downloading Forbidden') {
          console.error(error)
        }
        return null
      }
    }
    try {
      sourcemapsCache[key] = JSON.parse(
        (await readFile(cachedSourcemapPath)).toString(),
      )
    } catch (error) {
      return null
    }
  }
  return sourcemapsCache[key]
}
