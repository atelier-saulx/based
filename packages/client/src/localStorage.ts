import { BasedClient } from '.'
import fflate from 'fflate'
import {
  decodeBase64,
  encodeBase64,
  stringToUtf8,
  uft8ToString,
} from '@saulx/utils'

const isBrowser = typeof window !== 'undefined'

const decode = (dataURI: string): any => {
  const data = decodeBase64(dataURI)
  const uncompressed = uft8ToString(fflate.inflateSync(data))
  const parsed = JSON.parse(uncompressed)
  return parsed
}

export const removeStorage = (client: BasedClient, key: string) => {
  if (isBrowser) {
    const prev = localStorage.getItem(key)
    if (prev) {
      client.storageSize -= new Blob([prev]).size
      localStorage.setItem('@based-size', String(client.storageSize))
      localStorage.removeItem(key)
    }
  }
}

const clearStorage = () => {
  if (isBrowser) {
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
}

export const setStorage = (client: BasedClient, key: string, value: any) => {
  if (isBrowser) {
    try {
      const prev = localStorage.getItem(key)

      const stringifiedJson = JSON.stringify(value)

      const encoded =
        stringifiedJson.length > 70 || key === '@based-authState'
          ? encodeBase64(fflate.deflateSync(stringToUtf8(stringifiedJson)))
          : stringifiedJson

      // console.info(
      //   'COMPRESSION',
      //   new Blob([stringifiedJson]).size / new Blob([encoded]).size
      // )

      const blob = new Blob([encoded])
      const size = blob.size

      if (prev) {
        client.storageSize -= new Blob([prev]).size
      }

      client.storageSize += size
      if (client.storageSize > client.maxStorageSize) {
        console.info('Based - Max localStorage size reached - clear')
        clearStorage()
        client.storageSize = 0
        if (client.authState.persistent === true) {
          setStorage(client, '@based-authState', client.authState)
        }
        client.storageSize += size
      }
      localStorage.setItem('@based-size', String(client.storageSize))
      localStorage.setItem(key, encoded)
    } catch (err) {
      console.error(`Based - Error writing ${key} to localStorage`, err)
    }
  }
}

export const getStorage = (client: BasedClient, key: string): any => {
  if (isBrowser) {
    try {
      const value = localStorage.getItem(key)
      if (value !== undefined) {
        if (value.length < 70 && key !== '@based-authState') {
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
}

export const initStorage = async (client: BasedClient) => {
  if (isBrowser) {
    try {
      // compress as option!
      let totalSize = Number(localStorage.getItem('@based-size') || 0)

      if (totalSize < 0) {
        console.error('Based - Corrupt localStorage (negative size) - clear')
        clearStorage()
        totalSize = 0
      }

      client.storageSize = totalSize

      const keys = Object.keys(localStorage)

      if (keys.length === 1 && totalSize > 0) {
        console.error(
          'Based - Corrupt localStorage (size but no keys) - clear',
          totalSize
        )
        clearStorage()
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

          if (key === '@based-authState') {
            const authState = getStorage(client, '@based-authState')
            if (authState) {
              client.setAuthState(authState)
            }
            continue
          }

          const [, id] = key.split('@based-cache-')

          if (!id) {
            console.warn('Based - clear corrupt localStorage item')
            removeStorage(client, key)
            continue
          }

          const value = getStorage(client, key)
          client.cache.set(Number(id), value)
        }
      }
    } catch (err) {
      console.error('Based - Cannot read localStorage')
    }
  }

  //   console.info('handling of node js storage!') // will just point to a file...
}