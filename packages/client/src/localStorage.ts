// can make a plugin for node? that you can store it presitent on disk

import { BasedClient } from '.'

const isBrowser = typeof window !== 'undefined'

export const setStorage = (client: BasedClient, key: string, value: any) => {
  // encode value?
}

export const getStorage = (client: BasedClient, key: string) => {}

export const initStorage = async (client: BasedClient) => {
  //

  if (isBrowser) {
    const totalSize = localStorage.getItem('@based-size')
    const keys = Object.keys(localStorage)
    console.info(keys, totalSize)
    // Object.entries(localStorage)
  }

  console.info('handling of node js storage!') // will just point to a file...
}
