import { AuthState, BasedClient } from '..'
import { join } from 'path'
import gzip from 'zlib'
import fs from 'fs'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const rm = promisify(fs.rm)
const stat = promisify(fs.stat)

const compress = promisify(gzip.gzip)
const unzip = promisify(gzip.gunzip)

const writeToStorage = (client: BasedClient) => {
  if (!client.storageBeingWritten) {
    client.storageBeingWritten = setTimeout(async () => {
      const file = join(
        client.storagePath,
        'based-' + client.storageEnvKey + '.storage'
      )
      // id, c, value
      const cache: any[] = []
      client.cache.forEach((c, id) => {
        if (c.persistent) {
          cache.push(id, c.checksum, c.value)
        }
      })
      const f: { cache: any[]; authState?: AuthState } = { cache }
      if (client.authState.persistent) {
        f.authState = client.authState
      }
      client.storageBeingWritten = null
      await writeFile(file, await compress(JSON.stringify(f)))
    }, 1e3)
  }
}

export const initStorageNode = async (client: BasedClient) => {
  const file = join(
    client.storagePath,
    'based-' + client.storageEnvKey + '.storage'
  )
  console.info('    [Based-client] Start persistent storage')
  console.info('   ', file)
  console.info('')
  const s = await stat(file).catch(() => null)
  try {
    if (s) {
      const r = await readFile(file)
      const unpacked = await unzip(r)
      const c = JSON.parse(unpacked.toString())
      try {
        for (let i = 0; i < c.length - 3; i += 3) {
          // go go go
        }
      } catch (err) {
        console.error('    [Based-client] Corrupt persistent storage - clear')
        clearStorageNode(client)
      }
    } else {
      const x = await compress(JSON.stringify({ cache: [] }))
      await writeFile(file, x).catch((err) => {
        if (err) {
          console.error(
            '     [Based-client] Failed creating persistent storage, cannot write file'
          )
          client.storagePath = null
        }
      })
    }
  } catch (err) {}
}

export const clearStorageNode = async (client: BasedClient) => {
  const file = join(
    client.storagePath,
    'based-' + client.storageEnvKey + '.storage'
  )
  clearTimeout(client.storageBeingWritten)
  return rm(file)
}

export const removeStorageNode = (
  client: BasedClient,
  // eslint-disable-next-line
  key: string
) => {
  writeToStorage(client)
}

export const setStorageNode = (
  client: BasedClient,
  // eslint-disable-next-line
  key: string,
  // eslint-disable-next-line
  value: any
) => {
  writeToStorage(client)
}
