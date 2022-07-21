import { BasedCoreClient } from '@based/core-client'

console.info('browser')

const init = async () => {
  const coreClient = new BasedCoreClient()

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  const iqTest = await coreClient.function('iqTest')

  console.info(iqTest)
}

init()
