import { Box, Text } from 'ink'
import React, { useEffect } from 'react'
import { parseFolder, watch } from './bundle/index.js'
import { initS3 } from '@based/s3'
import start from '@based/hub'
import connect from '@based/client'
import { basename } from 'path'
import { serialize } from '@based/schema'
import { ParseResults } from './bundle/parse.js'

export const Deploy = () => {
  useEffect(() => {
    const run = async () => {}
    run()
  }, [])

  return (
    <Box>
      <Text>Deploy time!</Text>
    </Box>
  )
}
