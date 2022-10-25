import { BasedCoreClient } from '@based/core-client'

console.info('browser')

const init = async () => {
  const coreClient = new BasedCoreClient()

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
    },
  })

  const x = await coreClient.get('counter')

  console.info('FUN', x)

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  coreClient.observe('counter', (d) => {
    console.info('guuuurrr', d)
  })

  // const iqTest = await coreClient.function('iqTest')
  // const small = await coreClient.function('small')

  // console.info(iqTest)
  // console.info(small)

  // let str = ''
  // for (let i = 0; i < 20000; i++) {
  //   str += ' big string ' + ~~(Math.random() * 1000) + 'snur ' + i
  // }

  // let i = 100e3
  // while (--i) {
  //   try {
  //     const flap = await coreClient.function('hello', str)
  //     console.info('GOT FLAP', flap)
  //   } catch (err) {
  //     console.error(err)
  //   }
  // }
  // const close = await coreClient.observe('counter', (data) => {
  //   console.log('incoming', data)
  // })

  // await new Promise((resolve, reject) => setTimeout(resolve, 2500))

  // close()
}

init()
