import build from '@saulx/aristotle-build'

const target = process.argv[2]
if (!target) throw new Error('No target')
;(async () => {
  const res = await build({
    entryPoints: [target],
    minify: true,
    platform: 'browser',
    production: true,
    gzip: true,
  })
  process.send(res, () => {
    process.disconnect()
  })
})()
