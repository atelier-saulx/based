import { RequestTypes } from '@based/types'

import zlib from 'node:zlib'

import jsonpack from 'jsonpack'
const createCompress = require('compress-brotli')

import fflate from 'fflate'

import {
  MsgPackEncoderFast,
  MsgPackDecoderFast,
} from 'json-joy/es2020/json-pack/msgpack'

export const incomingTypes = {}

export const outGoingTypes = {}

// fflate.inflateSync

const decompress = require('brotli/decompress')
// const compress = require('brotli/compress')

const encoder = new MsgPackEncoderFast()
const msgDecode = new MsgPackDecoderFast()

// const bigObject = []
// for (let i = 0; i < 1000; i++) {
//   bigObject.push({ x: i })
// }

const bigObject = require('./tmp.json')

// 0 = JSON
// 1 = brotli
// 2 = MSGPACK

let COMPRESSION_TYPE = 1

export async function encodeSubData(
  id: number,
  checksum: number,
  d: Object
): Promise<Uint8Array> {
  // now size

  // 16777216 MAX SIZE OF PAYLOAD

  // first is type, second is id, third is checksum, 3rd is size of payload

  const data = bigObject
  // const data = {
  //   name: [0, 'This is something'],
  //   updatedAt: [0, 1656430322719],
  // }
  // will add types based on size if super small just json

  const originalSize = Buffer.from(JSON.stringify(data)).length

  let buffer
  let now = Date.now()

  // now = Date.now()
  // buffer = encoder.encode(data)
  // console.info('MSGPACK', Date.now() - now, 'ms')

  // or just json for small
  // now = Date.now()
  // buffer = Buffer.from(JSON.stringify(data))
  // console.info('JSON', Date.now() - now, 'ms')

  // now = Date.now()
  // // let x = Buffer.from(JSON.stringify(data))
  // buffer = zlib.brotliCompressSync(JSON.stringify(data), {
  //   // [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
  //   // [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
  //   // [zlib.constants.BROTLI_PARAM_SIZE_HINT]: x.length,
  // }) // 15x smaller for brotli on large objects
  // console.log('BROTLI CREATE', Date.now() - now, 'ms')

  // now = Date.now()
  // buffer = zlib.gzipSync(JSON.stringify(data), {}) // 2.83x smaller then msg pack / prob not worth it
  // console.log('GZIP', Date.now() - now, 'ms')

  // 100 byte is cutoff

  now = Date.now()
  // buffer = zlib.deflateRawSync(buffer, {})
  buffer = zlib.deflateRawSync(JSON.stringify(data), {}) // 2.83x smaller then msg pack / prob not worth it
  console.log('DEFLATE', Date.now() - now, 'ms')

  console.info(
    'BUFFER LEN',
    buffer.length,
    Math.round((originalSize / buffer.length) * 100) / 100,
    'COMPRESSION RATIO'
  )

  // add extra (Can mask it in the first)

  const basicLen = 1 + 1 + 1 + 1 + 8 + 8

  const start = new Uint8Array(1 + 1 + 1 + 1 + 8 + 8 + buffer.length)
  // size is extra 3

  start.set(buffer, basicLen)

  // type
  start[0] = 1

  // this is an extra delimiter check
  start[1] = 132 + 1

  // let size = 5e6
  // for (let index = 2; index < 2 + 3; index++) {
  //   const byte = size & 0xff // (256)
  //   start[index] = byte
  //   size = (size - byte) / 256
  // }

  // chunks IF 1 dont need size
  start[2] = 1
  // this is an extra check
  start[3] = 132 - 1

  // id
  let long = 3505570842633
  for (let index = 4; index < 4 + 8; index++) {
    const byte = long & 0xff // (256)
    start[index] = byte
    long = (long - byte) / 256
  }

  // checksum
  let long2 = 1377755639644
  for (let index = 4 + 8; index < 4 + 8 + 8; index++) {
    const byte = long2 & 0xff // (256)
    start[index] = byte
    long2 = (long2 - byte) / 256
  }

  // zlib

  // 22 bytes

  // size has to be stored as well

  return start
}

export function decodeSubData(buff: Uint8Array) {
  if (buff[1] === 132 + buff[0] && buff[3] + buff[0] === 132) {
    // checksum to see if it sub data

    if (buff[2] === 1) {
      // no chunked shit
      console.info('single chunk')

      const basicLength = 1 + 1 + 1 + 1 + 8 + 8

      let id = 0
      for (let i = 11; i >= 4; i--) {
        id = id * 256 + buff[i]
      }

      let checksum = 0
      for (let i = basicLength - 1; i >= 4 + 8; i--) {
        checksum = checksum * 256 + buff[i]
      }

      const arr = [buff[0], id, checksum]

      // let now = Date.now()
      // const datax = JSON.parse(
      //   new TextDecoder().decode(buff.slice(basicLength))
      // )
      // console.info('EXTRACT JSON', Date.now() - now, 'ms')

      // let now = Date.now()
      // const datax = msgDecode.decode(buff.slice(basicLength))
      // console.info('EXTRACT MSGPACK', Date.now() - now, 'ms')

      // let now = Date.now()
      // const d = zlib.brotliDecompressSync(buff.slice(basicLength))
      // let y = JSON.parse(d.toString())
      // console.info('BROTLI NODE', Date.now() - now, 'ms')

      // let now = Date.now()
      // const x = decompress(buff.slice(basicLength), buff.length - basicLength)
      // var str = new TextDecoder().decode(x)
      // let y = JSON.parse(str)
      // console.info('BROTLI BROWSER', Date.now() - now, 'ms')

      // let now = Date.now()
      // const d = zlib.gunzipSync(buff.slice(basicLength))
      // let y = JSON.parse(d.toString())
      // console.info('ZLIB NODE', Date.now() - now, 'ms')

      const now = Date.now()
      const d = fflate.inflateSync(buff.slice(basicLength))
      const str = new TextDecoder().decode(d)
      const y = JSON.parse(str)
      // const y = JSON.parse(fflate.strFromU8(d))
      console.info('ZLIB BROWSER', Date.now() - now, 'ms')

      // console.info(y)
      // console.log(JSON.parse(d.toString()))
    }

    console.info('correct')
  }
}

// https://github.com/uNetworking/uWebSockets.js/blob/61fa4bd06cf9db078716dc0c70bc5e8274d742f6/examples/PubSub.js
