import { Box, Text } from 'ink'
import React from 'react'

import { usePaginatedData } from './usePaginatedData.js'
import { formatMetaDateTime } from './formatMetaData.js'

export const ScrollArea = (p: {
  width: number
  height: number
  indentWidth?: number
  setSelected: (selected: number) => void
  selected: number
}) => {
  const indentWidth = p.indentWidth || 20
  const maxCols = p.width - indentWidth - 3
  const maxRows = p.height - 1

  const { lines } = usePaginatedData(
    maxCols,
    maxRows,
    'based:events',
    p.setSelected,
    p.selected,
  )

  return (
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
              <Box flexGrow={0} gap={1} minWidth={indentWidth}>
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
                  v.level === 'error'
                    ? 'red'
                    : v.level === 'warn'
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
  )
}
