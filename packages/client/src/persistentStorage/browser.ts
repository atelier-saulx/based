import { BasedClient } from '../index.js'
import * as fflate from 'fflate'
import {
  CACHE_PREFIX,
  CACHE_SIZE,
  CACHE_NAME,
  CACHE_AUTH,
} from './constants.js'

const decoder = new TextDecoder()
const encoder = new TextEncoder()

const decode = (dataURI: string): any => {
  const data = global.atob(dataURI)
  const uncompressed = decoder.decode(fflate.inflateSync(encoder.encode(data)))
  const parsed = JSON.parse(uncompressed)
  return parsed
}

export const removeStorageBrowser = (client: BasedClient, key: string) => {
  const prev = localStorage.getItem(key)
  if (prev) {
    client.storageSize -= new Blob([prev]).size
    localStorage.setItem(CACHE_SIZE, String(client.storageSize))
    localStorage.removeItem(key)
  }
}

export const clearStorageBrowser = () => {
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

export const setStorageBrowser = (
  client: BasedClient,
  key: string,
  value: any
) => {
  try {
    const env = client.storageEnvKey
    if (!env) {
      return
    }

    const prev = localStorage.getItem(key)
    const stringifiedJson = JSON.stringify(value)
    const encoded =
      stringifiedJson.length > 70 || key === CACHE_AUTH + env
        ? global.btoa(
            decoder.decode(fflate.deflateSync(encoder.encode(stringifiedJson)))
          )
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
        setStorageBrowser(client, CACHE_AUTH + env, client.authState)
      }
      client.storageSize += size
    }
    localStorage.setItem(CACHE_SIZE, String(client.storageSize))
    localStorage.setItem(key, encoded)
  } catch (err) {
    // console.error(`Based - Error writing ${key} to localStorage`, err)
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
      if (value.length < 70 && key !== CACHE_AUTH + env) {
        try {
          return JSON.parse(value)
        } catch (err) {}
      }
      return decode(value)
    }
    return
  } catch (err) {
    // console.error(`Based - Error parsing ${key} from localStorage`)
  }
}

export const initStorageBrowser = async (client: BasedClient) => {
  const env = client.storageEnvKey
  if (!env) {
    return
  }

  console.info('INIT STORAGE')
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

        if (key === CACHE_AUTH + env) {
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
