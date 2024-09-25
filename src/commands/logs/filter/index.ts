import { Command } from 'commander'
import { AppContext, basedAuth, streamLogs } from '../../../shared/index.js'
import { isValid, formatISO } from 'date-fns'
// import { dirname, join } from 'node:path'
// import { mkdir, readFile, stat } from 'node:fs/promises'
// import { AuthState, BasedClient, encodeAuthState } from '@based/client'
// import { homedir } from 'os'
// import { hash } from '@saulx/hash'
// import { pipeline } from 'node:stream/promises'
// import { createWriteStream } from 'node:fs'
// import { SourceMapConsumer } from 'source-map'

type ShowArgs = {
  collapsed: boolean
  app: boolean
  infra: boolean
  group: 'content' | 'function' | 'service' | 'none'
  level: 'all' | 'info' | 'error'
  before: string
  after: string
  checksum: number
  functions: string | string[]
  services: string | string[]
}

// type LogData = {
//   msg: string
//   ts: number
//   lvl?: string
//   fn: string
//   cs: number
//   stack: LogStack
//   location: any
//   internalLog: boolean
//   srvc: string
//   i: string // instance id/key
//   mid: string // machine id
//   url: string // ip/url
//   eid: string
// }
//
// type LogStack = {
//   message: string
//   functionName?: string
//   path?: string
//   line?: number
//   column?: number
//   parseFail?: boolean
// }

// export const parseStack = (error: Error | string): LogStack => {
//   const re = /(.*?)\s{3,}at (.*?) \((.*?):(\d+):(\d+)\)/s
//   const match = re.exec(String(error))
//   if (!match) {
//     return {
//       message: String(error),
//       parseFail: true,
//     }
//   }
//   return {
//     message: match[1],
//     functionName: match[2],
//     path: match[3],
//     line: Number(match[4]),
//     column: Number(match[5]),
//   }
// }
//
// export const BASED_DIR = join(homedir(), '.based')
// export const SOURCEMAPS_DIR = join(BASED_DIR, 'sourcemaps')
// let envAdminHubHost: string
// let envAdminHubPort: string
// const sourcemapsCache: {
//   [key: string]: any
// } = {}
// export const getHostAndPortFromUrl = (url: string) => {
//   const m = /^(http|ws)s?:\/\/([^/]*?)(?::(\d*))?\//.exec(url)
//   if (m) {
//     return { protocol: m[1], host: m[2], port: m[3] }
//   }
//   return null
// }
// const downloadInProgress = new Map<number, Promise<void>>()
// const exists = (path: string) =>
//   stat(path)
//     .then(() => true)
//     .catch(() => false)
// const _downloadFile = async (
//   url: string,
//   path: string,
//   authState: AuthState,
// ) => {
//   const folder = dirname(path)
//   if (!(await exists(folder))) {
//     await mkdir(folder, { recursive: true })
//   }
//
//   const controller = new AbortController()
//   const timeout = setTimeout(() => {
//     controller.abort()
//   }, 5e3)
//   let response: Awaited<ReturnType<typeof fetch>>
//   try {
//     response = await fetch(url, {
//       signal: controller.signal,
//       headers: {
//         authorization: encodeAuthState(authState),
//       },
//     })
//   } catch (error) {
//     return null
//   } finally {
//     clearTimeout(timeout)
//   }
//   if (!response.ok) {
//     throw new Error('Error downloading ' + response.statusText)
//   }
//   await pipeline(response.body, createWriteStream(path))
// }
// const downloadFile = async (
//   url: string,
//   path: string,
//   authState: AuthState,
// ) => {
//   const key = hash([url, path])
//   if (!downloadInProgress.has(key)) {
//     downloadInProgress.set(
//       key,
//       _downloadFile(url, path, authState).then((res) => {
//         downloadInProgress.delete(key)
//         return res
//       }),
//     )
//   }
//   return downloadInProgress.get(key)
// }
//
// const getSourcemap = async (
//   client: BasedClient,
//   checksum: string,
//   envId: string,
// ) => {
//   const key = `${envId}-${checksum}`
//   if (!sourcemapsCache[key]) {
//     const cachedSourcemapPath = join(
//       SOURCEMAPS_DIR,
//       envId + '-' + checksum + '.map',
//     )
//     if (!(await exists(cachedSourcemapPath))) {
//       if (!envAdminHubHost) {
//         ;({ host: envAdminHubHost, port: envAdminHubPort } =
//           getHostAndPortFromUrl(await client.url()))
//       }
//
//       const url = `http://${envAdminHubHost}:${
//         envAdminHubPort || '80'
//       }/based:get-sourcemap?checksum=${checksum}&envId=${envId}`
//       try {
//         await downloadFile(url, cachedSourcemapPath, client.authState)
//       } catch (error) {
//         if (error.message !== 'Error downloading Forbidden') {
//           console.error(error)
//         }
//         return null
//       }
//     }
//     try {
//       sourcemapsCache[key] = JSON.parse(
//         (await readFile(cachedSourcemapPath)).toString(),
//       )
//     } catch (error) {
//       // console.error(error)
//       return null
//     }
//   }
//   return sourcemapsCache[key]
// }

