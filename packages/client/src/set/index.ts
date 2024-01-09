import {
  BasedSchemaCollectProps,
  BasedSchemaField,
  BasedSchemaFieldSet,
  Path,
  setWalker,
  walk,
} from '@based/schema'
import {
  ModifyArgType,
  ModifyOpSetType,
  SelvaModify_OpEdgeMetaCode,
  edgeMetaDef,
} from '../protocol/encode/modify/types.js'
import { arrayOpToModify } from './array.js'
import { joinPath } from '../util/index.js'
import { BasedDbClient } from '../index.js'
import genId from '../id/index.js'
import { createRecord } from 'data-record'
import {
  encodeDouble,
  encodeLongLong,
} from '../protocol/encode/modify/primitiveTypes.js'
import { resolveNodeId } from '../get/exec/cmd.js'

const DB_TYPE_TO_MODIFY_TYPE = {
  string: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  json: ModifyArgType.SELVA_MODIFY_ARG_STRING,
  integer: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  boolean: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  timestamp: ModifyArgType.SELVA_MODIFY_ARG_LONGLONG,
  float: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  number: ModifyArgType.SELVA_MODIFY_ARG_DOUBLE,
  cardinality: ModifyArgType.SELVA_MODIFY_ARG_OP_HLL,
}

const DB_TYPE_TO_SET_TYPE = {
  references: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
  string: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_CHAR,
  integer: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_LONG_LONG,
  number: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_DOUBLE,
}

const VALUE_TYPE_TO_INCREMENT_TYPE = {
  [ModifyArgType.SELVA_MODIFY_ARG_LONGLONG]:
    ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT,
  [ModifyArgType.SELVA_MODIFY_ARG_DOUBLE]:
    ModifyArgType.SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE,
}

const VALUE_TYPE_TO_DEFAULT_VALUE_TYPE = {
  3: '8',
  A: '9',
  0: '2',
}

/* eslint-disable */
export function toModifyArgs(props: {
  fieldSchema: BasedSchemaField
  path: Path
  value: any
}): any[] {
  let { fieldSchema, path, value } = props
  const strPath = joinPath(path)

  switch (fieldSchema.type) {
    // @ts-expect-error fallthrough
    case 'reference':
      if (!value.$value && !value.$delete) {
        value = { $value: [value] }
      }
    case 'references':
      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
        strPath,
        {
          ...value,
          setType: ModifyOpSetType.SELVA_MODIFY_OP_SET_TYPE_REFERENCE,
          isSingle: fieldSchema.type === 'reference',
          // @ts-ignore
          isBidirectional: !!fieldSchema.bidirectional,
        },
      ]
    case 'set':
      const setFieldSchema = <BasedSchemaFieldSet>fieldSchema
      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_SET,
        strPath,
        {
          ...value,
          setType: DB_TYPE_TO_SET_TYPE[setFieldSchema.items.type],
        },
      ]
    case 'array':
      // we are doing an array level operation like $push etc.
      // array operations can yield to multiple modify args
      // so encoding happens here instead of at modify encoding level
      return arrayOpToModify(props)
    case 'object':
      if (!value) {
        return []
      }

      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META,
        strPath,
        value.$delete === true ? { $delete: true } : [0],
      ]
    case 'record':
      if (!value) {
        return []
      }

      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META,
        strPath,
        value.$delete === true ? { $delete: true } : [1],
      ]
    case 'text':
      return [
        ModifyArgType.SELVA_MODIFY_ARG_OP_OBJ_META,
        strPath,
        value.$delete === true ? { $delete: true } : [2],
      ]
    default:
      let opType = DB_TYPE_TO_MODIFY_TYPE[fieldSchema.type]

      if (value?.$increment) {
        opType = VALUE_TYPE_TO_INCREMENT_TYPE[opType]
      } else if (value?.$default) {
        value = value.$default
        opType = VALUE_TYPE_TO_DEFAULT_VALUE_TYPE[opType]
      }

      if (!opType) {
        console.error('Unsupported field type', path, fieldSchema, value)
        return []
      }

      return [opType, strPath, value]
  }
}

