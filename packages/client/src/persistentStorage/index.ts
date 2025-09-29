import { ClientAuthState as AuthState, BasedClient } from '../index.js'
import { join } from 'path'
import { gzip, gunzipSync } from 'node:zlib'
import {
  writeFile as wf,
  rm as rmOrignal,
  readFileSync,
  existsSync,
} from 'node:fs'
import { promisify } from 'node:util'

const writeFile = promisify(wf)
const rm = promisify(rmOrignal)
const compress = promisify(gzip)

const store = async (client: BasedClient) => {
  try {
    clearTimeout(client.storageBeingWritten)
    client.storageBeingWritten = null
    const file = join(
      client.storagePath,
      'based-' + client.storageEnvKey + '.storage',
    )
    const cache: any[] = []
    client.cache.forEach((c, id) => {
      if (c.p) {
        cache.push(id, c.c, c.v)
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
      client.storagePath,
    )
  }
}

const writeToStorage = async (client: BasedClient, instant?: boolean) => {
  if (!client.storageBeingWritten) {
    if (instant) {
      store(client)
    } else {
      client.storageBeingWritten = setTimeout(() => store(client), 5e3)
    }
  } else if (instant) {
    clearTimeout(client.storageBeingWritten)
    await store(client)
  }
}

const initStorageNode = async (client: BasedClient) => {
  const file = join(
    client.storagePath,
    'based-' + client.storageEnvKey + '.storage',
  )
  try {
    const s = existsSync(file)

    if (s) {
      try {
        const r = readFileSync(file)
        const unpacked = gunzipSync(r)
        const c = JSON.parse(unpacked.toString())
        for (let i = 0; i < c.cache.length - 2; i += 3) {
          client.cache.set(c.cache[i], {
            c: c.cache[i + 1],
            v: c.cache[i + 2],
            p: true,
          })
        }
        if (c.authState) {
          client.setAuthState(c.authState).catch(() => {
            console.error('    [Based-client] Invalid authState')
            clearStorageNode(client)
          })
        }
      } catch (err) {
        console.error('    [Based-client] Corrupt persistent storage - clear')
        await clearStorageNode(client)
      }
    } else {
      const x = await compress(JSON.stringify({ cache: [] }))
      await writeFile(file, x).catch((err) => {
        if (err) {
          console.log({ err })
          console.error(
            '     [Based-client] Failed creating persistent storage, cannot write file',
          )
          client.storagePath = null
        }
      })
    }
  } catch (err) {}
}

const clearStorageNode = async (client: BasedClient) => {
  const file = join(
    client.storagePath,
    'based-' + client.storageEnvKey + '.storage',
  )
  clearTimeout(client.storageBeingWritten)
  return rm(file)
}

const removeStorageNode = (client: BasedClient, _key: string) => {
  writeToStorage(client)
}

const setStorageNode = (client: BasedClient) => {
  writeToStorage(client)
}

export const removeStorage = (client: BasedClient, key: string) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }
  if (client.storagePath) {
    removeStorageNode(client, key)
  }
}

export const setStorage = (client: BasedClient, _key: string, _value: any) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }
  if (client.storagePath) {
    setStorageNode(client)
  }
}

export const updateStorage = async (client: BasedClient, instant?: boolean) => {
  if (client.storagePath) {
    return writeToStorage(client, instant)
  }
}

export const initStorage = async (client: BasedClient) => {
  if (client.storagePath) {
    return initStorageNode(client)
  }
}

export const clearStorage = async (client: BasedClient) => {
  if (client.storagePath) {
    return clearStorageNode(client)
  }
}