export const filter =
  (program: Command, context: AppContext) =>
  async ({
    collapsed,
    app,
    infra,
    level,
    before,
    after,
    checksum,
    functions,
    services,
  }: ShowArgs): Promise<void> => {
    const { cluster, org, env, project, yes: skip } = program.opts()
    const { basedClient, envHubBasedCloud, adminHubBasedCloud } =
      await basedAuth(program, context)
    const logOptions = ['all', 'info', 'error']
    let formatedBefore: string = null
    let formatedAfter: string = null
    let validChecksum: number = null
    let filterByDateBefore: string = null
    let filterByDateAfter: string = null
    let selectedFunctions: string | string[] = null
    let filterByChecksum: string = null
    let selectedServices: string | string[] = null
    let selectedLevels: string | string[] = level

    const errorMessage = (section: string, value: string | number) =>
      context.print.fail(
        `The <b>${section}</b> date is not valid: '<b><cyan>${value}</cyan></b>'. Check it and try again.`,
      )

    if (before) {
      formatedBefore = formatISO(before)
      if (!isValid(formatedBefore)) {
        errorMessage('before', before)
      }
    }

    if (after) {
      formatedAfter = formatISO(after)
      if (!isValid(formatedAfter)) {
        errorMessage('after', after)
      }
    }

    if (checksum) {
      validChecksum = parseInt(checksum.toString())
      if (isNaN(validChecksum)) {
        errorMessage('checksum', checksum)
      }
    }

    if (level && !logOptions.includes(level)) {
      errorMessage('log level', level)
    }

    if (!skip) {
      context.print.line()

      if (!formatedBefore && !formatedAfter) {
        const filterByDate: boolean = await context.input.confirm(
          `Would you like to filter the logs by date?`,
        )

        if (filterByDate) {
          filterByDateAfter = await context.input.date(
            `Filter logs after:`,
            true,
            false,
          )

          filterByDateBefore = await context.input.date(`Filter logs before:`)
        }
      }

      if (!functions || !functions.length) {
        const filterByFunction: boolean = await context.input.confirm(
          `Do you want to filter by function?`,
        )

        if (filterByFunction) {
          const { functions } = await basedClient
            .query('db', {
              $db: 'config',
              functions: {
                $all: true,
                current: {
                  config: true,
                  $all: true,
                },
                $list: {
                  $find: {
                    $traverse: 'children',
                    $filter: {
                      $field: 'type',
                      $operator: '=',
                      $value: ['job', 'function'],
                    },
                  },
                },
              },
            })
            .get()

          const functionsItems = functions
            .filter(({ name }) => Boolean(name))
            .map(({ id, name }) => ({ value: id, name }))
            .sort((a, b) => (a.name > b.name ? 1 : -1))

          selectedFunctions = await context.input.select(
            `Select the functions: <dim>(A-Z)</dim>`,
            functionsItems,
            true,
          )
        }
      }

      if (!services || !services.length) {
        const filterByService: boolean = await context.input.confirm(
          `Do you want to filter by service?`,
        )

        // TODO get all the services running

        if (filterByService) {
          selectedServices = await context.input.select(
            'Select the services: <dim>(A-Z)</dim>',
            [
              {
                name: 'env-hub',
                value: 'env-hub',
              },
              {
                name: 'admin-hub',
                value: 'admin-hub',
              },
            ],
            true,
            true,
          )
        }
      }
    }

    await streamLogs({
      context,
      basedClient,
      envHubBasedCloud,
      adminHubBasedCloud,
      cluster,
      org,
      env,
      project,
      filters: {
        isCollapsed: collapsed,
        isApp: app,
        isInfra: infra,
        byLevel: selectedLevels,
        byDateBefore: filterByDateBefore,
        byDateAfter: filterByDateAfter,
        byChecksum: filterByChecksum,
        byFunctions: selectedFunctions,
        byServices: selectedServices,
      },
    })
  }
