import { BasedDb } from '@based/db'
import { destructureTreeKey } from '@based/db/dist/src/server/tree.js'
import { open } from 'fs/promises'
import { join } from 'path'
import { toCsvHeader, toCsvChunk } from './toCsv.js'

const CHUNK_SIZE = 1025

const OUTPUT_DIR = './tmp/export'

const getCsvFileName = (typeId: number, startNodeId: number) => {
  return join(OUTPUT_DIR, `${typeId}_${startNodeId}.csv`)
}

const processBlockAndExportToCsv = async (db: BasedDb, blockKey: number) => {
  const [typeId, startNodeId] = destructureTreeKey(blockKey)
  const def = db.client.schemaTypesParsedById[typeId]

  console.log(
    `Processing block: type "${def.type}" (id: ${typeId}), starting from node: ${startNodeId}`,
  )

  const propsToExport = Object.keys(def.props).filter((propName) => {
    const typeIndex = def.props[propName].typeIndex
    // For now we do not export references, waiting for partials
    return typeIndex !== 13 && typeIndex !== 14
  })

  const csvHeader = ['id', ...propsToExport]

  let offset = 0
  let isDone = false
  let fileHandle: any | undefined

  const filename = getCsvFileName(typeId, startNodeId)
  fileHandle = await open(filename, 'w')
  console.log(`  - Opened file for writing: ${filename}`)
  await fileHandle.write(toCsvHeader(csvHeader))

  const allCsvRows: any[][] = []

  while (!isDone) {
    await db.server.loadBlock(def.type, startNodeId).catch((e) => {
      if (e.message !== 'Block hash mismatch') {
        console.error(e)
        console.log('Skipping block due to error.')
        isDone = true
      }
    })
    console.log(`  - Loading chunk from offset ${offset}...`)

    const data = await db
      .query(def.type)
      .include('*')
      .range(offset, CHUNK_SIZE)
      .get()
      .toObject()

    if (!data || Object.keys(data).length === 0) {
      isDone = true
      console.log('    - No more data in this chunk. Finishing.')
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

    // allCsvRows.push(...csvRows) // depois isso vai pra função sem o header
    await fileHandle.write(toCsvChunk(csvRows))

    if (csvRows.length == CHUNK_SIZE) {
      offset += CHUNK_SIZE
    } else {
      isDone = true
    }
  }

  // const csvContent = toCsvString(csvHeader, allCsvRows)

  try {
    // const filename = getCsvFileName(typeId, startNodeId)
    // await writeFile(filename, csvContent)
    if (fileHandle) {
      await fileHandle.close()
    }
    console.log(`  - Successfully exported to ${filename}`)
  } catch (error) {
    console.error(`  - Failed to write CSV file:`, error)
  }
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
  for (const block of db.server.verifTree.blocks(blockInfo)) {
    await processBlockAndExportToCsv(db, block.key)
  }
}

await db.stop()
