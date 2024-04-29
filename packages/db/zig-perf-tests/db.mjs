import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads'
import zlib from 'node:zlib'
import { LoremIpsum } from 'lorem-ipsum'
import fs from 'fs/promises'
import { join, dirname } from 'path'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import addon from './nativebla.js'
import { BasedServer } from '@based/server'
import { write } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

parentPort.on('message', (w) => {
  // console.log(w)
  addon.setBatch(w)
  parentPort.postMessage('done')
})
