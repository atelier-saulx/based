import { useQuery } from '@based/react'
import { Box, Text, useInput } from 'ink'
import React, { useEffect, useRef, useState } from 'react'
import { parseStack } from './stackParser.js'
import { SourceMapConsumer } from 'source-map'
import { getSourcemap } from './getSourcemap.js'
import { BasedClient } from '@based/client'
import { Footer } from '../footer/footer.js'
import { useScreenSize } from 'fullscreen-ink'
import { LogType } from '../types.js'
import { usePaginatedData } from './usePaginatedData.js'

let envIdCached: string | undefined

const parseLog = async (log: LogType, client: BasedClient) => {
  if (!envIdCached) {
    const { envId } = await client.call('based:env-info')
    envIdCached = envId
  }

  if (log.type === 'error') {
    const sourcemap = await getSourcemap(
      client,
      String(log.function.checksum),
      envIdCached,
    )
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

const formatMetaDateTime = (createdAt: number) => {
  if (!createdAt) {
    return ''
  }
  return `${new Date(createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })} ${new Date(createdAt).toLocaleTimeString(undefined, { hour12: false })}`
}

export const Status = () => {
  const { height, width } = useScreenSize()
  const metaWidth = 20 // has to be calculated based on the longest function name
  const maxCols = width - metaWidth - 3
  const maxRows = height - 5

  const { lines, setSelected, selected } = usePaginatedData(
    maxCols,
    maxRows,
    'based:logs',
  )

  useInput((input, key) => {
    let newSelected = selected
    const speed = key.meta ? 100 : key.shift ? 10 : 1
    if (key.upArrow) {
      newSelected = selected + speed
    }
    if (key.downArrow) {
      newSelected = selected - speed
    }
    if (newSelected < 0) {
      newSelected = 0
    }
    if (input === 'f') {
      newSelected = 0
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
        >
          {lines.map((v, i) => {
            return (
              <Box key={i}>
                <Box flexGrow={0} gap={1} minWidth={metaWidth}>
                  {v.meta && (
                    <Box gap={1}>
                      {v.meta.name && (
                        <Text color={'whiteBright'}>[{v.meta.name}]</Text>
                      )}
                      {v.meta.createdAt && (
                        <Text color={'gray'}>
                          {formatMetaDateTime(v.meta.createdAt)}
                        </Text>
                      )}
                    </Box>
                  )}
                </Box>
                <Text
                  color={
                    v.type === 'error'
                      ? 'red'
                      : v.type === 'warn'
                        ? 'yellow'
                        : 'white'
                  }
                >
                  {v.line}
                </Text>
              </Box>
            )
          })}
        </Box>
      </Box>
      <Footer>
        <Box gap={1}>
          <Text color={'gray'}>
            <Text color={'white'}>[s]</Text>earch
          </Text>
          {selected > 0 && (
            <Text color={'gray'}>
              <Text color={'white'}>[f]</Text>ollow
            </Text>
          )}
          <Text color={'gray'}>↑</Text>
          <Text color={'gray'}>↓</Text>
          <Text color={'gray'}>{selected}</Text>
        </Box>
      </Footer>
    </Box>
  )
}
