import { BasedCoreClient } from '@based/core-client'

console.info('browser')

const init = async () => {
  const coreClient = new BasedCoreClient()

  coreClient.connect({
    env: 'production',
    org: 'saulx',
    project: 'flap',
    cluster: 'http://192.168.1.104:7022',
    // url: async () => {
    //   return 'ws://localhost:9910'
    // },
  })

  coreClient.once('connect', (isConnected) => {
    console.info('connect', isConnected)
  })

  await coreClient.function('based-db-update-schema', {
    languages: ['en'],
    types: {
      thing: {
        prefix: 'th',
        fields: {
          name: { type: 'string' },
        },
      },
    },
  })

  coreClient.observe(
    'based-db-observe',
    (d) => {
      console.info('-->', d)
    },
    { children: true }
  )

  coreClient.observe(
    'nestedCounter',
    (d) => {
      console.info('NESTED, INCOMING ---->', d)
    },
    { children: true }
  )

  // for (let i = 0; i < 5; i++) {
  //   await coreClient.function('based-db-set', {
  //     type: 'thing',
  //     name: 'YES' + i,
  //   })
  // }

  const button = document.createElement('button')
  button.innerHTML = 'set something'
  button.onclick = () => {
    coreClient.function('based-db-set', {
      type: 'thing',
      name: 'BLAAAA',
    })
  }
  document.body.appendChild(button)
  // const x = await coreClient.get('counter')

  // console.info('FUN', x)

  // coreClient.observe('counter', (d) => {
  //   console.info('--->', d)
  // })

  // const close = coreClient.observe('chill', (d) => {
  //   console.info('chill', d)
  // })

  // setTimeout(() => {
  //   close()
  // }, 1e3)

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
