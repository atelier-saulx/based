import { BasedDb } from '@based/db'
import { open } from 'fs/promises'
import { join } from 'path'
import { toCsvHeader, toCsvChunk } from './toCsv.js'
import os from 'node:os'
import { destructureTreeKey } from '@based/db/dist/src/server/blockMap.js'
import { PropType, type PropTypeEnum } from './zigTsExports.js'

let CHUNK_SIZE = 1025
let OUTPUT_DIR = './tmp/export'
let verbose = false
let locale = undefined

process.argv.forEach((val) => {
  if (val.includes('verbose')) {
    verbose = true
  }
  if (val.toLowerCase().includes('dest')) {
    OUTPUT_DIR = val.split('=')[1].replace(/^~(?=$|\/|\\)/, os.homedir)
  }
  if (val.toLowerCase().includes('chunk')) {
    CHUNK_SIZE = Number(val.split('=')[1])
  }
  if (val.toLowerCase().includes('locale')) {
    locale = String(val.split('=')[1])
  }
})

var log = (...params) => {
  if (verbose === true) console.log(...params)
}

const getCsvFileName = (
  typeId: number,
  startNodeId: number,
  endNodeId: number,
) => {
  return join(OUTPUT_DIR, `${typeId}_${startNodeId}_${endNodeId}.csv`)
}

const processBlockAndExportToCsv = async (db: BasedDb, blockKey: number) => {
  const [typeId, startNodeId] = destructureTreeKey(blockKey)
  const def = db.client.schemaTypesParsedById[typeId]
  log(
    `Processing block: type "${def.type}" (id: ${typeId}), starting from node: ${startNodeId}`,
  )
  const propsToExport = Object.keys(def.props).filter((propName) => {
    const typeIndex = def.props[propName].typeIndex
    // For now we do not export references, waiting for partials
    return typeIndex !== PropType.reference && typeIndex !== PropType.references
  })

  const csvHeader = ['id', ...propsToExport]
  const propTypes: PropTypeEnum[] = [
    PropType.number,
    ...Object.keys(def.props).map((propName) => def.props[propName].typeIndex),
  ]

  let offsetStart = 0
  let offsetEnd = offsetStart + CHUNK_SIZE
  let isDone = false
  let fileHandle: any | undefined
  const endNodeId = startNodeId + def.blockCapacity

  const filename = getCsvFileName(typeId, startNodeId, endNodeId)
  fileHandle = await open(filename, 'w')
  log(`  - Opened file for writing: ${filename}`)
  await fileHandle.write(toCsvHeader(csvHeader))

  const allCsvRows: any[][] = []

  await db.server.loadBlock(def.type, startNodeId).catch((e) => {
    if (e.message !== 'Block hash mismatch') {
      console.error(e)
      console.log('Skipping block due to error.')
      isDone = true
    }
  })

  while (!isDone) {
    log(`  - Processing chunk from offset ${offsetStart}...`)
    const data = await db
      .query(def.type)
      .include('*')
      .range(offsetStart, offsetEnd)
      .get()
      .toObject()

    if (!data || Object.keys(data).length === 0 || data.length === 0) {
      isDone = true
      log('    - No more data in this chunk. Finishing.')
      break
    }

    const csvRows = data.map((prop) => {
      let row = [prop.id]
      for (let p = 0; p < propsToExport.length; p++) {
        let propName = propsToExport[p]
        const value = prop[propName]
        row.push(value || '')
      }
      return row
    })

    if (locale === undefined) {
      locale = def.localeSize > 0 ? Object.keys(def.locales)[0] : ''
    }

    await fileHandle.write(toCsvChunk(csvRows, propTypes, locale))

    if (offsetStart + CHUNK_SIZE >= endNodeId) {
      isDone = true
      log('    - Final chunk processed. Finishing.')
    } else {
      offsetStart += CHUNK_SIZE
      offsetEnd += CHUNK_SIZE
      log(
        `    - Chunk full, continuing to next chunk at offset ${offsetStart}.`,
      )
    }
  }

  try {
    if (fileHandle) {
      await fileHandle.close()
    }
    log(`  - Successfully exported to ${filename}`)
  } catch (error) {
    console.error(`  - Failed to write CSV file:`, error)
  }
  log(
    `  - Unload block: type "${def.type}" (id: ${typeId}), starting from node: ${startNodeId}`,
  )
  await db.server.unloadBlock(def.type, startNodeId)
}

const db = new BasedDb({ path: './tmp' })

await db.start({ noLoadDumps: true })

await import('fs')
  .then((fs) => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }
  })
  .catch(console.error)

for (const blockInfo of db.server.blockMap.types()) {
  for (const block of db.server.blockMap.blocks(blockInfo)) {
    await processBlockAndExportToCsv(db, block.key)
  }
}

await db.stop()
