// import { BasedServer } from '@based/server'
// import { BasedQueryFunction } from '@based/functions'

// const counter: BasedQueryFunction<{ speed: number }, { cnt: number }> = (
//   _based,
//   payload,
//   update
// ) => {
//   let cnt = 0
//   // update({ cnt })
//   const int = setInterval(() => {
//     update({ cnt: ++cnt })
//   }, payload.speed ?? 1e3)
//   return () => {
//     clearInterval(int)
//   }
// }

// const fakeDb = (_based, { offset, limit }, update) => {
//   let i
//   let cnt = 0
//   const timer = setTimeout(() => {
//     const doit = () => {
//       cnt++
//       const things = Array.from(Array(limit)).map((_, i) => {
//         return {
//           id: `${i + offset} - ${cnt}`,
//         }
//       })
//       update({ things })
//     }

//     i = setInterval(doit, 1e3)
//     doit()
//   }, 100)
//   return () => {
//     clearTimeout(timer)
//     clearInterval(i)
//   }
// }

// const server = new BasedServer({
//   port: 8081,
//   functions: {
//     configs: {
//       'fake-db': {
//         type: 'query',
//         fn: fakeDb,
//       },
//       counter: {
//         type: 'query',
//         fn: counter,
//       },
//     },
//   },
// })

// server.start()
