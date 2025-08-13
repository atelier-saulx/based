import { BasedClient } from '@based/client'
import { EventType } from '../types.js'
import { getSourcemap } from './getSourcemap.js'
import { SourceMapConsumer } from 'source-map'

export type LogStack = {
  message: string
  functionName?: string
  path?: string
  line?: number
  column?: number
  parseFail?: boolean
}

export const parseStack = (error: Error | string): LogStack => {
  const re = /(.*?)\s{3,}at (.*?) \((.*?):(\d+):(\d+)\)/s
  const match = re.exec(String(error))
  if (!match) {
    return {
      message: String(error),
      parseFail: true,
    }
  }
  return {
    message: match[1],
    functionName: match[2],
    path: match[3],
    line: Number(match[4]),
    column: Number(match[5]),
  }
}

let envIdCached: string | undefined

const parseLog = async (log: EventType, client: BasedClient) => {
  if (!envIdCached) {
    const { envId } = await client.call('based:env-info')
    envIdCached = envId
  }

  if (log.level === 'error') {
    const sourcemap = await getSourcemap(
      client,
      String(log.function.checksum),
      envIdCached,
    )
    let location: string
    const stack = parseStack(log.msg)
    if (sourcemap && sourcemap.version) {
      location = await SourceMapConsumer.with(sourcemap, null, (consumer) => {
        const originalPosition = consumer.originalPositionFor({
          line: stack.line,
          column: stack.column,
        })
        return `${originalPosition.source}:${originalPosition.line}:${originalPosition.column}`
      })
    }
    return {
      ...log,
      stack,
      location,
    }
  }
  return log
}
