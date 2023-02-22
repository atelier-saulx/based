import { AuthState, BasedClient } from '..'
import { join } from 'path'
import gzip from 'zlib'
import fs from 'fs'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const rm = promisify(fs.rm)
const compress = promisify(gzip.gzip)

export const store = async (client: BasedClient) => {
  try {
    clearTimeout(client.storageBeingWritten)
    client.storageBeingWritten = null
    const file = join(
      client.storagePath,
      'based-' + client.storageEnvKey + '.storage'
    )
    // [id, checksum, value]
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
  } catch (err) {
    console.error(
      '    [Based-client] Cannot update persistent storage',
      client.storagePath
    )
  }
}

const writeToStorage = (client: BasedClient) => {
  if (!client.storageBeingWritten) {
    client.storageBeingWritten = setTimeout(() => store(client), 5e3)
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
  try {
    const s = fs.statSync(file)
    if (s) {
      try {
        const r = fs.readFileSync(file)
        const unpacked = gzip.gunzipSync(r)
        const c = JSON.parse(unpacked.toString())
        for (let i = 0; i < c.cache.length - 2; i += 3) {
          client.cache.set(c.cache[i], {
            checksum: c.cache[i + 1],
            value: c.cache[i + 2],
            persistent: true,
          })
        }
        if (c.authState) {
          client.setAuthState(c.authState)
        }
      } catch (err) {
        console.error('    [Based-client] Corrupt persistent storage - clear')
        await clearStorageNode(client)
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
