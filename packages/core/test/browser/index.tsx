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

  // const iqTest = await coreClient.function('iqTest')
  // const small = await coreClient.function('small')

  // console.info(iqTest)
  // console.info(small)

  let str = ''
  for (let i = 0; i < 2000000; i++) {
    str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  }

  let i = 10e3
  while (--i) {
    const flap = await coreClient.function('hello', str)

    console.info('GOT FLAP', flap)
  }
  // const close = await coreClient.observe('counter', (data) => {
  //   console.log('incoming', data)
  // })

  // await new Promise((resolve, reject) => setTimeout(resolve, 2500))

  // close()
}

init()
