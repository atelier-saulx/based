import { CompiledRecordDef, compile } from './compiler.js'
import {createRecord} from './index.js'

export function compRecordDef2buffer(compRecDef: CompiledRecordDef): Buffer {
  return createRecord(compile([
    {
      name: 'field_list',
      type: `record[${compRecDef.fieldList.length}]`,
      def: [
        { name: 'offset', type: 'uint32_le' },
        { name: 'size', type: 'uint32_le', },
        { name: 'arr_size', type: 'uint32_le' },
        { name: 'type', type: 'cstring', size: 2 },
        { name: 'name', type: 'cstring', size: 50 },
      ],
    },
  ]),
  {
    field_list: compRecDef.fieldList.map(([offset, size, arr_size, type, _path, name]) => ({
      offset,
      size,
      arr_size,
      type,
      name,
    }))
  })
}
