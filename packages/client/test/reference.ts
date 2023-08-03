import test from 'ava'
import { BasedDbClient, protocol } from '../src'
import { startOrigin } from '../../server/dist'
import { SelvaServer } from '../../server/dist/server'
import { wait } from '@saulx/utils'
import './assertions'

let srv: SelvaServer
let client: BasedDbClient
test.beforeEach(async (_t) => {
  console.log('origin')
  srv = await startOrigin({
    port: 8081,
    name: 'default',
  })

  console.log('connecting')
  client = new BasedDbClient()
  client.connect({
    port: 8081,
    host: '127.0.0.1',
  })

  console.log('updating schema')

  await client.updateSchema({
    // TODO: add 'en_us' and 'en_uk'?
    languages: ['en', /* 'en_us', 'en_uk',*/ 'de', 'nl'],
    root: {
      fields: {
        value: { type: 'number' },
      },
    },
    types: {
      logo: {
        prefix: 'lo',
        fields: {
          name: { type: 'string' },
          bidirClub: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirLogo',
            },
          },
        },
      },
      club: {
        prefix: 'cl',
        fields: {
          specialMatch: { type: 'reference' },
          bidirMatches: {
            type: 'references',
            bidirectional: {
              fromField: 'bidirClub',
            },
          },
          relatedClubs: {
            type: 'references',
            bidirectional: {
              fromField: 'relatedClubs',
            },
          },
          bidirLogo: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirClub',
            },
          },
          nested: {
            type: 'object',
            properties: {
              specialMatch: { type: 'reference' },
            },
          },
          value: { type: 'number' },
          age: { type: 'number' },
          auth: {
            type: 'json',
          },
          title: { type: 'text' },
          description: { type: 'text' },
          image: {
            type: 'object',
            properties: {
              thumb: { type: 'string' },
              poster: { type: 'string' },
            },
          },
        },
      },
      match: {
        prefix: 'ma',
        fields: {
          value: { type: 'number' },
          title: { type: 'text' },
          description: { type: 'text' },
          bidirClub: {
            type: 'reference',
            bidirectional: {
              fromField: 'bidirMatches',
            },
          },
        },
      },
    },
  })
})

test.afterEach(async (_t) => {
  await srv.destroy()
  client.destroy()
  await wait(300)
})

// TODO: references not working
// TODO: sort not working?
// TypeError {
//   message: 'b.sort is not a function',
// }
test.serial.only('simple singular reference', async (t) => {
  // const match1 = await client.set({
  //   $id: 'maA',
  //   title: {
  //     en: 'yesh match'
  //   }
  // })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  const specialMatch = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: ['clA'],
  })
  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    // specialMatch: {
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match',
    //   },
    // },
    specialMatch,
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: true,
    }),
    {
      title: 'yesh club',
      specialMatch: 'maA',
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        description: { $default: 'no description' },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        description: 'no description',
      },
    }
  )
})

// TODO: references not working
// TODO: sort not working?
// TypeError {
//   message: 'b.sort is not a function',
// }
test.serial.skip('simple singular reference with $flatten', async (t) => {
  const specialMatch = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: ['clA'],
  })
  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    // specialMatch: {
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match',
    //   },
    // },
    specialMatch,
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      // title: true,
      specialMatch: {
        $flatten: true,
        title: true,
        description: { $default: 'no description' },
      },
    }),
    {
      id: 'clA',
      title: 'yesh match',
      description: 'no description',
    }
  )
})

// TODO: references not working
// TODO: sort not working?
test.serial.skip('nested singular reference with $flatten', async (t) => {
  const specialMatch = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: ['clA'],
  })
  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    nested: {
      // specialMatch: {
      //   $id: 'maA',
      //   title: {
      //     en: 'yesh match',
      //   },
      // },
      specialMatch,
    },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      nested: {
        specialMatch: {
          $flatten: true,
          title: true,
          description: { $default: 'no description' },
        },
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      nested: {
        title: 'yesh match',
        description: 'no description',
      },
    }
  )
})

// TODO: parents: { $add } not working
test.serial.skip('singular reference inherit', async (t) => {
  await client.set({
    $id: 'maB',
    value: 112,
  })

  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: {
      $add: 'maB',
    },
  })

  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    specialMatch: match1,
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: {
  //     $id: 'maA',
  //     title: {
  //       en: 'yesh match'
  //     }
  //   }
  // })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        // value: { $inherit: { $type: ['match', 'club'] } }
        value: { $inherit: true },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        value: 112,
      },
    }
  )
})

