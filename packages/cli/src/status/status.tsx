import { useQuery } from '@based/react'
import { Spinner } from '@inkjs/ui'
import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'
import { parseStack } from './stackParser.js'
import { SourceMapConsumer } from 'source-map'
import { getSourcemap } from './getSourcemap.js'
import { BasedClient } from '@based/client'
import { useClient } from '@based/react'

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

  const [parsedLog, setParsedLog] = useState<LogType | null>(null)

  const client = useClient()

  useEffect(() => {
    parseLog(log, client).then(setParsedLog)
  }, [log.msg])

  if (!parsedLog) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      gap={0}
      borderTop
      borderColor="gray"
      borderStyle="single"
    >
      <Box gap={1}>
        <Text color={color}>[{parsedLog.fn}]</Text>
        <Text color={color}>{new Date(parsedLog.ts).toLocaleString()}</Text>
      </Box>
      <Text color={color}>{parsedLog.msg}</Text>
    </Box>
  )
}

export const Status = () => {
  const { data, error, loading } = useQuery('based:logs', {})

  if (error) {
    return <Text color="red">{error.message}</Text>
  }

  if (loading) {
    return <Spinner label="Loading logs..." />
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" gap={0}>
        {data.map((log, i) => (
          <Log key={i + ' ' + log.cs} log={log} />
        ))}
      </Box>
    </Box>
  )
}
