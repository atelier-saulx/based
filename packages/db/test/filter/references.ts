import test from '../shared/test.js'
import { BasedDb } from '../../src/index.js'

await test('filter references drones', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
  })
  await db.start({ clean: true })
  t.after(() => t.backup(db))

  await db.setSchema({
    types: {
      workspace: {
        props: {
          name: 'string',
        },
      },
      user: {
        props: {
          name: 'string',
          workspaces: {
            items: {
              ref: 'workspace',
              prop: 'users',
            },
          },
        },
      },
      drone: {
        props: {
          name: 'string',
          workspace: {
            ref: 'workspace',
            prop: 'drones',
          },
        },
      },
    },
  })

  for (let w = 1; w <= 1000; w++) {
    const wkspc = db.create('workspace', { name: `Workspace ${w}` })
    if (w == 500 || w == 750) {
      db.create('user', { name: 'User A', workspaces: [wkspc] })
    }
    for (let d = 0; d < 1000; d++) {
      db.create('drone', { workspace: wkspc, name: `Drone ${d}` })
    }
  }

  console.log(await db.drain(), 'ms')

  const user = 1

  const drones = await db
    .query('user')
    .include((s) =>
      s('workspaces').include((s) =>
        s('drones').include('*').filter('workspace.users', 'includes', user),
      ),
    )
    .include('*')
    .get()

  const drones2 = await db
    .query('drone')
    .filter('workspace.users', 'includes', user)
    .get()

  drones.inspect()
  drones2.inspect()
})
