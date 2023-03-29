// import test from 'ava'
// import { BasedClient } from '../src/index'
// import { createSimpleServer } from '@based/server'
// import { wait } from '@saulx/utils'

// test.serial('Proxy', async (t) => {
//   const proxyClient = new BasedClient()
//   const server = await createSimpleServer({
//     uninstallAfterIdleTime: 1e3,
//     port: 9911,
//     functions: {
//       hello: async (based, payload) => {
//         console.info('from hello ', +payload.snap)
//       },
//     },
//     queryFunctions: {
//       counter: (based, payload, update) => {
//         let cnt = 1
//         update(cnt)
//         const counter = setInterval(() => {
//           update(++cnt)
//         }, 1000)
//         return () => {
//           clearInterval(counter)
//         }
//       },
//     },
//   })

//   proxyClient.connect({
//     url: async () => {
//       return 'ws://localhost:9911'
//     },
//   })

//   const outGoingRelayClients = {}

//   // authorize will just recieve binary nothing else

//   const serverWithProxy = await createSimpleServer({
//     uninstallAfterIdleTime: 1e3,
//     port: 9910,
//     // only ws for now
//     proxy: {
//       // uses the name (and later path)
//       hello: async (based, binary, ctx) => {
//         if (!outGoingRelayClients[ctx.session.id]) {
//           outGoingRelayClients[ctx.session.id] = ctx.session.ws
//           // and have to clean the relay stuff
//         }
//         relayClient.sendProxyMessage(binary, ctx.session.id)
//       },
//     },
//   })

//   proxyClient.on('proxyMessage', (binary, id) => {
//     console.info(binary)
//     outGoingRelayClients[id].send(binary)
//   })

//   const client = new BasedClient()

//   proxyClient.connect({
//     url: async () => {
//       return 'ws://localhost:9910'
//     },
//   })

//   const x = await client.call('hello', { snap: 'snap je!' })

//   await wait(1500)
//   await client.destroy()
//   await server.destroy()
//   await proxyClient.destroy()
//   await serverWithProxy.destroy()
//   t.true(true)
// })
