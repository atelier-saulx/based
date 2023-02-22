import { BasedClient } from '..'
import {
  getStorageBrowser,
  initStorageBrowser,
  setStorageBrowser,
  removeStorageBrowser,
  clearStorageBrowser,
} from './browser'

const isBrowser = typeof window !== 'undefined'

export const removeStorage = (client: BasedClient, key: string) => {
  if (isBrowser) {
    removeStorageBrowser(client, key)
  }
}

export const setStorage = (client: BasedClient, key: string, value: any) => {
  if (isBrowser) {
    setStorageBrowser(client, key, value)
  }
}

export const getStorage = (client: BasedClient, key: string): any => {
  if (isBrowser) {
    getStorageBrowser(client, key)
  }
}

export const initStorage = async (client: BasedClient) => {
  if (isBrowser) {
    initStorageBrowser(client)
  }
}

export const clearStorage = async (client: BasedClient) => {
  if (isBrowser) {
    clearStorageBrowser()
  }
}
