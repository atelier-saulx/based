import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { useClient } from '@based/react'
import { Spinner } from '@inkjs/ui'

export const GetSecret = ({ name }) => {
  const client = useClient()
  const [value, setValue] = useState('')
  useEffect(() => {
    client
      .query('based:secret', name)
      .get()
      .then((result) => {
        setValue(result)
      })
  }, [])
  return (
    <Box flexDirection="column" margin={0}>
      <Text color="white">
        Secret <Text color="cyan">{name}</Text>:
      </Text>
      {value ? <Text color="red">{value}</Text> : <Spinner />}
    </Box>
  )
}

export const SetSecret = ({ name, value }) => {
  const client = useClient()
  const [success, setSucess] = useState(false)
  useEffect(() => {
    client.call('based:set-secret', { name, value }).then((result) => {
      setSucess(true)
    })
  }, [client])
  return success ? (
    <Text color="white">
      Successfuly saved secret <Text color="cyan">{name}</Text>.
    </Text>
  ) : (
    <Spinner label="Saving secret..." />
  )
}
