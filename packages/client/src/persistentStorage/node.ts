import { AuthState, BasedClient } from '..'
import { join } from 'node:path'
import gzip from 'node:zlib'
import fs from 'node:fs/promises'

// total gets gzipped

const writeToStorage = (client: BasedClient) => {
  if (!client.storageBeingWritten) {
    client.storageBeingWritten = setTimeout(() => {
      client.storageBeingWritten = null
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

      fs.writeFile(client.storagePath, JSON.stringify(f))
    }, 1e3)
    // just write the cache and authState
    //   client.storageStaged
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
  const stat = await fs.stat(file).catch(() => null)
  if (stat) {
    //
  } else {
    await fs.writeFile(file, '').catch((err) => {
      if (err) {
        console.error(
          '     [Based-client] Failed creating persistent storage, cannot write file'
        )
        // Do not try again
        client.storagePath = null
      }
    })
  }
}

export const clearStorageNode = async (client: BasedClient) => {
  clearTimeout(client.storageBeingWritten)
  return fs.rm(client.storagePath)
}

export const removeStorageNode = (client: BasedClient, key: string) => {
  console.info('removeStorageNode', key)
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
