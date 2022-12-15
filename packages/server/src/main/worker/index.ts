import { join } from 'node:path'
import { Worker, SHARE_ENV } from 'node:worker_threads'
import pc from 'picocolors'
import { BasedServer } from '../server'
import { incomingWorkerMessage } from './incoming'

const WORKER_PATH = join(__dirname, '../worker/index.js')

export const createWorker = (server: BasedServer): Worker => {
  const worker = new Worker(WORKER_PATH, {
    stdout: true,
    stderr: true,
    env: SHARE_ENV, // only specifics later...
    workerData: {
      importWrapperPath:
        server.functions.config.importWrapperPath ||
        join(__dirname, 'dummyImportWrapper'),
    },
  })

  worker.stdout.on('data', (d) => {
    process.stdout.write(
      ` ${pc.gray(`[worker ${worker.threadId}]`)} ${d.toString()}`
    )
  })

  worker.stderr.on('data', (d) => {
    process.stderr.write(` [worker ${worker.threadId}] ${d.toString()}`)
  })

  worker.on('error', (err) => {
    // CRASHING WORKER
    console.error('Crash on worker', worker.threadId, err)
  })

  worker.on('message', (data) => {
    incomingWorkerMessage(server, data)
  })

  return worker
}

export * from './send'
