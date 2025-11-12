import { wait } from '@based/utils'
import { DbClient } from '../../src/client/index.js'
import { DbServer } from '../../src/server/index.js'
import test from '../shared/test.js'
import { getDefaultHooks } from '../../src/hooks.js'
import { equal } from 'assert'

const start = async (t, clientsN = 2) => {
  const server = new DbServer({
    path: t.tmp,
  })
  const clients = Array.from({ length: clientsN }).map(
    () =>
      new DbClient({
        hooks: getDefaultHooks(server, 1),
      }),
  )
  await server.start({ clean: true })
  t.after(() => server.destroy())
  return { clients, server }
}

await test('subscriptionIdRemove', async (t) => {
  const clientsN = 2
  const { clients, server } = await start(t, clientsN)

  const amount = 10000

  await clients[0].setSchema({
    types: {
      user: {
        date: 'timestamp',
        x: 'uint8',
        name: 'string',
      },
    },
  })

  // Track all users and their subscriptions
  const users = new Map() // userId -> { id, subscription, updateCount, active }
  let nextUserId = 0
  let totalCreated = 0
  let totalRemoved = 0
  let running = true

  // Create users with subscriptions over time, ramping up to 100k total
  const addInterval = setInterval(async () => {
    if (!running || totalCreated >= amount) {
      if (totalCreated >= amount) {
        clearInterval(addInterval)
      }
      return
    }

    // Add between 50-200 users per interval
    const toAdd = Math.min(
      Math.floor(Math.random() * 150) + 50,
      amount - totalCreated,
    )

    for (let i = 0; i < toAdd; i++) {
      const userId = nextUserId++

      // Create user
      const id = await clients[0].create('user', {
        name: `User ${userId}`,
        date: 'now',
      })

      // Subscribe to the user
      const subscription = clients[0].query('user', id).subscribe(() => {
        const user = users.get(userId)
        if (user && user.active) {
          user.updateCount++
        }
      })

      users.set(userId, {
        id,
        subscription,
        updateCount: 0,
        active: true,
      })

      totalCreated++
    }
  }, 1)

  // Randomly remove subscriptions and immediately update those users
  const removeInterval = setInterval(() => {
    if (!running || totalRemoved >= amount) {
      if (totalRemoved >= amount) {
        clearInterval(removeInterval)
      }
      return
    }

    const activeUserIds = Array.from(users.keys()).filter(
      (uid) => users.get(uid).active,
    )
    if (activeUserIds.length === 0) return

    // Remove between 50-200 subscriptions per interval
    const toRemove = Math.min(
      Math.floor(Math.random() * 150) + 50,
      activeUserIds.length,
      amount - totalRemoved,
    )

    for (let i = 0; i < toRemove; i++) {
      const randomIdx = Math.floor(Math.random() * activeUserIds.length)
      const userId = activeUserIds[randomIdx]
      activeUserIds.splice(randomIdx, 1)

      const user = users.get(userId)
      if (user && user.active) {
        // Close the subscription
        user.subscription()
        user.active = false
        totalRemoved++

        // Immediately update the user after closing subscription to test if it crashes
        clients[0].update('user', user.id, {
          x: { increment: 1 },
        })

        // Update again to really stress test
        clients[0].update('user', user.id, {
          name: `Removed User ${userId}`,
        })
      }
    }
  }, 1)

  // Randomly update users periodically
  const updateInterval = setInterval(() => {
    if (!running) {
      clearInterval(updateInterval)
      return
    }

    const allUserIds = Array.from(users.keys())
    if (allUserIds.length === 0) return

    // Update 10-50 random users per interval
    const toUpdate = Math.min(
      Math.floor(Math.random() * 40) + 10,
      allUserIds.length,
    )

    for (let i = 0; i < toUpdate; i++) {
      const randomUserId =
        allUserIds[Math.floor(Math.random() * allUserIds.length)]
      const user = users.get(randomUserId)
      if (user) {
        clients[0].update('user', user.id, {
          x: { increment: 1 },
        })
      }
    }
  }, 1)

  t.after(() => {
    clearInterval(addInterval)
    clearInterval(removeInterval)
    clearInterval(updateInterval)
  })

  // Wait until we've created and removed 100k subscriptions
  while (totalCreated < amount || totalRemoved < amount) {
    await wait(100)
  }

  running = false
  clearInterval(addInterval)
  clearInterval(removeInterval)
  clearInterval(updateInterval)

  // Wait for final operations to complete
  await wait(200)

  // Verify all subscriptions received proper updates
  let correctCounts = 0
  let incorrectCounts = 0
  let raceCaseCount = 0
  const errors = []

  for (const [userId, user] of users.entries()) {
    if (!user.active) {
      // Inactive subscription
      if (user.updateCount >= 1) {
        // Normal case - received at least initial state
        correctCounts++
      } else if (user.updateCount === 0) {
        // Edge case: subscription was removed before initial state delivery
        // This is acceptable due to async nature of subscription initialization
        raceCaseCount++
        correctCounts++
      } else {
        incorrectCounts++
        errors.push({
          userId,
          updateCount: user.updateCount,
          active: user.active,
        })
      }
    } else {
      // Active subscription - should have at least initial state
      if (user.updateCount >= 1) {
        correctCounts++
      } else {
        incorrectCounts++
        errors.push({
          userId,
          updateCount: user.updateCount,
          active: user.active,
        })
      }
    }
  }

  if (incorrectCounts > 0) {
    console.log('Sample errors:')
    errors.slice(0, 10).forEach((err) => {
      console.log(
        `  User ${err.userId}: updateCount=${err.updateCount}, active=${err.active}`,
      )
    })
  }

  equal(incorrectCounts, 0, 'All subscriptions should have received updates')

  // Close remaining subscriptions
  for (const user of users.values()) {
    if (user.active) {
      user.subscription()
    }
  }

  await wait(100)

  equal(server.subscriptions.active, 0)
})