export async function set(client: BasedDbClient, opts: any) {
  let { $id, $alias } = opts
  if (!$id && $alias) {
    const args = Array.isArray($alias) ? $alias : [$alias]
    $id = await resolveNodeId({ client }, null, args)
    if (!$id && !opts.aliases) {
      opts.aliases = { $add: args }
    }
  }

  if (!$id) {
    $id = genId(client.schema, opts.type)
  }

  opts.$id = $id

  let flags: string = ''
  // TODO: get this from target of setWalker
  if (opts.$noRoot) {
    flags += 'N'
    delete opts.$noRoot // TODO: setWalker does not support $noRoot
  }

  if (opts.$merge === false) {
    flags += 'M'
  }

  const edgeMetas: any[] = []
  const { errors, collected } = await setWalker(
    client.schema,
    opts,
    async (args, type) => {
      if (type !== 'modifyObject') {
        throw new Error(`Unsupported nested operation: ${type}`)
      }

      const { path, value } = args
      const refField = String(path[0])

      const { $edgeMeta, ...nestedOpts } = value

      if (
        !['parents', 'children'].includes(refField) &&
        !nestedOpts.parents &&
        !nestedOpts.children
      ) {
        // essentially:
        // nestedOpts.$noRoot = false
        // nestedOpts.parents = ['root']
      } else {
        nestedOpts.$noRoot = true
      }

      if (opts.$language) {
        nestedOpts.$language = opts.$language
      }

      const nestedId = await set(client, nestedOpts)

      if ($edgeMeta) {
        edgeMetas.push(
          ...(await parseEdgeMetaModifyArgs(
            client,
            refField,
            nestedId,
            $edgeMeta
          ))
        )
      }

      return nestedId
    }
  )

  if (errors?.length) {
    // TODO
    throw new Error(JSON.stringify(errors))
  }

  const args: any[] = []
  const edgeArgs: any[] = []
  collected?.forEach((props: Required<BasedSchemaCollectProps>) => {
    let { path } = props

    if (path.length === 1 && path[0] === 'type') {
      return
    }

    if (['reference', 'references'].includes(props?.fieldSchema?.type)) {
      edgeArgs.push(...toModifyArgs(props))
    } else {
      args.push(...toModifyArgs(props))
    }
  })

  args.unshift(...edgeArgs)
  args.push(...edgeMetas)

  if (!args.length) {
    return $id
  }

  const resp = await client.command('modify', [$id, flags, args])
  const err = resp?.[0]?.find((x: any) => {
    return x instanceof Error
  })

  if (err) {
    console.error('MODIFY ERROR', err)
  }

  return resp?.[0]?.[0]
}

async function parseEdgeMetaModifyArgs(
  client: BasedDbClient,
  edgeField: string,
  dstId: string,
  $edgeMeta: any
): Promise<any[]> {
  if ($edgeMeta.$delete === true) {
    const rec = createRecord(edgeMetaDef, {
      op_code: SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_DEL,
      delete_all: 1,
      dst_node_id: dstId,
    })

    return [ModifyArgType.SELVA_MODIFY_ARG_OP_EDGE_META, edgeField, rec]
  }

  const collected: any[] = []
  await walk(
    client.schema,
    {
      init: async () => {
        return {}
      },
      collect: (args) => {
        const { value, path } = args

        let opCode: SelvaModify_OpEdgeMetaCode
        let v: Buffer

        const vType = typeof value
        if (vType === 'object') {
          opCode = SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_DEL
        } else if (vType === 'number') {
          if (Number.isInteger(value)) {
            opCode =
              SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_LONGLONG
            v = encodeLongLong(value)
          } else {
            opCode = SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_DOUBLE
            v = encodeDouble(value)
          }
        } else {
          opCode = SelvaModify_OpEdgeMetaCode.SELVA_MODIFY_OP_EDGE_META_STRING
          v = value
        }

        const rec = createRecord(edgeMetaDef, {
          op_code: opCode,
          delete_all: 0,
          dst_node_id: dstId,
          meta_field_name: joinPath(path),
          meta_field_value: v,
        })

        collected.push(
          ModifyArgType.SELVA_MODIFY_ARG_OP_EDGE_META,
          edgeField,
          rec
        )
      },
      parsers: {
        fields: {},
        keys: {},
        any: async (args) => {
          // const { key, value, path, target } = args
          args.collect()
        },
      },
    },
    $edgeMeta
  )

  return collected
}
