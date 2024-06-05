import { BasedClient } from '../index.js'

export const forceReload = (client: BasedClient, type: number) => {
  // 0 = all
  // 1 = browser
  // 2 = non-browser
  console.info('force reload')
  if (type === 0) {
    console.info('ALL')
  }

  if (typeof window !== 'undefined') {
    // prob browser...
  } else {
    client.disconnect()
    setTimeout(() => {
      client.connect()
    }, 100)
  }
}
