// import { ENCODER, readUint32, writeUint32 } from '@saulx/utils'
// import { DbTrackPayload, TrackPayload } from './types.js'
// import { DECODER, xxHash64 } from '@based/db'

// const payloadToUint8Array = (payload: TrackPayload): Uint8Array => {
//   // put count
//   let size = 2 // geo size
//   const eventNameBuffer = ENCODER.encode(payload.event)
//   if (eventNameBuffer.byteLength > 255) {
//     throw new Error('Max len for event name is 255 bytes!')
//   }
//   size += 1 + eventNameBuffer.byteLength
//   // size for has ip or not
//   size += 1
//   if (payload.uniq) {
//     //
//     size += 8
//   }
//   // size for has active or not
//   size += 1
//   if (payload.active) {
//     size += 4
//   }
//   const payloadUint8 = new Uint8Array(size)
//   let i = 0
//   try {
//     ENCODER.encodeInto(payload.geo ?? '00', payloadUint8.subarray(0, 2))
//   } catch (err) {
//     throw new Error(`Incorrect passed geo payload ${payload.geo}`)
//   }
//   i += 2
//   payloadUint8[i] = eventNameBuffer.byteLength
//   i += 1
//   payloadUint8.set(eventNameBuffer, i)
//   i += eventNameBuffer.byteLength
//   if (payload.ip) {
//     payloadUint8[i] = 1
//     i += 1
//     xxHash64(ENCODER.encode(payload.ip), payloadUint8, i)
//     i += 8
//   } else {
//     payloadUint8[i] = 0
//     i += 1
//   }
//   if (payload.active != undefined) {
//     payloadUint8[i] = 1
//     i += 1
//     writeUint32(payloadUint8, payload.active, i)
//     i += 4
//   } else {
//     payloadUint8[i] = 0
//     i += 1
//   }
//   return payloadUint8
// }

// const readPayload = (p: Uint8Array): DbTrackPayload => {
//   let i = 0
//   const geo = DECODER.decode(p.subarray(i, 2))
//   i += 2
//   const event = DECODER.decode(p.subarray(i + 1, p[i] + i + 1))
//   i += p[i] + 1
//   let ip: Uint8Array | undefined
//   const hasIp = p[i] === 1
//   i += 1
//   if (hasIp) {
//     ip = p.subarray(i, i + 8)
//     i += 8
//   }
//   let active: number | undefined
//   const hasActive = p[i] === 1
//   i += 1
//   if (hasActive) {
//     // this has to be handled correctly!
//     active = readUint32(p, i)
//     i += 4
//   }
//   //  put count
//   return { geo, ip, event, active, count: 1 }
// }
