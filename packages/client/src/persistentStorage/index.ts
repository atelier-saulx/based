import { BasedClient } from '..'
import {
  getStorageBrowser,
  initStorageBrowser,
  setStorageBrowser,
  removeStorageBrowser,
  clearStorageBrowser,
} from './browser'
import {
  clearStorageNode,
  initStorageNode,
  removeStorageNode,
  getStorageNode,
  setStorageNode,
} from './node'

const isBrowser = typeof window !== 'undefined'

export const removeStorage = (client: BasedClient, key: string) => {
  const env = client.storageEnvKey
  key += '-' + env
  if (isBrowser) {
    removeStorageBrowser(client, key)
  } else if (client.storagePath) {
    removeStorageNode(client, key)
  }
}

export const setStorage = (client: BasedClient, key: string, value: any) => {
  const env = client.storageEnvKey
  key += '-' + env
  if (isBrowser) {
    setStorageBrowser(client, key, value)
  } else if (client.storagePath) {
    setStorageNode(client, key, value)
  }
}

export const getStorage = (client: BasedClient, key: string): any => {
  const env = client.storageEnvKey
  key += '-' + env
  if (isBrowser) {
    return getStorageBrowser(client, key)
  } else if (client.storagePath) {
    return getStorageNode(client, key)
  }
}

export const initStorage = async (client: BasedClient) => {
  if (isBrowser) {
    return initStorageBrowser(client)
  } else if (client.storagePath) {
    return initStorageNode(client)
  }
}

export const clearStorage = async (client: BasedClient) => {
  if (isBrowser) {
    return clearStorageBrowser()
  } else if (client.storagePath) {
    return clearStorageNode(client)
  }
}
