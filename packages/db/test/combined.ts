import { BasedDb } from '../src/index.js'
import { throws, equal, isSorted } from './shared/assert.js'
import test from './shared/test.js'
import { randomString, wait } from '@saulx/utils'

const getRandom = <T>(arr: T[]): T | undefined => {
  if (arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

const randomPrice = () => Math.round((Math.random() * 100 + 5) * 100) / 100
const randomStock = () => Math.floor(Math.random() * 500)

// this test is not a perf test - tries a lot of randomization
await test('E-commerce Simulation', async (t) => {
  const db = new BasedDb({
    path: t.tmp,
    maxModifySize: 50000,
  })

  const simulationDuration = 120 * 100
  let maxInProgress = 1000
  let inProgress = 0
  let concurrency = 3

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
  const userIds: number[] = []
  const categoryIds: number[] = []
  const productIds: number[] = []
  const reviewIds: number[] = []
  let totalItemsCreated = 0
  let operationsCount = 0

  // --- Initial Population ---
  const initialCategories = 10
  const initialUsers = 100
  const initialProducts = 500

  for (let i = 0; i < initialCategories; i++) {
    const catId = await db.create('category', {
      name: `Category ${i}`,
      description: { en: `Description for category ${i}` },
    })
    categoryIds.push(catId)
    totalItemsCreated++
  }

  for (let i = 0; i < initialUsers; i++) {
    const userId = await db.create('user', {
      name: `User ${i}`,
      email: `user${i}@example.com`,
      lastLogin: Math.max(
        0,
        ~~(Date.now() - Math.random() * 1000 * 3600 * 24 * 30),
      ),
    })
    userIds.push(userId)
    totalItemsCreated++
  }

  for (let i = 0; i < initialProducts; i++) {
    const category = getRandom(categoryIds)
    if (category) {
      const prodId = await db.create('product', {
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
      productIds.push(prodId)
      totalItemsCreated++
    }
  }
  await db.drain()
  console.log(
    `Initial population complete: ${categoryIds.length} categories, ${userIds.length} users, ${productIds.length} products.`,
  )

  // --- Simulation Loop ---
  const startTime = Date.now()
  let intervalId: NodeJS.Timeout | null = null

  t.after(() => {
    clearInterval(intervalId)
  })

  const simulationStep = async (i: number) => {
    operationsCount++
    const action = Math.random()

    if (action < 0.15) {
      // --- CREATE ---
      const entityType = Math.random()
      if (entityType < 0.1 && categoryIds.length < 50) {
        // Create Category
        const catId = await db.create('category', {
          name: `New Category ${totalItemsCreated}`,
          description: { en: `Dynamic category ${totalItemsCreated}` },
        })
        categoryIds.push(catId)
        totalItemsCreated++
      } else if (entityType < 0.4 && userIds.length < 4000) {
        // Create User
        const userId = await db.create('user', {
          name: `User ${totalItemsCreated}`,
          email: `user${totalItemsCreated}@example.com`,
        })
        userIds.push(userId)
        totalItemsCreated++
      } else if (entityType < 0.8 && productIds.length < 8000) {
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
          productIds.push(prodId)
          totalItemsCreated++
        }
      } else {
        // Create Review
        const user = getRandom(userIds)
        const product = getRandom(productIds)
        if (user && product) {
          const reviewId = await db.create('review', {
            user,
            product,
            rating: (Math.floor(Math.random() * 5) + 1) as 1 | 2 | 3 | 4 | 5,
            comment: {
              en: `Review ${totalItemsCreated} ${randomString(30)}`,
            },
          })
          reviewIds.push(reviewId)
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
          await db.update('user', userId, {
            lastLogin: Date.now(),
            viewedProducts: {
              update: [
                {
                  id: productId,
                  // $viewCount: { increment: 1 },
                  $lastViewed: 'now',
                },
              ],
            },
          })
        }
      } else if (entityType < 0.8) {
        // Update User (Name/Email via Upsert)
        const oldEmail = getRandom(userIds.map((id) => `user${id}@example.com`))
        if (oldEmail) {
          // await db.upsert('user', {
          //   email: oldEmail, // Find by alias
          //   name: `Updated Name ${randomString(4)}`,
          //   lastLogin: Date.now(),
          // })
        }
      } else {
        // Update Category Description
        const catId = getRandom(categoryIds)
        if (catId) {
          await db.update('category', catId, {
            description: { de: `Aktualisiert ${randomString(10)}` },
          })
        }
      }
    } else if (action < 0.7 && totalItemsCreated > 100) {
      // --- DELETE --- (Less frequent)
      const entityType = Math.random()
      if (entityType < 0.3 && productIds.length > 50) {
        const idx = Math.floor(Math.random() * productIds.length)
        const productId = productIds[idx]
        if (productId) {
          await db.delete('product', productId)
          productIds.splice(idx, 1)
        }
      } else if (entityType < 0.6 && userIds.length > 50) {
        const idx = Math.floor(Math.random() * userIds.length)
        const userId = userIds[idx]
        if (userId) {
          await db.delete('user', userId)
          userIds.splice(idx, 1)
        }
      } else if (reviewIds.length > 10) {
        const idx = Math.floor(Math.random() * reviewIds.length)
        const reviewId = reviewIds[idx]
        if (reviewId) {
          await db.delete('review', reviewId)
          reviewIds.splice(idx, 1)
        }
      }
    } else {
      // --- QUERY ---
      const queryType = Math.random()
      if (queryType < 0.1) {
        // isSorted(
        //   await db.query('user').sort('lastLogin', 'asc').get(),
        //   'lastLogin',
        //   'asc',
        // )
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
        const searchTerm = getRandom(['product', 'new', 'tag', randomString(4)])
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
        const email = getRandom(userIds.map((id) => `user${id}@example.com`))
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

    await wait(10)
    // if (operationsCount % 50 === 0) {
    //   console.log(
    //     `Ops: ${operationsCount}, Items: ${totalItemsCreated}, Users: ${userIds.length}, Prods: ${productIds.length} inProgress: ${inProgress}`,
    //   )
    // }
  }

  // make util for this
  let testErr: Error
  intervalId = setInterval(async () => {
    if (inProgress > maxInProgress) {
      return
    }
    await db.isModified()

    let q = []
    for (let i = 0; i < concurrency; i++) {
      q.push(simulationStep(i))
    }
    inProgress += concurrency
    try {
      await Promise.all(q)
      inProgress -= concurrency
    } catch (err) {
      testErr = err
      clearInterval(intervalId)
    }
  })
  let d = simulationDuration
  const cancelWait = async () => {
    if (testErr) {
      return
    }
    d -= 100
    await wait(100)
    if (d > 100) {
      return cancelWait()
    }
  }
  await cancelWait()
  if (testErr) {
    throw testErr
  }

  const finalProductCount = (await db.query('product').get()).length
  console.log(`Final product count in DB: ${finalProductCount}`)
  equal(
    finalProductCount > 0,
    true,
    'Should have products left after simulation',
  )
})
