import { QueryAst } from '../../src/db-query/ast/ast.js'
import { astToQueryCtx } from '../../src/db-query/ast/toCtx.js'
import {
  resultToObject,
  serializeReadSchema,
  deSerializeSchema,
} from '../../src/protocol/index.js'
import { AutoSizedUint8Array } from '../../src/utils/AutoSizedUint8Array.js'
import test from '../shared/test.js'
import { testDbClient, testDbServer } from '../shared/index.js'
import { equal } from 'assert'
import { SchemaIn } from '../../src/sdk.js'

await test('filterFlattenId', async (t) => {
  const server = await testDbServer(t, { noBackup: true })
  const schema: SchemaIn = {
    types: {
      user: {
        aliasId: 'alias',
        name: 'string',
        y: 'uint32',
      },
    },
  } as const
  const client = await testDbClient(server, schema)

  const a = await client.create('user', {
    aliasId: 'jim',
    name: 'Jim',
    y: 15,
  })

  const b = await client.create('user', {
    name: 'mr snurf b',
    aliasId: 'snurf',
    y: 20,
  })

  await client.drain()

  // Test 1: Exact ID
  const astId: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: {
        id: { ops: [{ op: '=', val: a }] },
      },
    },
  }

  // Test 2: Nested AND ID Valid
  const astNestedId: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { y: { ops: [{ op: '=', val: 20 }] } },
      and: {
        props: { id: { ops: [{ op: '=', val: b }] } },
      },
    },
  }

  // Test 3: OR invalidates ID lookup (should return empty or scan without breaking)
  const astOrInvalid: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { id: { ops: [{ op: '=', val: a }] } },
      or: {
        props: { y: { ops: [{ op: '=', val: 20 }] } },
      },
    },
  }

  // Test 4: Array of IDs
  const astIdsArray: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { id: { ops: [{ op: '=', val: [a, b] }] } },
    },
  }

  // Test 5: OR of IDs
  const astIdsOr: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { id: { ops: [{ op: '=', val: a }] } },
      or: {
        props: { id: { ops: [{ op: '=', val: b }] } },
      },
    },
  }

  // Test 6: Mixed valid OR
  // (id = a OR id = b) AND y = 20
  // Should extract [a, b] and filter by y = 20
  const astIdsMixed: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { y: { ops: [{ op: '=', val: 20 }] } },
      and: {
        props: { id: { ops: [{ op: '=', val: a }] } },
        or: {
          props: { id: { ops: [{ op: '=', val: b }] } },
        },
      },
    },
  }

  // Blocking Test 1: OR with disjoint non-id properties
  // (id = a OR y = 20) AND x = true
  const astBlocking1: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { name: { ops: [{ op: '=', val: 'Jim' }] } },
      and: {
        props: { id: { ops: [{ op: '=', val: a }] } },
        or: {
          props: { y: { ops: [{ op: '=', val: 20 }] } },
        },
      },
    },
  }

  // Blocking Test 2: Double NOT ID mixed with OR
  // id = a AND (id != a OR id = b) -> The ID logic isn't capable of != parsing yet, maps to undefined safely.
  const astBlocking2: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { id: { ops: [{ op: '=', val: a }] } },
      and: {
        props: { id: { ops: [{ op: '!=', val: a }] } },
        or: {
          props: { id: { ops: [{ op: '=', val: b }] } },
        },
      },
    },
  }

  // Test 7: Intersection blocking (id = a AND id = b) -> Results in undefined because Intersection of a & b sets is empty []!
  const astIdsIntersectFail: QueryAst = {
    type: 'user',
    range: { start: 0, end: 100 },
    filter: {
      props: { id: { ops: [{ op: '=', val: a }] } },
      and: {
        props: { id: { ops: [{ op: '=', val: b }] } },
      },
    },
  }

  const runAst = async (
    ast: QueryAst,
    expectIds: number[],
    strictEmpty = false,
  ) => {
    const ctx = astToQueryCtx(
      client.schema!,
      ast,
      new AutoSizedUint8Array(1000),
    )
    const readSchemaBuf = serializeReadSchema(ctx.readSchema)
    const result = await server.getQueryBuf(ctx.query)
    const obj = resultToObject(
      deSerializeSchema(readSchemaBuf),
      result,
      result.byteLength - 4,
    )
    if (expectIds.length > 0) {
      if (obj.length !== expectIds.length) {
        console.log('FAIL LENGTH', expectIds, obj)
      }
      equal(obj.length, expectIds.length)
      for (const id of expectIds) {
        equal(
          obj.some((r) => r.id === id),
          true,
        )
      }
    } else {
      if (strictEmpty) {
        if (obj.length !== 0) {
          console.log('FAIL EMPTY', expectIds, obj)
        }
        equal(obj.length, 0)
      } else {
        if (obj.length === 0) {
          console.log('FAIL NOT EMPTY', expectIds, obj)
        }
        equal(obj.length > 0, true)
      }
    }
  }

  await runAst(astId, [a])
  await runAst(astNestedId, [b])

  // OR should find both a and b since id=a OR y=20(b)
  await runAst(astOrInvalid, []) // expectIds = [] means just check length > 0

  await runAst(astIdsArray, [a, b])
  await runAst(astIdsOr, [a, b])
  await runAst(astIdsMixed, [b]) // Only b has y = 20
  await runAst(astBlocking1, [a]) // Jim matches a, y=20 matches b but name = 'mr snurf b' fails AND. Full scan finds [a].
  await runAst(astBlocking2, [], true) // id != a OR id = b fails for a. Restricts to [] appropriately.
  await runAst(astIdsIntersectFail, [], true) // Intersection of 'id = a AND id = b' is []. Target limits safely.
})
