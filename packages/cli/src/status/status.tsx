import { useQuery } from '@based/react'
import { Box, Text, useInput } from 'ink'
import React, { useEffect, useRef, useState } from 'react'
import { parseStack } from './stackParser.js'
import { SourceMapConsumer } from 'source-map'
import { getSourcemap } from './getSourcemap.js'
import { BasedClient } from '@based/client'
import { Footer } from '../footer/footer.js'
import { useScreenSize } from 'fullscreen-ink'
import { deepCopy } from '@saulx/utils'

export type LogType = {
  id: number
  msg: string
  type: 'info' | 'error' | 'warn' | 'debug' | 'log' | 'trace'
  function: {
    name: string
    checksum: number
  }
  createdAt: number
  lines: number
}

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

export const Status = () => {
  const { height, width } = useScreenSize()
  const correctedHeight = height - 5
  const correctedWidth = width - 2
  const metaWidth = 28 // has to be calculated based on the longest function name
  const [page, setPage] = useState<number>(0)

  const [lines, setLines] = useState<
    {
      line: string
      type: 'info' | 'error' | 'warn' | 'debug' | 'log' | 'trace'
      meta?: {
        name: string
        createdAt: number
      }
    }[]
  >([])

  const dataRef = useRef<{ data: LogType[]; isCopy: boolean; page: number }>({
    data: [],
    isCopy: false,
    page: 0,
  })

  const [selected, setSelected] = useState<number>(0)
  const { data, error, loading, checksum } = useQuery(
    selected === 0 || dataRef.current.page !== page ? 'based:logs' : null,
    { page },
  )

  if (selected === 0 && data) {
    dataRef.current.data = data
    dataRef.current.isCopy = false
    dataRef.current.page = 0
  } else if (
    selected !== 0 &&
    dataRef.current.page !== page &&
    data &&
    data.length
  ) {
    dataRef.current.data = [...dataRef.current.data, ...deepCopy(data)]
    dataRef.current.isCopy = true
    dataRef.current.page = page
  }

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

    if (newSelected !== 0 && !dataRef.current.isCopy) {
      dataRef.current.data = deepCopy(dataRef.current.data)
      dataRef.current.isCopy = false
    }

    if (newSelected === 0) {
      setPage(0)
    }
    // command + k clear all logs
    setSelected(newSelected)
  })

  useEffect(() => {
    const tempLines = []
    let size = 0
    const maxCols = correctedWidth - metaWidth - 1
    for (let i = 0; i < correctedHeight; i++) {
      tempLines.push({ line: ' ' })
    }
    const d = dataRef.current.data
    let lineIndex = 0
    if (!d) {
      setLines(tempLines)
      return
    }
    for (let i = 0; i < d.length; i++) {
      const log = d[i]
      const msg = log.msg.split('\n')
      for (let j = msg.length - 1; j >= 0; j--) {
        const lines = Math.ceil(msg[j].length / maxCols)
        for (let n = lines - 1; n >= 0; n--) {
          const line = msg[j].slice(n * maxCols, (n + 1) * maxCols)
          lineIndex++
          const index = correctedHeight - lineIndex + selected
          if (tempLines[index]) {
            tempLines[index] = {
              line,
              type: log.type,
              meta: j === 0 &&
                n === 0 && {
                  name: log.function.name,
                  createdAt: log.createdAt,
                },
            }
            size += 1
            if (size > correctedHeight) {
              break
            }
          }
        }
      }
    }
    if (d.length > 99 && selected !== 0 && size !== correctedHeight) {
      // tempLines[0] = {
      //   line: 'Need to load more logs...',
      // }
      setPage(dataRef.current.page + 1)
    }
    setLines(tempLines)
  }, [correctedWidth, correctedHeight, checksum, selected])

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
                      <Text color={'whiteBright'}>[{v.meta.name}]</Text>
                      <Text color={'gray'}>
                        {`${new Date(v.meta.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })} ${new Date(v.meta.createdAt).toLocaleTimeString(undefined, { hour12: false })}`}
                      </Text>
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
          {/* <Text color={'gray'}>{selected}</Text> */}
        </Box>
      </Footer>
    </Box>
  )
}
