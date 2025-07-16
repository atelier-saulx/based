import { Box, Text } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, watch } from './bundle/index.js'
import { initS3 } from '@based/s3'
import start from '@based/hub'
import connect from '@based/client'
import { basename } from 'path'

export const Dev = () => {
  useEffect(() => {
    const run = async () => {
      const results = await parseFolder()

      await start({
        port: 8080,
        path: './tmp',
        s3: initS3({
          provider: 'local',
          localS3Dir: './tmp/s3',
        }),
        buckets: {
          files: 'files',
          backups: 'backups',
          dists: 'dists',
        },
      })

      const client = connect({
        url: 'ws://localhost:8080',
      })

      // upload assets
      await Promise.all(
        results.configs.map((config) => {
          if (!config.mainCtx) return
          return Promise.all(
            config.mainCtx?.build.outputFiles.map((file) => {
              return client.stream('db:file-upload', {
                contents: file.contents,
                payload: {
                  Key: basename(file.path),
                },
              })
            }),
          )
        }),
      )

      // deploy functions
      await Promise.all(
        results.configs.map((config) => {
          return client.stream('based:set-function', {
            contents: config.indexCtx.build.outputFiles[0].contents,
            payload: {
              config: config.fnConfig,
            },
          })
        }),
      )

      await watch(results, (err, path, type) => {
        console.log('change!', err, path, type)
      })
    }
    run()
  }, [])

  // const logs = useQuery('based:logs', {})

  // console.log(logs)
  /*
    before,
      after,
      fn,
      cs,
      lvl,

    */

  return (
    <Box>
      <Text>Dev time!</Text>
    </Box>
  )
}
