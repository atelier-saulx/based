import net from 'node:net'

export const createConnection = ({
  port,
  host,
}: {
  port: number
  host: string
}) => {
  const socket = new net.Socket()

  socket.connect(port, host, () => {
    console.info(`CONNECTED TO: ${host}:${port}`)
  })

  socket.on('data', (rest) => {
    console.log('RE', rest)
  })

  socket.on('close', () => {
    console.log('Connection closed')
  })

  socket.on('error', (e) => {
    console.info(e)
  })

  return socket
}
