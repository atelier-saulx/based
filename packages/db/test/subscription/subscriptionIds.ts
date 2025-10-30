import {
  readUint32,
  wait,
  writeUint16,
  writeUint24,
  writeUint32,
} from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import native from '../../src/native.js'
import { registerQuery } from '../../src/client/query/registerQuery.js'
import { ALIAS } from '@based/schema/prop-types'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 100),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

const createSingleSubscriptionBuffer = (
  subId: number,
  typeId: number,
  fields: Uint8Array,
  id: number,
) => {
  const headerLen = 10
  let val = new Uint8Array(headerLen + fields.byteLength)
  writeUint32(val, subId, 0)
  writeUint16(val, typeId, 4)
  writeUint32(val, id, 6)
  val.set(fields, headerLen)
  return val
}

// make a tool to test subs
await test('subscriptionIds', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  await clients[0].setSchema({
    types: {
      user: {
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
        name: 'string',
        email: 'alias', // handle alias (from the other side...)
      },
      control: {
        x: 'uint8',
        derp: 'uint32',
        location: 'string',
        lang: 'string',
      },
    },
  })

  const amount = 2e6
  const readable =
    amount > 1e6
      ? Math.round(amount / 1e6) + 'M'
      : amount > 1e3
        ? Math.round(amount / 1e3) + 'K'
        : amount

  const payload: any = {
    derp: 99,
    x: 1,
  }

  const updateAll = async (type = 'user') => {
    let d = Date.now()
    for (let i = 0; i < 2e6; i++) {
      payload.derp = i
      payload.x = i % 255
      // payload.location = 'x ' + i
      clients[1].update(type, i + 1, payload)
    }
    let dTime = await clients[1].drain()
    console.log(
      `handling ${readable} updates with unique subs firing`,
      Date.now() - d,
      'ms',
      'drain time (real db)',
      dTime,
      'ms',
    )
  }

  const removeubsForId = (subId: number, id: number) => {
    let d = Date.now()
    const val = new Uint8Array(10)
    const typeId = server.schemaTypesParsed['user'].id
    writeUint32(val, id, 0)
    writeUint32(val, subId, 4)
    writeUint16(val, typeId, 8)
    native.removeIdSubscription(server.dbCtxExternal, val)
    console.log(`Remove subscriptions ${subId} ${id} `, Date.now() - d, 'ms')
  }

  // different
  const addSubs = (subId: number, start = 0, end = 1000): Uint8Array => {
    const fields = new Uint8Array([0, 1, 2])
    const typeId = server.schemaTypesParsed['user'].id
    const val = createSingleSubscriptionBuffer(subId, typeId, fields, 1)
    let d = Date.now()
    for (let i = start; i < end; i++) {
      writeUint32(val, i, 6)
      native.addIdSubscription(server.dbCtxExternal, val)
    }
    console.log('  Add all those subs ', Date.now() - d, 'ms')
    return val
  }

  // let BLA = Date.now()

  // // [type][type]
  // // [subId][subId][subId][subId]
  // // ofc we have to divide per core e.g. 1e6 / 16 (62.5k)
  // for (let i = 0; i < 62e3; i++) {
  //   const multiSubscription = new Uint8Array(6)
  //   const typeId = server.schemaTypesParsed['user'].id
  //   writeUint16(multiSubscription, typeId, 0)
  //   writeUint32(multiSubscription, 777 + i, 2)
  //   native.addMultiSubscription(server.dbCtxExternal, multiSubscription)
  // }

  // console.log('ZIG ZAGx', Date.now() - BLA, 'ms')

  // for (let i = 0; i < amount; i++) {
  //   clients[0].create('user', { x: i % 255 })
  // }

  // console.log('create', await clients[0].drain(), 'ms')

  // let d = Date.now()
  // // addSubs(666, 1, 2e6 - 2)
  // // addSubs(420, 1, 2e6 - 2)
  // addSubs(666, 198, 199)
  // console.log('REST 1------------')

  // addSubs(666, 1, 2)

  // console.log('REST 2------------')

  // addSubs(666, 20e6 - 10e3, 20e6 - 10e3 + 1)

  // console.log('REST 3------------')
  // addSubs(666, 10e6 - 2, 10e6 - 1)
  // addSubs(666, 500, 501)
  // addSubs(999, 500, 501)

  // addSubs(666, 2e6, 4e6)

  // console.log(Date.now() - d, 'ms', 'to create 4M')

  // d = Date.now()

  // // removeubsForId(666, 500)
  // // removeubsForId(666, 10e6 - 2)
  // // removeubsForId(666, 20e6 - 2)
  // // removeubsForId(999, 500)

  // console.log(Date.now() - d, 'ms', 'to remove subs...')

  // addSubs(666, 1, 2e6 - 1)
  // addSubs(777, 1, 2e6 - 1)

  // await updateAll()

  // await clients[0].query('user').range(0, 2e6).get().inspect()

  // const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
  // console.log({ markedSubsR })

  await wait(100)

  const subs: any = {}
  const subsReverse: any = {}

  let subId = 0

  clients[0].create('user', { name: 'mr poop' })

  // maybe make create fire things as well?
  const def = clients[0].query('user', 1).include('name', 'x')

  registerQuery(def)

  const x = def.def

  console.log(x.target)

  if ('id' in x.target && typeof x.target.id === 'number') {
    // for id queries the id will be the hash of the actual?

    // this id has to be WITHOUT the actual sub id
    // and then we need an extra one for sub id

    if (!subsReverse[def.id]) {
      subId++
      subsReverse[def.id] = subId
      subs[subId] = def.id
    }

    let fCount = x.include.main.len != 0 ? 1 : 0
    fCount += x.include.props.size
    const fields = new Uint8Array(fCount)
    // if alias as well!
    let i = 0
    if (x.include.main.len != 0) {
      fields[i] = 0
      i++
    }

    for (const y of x.include.props.values()) {
      fields[i] = y.def.prop
      i++
    }

    if (x.references.size) {
      console.log('HANDLE REFS')
    }

    const typeId = x.schema.id
    const val = createSingleSubscriptionBuffer(
      subId,
      typeId,
      fields,
      x.target.id,
    )

    console.log(fields)

    native.addIdSubscription(server.dbCtxExternal, val)
  }

  // 200 has to be different
  const int = setInterval(() => {
    const markedSubsR = native.getMarkedSubscriptions(server.dbCtxExternal)
    console.log({ markedSubsR })

    if (markedSubsR) {
      const x = new Uint8Array(markedSubsR)
      let i = 0

      for (; i < markedSubsR.byteLength; i += 8) {
        const subId = readUint32(x, i)
        const id = readUint32(x, i + 4)
        console.log('subId', subId, id)
      }

      // need to
      // do stuff
    }
  }, 200)

  await wait(200)

  await clients[0].update('user', 1, {
    name: 'MR FLAP!',
  })

  await wait(1000)

  clearInterval(int)
})
