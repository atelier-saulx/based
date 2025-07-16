import { useQuery } from '@based/react'
import { TextInput } from '@inkjs/ui'
import { Box, Text, useInput } from 'ink'
import React, { useEffect, useState } from 'react'
import { parseStack } from './stackParser.js'
import { SourceMapConsumer } from 'source-map'
import { getSourcemap } from './getSourcemap.js'
import { BasedClient } from '@based/client'
import { useClient } from '@based/react'
import { Footer } from '../footer/footer.js'
import { useScreenSize } from 'fullscreen-ink'

export type LogType = {
  msg: string
  lvl: 'info' | 'error' | 'warning'
  fn: string
  ts: number
  cs: string
  lines: number
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

const Log = ({ log, isLast }: { log: LogType; isLast: boolean }) => {
  const color =
    log.lvl === 'error' ? 'red' : log.lvl === 'warning' ? 'yellow' : 'white'

  // const [parsedLog, setParsedLog] = useState<LogType | null>(null)

  const client = useClient()

  // useEffect(() => {
  //   parseLog(log, client).then(setParsedLog)
  // }, [log.msg])

  return (
    <Box gap={1} minHeight={log.lines}>
      <Box flexDirection="column" minWidth={25} flexGrow={0}>
        <Text color={'whiteBright'}>[{log.fn}]</Text>
        <Text color={'gray'}>{new Date(log.ts).toLocaleString()}</Text>
      </Box>
      <Text color={color}>{log.msg}</Text>
    </Box>
  )
}

export const Status = () => {
  const client = useClient()

  const [logs, setLogs] = useState<LogType[]>([])
  const [offset, setOffset] = useState<number>(0)
  const [selected, setSelected] = useState<number>(0)
  const [fn, setFn] = useState<string>('')
  const { height } = useScreenSize()
  const { data, error, loading, checksum } = useQuery(
    'based:logs',
    fn ? { fn } : {},
  )

  const HEIGHT = height - 5

  useEffect(() => {
    const newLogs: LogType[] = []
    let size = 0
    if (loading) {
      return
    }

    const startIndex = Math.max(
      0,
      Math.min(data.length - 1, data.length - 1 - selected),
    )

    if (data.length === 0) {
      return
    }

    for (let i = startIndex; i >= 0; i--) {
      const log = data[i]
      log.lines = log.msg.split('\n').length
      size += log.lines
      newLogs.unshift(log)

      if (size > HEIGHT) {
        setOffset(size - HEIGHT)
        break
      }
    }

    setLogs(newLogs)
  }, [checksum, height, selected])

  useInput((input, key) => {
    let newSelected = selected

    const len = (data?.length || 1) - 1

    const speed = key.meta ? 100 : key.shift ? 10 : 1

    if (key.upArrow) {
      newSelected = selected + speed
    }
    if (key.downArrow) {
      newSelected = selected - speed
    }

    if (newSelected < 0) {
      newSelected = 0
    } else if (selected > len) {
      newSelected = len
    }

    if (newSelected > len - 1) {
      newSelected = len
    }

    // command + k clear all logs

    setSelected(newSelected)
  })

  return (
    <Box flexDirection="column" width={'100%'} height={'100%'}>
      <Box
        flexDirection="column"
        flexGrow={1}
        borderColor={'gray'}
        overflowY="hidden"
      >
        <Box
          flexGrow={1}
          flexDirection="column"
          borderColor={'gray'}
          borderStyle="single"
          overflow="hidden"
        >
          <Box marginTop={-offset} flexDirection="column">
            {logs.map((log, i) => (
              <Log
                isLast={i === logs.length - 1}
                key={log.lines + log.ts + log.cs + i}
                log={log}
              />
            ))}
          </Box>
        </Box>
      </Box>
      <Footer>
        <Box gap={1}>
          <Text color={'gray'}>
            <Text color={'white'}>[s]</Text>earch
          </Text>
          <Text color={'gray'}>↑</Text>
          <Text color={'gray'}>↓</Text>
          <Text color={'gray'}>{selected}</Text>
        </Box>
      </Footer>
    </Box>
  )
}
