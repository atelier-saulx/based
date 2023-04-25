import { BasedClient } from '..'
import {
  initStorageBrowser,
  setStorageBrowser,
  removeStorageBrowser,
  clearStorageBrowser,
} from './browser'

const isBrowser = typeof window !== 'undefined'

export const removeStorage = (client: BasedClient, key: string) => {
  const env = client.storageEnvKey
  if (isBrowser) {
    key += '-' + env
    removeStorageBrowser(client, key)
  } else if (client.storagePath) {
    require('./node').removeStorageNode(client, key)
  }
}

export const setStorage = (client: BasedClient, key: string, value: any) => {
  const env = client.storageEnvKey
  if (isBrowser) {
    key += '-' + env
    setStorageBrowser(client, key, value)
  } else if (client.storagePath) {
    require('./node').setStorageNode(client, key, value)
  }
}

export const updateStorage = async (client: BasedClient) => {
  if (isBrowser) {
    // not nessecary...
  } else if (client.storagePath) {
    return require('./node').store(client)
  }
}

export const initStorage = async (client: BasedClient) => {
  if (isBrowser) {
    return initStorageBrowser(client)
  } else if (client.storagePath) {
    return require('./node').initStorageNode(client)
  }
}

export const clearStorage = async (client: BasedClient) => {
  if (isBrowser) {
    return clearStorageBrowser()
  } else if (client.storagePath) {
    return require('./node').clearStorageNode(client)
  }
}