// TODO: references not working
// TODO: sort not working?
test.serial.skip('singular reference $field', async (t) => {
  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
  })

  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    specialMatch: match1,
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: {
  //     $id: 'maA',
  //     title: {
  //       en: 'yesh match'
  //     }
  //   }
  // })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      match: {
        $field: 'specialMatch',
        title: true,
      },
    }),
    {
      title: 'yesh club',
      match: {
        title: 'yesh match',
      },
    }
  )
})

// TODO: parents: { $add } not working
test.serial.skip('singular reference inherit reference', async (t) => {
  await client.set({
    $id: 'clB',
    specialMatch: 'maA',
  })

  await client.set({
    $id: 'maB',
    value: 9001,
  })

  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
    parents: {
      $add: 'maB',
    },
  })

  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    parents: {
      $add: 'clB',
    },
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: {
  //     $id: 'maA',
  //     title: {
  //       en: 'yesh match'
  //     }
  //   }
  // })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      special: {
        $field: 'specialMatch',
        $inherit: { $type: ['club', 'match'] },
        title: true,
        // value: { $inherit: { $type: ['club', 'match'] } }
        value: { $inherit: true },
      },
    }),
    {
      title: 'yesh club',
      special: {
        title: 'yesh match',
        value: 9001,
      },
    }
  )
})

// TODO: references not working
// TODO: sort not working?
test.serial.skip('list of simple singular reference', async (t) => {
  const match1 = await client.set({
    $id: 'maA',
    title: {
      en: 'yesh match',
    },
  })

  // const club1 = await client.set({
  //   $id: 'clA',
  //   title: {
  //     en: 'yesh club'
  //   },
  //   specialMatch: match1
  // })

  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    // specialMatch: {
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match',
    //   },
    // },
    specialMatch: match1,
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: true,
    }),
    {
      title: 'yesh club',
      specialMatch: 'maA',
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      title: true,
      specialMatch: {
        title: true,
        description: { $default: 'no description' },
      },
    }),
    {
      title: 'yesh club',
      specialMatch: {
        title: 'yesh match',
        description: 'no description',
      },
    }
  )

  const result = await client.get({
    $id: 'root',
    $language: 'en',
    children: {
      id: true,
      title: true,
      parents: true,
      specialMatch: {
        id: true,
        title: true,
      },
      $list: {
        $find: {
          $filter: [
            {
              $field: 'type',
              $operator: '=',
              $value: 'club',
            },
          ],
        },
      },
    },
  })

  console.log(JSON.stringify(result, null, 2))
  t.deepEqual(result, {
    children: [
      {
        id: 'clA',
        title: 'yesh club',
        parents: ['root'],
        specialMatch: { id: 'maA', title: 'yesh match' },
      },
    ],
  })

  t.deepEqual(
    await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        parents: true,
        specialMatch: {
          id: true,
          title: true,
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    }),
    {
      children: [
        {
          id: 'clA',
          type: 'club',
          parents: ['root'],
          title: 'yesh club',
          specialMatch: { id: 'maA', title: 'yesh match' },
        },
      ],
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'clA',
      $all: true,
      createdAt: false,
      updatedAt: false,
      specialMatch: {
        $all: true,
        createdAt: false,
        updatedAt: false,
      },
    }),
    {
      id: 'clA',
      type: 'club',
      title: { en: 'yesh club' },
      specialMatch: {
        id: 'maA',
        title: { en: 'yesh match' },
        type: 'match',
      },
    }
  )

  await client.set({
    $id: 'maA',
    bidirClub: 'clA',
  })

  t.deepEqual(
    await client.get({
      $id: 'clA',
      $all: true,
      createdAt: false,
      updatedAt: false,
      specialMatch: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        bidirClub: {
          $all: true,
          createdAt: false,
          updatedAt: false,
        },
      },
    }),
    {
      id: 'clA',
      type: 'club',
      title: { en: 'yesh club' },
      specialMatch: {
        id: 'maA',
        title: { en: 'yesh match' },
        type: 'match',
        bidirClub: {
          id: 'clA',
          type: 'club',
          title: { en: 'yesh club' },
        },
      },
    }
  )

  t.deepEqual(
    await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        $all: true,
        createdAt: false,
        updatedAt: false,
        specialMatch: {
          $all: true,
          createdAt: false,
          updatedAt: false,
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    }),
    {
      children: [
        {
          id: 'clA',
          type: 'club',
          title: 'yesh club',
          specialMatch: { id: 'maA', title: 'yesh match', type: 'match' },
        },
      ],
    }
  )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip('simple singular bidirectional reference', async (t) => {
  const club1 = await client.set({
    $id: 'clA',
    title: {
      en: 'yesh club',
    },
    bidirMatches: [
      {
        $id: 'maA',
        title: {
          en: 'yesh match',
        },
      },
      {
        $id: 'maB',
        title: {
          en: 'yesh match 2',
        },
      },
    ],
    bidirLogo: {
      $id: 'lo1',
      name: 'logo 1',
    },
  })

  const club2 = await client.set({
    $id: 'clB',
    title: {
      en: 'yesh club 2',
    },
    relatedClubs: {
      $add: 'clA',
    },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'maA',
      $language: 'en',
      id: true,
      title: true,
      bidirClub: {
        id: true,
        title: true,
        logo: {
          $field: 'bidirLogo',
          name: true,
        },
      },
    }),
    {
      id: 'maA',
      title: 'yesh match',
      bidirClub: {
        id: 'clA',
        title: 'yesh club',
        logo: {
          name: 'logo 1',
        },
      },
    }
  )

  await client.set({
    $id: 'clA',
    bidirMatches: {
      $delete: 'maA',
    },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'maA',
      $language: 'en',
      id: true,
      title: true,
      bidirClub: {
        id: true,
        title: true,
        logo: {
          $field: 'bidirLogo',
          name: true,
        },
      },
    }),
    {
      id: 'maA',
      title: 'yesh match',
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [
        {
          id: 'maB',
          title: 'yesh match 2',
        },
      ],
      bidirLogo: {
        id: 'lo1',
        name: 'logo 1',
      },
    }
  )

  await client.set({
    $id: 'clA',
    bidirLogo: {
      $delete: true,
    },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [
        {
          id: 'maB',
          title: 'yesh match 2',
        },
      ],
    }
  )

  await client.set({
    $id: 'maB',
    bidirClub: { $delete: true },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      bidirMatches: {
        id: true,
        title: true,
        $list: true,
      },
      bidirLogo: {
        id: true,
        name: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      bidirMatches: [],
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      relatedClubs: [
        {
          id: 'clB',
          title: 'yesh club 2',
        },
      ],
    }
  )

  await client.set({
    $id: 'clB',
    relatedClubs: {
      $delete: 'clA',
    },
  })

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clA',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clA',
      title: 'yesh club',
      relatedClubs: [],
    }
  )

  t.deepEqualIgnoreOrder(
    await client.get({
      $id: 'clB',
      $language: 'en',
      id: true,
      title: true,
      relatedClubs: {
        id: true,
        title: true,
        $list: true,
      },
    }),
    {
      id: 'clB',
      title: 'yesh club 2',
      relatedClubs: [],
    }
  )
})

