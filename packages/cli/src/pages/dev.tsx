import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { parseFolder, watch } from '../bundle/index.js'
import { initS3 } from '@based/s3'
import startHub from '@based/hub'
import connect from '@based/client'
import handler from 'serve-handler'
import http from 'node:http'
import { deployChanges } from './deploy.js'
import getPort from 'get-port'
import MailDev from 'maildev'
import mailDevLogger from 'maildev/lib/logger.js'
import colors from 'picocolors'
import { networkInterfaces } from 'node:os'
import { format } from 'node:util'

const TMP_PATH = './tmp'
const FILES_PATH = `${TMP_PATH}/files`

const info = (service: string, ...args) => console.info(`[${service}]`, ...args)
const log = (service: string, ...args) =>
  console.log(colors.gray(`[${service}] ${format(...args)}`))
const error = (service: string, ...args) =>
  console.error(colors.red(`[${service}] ${format(...args)}`))
const warn = (service: string, ...args) =>
  console.warn(colors.yellow(`[${service}] ${format(...args)}`))

const startMailServer = (ip: string, smtpPort: number, webPort: number) => {
  mailDevLogger.setLevel(0)
  info(
    'mail-stmp',
    `http://localhost:${smtpPort} ${colors.gray(`http://${ip}:${smtpPort}`)}`,
  )
  info(
    'mail-ui',
    `http://localhost:${webPort} ${colors.gray(`http://${ip}:${webPort}`)}`,
  )
  return new MailDev({
    smtp: smtpPort,
    web: webPort,
  }).listen()
}

const startFileServer = (ip: string, port: number, path: string) => {
  info(
    'file-server',
    `http://localhost:${port} ${colors.gray(`http://${ip}:${port}`)}`,
  )
  return http
    .createServer((req, res) => {
      handler(req, res, {
        public: path,
        headers: [
          {
            source: '*',
            headers: [
              {
                key: 'Access-Control-Allow-Origin',
                value: '*',
              },
            ],
          },
        ],
      })
    })
    .listen(port)
}

const getMyIp = () => {
  const nets = networkInterfaces()
  const prefer = nets.en0 || nets.lo0

  for (const net of prefer) {
    if (net.family === 'IPv4' && !net.internal) {
      return net.address
    }
  }

  for (const name in nets) {
    if (prefer === nets[name]) {
      continue
    }
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
}

const startEnvServer = (ip: string, hubPort: number, smtpPort: number) => {
  const domain = `${ip}:${hubPort}`
  info(
    'env-server',
    `http://localhost:${hubPort} ${colors.gray(`http://${domain}`)}`,
  )
  process.env.DOMAIN = domain

  return startHub({
    port: hubPort,
    path: TMP_PATH,
    s3: initS3({
      provider: 'local',
      localS3Dir: TMP_PATH,
    }),
    buckets: {
      files: 'files',
      backups: 'backups',
      dists: 'dists', // deprecated
    },
    smtp: {
      auth: { port: smtpPort },
    },
    console: {
      ...console,
      log: log.bind(null, 'env-server'),
      warn: warn.bind(null, 'env-server'),
      info: info.bind(null, 'env-server'),
      error: error.bind(null, 'env-server'),
    },
  })
}

export const Dev = ({ opts }) => {
  useEffect(() => {
    const run = async () => {
      try {
        const ip = getMyIp()
        const [envPort, filePort, smtpWebPort, smtpPort] = await Promise.all([
          getPort({ port: 1234 }),
          getPort({ port: 2000 }),
          getPort({ port: 3000 }),
          getPort({ port: 4000 }),
        ])

        startFileServer(ip, filePort, FILES_PATH)
        startMailServer(ip, smtpPort, smtpWebPort)

        const env = await startEnvServer(ip, envPort, smtpPort)
        const url = `ws://localhost:${envPort}`
        const publicPath = `http://${ip}:${filePort}/`
        const cwd = process.cwd()
        const results = await parseFolder({
          opts: { ...opts, url },
          cwd,
          publicPath,
        })
        const client = connect({ url })
        await client.setAuthState({ token: 'local', type: 'based' })
        await deployChanges(client, publicPath, results)
        await watch(results, async (err, changes) => {
          if (err) {
            error('watcher', 'Error watching:', err)
          } else if (changes) {
            info('watcher', 'Detected changes, deploying...')
            await deployChanges(client, publicPath, changes)
            env.server.forceReload()
          }
        })
      } catch (err) {
        console.error('Dev server error:', err)
      }
    }
    run()
  }, [])

  return null
}
