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
      console.info('|-->', d)
    },
    { children: { name: true, id: true, $list: true } }
  )

  coreClient.observe(
    'nestedCounter',
    (d) => {
      console.info('NESTED, INCOMING ---->', d)
    },
    { children: { name: true, id: true, $list: true } }
  )

  // for (let i = 0; i < 5; i++) {
  //   await coreClient.function('based-db-set', {
  //     type: 'thing',
  //     name: 'YES' + i,
  //   })
  // }

  const makeButton = (label: string, fn: () => void) => {
    const button = document.createElement('button')
    button.innerHTML = label
    button.style.margin = '40px'
    button.onclick = fn
    document.body.appendChild(button)
  }

  makeButton('set thing', () => {
    coreClient.function('based-db-set', {
      type: 'thing',
      name: 'BLAAAA',
    })
  })

  makeButton('crasher', () => {
    coreClient.function('crasher').catch((err) => {
      console.error(err)
    })
  })

  makeButton('init obs crash', () => {
    coreClient.observe(
      'obsInitCrash',
      (d) => {
        console.info(d)
      },
      (err) => {
        console.error(err)
      }
    )
  })

  makeButton('rando obs crash', () => {
    coreClient.observe(
      'obsRandomUpdateCrash',
      (d) => {
        console.info('rando', d)
      },
      (err) => {
        console.error(err)
      }
    )
  })

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
