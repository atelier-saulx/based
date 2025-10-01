import React, { useState } from 'react'
import { useScreenSize } from 'fullscreen-ink'
import { ScrollArea } from '../components/scrollArea/scrollArea.js'
import { Footer } from '../components/footer/footer.js'
import { Box, Text } from 'ink'
import { useScrollInput } from '../components/scrollArea/useScroll.js'
import { useQuery } from '@based/react'

const useEvents = (page: number, active: boolean) =>
  useQuery(active && 'based:events', { page })

export const Events = () => {
  const { height, width } = useScreenSize()
  const [selected, setSelected] = useState(0)
  useScrollInput(selected, setSelected)
  return (
    <Box flexDirection="column" width="100%" height="100%">
      <ScrollArea
        width={width}
        height={height - 3}
        setSelected={setSelected}
        selected={selected}
        useData={useEvents}
      />
      <Footer>
        <Box gap={1}>
          <Text color="gray">
            <Text color="white">[s]</Text>earch
          </Text>
          {selected > 0 && (
            <Text color="gray">
              <Text color="white">[f]</Text>ollow
            </Text>
          )}
          <Text color="gray">↑</Text>
          <Text color="gray">↓</Text>
          <Text color="gray">{selected}</Text>
        </Box>
      </Footer>
    </Box>
  )
}
