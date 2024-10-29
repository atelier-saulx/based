import {
  isMainThread,
  Worker,
  workerData,
  parentPort,
  MessageChannel,
  receiveMessageOnPort,
} from 'node:worker_threads'
import { BasedDb, native, BasedQueryResponse } from '@based/db'
import { tmpdir } from 'os'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'

const db = new BasedDb({
  path: tmpdir(),
})

await db.start({ clean: true })

db.putSchema({
  types: {
    article: {
      props: {
        body: 'string',
        writer: {
          ref: 'writer',
          prop: 'articles',
        },
      },
    },
    writer: {
      props: {
        name: 'string',
        articles: {
          items: {
            ref: 'article',
            prop: 'writer',
          },
        },
      },
    },
  },
})

await setTimeout(500)

let j = 1

while (j--) {
  let i = 10
  let k = 10
  while (i--) {
    db.create('article', {
      body: 'nice body 00dlsjfhlksjgflksdjgflksjglks gjlks ' + i,
    })
  }
  while (k--) {
    db.create('writer', {
      name: 'cool name ' + i,
    })
  }
  const d = db.drain()
  console.log({ d })
}

// if (isMainThread) {
//   const db = new BasedDb({
//     path: tmpdir(),
//   })

//   await db.start({ clean: true })

//   db.putSchema({
//     types: {
//       article: {
//         props: {
//           body: 'string',
//           writer: {
//             ref: 'writer',
//             prop: 'articles',
//           },
//         },
//       },
//       writer: {
//         props: {
//           name: 'string',
//           articles: {
//             items: {
//               ref: 'article',
//               prop: 'writer',
//             },
//           },
//         },
//       },
//     },
//   })

//   let i = 1_000_000
//   while (i--) {
//     db.create('article', {
//       body: 'nice body 00dlsjfhlksjgflksdjgflksjglks gjlks ' + i,
//     })
//   }

//   db.drain()

//   // const query = db.query()
//   const __filename = fileURLToPath(import.meta.url)
//   const { port1, port2 } = new MessageChannel()

//   new Worker(__filename, {
//     workerData: {
//       dbCtxAddress: db.native.intFromExternal(db.dbCtxExternal),
//       port2,
//     },
//     transferList: [port2],
//   })

//   // new Worker(__filename, {
//   //   workerData: {
//   //     dbCtxAddress: db.native.intFromExternal(db.dbCtxExternal),
//   //     port2,
//   //   },
//   //   transferList: [port2],
//   // })

//   const query = db.query('article').range(0, 100_000)
//   console.log('main query:', query.get())
//   let d
//   port1.on('message', (result) => {
//     const buf = Buffer.from(result)
//     const t3 = performance.now()
//     const res = new BasedQueryResponse(query.def, buf, t3 - d)
//     console.log('worker query:', res)
//     console.log('received at', { t3 })
//   })

//   const test = () => {
//     const queryBuf = query.toBuffer()
//     d = performance.now()
//     port1.postMessage(queryBuf, [queryBuf.buffer])
//     console.log('send it at', { d, queryBuf })
//     // setTimeout(test, 1e3)
//   }

//   setTimeout(test, 1e3)
// } else {
//   const { dbCtxAddress, port2 } = workerData
//   const dbCtx = native.externalFromInt(dbCtxAddress)
//   const get = (buf) => {
//     const t = performance.now()
//     const resultBuf = native.getQueryBuf(buf, dbCtx)
//     const t2 = performance.now()
//     port2.postMessage(resultBuf.buffer, [resultBuf.buffer])
//     console.log('received it at:', { t })
//     console.log('send it back at', { t2 }, t2 - t)
//   }
//   const poll = () => {
//     const msg = receiveMessageOnPort(port2)
//     if (msg) {
//       get(msg.message)
//     }
//     process.nextTick(poll)
//   }
//   poll()

//   // port2.on('message', get)
// }
