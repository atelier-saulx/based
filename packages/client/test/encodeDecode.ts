import test from 'ava'
import based from '../src'
import createServer from '@based/server'
import { start } from '@saulx/selva-server'
import { SelvaClient } from '@saulx/selva'
import jwt from 'jsonwebtoken'

const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQCaK/C7fZwyOWrI+xGYETtdkM0GKKM8c8Yx2sNbI3XZJcYAD4FU
0zUGKXfyT0LgkWHk3TOG5fz0+SUygQ3AQ383kCoqzycUkntGFEkMFVirSq073aH2
42v8YtIpH6D4WpL/ytIV1NpOcGscakqQEedlMR5s7WO4EisNBEJPbpaoWQIDAQAB
AoGAD2FW0L2FOZV0y7wQU0VU0M7DRVwEfOFn4k1as9rjxNf52sOxOU8guQ6mAqxZ
laGrTHOs0kZbZ+z7AwDQ6F9Tb4WrxxgH+MmzcUZr5K0sqKCPsOmqYkkF8oZmJ3hy
iTswzVVXnBiLg1yAAp0/bNyAVW2FueS9pj6ltgSsXKd9umkCQQDf+ylawPB2Q9HD
v+S8mGIXvZGBgwV11jBg/s1SLOHv/xxOJvk0OuTpba5YLW44e4EG1b8F1AvMvJN3
yqUgFGP7AkEAsDYGFSFuDIuZ1MILCNI6HYtyjIt8D/5wSnjV8d42TL1fhs/cpBVu
YdEP5CS5Yn94zk0WbpaGl4DuI6wA7MLguwJBAIw0bG6i1+MwEN64ADcOLFkwESVB
HunkaeRNm7kU31mcF9vUCaroMuLsBXas+ZHhvaLJqgm78qb2ZFlYQIUUPoECQQCh
rxBptyDpNfbSt7G0SGG21ksnFp2hd0/FpZZ5tfGQ/Hp4kqXbkSaVbmTsa54G+Pv6
H9WjZ07cGRtpc9vtYusdAkB3RUJQ92U0i9K0jlK8xei9gy4GAkxS4sgh6F/Vk5CQ
DtXRDgzwuz568LjPxOsY8Uycaqo3i+lKY2BUVSpUT0k3
-----END RSA PRIVATE KEY-----`

const publicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCaK/C7fZwyOWrI+xGYETtdkM0G
KKM8c8Yx2sNbI3XZJcYAD4FU0zUGKXfyT0LgkWHk3TOG5fz0+SUygQ3AQ383kCoq
zycUkntGFEkMFVirSq073aH242v8YtIpH6D4WpL/ytIV1NpOcGscakqQEedlMR5s
7WO4EisNBEJPbpaoWQIDAQAB
-----END PUBLIC KEY-----`

let db: SelvaClient

test.before(async () => {
  const selvaServer = await start({
    port: 9299,
  })
  db = selvaServer.selvaClient
})

test.after(async () => {
  await db.destroy()
})

test.serial('Should encode a payload into a jwt using a secret', async (t) => {
  const payload = {
    something: 'this is payload',
  }

  const server = await createServer({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9299,
    },
    config: {
      secrets: {
        aPrivateKey: privateKey,
      },
      functions: {
        encode: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.encode(payload, 'aPrivateKey')
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  const result = await client.call('encode', payload)
  t.like(jwt.verify(result, publicKey), payload)

  client.disconnect()
  await server.destroy()
})

test.serial('Should decode a jwt using a secret', async (t) => {
  const payload = {
    something: 'this is payload',
  }

  const encodedPayload = jwt.sign(payload, privateKey, {
    expiresIn: '2d',
    algorithm: 'RS256',
  })

  const server = await createServer({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9299,
    },
    config: {
      secrets: {
        aPublicKey: publicKey,
      },
      functions: {
        decode: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.decode(payload, 'aPublicKey')
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  const result = await client.call('decode', encodedPayload)
  t.like(result, payload)

  client.disconnect()
  await server.destroy()
})

test.serial('Should decode a jwt using a private key', async (t) => {
  const payload = {
    something: 'this is payload',
  }

  const encodedPayload = jwt.sign(payload, privateKey, {
    expiresIn: '2d',
    algorithm: 'RS256',
  })

  const server = await createServer({
    port: 9101,
    db: {
      host: 'localhost',
      port: 9299,
    },
    config: {
      functions: {
        decode: {
          observable: false,
          function: async ({ based, payload }) => {
            return based.decode(payload, { publicKey })
          },
        },
      },
    },
  })

  const client = based({
    url: async () => {
      return 'ws://localhost:9101'
    },
  })

  const result = await client.call('decode', encodedPayload)
  t.like(result, payload)

  client.disconnect()
  await server.destroy()
})
