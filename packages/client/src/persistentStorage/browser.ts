import { BasedClient } from '..'
import fflate from 'fflate'
import {
  decodeBase64,
  encodeBase64,
  stringToUtf8,
  uft8ToString,
} from '@saulx/utils'

const decode = (dataURI: string): any => {
  const data = decodeBase64(dataURI)
  const uncompressed = uft8ToString(fflate.inflateSync(data))
  const parsed = JSON.parse(uncompressed)
  return parsed
}

export const removeStorageBrowser = (client: BasedClient, key: string) => {
  const prev = localStorage.getItem(key)
  if (prev) {
    client.storageSize -= new Blob([prev]).size
    localStorage.setItem('@based-size', String(client.storageSize))
    localStorage.removeItem(key)
  }
}

export const clearStorageBrowser = () => {
  const keys = Object.keys(localStorage)
  try {
    for (const key of keys) {
      if (key.startsWith('@based')) {
        localStorage.removeItem(key)
      }
    }
  } catch (err) {
    try {
      localStorage.clear()
    } catch (err) {
      console.error(`Based - Error clearing localStorage`)
    }
  }
}

export const setStorageBrowser = (
  client: BasedClient,
  key: string,
  value: any
) => {
  try {
    const prev = localStorage.getItem(key)
    const env = client.storageEnvKey

    const stringifiedJson = JSON.stringify(value)

    const encoded =
      stringifiedJson.length > 70 || key === '@based-authState-' + env
        ? encodeBase64(fflate.deflateSync(stringToUtf8(stringifiedJson)))
        : stringifiedJson

    const blob = new Blob([encoded])
    const size = blob.size

    if (prev) {
      client.storageSize -= new Blob([prev]).size
    }

    client.storageSize += size
    if (client.storageSize > client.maxStorageSize) {
      console.info('Based - Max localStorage size reached - clear')
      clearStorageBrowser()
      client.storageSize = 0
      if (client.authState.persistent === true) {
        setStorageBrowser(client, '@based-authState-' + env, client.authState)
      }
      client.storageSize += size
    }
    localStorage.setItem('@based-size', String(client.storageSize))
    localStorage.setItem(key, encoded)
  } catch (err) {
    console.error(`Based - Error writing ${key} to localStorage`, err)
  }
}

const getStorageBrowser = (client: BasedClient, key: string): any => {
  const env = client.storageEnvKey

  try {
    const value = localStorage.getItem(key)
    if (value !== undefined) {
      if (value.length < 70 && key !== '@based-authState-' + env) {
        try {
          return JSON.parse(value)
        } catch (err) {}
      }
      return decode(value)
    }
    return
  } catch (err) {
    console.error(`Based - Error parsing ${key} from localStorage`)
  }
}

export const initStorageBrowser = async (client: BasedClient) => {
  const env = client.storageEnvKey

  try {
    // compress as option!
    let totalSize = Number(localStorage.getItem('@based-size') || 0)

    if (totalSize < 0) {
      console.error('Based - Corrupt localStorage (negative size) - clear')
      clearStorageBrowser()
      totalSize = 0
    }

    client.storageSize = totalSize

    const keys = Object.keys(localStorage)

    if (keys.length === 1 && totalSize > 0) {
      console.error(
        'Based - Corrupt localStorage (size but no keys) - clear',
        totalSize
      )
      clearStorageBrowser()
      totalSize = 0
    }

    console.info(
      `Based - init localstorage stored ${~~(totalSize / 1024) + 'kb'}`
    )

    if (totalSize > 0) {
      for (const key of keys) {
        if (key === '@based-size' || !key.startsWith('@based')) {
          continue
        }

        if (key === '@based-authState-' + env) {
          const authState = getStorageBrowser(client, key)
          if (authState) {
            client.setAuthState(authState).catch((err) => {
              console.error(err.message)
              removeStorageBrowser(client, key)
            })
          }
          continue
        }

        const [, keyValuePair] = key.split('@based-cache-')

        if (!keyValuePair) {
          continue
        }

        const [id, e] = keyValuePair.split('-')

        if (e !== String(env)) {
          continue
        }

        if (!id) {
          console.warn('Based - clear corrupt localStorage item')
          removeStorageBrowser(client, key)
          continue
        }

        const value = getStorageBrowser(client, key)
        client.cache.set(Number(id), value)
      }
    }
  } catch (err) {
    console.error('Based - Cannot read localStorage')
  }
}
