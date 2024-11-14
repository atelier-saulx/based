import https from 'node:https'
import type { AppContext } from '../../shared/index.js'

export function contextRestRequester(context: AppContext) {
  return {
    get: <T>(url: string): Promise<T> => {
      return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
          let data = ''

          if (
            res.statusCode &&
            (res.statusCode < 200 || res.statusCode >= 300)
          ) {
            return reject(new Error(context.i18n('errors.912', res.statusCode)))
          }

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch (err) {
              reject(new Error(context.i18n('errors.914', err.message)))
            }
          })
        })

        req.on('error', (err) => {
          reject(new Error(context.i18n('errors.913', err.message)))
        })

        req.end()
      })
    },
  }
}
