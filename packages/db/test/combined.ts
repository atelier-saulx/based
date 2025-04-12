import { BasedDb } from '../src/index.js'
import { throws, equal, isSorted } from './shared/assert.js'
import test from './shared/test.js'
import { randomString, wait } from '@saulx/utils'

const randomPrice = () => Math.round((Math.random() * 100 + 5) * 100) / 100
const randomStock = () => Math.floor(Math.random() * 500)
const getRandom = (nr: number) => {
  return Math.ceil(Math.random() * nr)
}

// this test is not a perf test - tries a lot of randomization
await test('E-commerce Simulation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 50000,
    // debug: true,
  })

  const simulationDuration = 5e3
  let maxInProgress = 10_000
  let inProgress = 0
  let concurrency = 3000

  await db.start({ clean: true })

  t.after(() => {
    t.backup(db)
  })

  await db.setSchema({
    locales: { en: {}, de: {} }, // Add locales for text fields
    types: {
      user: {
        props: {
          name: { type: 'string', maxBytes: 50 },
          email: { type: 'alias', format: 'email' }, // Use alias for upsert testing
          createdAt: { type: 'timestamp', on: 'create' },
          lastLogin: { type: 'timestamp' },
          // Edge: User viewed products (with analytics)
          viewedProducts: {
            items: {
              ref: 'product',
              prop: 'viewedBy',
              $viewCount: { type: 'uint32' },
              $lastViewed: { type: 'timestamp' },
            },
          },
          reviews: {
            items: {
              ref: 'review',
              prop: 'user',
            },
          },
        },
      },
      category: {
        props: {
          name: { type: 'string', maxBytes: 50 },
          description: { type: 'text' },
          products: {
            items: {
              ref: 'product',
              prop: 'category',
            },
          },
        },
      },
      product: {
        props: {
          name: { type: 'string', maxBytes: 100 },
          description: { type: 'text' },
          price: { type: 'number', min: 0.01, max: 10000, step: 0.01 },
          stock: { type: 'uint32', min: 0, max: 100000 },
          tags: { type: 'cardinality' },
          createdAt: { type: 'timestamp', on: 'create' },
          updatedAt: { type: 'timestamp', on: 'update' },
          category: {
            ref: 'category',
            prop: 'products',
          },
          // Edge: Products viewed by users
          viewedBy: {
            items: {
              ref: 'user',
              prop: 'viewedProducts',
            },
          },
          reviews: {
            items: {
              ref: 'review',
              prop: 'product',
            },
          },
        },
      },
      review: {
        props: {
          user: { ref: 'user', prop: 'reviews' },
          product: { ref: 'product', prop: 'reviews' },
          rating: { type: 'uint8', min: 1, max: 5 },
          comment: { type: 'text' },
          createdAt: { type: 'timestamp', on: 'create' },
        },
      },
    },
  })

  // --- State Tracking ---
  let userIds: number = 0
  let categoryIds: number = 0
  let productIds: number = 0
  let reviewIds: number = 0

  let totalItemsCreated = 0
  let operationsCount = 0

  const magnitude = 100
  // --- Initial Population ---
  const initialCategories = 10 * magnitude
  const initialUsers = 100 * magnitude
  const initialProducts = 500 * magnitude

  const categoryIdsArr = []
  const productIdsArr = []
  const reviewIdsArr = []
  const userIdsArr = []

  for (let i = 0; i < initialCategories; i++) {
    const catId = db.create('category', {
      name: `Category ${i}`,
      description: { en: `Description for category ${i}` },
    })
    categoryIdsArr.push(catId)
    categoryIds++
    totalItemsCreated++
  }

  for (let i = 0; i < initialUsers; i++) {
    const userId = db.create('user', {
      name: `User ${i}`,
      email: `user${i}@example.com`,
      lastLogin: Math.max(
        0,
        ~~(Date.now() - Math.random() * 1000 * 3600 * 24 * 30),
      ),
    })
    userIdsArr.push(userId)
    userIds++
    totalItemsCreated++
  }

  for (let i = 0; i < initialProducts; i++) {
    const category = getRandom(categoryIds)
    if (category) {
      const prodId = db.create('product', {
        name: `Product ${i} ${randomString(5)}`,
        description: {
          en: `This is product ${i}. ${randomString(50)}`,
          de: `Das ist Produkt ${i}. ${randomString(50)}`,
        },
        price: randomPrice(),
        stock: randomStock(),
        category: category,
        tags: [`tag${i % 10}`, i % 2 === 0 ? 'even' : 'odd', 'popular'],
      })
      productIdsArr.push(prodId)
      productIds++
      totalItemsCreated++
    }
  }
  await db.drain()
  console.log(
    `Initial population complete: ${categoryIds} categories, ${userIds} users, ${productIds} products.`,
  )

  // --- Simulation Loop ---
  const startTime = Date.now()
  let intervalId: NodeJS.Timeout | null = null

  t.after(() => {
    clearInterval(intervalId)
  })

  let totalAliasUpdate = 0
  let totalAliasUpdateTime = 0

  const simulationStep = async (i: number) => {
    operationsCount++
    const action = Math.random()

    if (action < 0.15) {
      // --- CREATE ---
      const entityType = Math.random()
      if (entityType < 0.1 && categoryIds < 500) {
        // Create Category
        const catId = await db.create('category', {
          name: `New Category ${totalItemsCreated}`,
          description: { en: `Dynamic category ${totalItemsCreated}` },
        })
        categoryIdsArr.push(catId)
        categoryIds++
        totalItemsCreated++
      } else if (entityType < 0.4 && userIds < 10000) {
        // Create User
        const userId = await db.create('user', {
          name: `User ${totalItemsCreated}`,
          email: `user${totalItemsCreated}@example.com`,
        })
        userIdsArr.push(userId)
        userIds++
        totalItemsCreated++
      } else if (entityType < 0.8 && productIds < 80000) {
        // Create Product
        const category = getRandom(categoryIds)
        if (category) {
          const prodId = await db.create('product', {
            name: `Product ${totalItemsCreated} ${randomString(5)}`,
            description: { en: `Desc ${totalItemsCreated}` },
            price: randomPrice(),
            stock: randomStock(),
            category: category,
            tags: [`tag${totalItemsCreated % 10}`, 'new'],
          })
          productIdsArr.push(prodId)
          productIds++
          totalItemsCreated++
        }
      } else {
        // Create Review
        const user = getRandom(userIds)
        const product = getRandom(productIds)
        if (user && product) {
          const reviewId = await db.create('review', {
            user,
            // product,
            rating: (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5,
            comment: {
              en: `Review ${totalItemsCreated} ${randomString(30)}`,
            },
          })
          reviewIdsArr.push(reviewId)
          reviewIds++
          totalItemsCreated++
        }
      }
    } else if (action < 0.6) {
      // --- UPDATE ---
      const entityType = Math.random()
      if (entityType < 0.3) {
        // Update Product (Price/Stock)
        const productId = getRandom(productIds)
        if (productId) {
          await db.update('product', productId, {
            price: randomPrice(),
            stock: { increment: Math.random() > 0.5 ? 1 : -1 }, // Increment or decrement stock
          })
        }
      } else if (entityType < 0.6) {
        // Update User (Simulate view)
        const userId = getRandom(userIds)
        const productId = getRandom(productIds)
        if (userId && productId) {
          await db.update('user', 1, {
            lastLogin: Date.now(),
            viewedProducts: {
              update: [
                {
                  id: productId,
                  $viewCount: { increment: 1 }, //CRASHES!
                  $lastViewed: 'now',
                },
              ],
            },
          })
        }
      } else if (entityType < 0.8) {
        var d = Date.now()
        // Update User (Name/Email via Upsert)
        const oldEmail = `user${getRandom(userIds)}@example.com`
        if (oldEmail) {
          await db.upsert('user', {
            email: oldEmail, // Find by alias
            name: `Updated Name ${randomString(4)}`,
            lastLogin: Date.now(),
          })
        }
        totalAliasUpdate++
        totalAliasUpdateTime += Date.now() - d
        // console.log(Date.now() - d, 'ms')
      } else {
        // Update Category Description
        const catId = getRandom(categoryIds)
        if (catId) {
          await db.update('category', catId, {
            description: { de: `Aktualisiert ${randomString(10)}` },
          })
        }
      }
    } else if (action < 0.8 && totalItemsCreated > 100) {
      // --- DELETE --- (Less frequent)
      const entityType = Math.random()
      if (entityType < 0.3 && productIdsArr.length > 50) {
        const idx = Math.floor(Math.random() * productIdsArr.length)
        const productId = productIdsArr[idx]
        if (productId) {
          await db.delete('product', productId)
          productIdsArr.splice(idx, 1)
        }
      } else if (entityType < 0.6 && userIdsArr.length > 50) {
        const idx = Math.floor(Math.random() * userIdsArr.length)
        const userId = userIdsArr[idx]
        if (userId) {
          await db.delete('user', userId)
          userIdsArr.splice(idx, 1)
        }
      } else if (reviewIdsArr.length > 10) {
        const idx = Math.floor(Math.random() * reviewIdsArr.length)
        const reviewId = reviewIdsArr[idx]
        if (reviewId) {
          await db.delete('review', reviewId)
          reviewIdsArr.splice(idx, 1)
        }
      }
    } else {
      // --- QUERY ---
      const queryType = Math.random()
      if (queryType < 0.1) {
        isSorted(
          await db.query('user').sort('lastLogin', 'asc').get(),
          'lastLogin',
          'asc',
        )
      } else if (queryType < 0.2) {
        // Get products in a category, sorted by price
        const categoryId = getRandom(categoryIds)
        if (categoryId) {
          await db
            .query('product')
            .filter('category', '=', categoryId)
            .sort('price', Math.random() > 0.5 ? 'asc' : 'desc')
            .include('name', 'price', 'stock')
            .range(0, 10)
            .get()
        }
      } else if (queryType < 0.4) {
        // Get user's viewed products with analytics
        const userId = getRandom(userIds)
        if (userId) {
          await db
            .query('user', userId)
            .include(
              'name',
              'viewedProducts.name',
              'viewedProducts.$viewCount',
              'viewedProducts.$lastViewed',
            )
            .get()
        }
      } else if (queryType < 0.6) {
        // Get product reviews, sorted by rating
        const productId = getRandom(productIds)
        if (productId) {
          await db
            .query('review')
            .filter('product', '=', productId)
            .sort('rating', 'desc')
            .include('rating', 'comment', 'user.name')
            .range(0, 5)
            .get()
        }
      } else if (queryType < 0.8) {
        // Search product descriptions
        let searchTerm = 'tag'
        const x = Math.random()
        if (x < 0.2) {
          searchTerm = 'product'
        } else if (x < 0.4) {
          searchTerm = 'new'
        } else if (x < 0.6) {
          searchTerm = 'tag'
        } else if (x < 0.8) {
          searchTerm = randomString(4)
        }
        if (searchTerm) {
          await db
            .query('product')
            .search(searchTerm, 'name', 'description')
            .include('name', 'price')
            .range(0, 5)
            .get()
        }
      } else {
        // Get user by email (alias)
        const email = `user${getRandom(userIds)}@example.com`
        if (email) {
          await db.query('user', { email }).get()
        }
      }
    }

    // --- Validation Edge Cases ---
    if (Math.random() < 0.01) {
      // Occasionally try invalid operations
      await throws(
        async () =>
          db.create('product', { name: 'Too expensive', price: 20000 }),
        false,
        'Validation: Price too high',
      )
      await throws(
        async () =>
          db.create('review', {
            rating: 6,
            user: getRandom(userIds),
            product: getRandom(productIds),
          }),
        false,
        'Validation: Rating too high',
      )
    }
  }

  // make util for this
  let testErr: Error
  let measure = Date.now()
  let lastOperations = operationsCount
  intervalId = setInterval(async () => {
    if (inProgress > maxInProgress) {
      return
    }

    inProgress += concurrency
    // console.log({ inProgress, maxInProgress })
    if (operationsCount % 500 === 0) {
      const x = Date.now()

      const n = operationsCount - lastOperations

      const opsPerS = n / ((x - measure) / 1e3)
      measure = x
      lastOperations = operationsCount

      console.log(
        `${~~(totalAliasUpdateTime / totalAliasUpdate)}ms Ops per sec: ${~~opsPerS} concurrency: ${concurrency} Ops: ${operationsCount}, Items: ${totalItemsCreated}, Users: ${userIds}, Prods: ${productIds} inProgress: ${inProgress}`,
      )

      totalAliasUpdate = 0
      totalAliasUpdateTime = 0
    }

    let q = []
    for (let i = 0; i < concurrency; i++) {
      q.push(simulationStep(i))
    }

    try {
      await Promise.all(q)
    } catch (err) {
      testErr = err
      clearInterval(intervalId)
    }

    inProgress -= concurrency
  }, 100)

  let d = simulationDuration
  const cancelWait = async () => {
    if (testErr) {
      return
    }
    d -= 1000
    await wait(1000)
    if (d > 100) {
      return cancelWait()
    }
  }
  await cancelWait()
  if (testErr) {
    throw testErr
  }

  const finalProductCount = (
    await db.query('product').range(0, 10_000_000).get()
  ).length
  console.log(`Final product count in DB: ${finalProductCount}`)
  equal(
    finalProductCount > 0,
    true,
    'Should have products left after simulation',
  )
})
