import { Worker, SHARE_ENV } from 'node:worker_threads'
import { incomingWorkerMessage } from '../incoming/worker'
import chalk from 'chalk'
import { join } from 'path'
import { BasedWorker } from '../../types'
import { BasedFunctions } from '../functions'
import { sendToWorker } from './send'
import { IncomingType } from '../../worker/types'

const WORKER_PATH = join(__dirname, '../../worker')

export const updateWorkers = (functions: BasedFunctions) => {
  const d = functions.config.maxWorkers - functions.workers.length

  // create workers...
  // TODO: clean all this stuff up.....
  if (d !== 0) {
    if (d < 0) {
      for (let i = 0; i < d; i++) {
        // active into account
        const w = functions.workers.pop()
        w.worker.terminate()
      }
    } else {
      for (let i = 0; i < d; i++) {
        const worker = new Worker(WORKER_PATH, {
          stdout: true,
          stderr: true,
          env: SHARE_ENV, // only specifics later...
          workerData: {
            importWrapperPath:
              functions.config.importWrapperPath ||
              join(__dirname, 'dummyImportWrapper'),
          },
        })

        worker.stdout.on('data', (d) => {
          process.stdout.write(
            chalk.grey(` [worker ${worker.threadId}] ${d.toString()}`)
          )
        })

        worker.stderr.on('data', (d) => {
          process.stderr.write(` [worker ${worker.threadId}] ${d.toString()}`)
        })

        worker.on('error', (err) => {
          // CRASHING WORKER
          console.error('Crash on worker', worker.threadId, err)
        })

        const basedWorker: BasedWorker = {
          worker,
          nestedObservers: new Set(),
          index: functions.workers.length,
          activeObservables: 0,
          activeFunctions: 0,
        }

        functions.workers.push(basedWorker)

        if (functions.server.auth) {
          sendToWorker(basedWorker, {
            type: IncomingType.AddFunction,
            name: 'authorize',
            path: functions.server.auth.config.authorizePath,
          })
        }

        worker.on('message', (data) => {
          incomingWorkerMessage(functions.server, basedWorker, data)
        })
      }
    }
  }

  if (functions.workers.length === 0) {
    throw new Error('Needs at least 1 worker')
  }

  functions.lowestWorker = functions.workers.sort((a, b) => {
    // will be RATE LIMIT TOKEN
    return a.activeFunctions < b.activeFunctions
      ? -1
      : a.activeFunctions === b.activeFunctions
      ? 0
      : 1
  })[0]
}
