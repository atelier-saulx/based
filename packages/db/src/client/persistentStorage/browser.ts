import { BasedClient } from '../index.js'
import { inflateSync, deflateSync } from 'fflate'
import {
  CACHE_PREFIX,
  CACHE_SIZE,
  CACHE_NAME,
  CACHE_AUTH,
} from './constants.js'
import { decodeBase64, encodeBase64 } from '../../utils/index.js'

const decoder = new TextDecoder('utf-8')
const encoder = new TextEncoder()

const decode = (dataURI: string): any => {
  const uncompressed = decoder.decode(inflateSync(decodeBase64(dataURI)))
  const parsed = JSON.parse(uncompressed)
  return parsed
}

const removeStorageBrowser = (client: BasedClient, key: string) => {
  const prev = localStorage.getItem(key)
  if (prev) {
    client.storageSize -= new Blob([prev]).size
    localStorage.setItem(CACHE_SIZE, String(client.storageSize))
    localStorage.removeItem(key)
  }
}

const clearStorageBrowser = () => {
  const keys = Object.keys(localStorage)
  try {
    for (const key of keys) {
      if (key.startsWith(CACHE_NAME)) {
        localStorage.removeItem(key)
      }
    }
  } catch (err) {
    try {
      localStorage.clear()
    } catch (err) {
      // console.error(`Based - Error clearing localStorage`)
    }
  }
}

const setStorageBrowser = (client: BasedClient, key: string, value: any) => {
  try {
    const env = client.storageEnvKey
    if (!env) {
      return
    }

    const prev = localStorage.getItem(key)
    const stringifiedJson = JSON.stringify(value)

    const encoded =
      stringifiedJson.length > 70 || key === CACHE_AUTH + '-' + env
        ? encodeBase64(deflateSync(encoder.encode(stringifiedJson)))
        : stringifiedJson

    const blob = new Blob([encoded])
    const size = blob.size

    if (prev) {
      client.storageSize -= new Blob([prev]).size
    }

    client.storageSize += size
    if (client.storageSize > client.maxStorageSize) {
      // console.info('Based - Max localStorage size reached - clear')
      clearStorageBrowser()
      client.storageSize = 0
      if (client.authState.persistent === true) {
        setStorageBrowser(client, CACHE_AUTH + '-' + env, client.authState)
      }
      client.storageSize += size
    }
    localStorage.setItem(CACHE_SIZE, String(client.storageSize))
    localStorage.setItem(key, encoded)
  } catch (err) {
    console.error(`Based - Error writing ${key} to localStorage`, err)
  }
}

const getStorageBrowser = (client: BasedClient, key: string): any => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }
  try {
    const value = localStorage.getItem(key)
    if (value !== undefined) {
      if (value!.length < 70 && key !== CACHE_AUTH + '-' + env) {
        try {
          return JSON.parse(value!)
        } catch (err) {}
      }
      return decode(value!)
    }
    return
  } catch (err) {
    // console.error(`Based - Error parsing ${key} from localStorage`)
  }
}

const initStorageBrowser = async (client: BasedClient) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }

  const prevCache = global.__basedcache__ ?? {}

  for (const key in prevCache) {
    client.cache.set(Number(key), prevCache[key])
  }

  try {
    // compress as option!
    let totalSize = Number(localStorage.getItem(CACHE_SIZE) || 0)

    if (totalSize < 0) {
      // console.error('Based - Corrupt localStorage (negative size) - clear')
      clearStorageBrowser()
      totalSize = 0
    }

    client.storageSize = totalSize

    const keys = Object.keys(localStorage)

    if (keys.length === 1 && totalSize > 0) {
      // console.error(
      //   'Based - Corrupt localStorage (size but no keys) - clear',
      //   totalSize
      // )
      clearStorageBrowser()
      totalSize = 0
    }

    // console.info(
    //   `Based - init localstorage stored ${~~(totalSize / 1024) + 'kb'}`
    // )

    if (totalSize > 0) {
      for (const key of keys) {
        if (key === CACHE_SIZE || !key.startsWith(CACHE_NAME)) {
          continue
        }

        if (key === CACHE_AUTH + '-' + env) {
          const authState = getStorageBrowser(client, key)
          if (authState) {
            client.setAuthState(authState).catch((err) => {
              console.error(err.message)
              removeStorageBrowser(client, key)
            })
          }
          continue
        }

        const [, keyValuePair] = key.split(CACHE_PREFIX)

        if (!keyValuePair) {
          continue
        }

        const [id, e] = keyValuePair.split('-')

        if (e !== String(env)) {
          continue
        }

        if (!id) {
          // console.warn('Based - clear corrupt localStorage item')
          removeStorageBrowser(client, key)
          continue
        }

        const value = getStorageBrowser(client, key)
        client.cache.set(Number(id), value)
      }
    }
  } catch (err) {
    // console.error('Based - Cannot read localStorage')
  }
}

export const removeStorage = (client: BasedClient, key: string) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }
  key += '-' + env
  removeStorageBrowser(client, key)
}

export const setStorage = (client: BasedClient, key: string, value: any) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }
  key += '-' + env
  setStorageBrowser(client, key, value)
}

export const updateStorage = async (
  _client: BasedClient,
  _instant?: boolean,
) => {}

export const initStorage = async (client: BasedClient) => {
  return initStorageBrowser(client)
}

export const clearStorage = async (_client: BasedClient) => {
  return clearStorageBrowser()
}
