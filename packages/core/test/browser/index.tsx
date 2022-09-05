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
  const small = await coreClient.function('small')

  console.info(iqTest)
  console.info(small)

  const close = await coreClient.observe('counter', (data) => {
    console.log('incoming', data)
  })

  // await new Promise((resolve, reject) => setTimeout(resolve, 2500))

  // close()
}

init()
