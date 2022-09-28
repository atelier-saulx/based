// import test from 'ava'
// import createServer from '@based/server'
// import { wait } from '@saulx/utils'

// test.serial('functions (over http + stream)', async (t) => {
//   const store = {
//     hello: {
//       path: '/flap',
//       name: 'hello',
//       checksum: 1,
//       function: async (payload) => {
//         if (payload) {
//           return payload
//         }
//         return 'flap'
//       },
//     },
//   }

//   const server = await createServer({
//     port: 9910,
//     functions: {
//       memCacheTimeout: 3e3,
//       idleTimeout: 3e3,
//       uninstall: async () => {
//         await wait(1e3)
//         return true
//       },
//       registerByPath: async ({ path }) => {
//         await wait(1e3)
//         for (const name in store) {
//           if (store[name].path === path) {
//             return store[name]
//           }
//         }
//         return false
//       },
//       register: async ({ name }) => {
//         if (store[name]) {
//           return store[name]
//         } else {
//           return false
//         }
//       },
//       log: (opts) => {
//         console.info('-->', opts)
//       },
//     },
//   })

//   t.is(Object.keys(server.functions.functions).length, 0)

//   server.destroy()
// })