// TODO: waiting for creating node directly when setting children
test.serial.skip(
  'list of simple singular reference with $field usage',
  async (t) => {
    // const match1 = await client.set({
    //   $id: 'maA',
    //   title: {
    //     en: 'yesh match'
    //   }
    // })

    // const club1 = await client.set({
    //   $id: 'clA',
    //   title: {
    //     en: 'yesh club'
    //   },
    //   specialMatch: match1
    // })

    const club1 = await client.set({
      $id: 'clA',
      title: {
        en: 'yesh club',
      },
      specialMatch: {
        $id: 'maA',
        title: {
          en: 'yesh match',
        },
      },
    })

    let result = await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        id: true,
        title: true,
        parents: true,
        match: {
          id: { $field: 'specialMatch.id' },
          title: { $field: 'specialMatch.title' },
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    })

    console.log(JSON.stringify(result, null, 2))
    t.deepEqual(result, {
      children: [
        {
          id: 'clA',
          title: 'yesh club',
          parents: ['root'],
          match: { id: 'maA', title: 'yesh match' },
        },
      ],
    })

    result = await client.get({
      $id: 'root',
      $language: 'en',
      children: {
        id: true,
        title: true,
        parents: true,
        match: {
          $field: 'specialMatch',
          id: true,
          title: true,
        },
        $list: {
          $find: {
            $filter: [
              {
                $field: 'type',
                $operator: '=',
                $value: 'club',
              },
            ],
          },
        },
      },
    })

    console.log(JSON.stringify(result, null, 2))
    t.deepEqual(result, {
      children: [
        {
          id: 'clA',
          title: 'yesh club',
          parents: ['root'],
          match: { id: 'maA', title: 'yesh match' },
        },
      ],
    })
  }
)
