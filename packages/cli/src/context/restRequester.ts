import { createWriteStream, unlink } from 'node:fs'
import https from 'node:https'
import type { AppContext } from '../context/index.js'

export function contextRestRequester(context: AppContext) {
  return {
    get: <T>(url: string): Promise<T> => {
      return new Promise((resolve, reject) => {
        const requester = https.get(url, (response) => {
          let data = ''

          if (
            response.statusCode &&
            (response.statusCode < 200 || response.statusCode >= 300)
          ) {
            return reject(
              new Error(context.i18n('errors.912', response.statusCode)),
            )
          }

          response.on('data', (chunk) => {
            data += chunk
          })

          response.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch (err) {
              reject(new Error(context.i18n('errors.914', err.message)))
            }
          })
        })

        requester.on('error', (err) => {
          reject(new Error(context.i18n('errors.913', err.message)))
        })

        requester.end()
      })
    },

    download: (url: string, destination: string): Promise<boolean> => {
      return new Promise((resolve, reject) => {
        const fileStream = createWriteStream(destination)

        const requester = https.get(url, (response) => {
          if (
            response.statusCode &&
            (response.statusCode < 200 || response.statusCode >= 300)
          ) {
            fileStream.close()
            return reject(
              new Error(context.i18n('errors.912', response.statusCode)),
            )
          }

          response.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close(() => resolve(true))
          })

          fileStream.on('error', (err) => {
            unlink(destination, () =>
              reject(new Error(context.i18n('errors.914', err.message))),
            )
          })
        })

        requester.on('error', (err) => {
          unlink(destination, () =>
            reject(new Error(context.i18n('errors.913', err.message))),
          )
        })

        requester.end()
      })
    },
  }
}
