import fs from 'node:fs/promises'
import { BasedClient } from '..'
import { join } from 'path'

// periodic writing to file?
// or on beforeExit hook

// also add key..
export const initStorageNode = async (client: BasedClient) => {
  const file = join(
    client.storagePath,
    'based-' + client.storageEnvKey + '.storage'
  )
  console.info('    [Based-client] Start persistent storage')
  console.info('   ', file)
  console.info('')
  const stat = await fs.stat(file).catch(() => null)
  if (stat) {
    //
  } else {
    await fs.writeFile(file, '').catch((err) => {
      if (err) {
        console.error(
          '     [Based-client] Failed creating persistent storage, cannot write file'
        )
        // Do not try again
        client.storagePath = null
      }
    })
  }
}

export const clearStorageNode = async (client: BasedClient) => {
  console.info('lullz lets clear!')
}

export const removeStorageNode = (client: BasedClient, key: string) => {
  console.info('removeStorageNode', key)
}

export const setStorageNode = (
  client: BasedClient,
  key: string,
  value: any
) => {
  console.info('setStorageNode', key)
}

export const getStorageNode = (client: BasedClient, key: string) => {
  console.info('getStorageNode', key)
}
