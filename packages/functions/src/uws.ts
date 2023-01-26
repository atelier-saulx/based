export type RecognizedString =
  | string
  | ArrayBuffer
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array

/** A WebSocket connection that is valid from open to close event.
 * Read more about this in the user manual.
 */
export interface WebSocket {
  /** Sends a message. Make sure to check getBufferedAmount() before sending. Returns true for success, false for built up backpressure that will drain when time is given.
   * Returning false does not mean nothing was sent, it only means backpressure was built up. This you can check by calling getBufferedAmount() afterwards.
   *
   * Make sure you properly understand the concept of backpressure. Check the backpressure example file.
   */
  send(
    message: RecognizedString,
    isBinary?: boolean,
    compress?: boolean
  ): boolean

  /** Returns the bytes buffered in backpressure. This is similar to the bufferedAmount property in the browser counterpart.
   * Check backpressure example.
   */
  getBufferedAmount(): number

  /** Gracefully closes this WebSocket. Immediately calls the close handler.
   * A WebSocket close message is sent with code and shortMessage.
   */
  end(code?: number, shortMessage?: RecognizedString): void

  /** Forcefully closes this WebSocket. Immediately calls the close handler.
   * No WebSocket close message is sent.
   */
  close(): void

  /** Sends a ping control message. Returns true on success in similar ways as WebSocket.send does (regarding backpressure). This helper function correlates to WebSocket::send(message, uWS::OpCode::PING, ...) in C++. */
  ping(message?: RecognizedString): boolean

  /** Subscribe to a topic. */
  subscribe(topic: RecognizedString): boolean

  /** Unsubscribe from a topic. Returns true on success, if the WebSocket was subscribed. */
  unsubscribe(topic: RecognizedString): boolean

  /** Returns whether this websocket is subscribed to topic. */
  isSubscribed(topic: RecognizedString): boolean

  /** Returns a list of topics this websocket is subscribed to. */
  getTopics(): string[]

  /** Publish a message under topic. Backpressure is managed according to maxBackpressure, closeOnBackpressureLimit settings.
   * Order is guaranteed since v20.
   */
  publish(
    topic: RecognizedString,
    message: RecognizedString,
    isBinary?: boolean,
    compress?: boolean
  ): boolean

  /** See HttpResponse.cork. Takes a function in which the socket is corked (packing many sends into one single syscall/SSL block) */
  cork(cb: () => void): WebSocket

  /** Returns the remote IP address. Note that the returned IP is binary, not text.
   *
   * IPv4 is 4 byte long and can be converted to text by printing every byte as a digit between 0 and 255.
   * IPv6 is 16 byte long and can be converted to text in similar ways, but you typically print digits in HEX.
   *
   * See getRemoteAddressAsText() for a text version.
   */
  getRemoteAddress(): ArrayBuffer

  /** Returns the remote IP address as text. See RecognizedString. */
  getRemoteAddressAsText(): ArrayBuffer

  /** Arbitrary user data may be attached to this object. In C++ this is done by using getUserData(). */
  [key: string]: any
}

/** An HttpResponse is valid until either onAborted callback or any of the .end/.tryEnd calls succeed. You may attach user data to this object. */
export interface HttpResponse {
  /** Writes the HTTP status message such as "200 OK".
   * This has to be called first in any response, otherwise
   * it will be called automatically with "200 OK".
   *
   * If you want to send custom headers in a WebSocket
   * upgrade response, you have to call writeStatus with
   * "101 Switching Protocols" before you call writeHeader,
   * otherwise your first call to writeHeader will call
   * writeStatus with "200 OK" and the upgrade will fail.
   *
   * As you can imagine, we format outgoing responses in a linear
   * buffer, not in a hash table. You can read about this in
   * the user manual under "corking".
   */
  writeStatus(status: RecognizedString): HttpResponse
  /** Writes key and value to HTTP response.
   * See writeStatus and corking.
   */
  writeHeader(key: RecognizedString, value: RecognizedString): HttpResponse
  /** Enters or continues chunked encoding mode. Writes part of the response. End with zero length write. Returns true if no backpressure was added. */
  write(chunk: RecognizedString): boolean
  /** Ends this response by copying the contents of body. */
  end(body?: RecognizedString, closeConnection?: boolean): HttpResponse
  /** Ends this response, or tries to, by streaming appropriately sized chunks of body. Use in conjunction with onWritable. Returns tuple [ok, hasResponded]. */
  tryEnd(
    fullBodyOrChunk: RecognizedString,
    totalSize: number
  ): [boolean, boolean]

