import { useEffect, useRef, useState } from 'react'
import { deepCopy } from '@saulx/utils'
import { hash } from '@saulx/hash'
import { EventType } from '../../types.js'
import { useQuery } from '@based/react'

export type UseDataFn = (
  page: number,
  active: boolean,
  len: number,
) => ReturnType<typeof useQuery>

export const usePaginatedData = (
  maxChars: number,
  maxLines: number,
  setSelected: (selected: number) => void,
  selected: number,
  staticData?: EventType[],
  useData?: UseDataFn,
  len: number = 100,
  minRowLines: number = 2,
) => {
  const [page, setPage] = useState<number>(0)

  const [lines, setLines] = useState<
    {
      line: string
      border?: boolean
      type: EventType['type']
      level: EventType['level']
      meta?: {
        name?: string
        createdAt?: number
      }
    }[]
  >([])

  const dataRef = useRef<{
    data: EventType[]
    isCopy: boolean
    page: number
    selected: number
  }>({
    data: [],
    isCopy: false,
    page: 0,
    selected: 0,
  })
  let data: EventType[] | null = null
  let checksum: number = 0
  if (staticData) {
    data = staticData
    checksum = hash(data)
  } else {
    const d = useData(
      page,
      selected === 0 || dataRef.current.page !== page,
      len,
    )
    data = d.data
    checksum = d.checksum
  }

  if (selected === 0 && data) {
    dataRef.current.data = data
    dataRef.current.isCopy = false
    dataRef.current.page = 0
  } else if (
    selected !== 0 &&
    dataRef.current.page !== page &&
    data &&
    data.length
  ) {
    dataRef.current.data = [...dataRef.current.data, ...deepCopy(data)]
    dataRef.current.isCopy = true
    dataRef.current.page = page
  }

  useEffect(() => {
    const tempLines = []
    for (let i = 0; i < maxLines; i++) {
      tempLines.push({ line: ' ' })
    }
    if (selected !== dataRef.current.selected) {
      dataRef.current.selected = selected
      if (selected !== 0 && !dataRef.current.isCopy) {
        dataRef.current.data = deepCopy(dataRef.current.data)
        dataRef.current.isCopy = false
      }
      if (selected === 0) {
        setPage(0)
      }
    }
    const d = dataRef.current.data
    if (!d) {
      setLines(tempLines)
      return
    }

    let size = 0
    let lineIndex = 0

    for (let i = 0; i < d.length; i++) {
      const log = d[i]
      let msg = log.msg.split('\n')

      if (msg[msg.length - 1] === '' && msg.length === 2) {
        msg = msg.slice(0, -1)
      }

      let totalLines = 0
      let lineAdded = 0

      lineIndex++
      const index = maxLines - lineIndex + selected
      if (tempLines[index]) {
        tempLines[index] = {
          type: log.type,
          border: true,
          line: ' ',
        }
        size += 1
        if (size > maxLines) {
          break
        }
      }

      for (let j = msg.length - 1; j >= 0; j--) {
        const lines = Math.ceil(Math.max(msg[j].length, 1) / maxChars)
        totalLines += lines
      }

      if (totalLines < minRowLines) {
        for (let n = totalLines; n < minRowLines; n++) {
          lineIndex++
          lineAdded++
          const index = maxLines - lineIndex + selected
          if (tempLines[index]) {
            tempLines[index] = {
              line: ' ',
              meta: n === 1 && {
                createdAt: log.createdAt,
              },
            }
            size += 1
            if (size > maxLines) {
              break
            }
          }
        }
      }

      for (let j = msg.length - 1; j >= 0; j--) {
        const lines = Math.ceil(msg[j].length / maxChars)
        for (let n = lines - 1; n >= 0; n--) {
          const line = msg[j].slice(n * maxChars, (n + 1) * maxChars)
          lineIndex++
          lineAdded++
          const index = maxLines - lineIndex + selected
          if (tempLines[index]) {
            tempLines[index] = {
              line,
              type: log.type,
              level: log.level,
              meta:
                j === 0 && n === 0
                  ? log.function && {
                      name: log.function.name,
                    }
                  : lineAdded === totalLines - 1
                    ? log.createdAt && {
                        createdAt: log.createdAt,
                      }
                    : undefined,
            }
            size += 1
            if (size > maxLines) {
              break
            }
          }
        }
      }

      if (size > maxLines) {
        break
      }
    }

    if (d.length > len - 1 && selected !== 0 && size !== maxLines) {
      setPage(dataRef.current.page + 1)
    }

    setLines(tempLines)
  }, [maxChars, maxLines, checksum, selected])

  return { lines, setSelected, selected }
}
