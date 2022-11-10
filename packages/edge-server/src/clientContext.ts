// import { hash } from '@saulx/hash'

/*
    sharedArrayBuffer UA
    // make a ua table and hash UA
    // ip just in buffer format
    // 250 bytes
  */

// export const readIpFromContext = () => {
//   // what to read
//   // ip
//   // ua
//   // id
//   // authState
//   /*
//   function bytesToNumber(byteArray) {
//     let result = 0;
//     for (let i = byteArray.length - 1; i >= 0; i--) {
//         result = (result * 256) + byteArray[i];
//     }
//     return result;
// }
//   */
// }

// export const readUaFromContext = () => {}

// export const readQueryFromContext = () => {}

// export const readEncodingFromContext = () => {}

// export const readAuthStateFromContext = () => {}

// /*
// export type ClientContext = {
//   query: string
//   ua: string
//   ip: string
//   id: number
//   authState?: any
//   method: string //  this will be removed
//   headers: {
//     'content-length'?: number
//     authorization?: string
//     'content-type'?: string
//     'content-encoding'?: string
//     encoding?: string
//   }
// }
// */

// const encoder = new TextEncoder()

// export const createContext = (
//   ip: ArrayBuffer,
//   ua: string,
//   query: string,
//   authState: any, // maybe add refresh and token (token can then have )
//   forwardedFor: string,
//   outgoingEncoding: string
// ): Uint8Array => {
//   // IP 16 bytes
//   // UA 8 bytes
//   // ENCODING 1 byte (in & out)

//   // forwarded for needs to be parsed to 16 bytes ipv6
//   let len = 16 + 8 + 1

//   const encodedQuery = encoder.encode(query)

//   len += encodedQuery.byteLength

//   const sharedBuffer = new SharedArrayBuffer(len)

//   const view = new Uint8Array(sharedBuffer)

//   view.set(new Uint8Array(ip), 0)

//   const uaHash = hash(ua)

//   let n = uaHash
//   for (let index = 16; index < 32; index++) {
//     const byte = n & 0xff
//     view[index] = byte
//     n = (n - byte) / 256
//   }

//   // typeof auth state is {} with refresh token and token
//   // then

//   // parse encoding
//   view[32] = outgoingEncoding.includes('deflate')
//     ? 1
//     : outgoingEncoding.includes('gzip')
//     ? 2
//     : outgoingEncoding.includes('br')
//     ? 3
//     : 0

//   return view
// }
