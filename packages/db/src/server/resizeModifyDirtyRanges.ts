import native from '../native.js'
import { DbServer } from './index.js'

export const resizeModifyDirtyRanges = (server: DbServer) => {
  let maxNrChanges = 0
  for (const typeId in server.defs.byId) {
    const def = server.defs.byId[typeId]
    const lastId = server.ids[def.id - 1]
    const blockCapacity = def.blockCapacity
    const tmp = lastId - +!(lastId % def.blockCapacity)
    const lastBlock = Math.ceil(
      (((tmp / blockCapacity) | 0) * blockCapacity + 1) / blockCapacity,
    )
    maxNrChanges += lastBlock
  }
  if (
    !server.modifyDirtyRanges ||
    server.modifyDirtyRanges.length < maxNrChanges
  ) {
    const min = Math.max(maxNrChanges * 1.2, 1024) | 0
    server.modifyDirtyRanges = new Float64Array(min)
  }
}
