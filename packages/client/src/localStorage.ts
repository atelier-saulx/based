// make a plugin for node that you can store it persitent on disk

import { BasedClient } from '.'

const isBrowser = typeof window !== 'undefined'

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

export const setStorage = (client: BasedClient, key: string, value: any) => {
  if (isBrowser) {
    try {
      const prev = localStorage.getItem(key)
      const encoded = JSON.stringify(value)
      const size = new Blob([encoded]).size
      if (prev) {
        client.storageSize -= new Blob([prev]).size
      }
      client.storageSize += size
      if (client.storageSize > client.maxStorageSize) {
        console.info('Based - Max localStorage size reached - clear')
        localStorage.clear()
        client.storageSize = 0
        if (client.authState.persistent === true) {
          setStorage(client, '@based-authState', client.authState)
        }
        client.storageSize += size
      }
      localStorage.setItem('@based-size', String(client.storageSize))
      localStorage.setItem(key, encoded)
    } catch (err) {
      console.error(`Based - Error writing ${key} to localStorage`)
    }
  }
}

export const getStorage = (client: BasedClient, key: string): any => {
  if (isBrowser) {
    try {
      const value = localStorage.getItem(key)
      if (value !== undefined) {
        return JSON.parse(value)
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
        localStorage.clear()
        totalSize = 0
      }

      client.storageSize = totalSize

      const keys = Object.keys(localStorage)

      if (keys.length === 1 && totalSize > 0) {
        console.error(
          'Based - Corrupt localStorage (size but no keys) - clear',
          totalSize
        )
        localStorage.clear()
        totalSize = 0
      }

      console.info('Based - init localstorage', keys, totalSize)

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
    // return
  }

  //   console.info('handling of node js storage!') // will just point to a file...
}
