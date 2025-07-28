import React, { useEffect } from 'react'
import { Text } from 'ink'
import { useClient } from '@based/react'

export const GetSecret = ({ name }) => {
  const client = useClient()
  useEffect(() => {}, [])
  return <Text color="cyan">this is secrets {name}</Text>
}

export const SetSecret = ({ name, value }) => {
  useEffect(() => {}, [])
  return <Text color="cyan">this is secrets {name}</Text>
}
