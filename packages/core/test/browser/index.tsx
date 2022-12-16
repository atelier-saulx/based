import { BasedCoreClient } from '@based/core-client'

console.info('browsxxer')

const init = async () => {
  const coreClient = new BasedCoreClient()

  coreClient.connect({
    url: async () => {
      return 'ws://localhost:9910'
      // //   return 'ws://localhost:9910'
      // // },
      // env: 'production',
      // org: 'saulx',
      // project: 'flap',
      // // cluster: 'http://localhost:9001',
      // // url: async () => {
      // //   return 'ws://localhost:9910'
      // // },
    },
  })

  coreClient.on('connect', async (isConnected) => {
    console.info('connect', isConnected)
    // console.info('--->', await coreClient.function('helloNest', { x: true }))
  })

  console.info('-----------')
  console.info(await coreClient.function('hello', { x: true }))

  const makeButton = (label: string, fn: () => void) => {
    const button = document.createElement('button')
    button.innerHTML = label
    button.style.margin = '40px'
    button.onclick = fn
    document.body.appendChild(button)
  }

  makeButton('nested hello', async () => {
    console.info(await coreClient.function('helloNest', { x: true }))
  })

  makeButton('info time', async () => {
    console.info(await coreClient.function('timespend'))
  })

  makeButton('bombard hello', async () => {
    const d = Date.now()
    const q: any[] = []
    for (let i = 0; i < 1e3; i++) {
      q.push(coreClient.function('helloNest', { x: true }))
    }
    await Promise.all(q)
    console.info('fire 1000 hello nests', Date.now() - d, 'ms')
  })

  coreClient.observe('blaNest', (d, c) => {
    console.info('flap', d, c)
  })

  // console.info('go auth!')

  // await coreClient.auth('importservice')

  // console.info('hello')
  // await coreClient.function('based-db-update-schema', {
  //   schema: {
  //     languages: ['en', 'nl', 'de'],
  //     types: {
  //       thing: {
  //         fields: {
  //           name: { type: 'string' },
  //           done: { type: 'boolean' },
  //         },
  //       },
  //     },
  //   },
  // })

  // // console.info('hello!!! updated')

  // await coreClient.auth('myblurf')

  // coreClient.observe(
  //   'based-db-observe',
  //   (d) => {
  //     console.info('|-->', d)
  //   },
  //   { children: { name: true, id: true, $list: true } }
  // )

  // // coreClient.observe(
  // //   'nestedCounter',
  // //   (d) => {
  // //     console.info('NESTED, INCOMING ---->', d)
  // //   },
  // //   { children: { name: true, id: true, $list: true } }
  // // )

  // // coreClient.observe(
  // //   'nestedCounter',
  // //   (d) => {
  // //     console.info('NESTED, INCOMING ---->', d)
  // //   },
  // //   { children: true }
  // // )

  // // for (let i = 0; i < 5; i++) {
  // //   await coreClient.function('based-db-set', {
  // //     type: 'thing',
  // //     name: 'YES' + i,
  // //   })
  // // }

  // const makeButton = (label: string, fn: () => void) => {
  //   const button = document.createElement('button')
  //   button.innerHTML = label
  //   button.style.margin = '40px'
  //   button.onclick = fn
  //   document.body.appendChild(button)
  // }

  // makeButton('set thing', () => {
  //   coreClient.function('based-db-set', {
  //     type: 'thing',
  //     name: 'BLAAAA',
  //   })
  // })

  // makeButton('hello', async () => {
  //   console.info('hello:', await coreClient.function('hello'))
  // })

  // makeButton('add many things', () => {
  //   for (let i = 0; i < 1000; i++) {
  //     coreClient.function('based-db-set', {
  //       type: 'thing',
  //       name: 'YES' + i,
  //     })
  //   }
  // })

  // makeButton('crasher', () => {
  //   coreClient.function('crasher').catch((err) => {
  //     console.error(err)
  //   })
  // })

  // makeButton('init obs crash', () => {
  //   coreClient.observe(
  //     'obsInitCrash',
  //     (d) => {
  //       console.info(d)
  //     },
  //     (err) => {
  //       console.error(err)
  //     }
  //   )
  // })

  // makeButton('init obs crash GET', () => {
  //   coreClient.get('obsInitCrash').catch((err) => {
  //     console.error(err)
  //   })
  // })

  // makeButton('rando obs crash', () => {
  //   coreClient.observe(
  //     'obsRandomUpdateCrash',
  //     (d) => {
  //       console.info('rando', d)
  //     },
  //     (err) => {
  //       console.error(err)
  //     }
  //   )
  // })

  // makeButton('obsObserverCrash', () => {
  //   coreClient.observe(
  //     'obsObserverCrash',
  //     (d) => {
  //       console.info('obsObserverCrash -> ', d)
  //     },
  //     (err) => {
  //       console.error(err)
  //     }
  //   )
  // })
  // makeButton('rate limit', async () => {
  //   let url = coreClient.connection.ws?.url
  //   if (!url) {
  //     return
  //   }
  //   url = url.replace(/^ws/, 'http')
  //   for (let i = 0; i < 1000; i++) {
  //     await fetch(url + 'hello')
  //   }
  // })

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
