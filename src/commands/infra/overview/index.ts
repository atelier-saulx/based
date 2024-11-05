import { Command } from 'commander'
import { AppContext, colorize } from '../../../shared/index.js'
import { contextTerminalKit } from '../../../helpers/context/terminalKit.js'

export const overview =
  (program: Command) =>
  async ({ stream }) => {
    const context: AppContext = AppContext.getInstance(program)
    await context.getProgram()
    // const { destroy } = await context.getBasedClients()

    try {
      await getOverview(context, stream)

      //   destroy()
      return
    } catch (error) {
      throw new Error(error)
    }
  }

export const getOverview = async (context: AppContext, stream = true) => {
  const basedClient = await context.getBasedClient()
  const { cluster, org, project, env } = context.get('basedProject')

  const headerTemplate = (connections: number = 0) => {
    return colorize([
      `${context.get('appTitle')}`,
      `Viewing Infra from: [<b><cyan>${cluster}/${org}/${project}/${env}</cyan></b>] ${stream ? '<b><red>LIVE</red></b>' : ''}`,
      `Active Connections: <b>${connections}</b>`,
    ])
  }

  const { kill, header, addRow } = contextTerminalKit({
    title: context.get('appName'),
    rows: {
      sort: 'asc',
    },
  })

  await basedClient
    .call(context.endpoints.CONNECTIONS)
    .subscribe((connections) => {
      header(headerTemplate(connections))
    })

  // const rows = [
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:058\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1mdb-sub-manager\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma241d7ff6\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m35.159.84.35\u001b[22m]\u001b[39m\nGet subscription took 332 ms\n{\n  '$language': 'en',\n  data: {\n    id: true,\n    headline: true,\n    abstract: true,\n    membership: true,\n    type: true,\n    articleFormat: true,\n    publishDate: true,\n    contributorsText: true,\n    author: { id: true, firstName: true, lastName: true },\n    img: { id: true, src: true, credit: true },\n    headerImageCaption: true,\n    section: {\n      id: true,\n      title: true,\n      type: true,\n      '$list': { '$find': { '$filter': [Object] } }\n    },\n    articleType: {\n      id: true,\n      title: true,\n      type: true,\n      '$list': { '$find': { '$filter': [Object] } }\n    },\n    '$list': {\n      '$sort': { '$field': 'publishDate', '$order': 'desc' },\n      '$limit': 100,\n      '$find': {\n        '$traverse': 'children',\n        '$filter': [ [Object], [Object], [Object], [Object] ]\n      }\n    }\n  },\n  '$includeMeta': true,\n  '$subscription': '8a01d8854942990b48efd6fd0d4df07fb5f080111018c50921e56234215a6c9f',\n  '$originDescriptors': {\n    default: {\n      host: '172.35.84.151',\n      port: 8000,\n      name: 'default',\n      type: 'origin',\n      index: 0\n    }\n  },\n  '$firstEval': true\n}\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:058\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1mdb-sub-manager\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma241d7ff6\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m35.159.84.35\u001b[22m]\u001b[39m\nGet subscription took 332 ms\n{\n  '$language': 'en',\n  data: {\n    id: true,\n    headline: true,\n    abstract: true,\n    membership: true,\n    type: true,\n    articleFormat: true,\n    publishDate: true,\n    contributorsText: true,\n    author: { id: true, firstName: true, lastName: true },\n    img: { id: true, src: true, credit: true },\n    headerImageCaption: true,\n    section: {\n      id: true,\n      title: true,\n      type: true,\n      '$list': { '$find': { '$filter': [Object] } }\n    },\n    articleType: {\n      id: true,\n      title: true,\n      type: true,\n      '$list': { '$find': { '$filter': [Object] } }\n    },\n    '$list': {\n      '$sort': { '$field': 'publishDate', '$order': 'desc' },\n      '$limit': 100,\n      '$find': {\n        '$traverse': 'children',\n        '$filter': [ [Object], [Object], [Object], [Object] ]\n      }\n    }\n  },\n  '$includeMeta': true,\n  '$subscription': '8a01d8854942990b48efd6fd0d4df07fb5f080111018c50921e56234215a6c9f',\n  '$originDescriptors': {\n    default: {\n      host: '172.35.84.151',\n      port: 8000,\n      name: 'default',\n      type: 'origin',\n      index: 0\n    }\n  },\n  '$firstEval': true\n}\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:39:809\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma9d3bca97\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.124.113.157\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 102.91.4.6 Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:41:195\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma6b808fb9\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.76.86.237\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 41.243.2.147 Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:39:458\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma51c90803\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.72.79.70\u001b[22m]\u001b[39m\nITEM 1 - Disabled security: suspicious request: 37.120.130.38 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:39:725\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma9d3bca97\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.124.113.157\u001b[22m]\u001b[39m\nITEM 2 - Disabled security: suspicious request: 70.83.16.130 Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:129\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma51c90803\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.72.79.70\u001b[22m]\u001b[39m\nITEM 3 - Disabled security: suspicious request: 165.22.115.89 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:41:164\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma8c691ec8\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m35.158.104.110\u001b[22m]\u001b[39m\nITEM 4 - Disabled security: suspicious request: 2a01:e0a:508:57e0:a2bb:a46b:5f85:2913 Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:39:877\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma9d3bca97\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.124.113.157\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 193.226.5.165 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:39:889\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma6b808fb9\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.76.86.237\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 102.135.180.40 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:145\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mmaa81e207e\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.73.43.231\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 41.75.180.112 Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:365\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma6b808fb9\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.76.86.237\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 105.179.9.90 Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:514\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma6b808fb9\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.76.86.237\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 45.89.127.254 Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:658\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma9d3bca97\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.124.113.157\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 2c0f:e00:208:9300:565:9426:46ae:28e Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 OPR/85.0.0.0 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // "\u001b[0m\u001b[90m31/10/2024-16:06:40:719\u001b[39m \u001b[1m\u001b[35m[infra]\u001b[39m\u001b[22m \u001b[1m\u001b[34m[info]\u001b[39m\u001b[22m \u001b[33m[service: \u001b[1menv-hub\u001b[22m]\u001b[39m \u001b[32m[machineID: \u001b[1mma9d3bca97\u001b[22m]\u001b[39m \u001b[34m[IP: \u001b[1m3.124.113.157\u001b[22m]\u001b[39m\nDisabled security: suspicious request: 2607:fea8:bd18:9500:3552:c203:33ae:498d Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21G93 Twitter for iPhone/10.64.1 {\n  code: 40001,\n  message: '[app] Invalid payload.',\n  statusCode: 400,\n  statusMessage: 'Bad Request',\n  route: { name: 'app', path: '/', type: 'function' }\n} undefined\n\u001b[0m",
  // ]

  // addRow(rows)
  let counter = 0
  setInterval(() => {
    // addRow(rows[Math.floor(Math.random() * 8)])
    addRow(String(counter++))
  }, 2e3)

  kill(() => {
    basedClient.destroy()
    process.exit(0)
  })
}
