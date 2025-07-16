import { useQuery } from '@based/react'
import { Spinner } from '@inkjs/ui'
import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'
import { parseStack } from './stackParser.js'
import { SourceMapConsumer } from 'source-map'
import { getSourcemap } from './getSourcemap.js'
import { BasedClient } from '@based/client'
import { useClient } from '@based/react'
import { FullScreenBox } from 'fullscreen-ink'

export type LogType = {
  msg: string
  lvl: 'info' | 'error' | 'warning'
  fn: string
  ts: number
  cs: string
}

let envIdCached: string | undefined

const parseLog = async (log: LogType, client: BasedClient) => {
  if (!envIdCached) {
    const { envId } = await client.call('based:env-info')
    envIdCached = envId
  }

  if (log.lvl === 'error') {
    const sourcemap = await getSourcemap(client, String(log.cs), envIdCached)
    let location: string
    const stack = parseStack(log.msg)
    if (sourcemap && sourcemap.version) {
      location = await SourceMapConsumer.with(sourcemap, null, (consumer) => {
        const originalPosition = consumer.originalPositionFor({
          line: stack.line,
          column: stack.column,
        })
        return `${originalPosition.source}:${originalPosition.line}:${originalPosition.column}`
      })
    }
    return {
      ...log,
      stack,
      location,
    }
  }
  return log
}

const Log = ({ log }: { log: LogType }) => {
  const color =
    log.lvl === 'error' ? 'red' : log.lvl === 'warning' ? 'yellow' : 'white'

  // const [parsedLog, setParsedLog] = useState<LogType | null>(null)

  const client = useClient()

  // useEffect(() => {
  //   parseLog(log, client).then(setParsedLog)
  // }, [log.msg])

  return (
    <Box
      gap={1}
      // width={'100%'}
      minHeight={2 + log.msg.split('\n').length}
      // borderColor="gray"
      // borderStyle="single"
    >
      <Box flexDirection="column" minWidth={25} flexGrow={0}>
        <Text color={'whiteBright'}>[{log.fn}]</Text>
        <Text color={'gray'}>{new Date(log.ts).toLocaleString()}</Text>
      </Box>
      <Text color={color}>{log.msg}</Text>
    </Box>
  )
}

export const Status = () => {
  const { data, error, loading } = useQuery('based:logs', {})

  const client = useClient()

  if (error) {
    return <Text color="red">{error.message}</Text>
  }

  if (loading) {
    return <Spinner label="Loading logs..." />
  }

  return (
    <Box flexDirection="column" width={'100%'} height={'100%'}>
      <Box
        flexDirection="column"
        // gap={1}
        borderColor={'gray'}
        // borderStyle="single"
        overflowY="hidden"
      >
        {data.slice(data.length - 100, data.length).map((log, i) => (
          <Log key={i + ' ' + log.cs} log={log} />
        ))}
      </Box>
      <Box
        borderStyle="single"
        borderColor={'gray'}
        paddingLeft={1}
        paddingRight={1}
        paddingBottom={1}
      >
        <Text color={'whiteBright'}>{client.opts.org}/</Text>
        <Text color={'whiteBright'}>{client.opts.project}/</Text>
        <Text color={'whiteBright'}>{client.opts.env}</Text>
      </Box>
    </Box>
  )
}
