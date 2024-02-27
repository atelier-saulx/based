import { GetAggregate, GetTraverse, GetTraverseIds } from '../../types.js'
import { hashCmd } from '../../util.js'

export function parseList(
  type: 'aggregate' | 'traverse',
  initial: GetTraverse | GetAggregate | GetTraverseIds,
  key: string | number,
  $list: any
): GetTraverse | GetTraverseIds | GetAggregate {
  const cmd: GetTraverse | GetAggregate | GetTraverseIds = { ...initial }

  if ($list?.$find?.$find) {
    cmd.type = 'ids'
    ;(<GetTraverseIds>cmd).mainType = type

    const { $sort, $limit, $offset } = $list
    const opts = { $sort, $limit, $offset }

    const nestedCmd: GetTraverse | GetAggregate | GetTraverseIds = parseList(
      type,
      {
        ...initial,
        type,
      },
      key,
      { $find: $list.$find.$find, ...opts }
    )

    for (const opt in opts) {
      delete $list[opt]
    }

    // calculate 'abstract markerId' - this will change when there is a concrete id
    nestedCmd.cmdId = hashCmd(nestedCmd)
    cmd.nestedFind = nestedCmd
  }

  let sourceField = $list?.$find?.$traverse ?? $list?.$field
  let sourceFieldByPath = false

  if (!sourceField) {
    sourceField = String(key)
    sourceFieldByPath = true
  }

  if (Array.isArray($list?.$find?.$traverse)) {
    // find in id list
    cmd.source = { idList: sourceField }
  } else if (Array.isArray(sourceField)) {
    cmd.traverseExpr = { $any: { $first: sourceField } }
  } else if (typeof sourceField === 'object') {
    cmd.traverseExpr = sourceField
  } else {
    cmd.sourceField = sourceField
    cmd.sourceFieldByPath = sourceFieldByPath
  }

  if ($list?.$limit !== undefined || $list?.$offset !== undefined) {
    cmd.paging = {
      limit: $list?.$limit ?? -1,
      offset: $list?.$offset ?? 0,
    }
  }

  if ($list?.$sort !== undefined) {
    const { $order, $field } = $list.$sort
    cmd.sort = {
      order: $order,
      field: $field,
    }
  }

  if ($list?.$find?.$disableIndexing) {
    cmd.disableIndexing = true
  }

  if ($list?.isSingle !== undefined) {
    // @ts-ignore
    cmd.isSingle = $list.isSingle
  }

  if ($list?.$find?.$filter) {
    cmd.filter = $list?.$find?.$filter
  }

  if ($list?.$find?.$recursive) {
    cmd.recursive = true
  }

  return cmd
}
