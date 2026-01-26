import {
  ModifyMainHeader,
  pushModifyMainHeader,
  createModifyMainHeader,
  readModifyMainHeader,
  QueryHeader,
  pushQueryHeader,
  createQueryHeader,
  OpType,
  QueryType,
  QueryIteratorType,
} from '../src/zigTsExports.js'
import { AutoSizedUint8Array } from '../src/modify/AutoSizedUint8Array.js'
import { deepEqual } from '../src/utils/index.js'

const test = () => {
  const header: ModifyMainHeader = {
    id: 1,
    start: 123,
    size: 456,
  }

  // Use createModifyMainHeader (existing logic)
  const expectedBuf = createModifyMainHeader(header)

  // Use new pushModifyMainHeader
  const autoBuf = new AutoSizedUint8Array()
  const idx = pushModifyMainHeader(autoBuf, header)

  if (idx !== 0) {
    console.error(`Expected index 0, got ${idx}`)
    process.exit(1)
  }

  const actualBuf = autoBuf.view

  console.log('Expected:', expectedBuf)
  console.log('Actual:  ', actualBuf)

  if (expectedBuf.length !== actualBuf.length) {
    console.error('Length mismatch')
    process.exit(1)
  }

  for (let i = 0; i < expectedBuf.length; i++) {
    if (expectedBuf[i] !== actualBuf[i]) {
      console.error(
        `Mismatch at index ${i}: expected ${expectedBuf[i]}, got ${actualBuf[i]}`,
      )
      process.exit(1)
    }
  }

  console.log('ModifyMainHeader match!')

  // Test packed struct: QueryHeader
  const queryHeader: QueryHeader = {
    op: QueryType.ids,
    prop: 10,
    typeId: 99,
    edgeTypeId: 88,
    offset: 100,
    limit: 50,
    filterSize: 10,
    searchSize: 20,
    edgeSize: 30,
    edgeFilterSize: 40,
    includeSize: 5,
    iteratorType: QueryIteratorType.desc,
    size: 200,
    sort: true,
  }

  const expectedQueryBuf = createQueryHeader(queryHeader)
  const autoQueryBuf = new AutoSizedUint8Array()
  pushQueryHeader(autoQueryBuf, queryHeader)
  const actualQueryBuf = autoQueryBuf.view

  console.log('QueryHeader Expected:', expectedQueryBuf)
  console.log('QueryHeader Actual:  ', actualQueryBuf)

  if (expectedQueryBuf.length !== actualQueryBuf.length) {
    console.error('QueryHeader Length mismatch')
    process.exit(1)
  }

  for (let i = 0; i < expectedQueryBuf.length; i++) {
    if (expectedQueryBuf[i] !== actualQueryBuf[i]) {
      console.error(
        `QueryHeader Mismatch at index ${i}: expected ${expectedQueryBuf[i]}, got ${actualQueryBuf[i]}`,
      )
      process.exit(1)
    }
  }
  console.log('QueryHeader match!')
}

test()
