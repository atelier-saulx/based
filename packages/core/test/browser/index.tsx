import { BasedCoreClient } from '@based/core-client'

console.info('browsxxer')

const init = async () => {
  const coreClient = new BasedCoreClient()

  // coreClient.auth('"myyuzi!"').then((v) => {
  //   console.info('GOT AUTH', v)
  // })

  coreClient.auth('"myyuzi!"').then((v) => {
    console.info('GOT AUTH', v)
  })

  coreClient.connect({
    url: async () => {
      // return 'ws://ec2-52-59-200-223.eu-central-1.compute.amazonaws.com'
      return 'ws://ec2-3-70-244-158.eu-central-1.compute.amazonaws.com/'
      // return 'ws://ec2-52-59-200-223.eu-central-1.compute.amazonaws.com'
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
  console.info(await coreClient.call('hello', { x: true }))

  const makeButton = (label: string, fn: () => void) => {
    const button = document.createElement('button')
    button.innerHTML = label
    button.style.margin = '40px'
    button.onclick = fn
    document.body.appendChild(button)
  }

  makeButton('nested hello', async () => {
    console.info(await coreClient.call('helloNest', { x: true }))
  })

  makeButton('info time', async () => {
    console.info(await coreClient.call('timespend'))
  })

  const bombard = async () => {
    const d = Date.now()
    const q: any[] = []
    for (let i = 0; i < 1000; i++) {
      q.push(coreClient.call('helloNest', { x: true }))
    }
    await Promise.all(q)
    console.info('fire 1000 hello nests (1M gets)', Date.now() - d, 'ms')
    bombard()
  }

  makeButton('bombard hello', bombard)

  coreClient.observe('blaNest', (d, c) => {
    console.info('flap', d, c)
  })
}

init()