  /** Immediately force closes the connection. Any onAborted callback will run. */
  close(): HttpResponse

  /** Returns the global byte write offset for this response. Use with onWritable. */
  getWriteOffset(): number

  /** Registers a handler for writable events. Continue failed write attempts in here.
   * You MUST return true for success, false for failure.
   * Writing nothing is always success, so by default you must return true.
   */
  onWritable(handler: (offset: number) => boolean): HttpResponse

  /** Every HttpResponse MUST have an attached abort handler IF you do not respond
   * to it immediately inside of the callback. Returning from an Http request handler
   * without attaching (by calling onAborted) an abort handler is ill-use and will termiante.
   * When this event emits, the response has been aborted and may not be used. */
  onAborted(handler: () => void): HttpResponse

  /** Handler for reading data from POST and such requests. You MUST copy the data of chunk if isLast is not true. We Neuter ArrayBuffers on return, making it zero length. */
  onData(handler: (chunk: ArrayBuffer, isLast: boolean) => void): HttpResponse

  /** Returns the remote IP address in binary format (4 or 16 bytes). */
  getRemoteAddress(): ArrayBuffer

  /** Returns the remote IP address as text. */
  getRemoteAddressAsText(): ArrayBuffer

  /** Returns the remote IP address in binary format (4 or 16 bytes), as reported by the PROXY Protocol v2 compatible proxy. */
  getProxiedRemoteAddress(): ArrayBuffer

  /** Returns the remote IP address as text, as reported by the PROXY Protocol v2 compatible proxy. */
  getProxiedRemoteAddressAsText(): ArrayBuffer

  /** Corking a response is a performance improvement in both CPU and network, as you ready the IO system for writing multiple chunks at once.
   * By default, you're corked in the immediately executing top portion of the route handler. In all other cases, such as when returning from
   * await, or when being called back from an async database request or anything that isn't directly executing in the route handler, you'll want
   * to cork before calling writeStatus, writeHeader or just write. Corking takes a callback in which you execute the writeHeader, writeStatus and
   * such calls, in one atomic IO operation. This is important, not only for TCP but definitely for TLS where each write would otherwise result
   * in one TLS block being sent off, each with one send syscall.
   *
   * Example usage:
   *
   * res.cork(() => {
   *   res.writeStatus("200 OK").writeHeader("Some", "Value").write("Hello world!");
   * });
   */
  cork(cb: () => void): HttpResponse

  /** Upgrades a HttpResponse to a WebSocket. See UpgradeAsync, UpgradeSync example files. */
  upgrade<T>(
    userData: T,
    secWebSocketKey: RecognizedString,
    secWebSocketProtocol: RecognizedString,
    secWebSocketExtensions: RecognizedString,
    context: any
  ): void

  /** Arbitrary user data may be attached to this object */
  [key: string]: any
}

/** An HttpRequest is stack allocated and only accessible during the callback invocation. */
export interface HttpRequest {
  /** Returns the lowercased header value or empty string. */
  getHeader(lowerCaseKey: RecognizedString): string
  /** Returns the parsed parameter at index. Corresponds to route. */
  getParameter(index: number): string
  /** Returns the URL including initial /slash */
  getUrl(): string
  /** Returns the HTTP method, useful for "any" routes. */
  getMethod(): string
  /** Returns the raw querystring (the part of URL after ? sign) or empty string. */
  getQuery(): string
  /** Returns a decoded query parameter value or empty string. */
  getQuery(key: string): string
  /** Loops over all headers. */
  forEach(cb: (key: string, value: string) => void): void
  /** Setting yield to true is to say that this route handler did not handle the route, causing the router to continue looking for a matching route handler, or fail. */
  setYield(y: boolean): HttpRequest
}
