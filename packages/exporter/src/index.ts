import { BasedDb } from '@based/db'
import { destructureTreeKey } from '@based/db/dist/src/server/tree.js'
import { open } from 'fs/promises'
import { join } from 'path'
import { toCsvHeader, toCsvChunk } from './toCsv.js'
import os from 'node:os'

let CHUNK_SIZE = 1025
let OUTPUT_DIR = './tmp/export'
let verbose = false

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
})

var log = (...params) => {
  if (verbose === true) console.log(...params)
}

const getCsvFileName = (typeId: number, startNodeId: number) => {
  return join(OUTPUT_DIR, `${typeId}_${startNodeId}.csv`)
}

var query

const processBlockAndExportToCsv = async (db: BasedDb, blockKey: number) => {
  const xx = Date.now()
  const [typeId, startNodeId] = destructureTreeKey(blockKey)
  const def = db.client.schemaTypesParsedById[typeId]
  log(
    `Processing block: type "${def.type}" (id: ${typeId}), starting from node: ${startNodeId}`,
  )

  const propsToExport = Object.keys(def.props).filter((propName) => {
    const typeIndex = def.props[propName].typeIndex
    // For now we do not export references, waiting for partials
    return typeIndex !== 13 && typeIndex !== 14
  })

  const csvHeader = ['id', ...propsToExport]

  let offsetStart = startNodeId - 1
  let offsetEnd = startNodeId - 1 + CHUNK_SIZE
  let isDone = false
  let fileHandle: any | undefined

  const filename = getCsvFileName(typeId, startNodeId)
  fileHandle = await open(filename, 'w')
  log(`  - Opened file for writing: ${filename}`)
  await fileHandle.write(toCsvHeader(csvHeader))

  const allCsvRows: any[][] = []
  log(Date.now() - xx, 'ms start')

  const x = Date.now()
  await db.server.loadBlock(def.type, startNodeId).catch((e) => {
    if (e.message !== 'Block hash mismatch') {
      console.error(e)
      console.log('Skipping block due to error.')
      isDone = true
    }
  })

  log(Date.now() - x, 'ms', 'load dat shit')
  log(`  - Using chunks with ${CHUNK_SIZE} size.`)
  while (!isDone) {
    log(`  - Processing chunk from offset ${offsetStart}...`)
    const d = Date.now()

    // if (!query) {
    // console.log('!query', offsetStart, offsetEnd)
    // query = db.query(def.type).include('*').range(offsetStart, offsetEnd)
    // // } else {
    // //   console.log('reset', offsetStart, offsetEnd)
    // //   query.reset()
    // //   query.range(offsetStart, offsetEnd)
    // // }

    // const q = await query.get()
    // const data = q.toObject()
    const data = await db
      .query(def.type)
      .include('*')
      .range(offsetStart, offsetEnd)
      .get()
      .toObject()
    // log(
    //   data.length,
    //   'Total read time',
    //   Date.now() - d,
    //   'ms',
    //   'query exec time (without read)',
    //   q.execTime,
    // )

    let d2 = Date.now()

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

    await fileHandle.write(toCsvChunk(csvRows))

    if (csvRows.length == CHUNK_SIZE) {
      console.log(csvRows.length)
      offsetStart += CHUNK_SIZE
      offsetEnd += CHUNK_SIZE
      isDone = false
    } else {
      isDone = true
    }
    log("chunk's write time", Date.now() - d2)
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
  log('==================')
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

for (const blockInfo of db.server.verifTree.types()) {
  let i = 0
  blockLoop: for (const block of db.server.verifTree.blocks(blockInfo)) {
    if (i == 3) {
      break blockLoop
    }
    await processBlockAndExportToCsv(db, block.key)
    i++
  }
}

await db.stop()
