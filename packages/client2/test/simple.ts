import test from 'ava'
import { startOrigin, SelvaServer } from '@based/db-server'
import getPort from 'get-port'
import { BasedDbClient } from '../src/index.js'
import { wait } from '@saulx/utils'
import { sourceId } from '../src/id.js'
import { Fork, ast2rpn, createAst } from '@based/db-query'

import {
  ModifyArgType,
  ModifyOpSetType,
  SelvaModify_OpEdgeMetaCode,
  edgeMetaDef,
} from '../src/protocol/encode/modify/types.js'
import {
  SelvaFindResultType,
  SelvaTraversal,
  hierarchy_find_def,
} from '../src/protocol/types.js'
import { createRecord } from 'data-record'

test('simple test', async (t) => {
  const port = await getPort()
  const originServer = await startOrigin({
    port,
    name: 'default',
  })

  const client = new BasedDbClient()
  client.connect({
    port,
    host: '127.0.0.1',
  })

  client.on('connect', () => {
    console.log('CONNECT!')
  })

  const flap1 = 'flap'
  const flap2 = 'flap2'
  const flap3 = 'flap3'

  await client.command('modify', [
    flap1,
    '',
    [ModifyArgType.SELVA_MODIFY_ARG_STRING, '1', 'hello world!'],
  ])

  await client.command('modify', [
    flap3,
    '',
    [ModifyArgType.SELVA_MODIFY_ARG_STRING, '1', 'its flap 3'],
  ])

  // sorted references
  // key'ed references (record)
  /*
     return [
          ModifyArgType.SELVA_MODIFY_ARG_OP_ORD_SET,
          strPath,
          {
            setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
            mode: ORD_SET_MODE.assign,
            index: value.$assign.$idx,
            $value: value.$assign.$value,
          }
        ]
  */
  await client.command('modify', [
    flap2,
    '',
    [
      ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
      '1',
      {
        $value: [flap1, flap3],
        setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
        isSingle: false,
        isBidirectional: false,
      },
      ModifyArgType.SELVA_MODIFY_ARG_OP_EDGE_META,
      '1',
      createRecord(edgeMetaDef, {
        op_code: SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_STRING,
        delete_all: 0,
        dst_node_id: flap3,
        meta_field_name: '0',
        meta_field_value: 'HELLO',
      }),
    ],
  ])

  // console.log(node, node2)

  // find as option
  const result = await client
    .command('object.get', ['', flap1])
    .catch(console.error)

  console.log(result)
  try {
    const result2 = await client
      .command('hierarchy.find', [
        '', // lang
        createRecord(hierarchy_find_def, {
          skip: 0n,
          offset: 0n,
          limit: 10000n,
          dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_NODE,
          res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
          res_opt_str: '1.1\n1.createdAt\n1.updatedAt\n1.${EDGEFLAG}.0',
        }),
        flap2,
      ])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  await client.command('modify', [
    flap2,
    '', // lang
    [
      ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
      '2',
      {
        $value: [flap3, flap1],
        setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
        isSingle: false,
        isBidirectional: false,
      },
      ModifyArgType.SELVA_MODIFY_ARG_OP_EDGE_META,
      '2',
      createRecord(edgeMetaDef, {
        op_code: SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_STRING,
        delete_all: 0,
        dst_node_id: flap3,
        meta_field_name: '0',
        meta_field_value: 'HELLO',
      }),
      ModifyArgType.SELVA_MODIFY_ARG_OP_EDGE_META,
      '2',
      createRecord(edgeMetaDef, {
        op_code: SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_STRING,
        delete_all: 0,
        dst_node_id: flap1,
        meta_field_name: '0',
        meta_field_value: 'BYE',
      }),
    ],
  ])

  /*
   { A, B, C }
  */

  try {
    const result2 = await client
      .command('hierarchy.edgeGetMetadata', [flap2, '2', flap3])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  try {
    const result2 = await client
      .command('hierarchy.edgeGetMetadata', [flap2, '2', flap1])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  console.log(result)
  try {
    const ast = createAst({
      $field: '1',
      $operator: '=',
      $value: 'its flap 3',
    })

    const rpn = ast2rpn(undefined, ast as Fork, '')

    console.info(rpn)

    const result2 = await client
      .command('hierarchy.find', [
        '', // lang
        createRecord(hierarchy_find_def, {
          skip: 0n,
          offset: 0n,
          limit: 10000n,
          dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD,
          dir_opt_str: '1',
          res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_FIELDS,
          res_opt_str: '1\n$edgeMeta.0',
        }),
        flap2, // flap2 ->1 [flap, flap3]
        ...rpn,
      ])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  try {
    console.log('ALL')
    const result2 = await client
      .command('hierarchy.find', [
        '', // lang
        createRecord(hierarchy_find_def, {
          skip: 0n,
          offset: 0n,
          limit: -1n,
          dir: SelvaTraversal.SELVA_HIERARCHY_TRAVERSAL_ALL,
          res_type: SelvaFindResultType.SELVA_FIND_QUERY_RES_IDS,
        }),
        'bogus'.padEnd(16, '\0')
      ])
      .catch(console.error)

    console.dir(result2, { depth: 10 })
  } catch (err) {
    console.error(err)
  }

  await wait(1e3)

  t.true(true)
})
