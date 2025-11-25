import { BasedDb } from '../dist/db.mjs'

const start = async () => {
  const db = new BasedDb({
    path: 'tmp',
  })

  await db.start({ clean: true })

  await db.setSchema({
    types: {
      user: {
        props: {
          name: 'string',
          nr: 'uint32',
          // flap: { type: 'string', compression: 'none' },
        },
      },
    },
  })

  for (let i = 0; i < 1e6; i++) {
    db.create('user', {
      nr: i,
      name: 'Mr poop',
    })
  }

  console.log('start query')

  await db.drain()
  ;(await db.query('user').include('name').range(0, 1).get()).debug()
  await db.destroy()
}

start()
