import test from 'ava'
import createServer from '@based/server'
import { wait } from '@saulx/utils'
import based from '../src'
import { start } from '@saulx/selva-server'

let db

const query = {
  things: {
    name: true,
    id: true,
    nested: true,
    $list: {
      $find: {
        $traverse: 'children',
        $filter: {
          $operator: '=',
          $value: 'thing',
          $field: 'type',
        },
      },
    },
  },
}

test.before(async () => {
  const selvaServer = await start({
    port: 9099,
    pipeRedisLogs: { stdout: false, stderr: false },
  })
  db = selvaServer.selvaClient
  await selvaServer.selvaClient.updateSchema({
    types: {
      thing: {
        fields: {
          name: { type: 'string' },
          nested: {
            type: 'object',
            properties: {
              something: { type: 'string' },
            },
          },
        },
      },
    },
  })
})

test.after(async () => {
  await db.destroy()
})

// need to add 'salt' for the hashing function in the db for passwords
test.serial('call functions', async (t) => {
  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      // give me based public key for admin validation
      functions: {
        ale: {
          observable: false,
          function: async ({ based }) => {
            return based.get({
              $id: 'root',
              $all: true,
            })
          },
        },
        hello: {
          observable: false,
          function: async () => {
            return {
              snapje: 'ja',
            }
          },
        },
        bye: {
          observable: false,
          function: async ({ payload, based }) => {
            if (payload === 2) {
              throw new Error('My snurky')
            }
            if (payload === 3) {
              const err = new Error('my custom error')
              err.name = 'FlappieError'
              throw err
            }
            if (payload === 4) {
              return based.get({
                $id: 'root',
                $all: true,
              })
            }
            if (payload === 5) {
              // fix this with callerName
              return based.call('hello')
            }
            return {
              snapje: 'ja',
            }
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  await client.call('ale')

  const x = await client.call('hello')

  t.deepEqual(x, {
    snapje: 'ja',
  })

  t.throwsAsync(client.call('snurk'))

  try {
    await client.call('bye', 2)
  } catch (err) {
    console.error(err)
  }

  try {
    await client.call('bye', 3)
  } catch (err) {
    console.error(err)
  }

  const z = await client.call('bye', 4)

  t.deepEqual(z, { id: 'root', type: 'root' })

  const a = await client.call('bye', 5)

  await server.destroy()

  t.deepEqual(a, {
    snapje: 'ja',
  })

  client.disconnect()

  // better nested error handling - share it
})

// need to add 'salt' for the hashing function in the db for passwords
test.serial('observable functions', async (t) => {
  let closedCnt = 0

  const server = await createServer({
    port: 9100,
    db: {
      host: 'localhost',
      port: 9099,
    },
    config: {
      functions: {
        x: {
          observable: false,
          function: async () => {
            return { bla: 'x' }
          },
        },
        advanced: {
          shared: true,
          observable: true,
          function: async ({ payload, update, based }) =>
            based.observe(payload, update),
        },
        counter: {
          shared: true,
          observable: true,
          function: async ({ update }) => {
            let cnt = 0
            const interval = setInterval(() => {
              update({
                gurky: true,
                cnt: ++cnt,
              })
            }, 500)
            return () => {
              console.info('CLOSE CLOSE CLOSE')
              closedCnt++
              clearInterval(interval)
            }
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  let lastIncoming: any

  client.client.debug = (msg, type) => {
    if (type === 'incoming') {
      lastIncoming = msg
    }
  }

  try {
    await client.observe('flappie', () => {})
    t.fail('Non existing observable fn should throw')
  } catch (err) {}

  const close = await client.observe('counter', () => {})

  await wait(3e3)

  console.info(JSON.stringify(lastIncoming, null, 2))

  t.deepEqual(lastIncoming, [
    2,
    1625053507847,
    {
      cnt: [0, 6],
    },
    [6513385587101, 5622279198622],
  ])

  close()

  await wait(5250)
  t.is(closedCnt, 1)

  try {
    await client.observe('advanced', query, () => {})
  } catch (err) {
    t.fail('correct payload should not throw')
  }

  try {
    await client.observe('advanced', { x: 'nurky' }, () => {})
    t.fail('Wrong payload for observe - needs to throw')
  } catch (err) {}

  await client.set({
    type: 'thing',
    name: 'MY SNURELS',
  })

  await wait(2000)

  await server.destroy()

  client.disconnect()

  t.pass('everything clear')
})

test.serial('observable functions + get', async (t) => {
  const makeServer = async () => {
    return createServer({
      port: 9100,
      db: {
        host: 'localhost',
        port: 9099,
      },
      config: {
        functions: {
          slow: {
            shared: true,
            observable: true,
            function: async ({ update }) => {
              await wait(1e3)
              update({
                rando: Math.random(),
              })
              return () => {}
            },
          },
          advanced: {
            shared: true,
            observable: true,
            function: async ({ payload, update, based }) => {
              return based.observe(payload, update)
            },
          },
          nestedObservable: {
            shared: true,
            observable: true,
            function: async ({ payload, based, update }) => {
              return based.observe('advanced', payload, update)
            },
          },
        },
      },
    })
  }

  const server = await makeServer()

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  await client.set({
    type: 'thing',
    name: 'snurk',
  })

  const x = await client.get('advanced', query)

  t.true(!!x.things.find((v) => v.name === 'snurk'))

  await wait(5250)

  t.is(Object.keys(server.subscriptions).length, 0)

  await server.destroy()

  const server2 = await makeServer()

  const y = await client.get('advanced', query)

  t.true(!!y.things.find((v) => v.name === 'snurk'))

  await wait(5250)

  t.is(Object.keys(server2.subscriptions).length, 0)

  await server2.destroy()

  let getReceived = 0
  let subReceived = 0

  client.get('advanced', query).then(() => {
    getReceived++
  })

  let close

  client
    .observe('advanced', query, () => {
      subReceived++
    })
    .then((c) => {
      close = c
    })

  const server3 = await makeServer()

  await wait(3000)

  t.is(Object.keys(server3.subscriptions).length, 1)

  t.is(getReceived, 1)
  t.is(subReceived, 1)

  await server3.destroy()
  close()

  client.get('advanced', query).then(() => {
    getReceived++
  })

  await wait(5000)

  client
    .observe('advanced', query, () => {
      subReceived++
    })
    .then((c) => {
      close = c
    })

  const server4 = await makeServer()

  await wait(1000)
  t.is(Object.keys(server4.subscriptions).length, 1)
  close()

  t.is(getReceived, 2)
  t.is(subReceived, 2)

  await wait(6000)
  t.is(Object.keys(server4.subscriptions).length, 0)

  await server4.destroy()

  client.get('slow').then(() => {
    getReceived++
  })

  const server5 = await makeServer()

  await wait(500)

  client.observe('slow', () => {
    subReceived++
  })

  await wait(3250)
  t.is(Object.keys(server5.subscriptions).length, 1)
  t.is(getReceived, 3)
  t.is(subReceived, 3)

  client.disconnect()
  await server5.destroy()
})

test.serial('nested observable', async (t) => {
  const makeServer = async () => {
    return createServer({
      port: 9100,
      db: {
        host: 'localhost',
        port: 9099,
      },
      config: {
        functions: {
          advanced: {
            shared: true,
            observable: true,
            function: async ({ payload, update, based }) => {
              return based.observe(payload, (res) => {
                update(res)
              })
            },
          },
          nestedObservable: {
            shared: true,
            observable: true,
            function: async ({ payload, based, update }) => {
              return based.observe('advanced', payload, (res) => {
                update(res)
              })
            },
          },
        },
      },
    })
  }

  const server = await makeServer()

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  await client.set({
    type: 'thing',
    name: 'snurk',
  })

  await client.observe('nestedObservable', query, () => {})

  const x = await client.get('nestedObservable', query)

  t.true(!!x.things.find((v) => v.name === 'snurk'))

  client.disconnect()
  await server.destroy()
})

test.serial('observable functions + get + internal', async (t) => {
  const makeServer = async () => {
    return createServer({
      port: 9100,
      db: {
        host: 'localhost',
        port: 9099,
      },
      config: {
        functions: {
          a: {
            shared: true,
            observable: true,
            function: async ({ update }) => {
              update({
                rando: Math.random(),
              })
              const int = setInterval(() => {
                update({
                  rando: Math.random(),
                })
              }, 500)
              return () => {
                clearInterval(int)
              }
            },
          },
          b: {
            shared: true,
            observable: true,
            function: async ({ update, based }) => {
              // also need to close all observables if a client dc's
              return based.observe('a', (d) => {
                update({
                  ...d,
                  from: 'b',
                })
              })
            },
          },
        },
      },
    })
  }

  const server = await makeServer()

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const x = []

  const close = await client.observe('b', (d) => {
    x.push(d)
  })

  await wait(2100)

  t.is(x.length, 5)

  close()

  await wait(12e3)

  t.is(Object.keys(server.subscriptions).length, 0)

  await wait(1000)

  client.disconnect()
  await server.destroy()
})

test.serial(
  'observable functions + get + internal hard dc of client',
  async (t) => {
    const makeServer = async () => {
      return createServer({
        port: 9100,
        db: {
          host: 'localhost',
          port: 9099,
        },
        config: {
          functions: {
            a: {
              shared: true,
              observable: true,
              function: async ({ update }) => {
                update({
                  rando: Math.random(),
                })
                const int = setInterval(() => {
                  update({
                    rando: Math.random(),
                  })
                }, 500)
                return () => {
                  clearInterval(int)
                }
              },
            },
            b: {
              shared: true,
              observable: true,
              function: async ({ update, based }) => {
                // also need to close all observables if a client dc's
                return based.observe('a', (d) => {
                  update({
                    ...d,
                    from: 'b',
                  })
                })
              },
            },
          },
        },
      })
    }

    const server = await makeServer()

    const client = based({
      url: async () => {
        return 'ws://localhost:9100'
      },
    })

    const x = []

    await client.observe('b', (d) => {
      x.push(d)
    })

    await wait(2100)

    t.is(x.length, 5)

    client.disconnect()

    await wait(12e3)

    t.is(Object.keys(server.subscriptions).length, 0)

    await wait(1000)

    await server.destroy()
  }
)

test.serial('observable functions + internal + normal', async (t) => {
  const makeServer = async () => {
    return createServer({
      port: 9100,
      db: {
        host: 'localhost',
        port: 9099,
      },
      config: {
        functions: {
          a: {
            shared: true,
            observable: true,
            function: async ({ update }) => {
              update({
                rando: Math.random(),
              })
              const int = setInterval(() => {
                update({
                  rando: Math.random(),
                })
              }, 500)
              return () => {
                clearInterval(int)
              }
            },
          },
          b: {
            shared: true,
            observable: true,
            function: async ({ update, based }) => {
              // also need to close all observables if a client dc's
              return based.observe('a', (d) => {
                update({
                  ...d,
                  from: 'b',
                })
              })
            },
          },
        },
      },
    })
  }

  const server = await makeServer()

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const x = []

  const close = await client.observe('b', (d) => {
    x.push(d)
  })

  const close2 = await client.observe('a', (d) => {
    x.push(d)
  })

  await wait(2100)

  t.is(x.length, 10)

  close2()

  await wait(5e3)

  t.is(Object.keys(server.subscriptions).length, 2)

  close()

  await wait(12e3)

  t.is(Object.keys(server.subscriptions).length, 0)

  await wait(1000)

  client.disconnect()
  await server.destroy()
})

test.serial('observable functions + get observable', async (t) => {
  const makeServer = async () => {
    return createServer({
      port: 9100,
      db: {
        host: 'localhost',
        port: 9099,
      },
      config: {
        functions: {
          a: {
            shared: true,
            observable: true,
            function: async ({ update }) => {
              update({
                rando: Math.random(),
              })
              const int = setInterval(() => {
                update({
                  rando: Math.random(),
                })
              }, 500)
              return () => {
                clearInterval(int)
              }
            },
          },
          b: {
            observable: false,
            function: async ({ based }) => {
              const a = await based.get('a')

              return {
                flap: 'yes',
                a,
              }
            },
          },
        },
      },
    })
  }

  const server = await makeServer()

  const client = based({
    url: async () => {
      return 'ws://localhost:9100'
    },
  })

  const x = await client.call('b')

  t.true(!!x.a.rando)

  await wait(12e3)

  t.is(Object.keys(server.subscriptions).length, 0)

  await wait(1000)
  client.disconnect()

  await server.destroy()
})
