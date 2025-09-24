import { BasedDb } from '../src/index.js'
import test from './shared/test.js'
import { deepEqual, equal } from './shared/assert.js'

await test('ah', async (t) => {
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

  let wsA: number,
    wsB: number,
    droneA: number,
    droneB: number,
    droneUnrelated: number,
    user: number

  wsA = await db.create('workspace', { name: 'A Workspace' })
  wsB = await db.create('workspace', { name: 'B Workspace' })
  const wsC = await db.create('workspace', { name: 'C Workspace' })
  user = await db.create('user', { name: 'User A', workspaces: [wsA, wsB] })
  droneA = await db.create('drone', { workspace: wsA, name: 'Drone A' })
  droneB = await db.create('drone', { workspace: wsB, name: 'Drone B' })
  droneUnrelated = await db.create('drone', {
    name: 'Dont include me in results!',
  })

  for (let i = 0; i < 1e7; i++) {
    db.create('drone', { workspace: wsC, name: `Drone ${i}` })
  }

  console.time('q1')
  const drones = await db
    .query('user', user)
    .include((s) =>
      s('workspaces').include((s) => s('drones').include('*').range(0, 1)),
    )
    .get()
  console.timeEnd('q1')

  console.time('q2')
  const drones2 = await db
    .query('drone')
    .filter('workspace.users', 'includes', user)
    .get()
  console.timeEnd('q2')

  drones.inspect()
  drones2.inspect()
})

//   drones.inspect(10)

//   const droneso = drones
//     .toObject()!
//     .workspaces.map((ws: any) => ws.drones)
//     .flat()

//   deepEqual(
//     droneso,
//     [
//       { id: 1, name: 'Drone A' },
//       { id: 2, name: 'Drone B' },
//     ],
//     'approach 1',
//   )

// This uses the graph, and feels like we're not iterating through all drones.
// But now pagination doesn't really work anymore, as illustrated by the range that limits to a single drone,
// where in the end, we, of course, still have both drones in the result.

// it('can query drones through drones as well', async () => {

//   -----
// drones2.inspect(10)

//   deepEqual(
//     drones2.toObject(),
//     [
//       { id: 1, name: 'Drone A' },
//       { id: 2, name: 'Drone B' },
//     ],
//     'approach 2',
//   )

// This query feels easier, but on the other hand, it feels more expensive as it considers all drones and then filters them down.

// Also, adding deeper conditions, like, filter where the workspace.users includes our user, and the edge data between user and workspace needs to indicate a certain role, for example.
// I'm not even sure if we can add that here?

// This does allow for easy pagination, so from that point of view this query is better.
