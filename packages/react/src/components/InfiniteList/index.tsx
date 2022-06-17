import {
  addSubscriber,
  removeSubscriber,
  generateSubscriptionId,
} from '@based/client'
import React, { useRef, useState, useEffect } from 'react'
import { FixedSizeList as List } from 'react-window'
import { useData, useClient } from '../..'

const addScrollSub = (client, subId, payload, offset, current, setChecksum) => {
  const [, subscriberId] = addSubscriber(
    client.client,
    payload,
    ({ items }, checksum) => {
      for (let i = 0; i < items.length; i++) {
        current.items[i + offset] = items[i]
      }
      setChecksum(`${offset}-${checksum}`)
    },
    (err) => err && console.error(err),
    console.error,
    subId
  )
  return subscriberId
}

export function InfiniteList({
  query,
  delay = 100,
  itemSize = 50,
  height = 400,
  limit = Math.ceil(height / itemSize),
  treshold = 0,
  target = 'root',
  ...props
}) {
  const blockHeight = itemSize * limit
  const client = useClient()
  const [offset, setOffset] = useState(0)
  const [blocks, setBlocks] = useState(() => {
    let blocks = Math.ceil(height / blockHeight)
    if (treshold) {
      blocks += Math.ceil(
        (height / itemSize + treshold - blocks * limit) / limit
      )
    }
    return blocks
  })

  const [, setChecksum] = useState()
  const { current } = useRef({
    offset,
    blocks,
    scroll: 0,
    items: [],
    timer: null,
    subs: {},
  })
  const {
    data: { itemCount },
  } = useData({
    itemCount: {
      $aggregate: {
        $function: 'count',
        ...query().$list.$find,
      },
    },
  })

  useEffect(() => {
    if (client) {
      return () => {
        const { subs } = current
        current.subs = {}
        setTimeout(() => {
          for (const subId in subs) {
            const subscriberId = current.subs[subId]
            removeSubscriber(client.client, subId, subscriberId)
          }
        })
      }
    }
  }, [client, current])

  useEffect(() => {
    if (client) {
      const subs = {}
      let i = blocks

      while (i--) {
        const start = offset + limit * i
        const payload = {
          $id: target,
          items: query(start, limit),
        }
        const subId = generateSubscriptionId(payload)
        subs[subId] =
          current.subs[subId] ||
          addScrollSub(
            client,
            subId,
            payload,
            offset + limit * i,
            current,
            setChecksum
          )
      }

      for (const subId in current.subs) {
        if (!(subId in subs)) {
          const subscriberId = current.subs[subId]
          removeSubscriber(client.client, subId, subscriberId)
        }
      }

      current.subs = subs
    }
  }, [target, client, offset, limit, blocks, query, current])

  useEffect(update, [
    blockHeight,
    delay,
    height,
    itemSize,
    current,
    limit,
    treshold,
  ])

  if (!itemCount || !current.items.length) {
    return null
  }

  return (
    <List
      {...props}
      height={height}
      itemSize={itemSize}
      itemData={current.items}
      itemCount={itemCount}
      onScroll={({ scrollOffset }) => {
        current.scroll = scrollOffset
        update()
      }}
    />
  )

  function update() {
    const start = Math.max(0, current.scroll / itemSize - treshold)
    const end = (current.scroll + height) / itemSize
    const newOffset = start - (start % limit)
    let newBlocks = Math.ceil(
      height / blockHeight + (current.scroll % blockHeight) / blockHeight
    )

    if (treshold) {
      const newLength = newOffset + limit * newBlocks
      newBlocks += Math.max(0, Math.ceil((end + treshold - newLength) / limit))
    }

    if (newOffset !== current.offset || newBlocks !== current.blocks) {
      current.offset = newOffset
      current.blocks = newBlocks

      const set = () => {
        setOffset(current.offset)
        setBlocks(current.blocks)
      }

      if (current.timer) {
        clearTimeout(current.timer)
      } else {
        set()
      }

      current.timer = setTimeout(() => {
        current.timer = null
        set()
      }, delay)
    } else if (current.timer) {
      clearTimeout(current.timer)
      current.timer = setTimeout(() => {
        current.timer = null
        setOffset(current.offset)
        setBlocks(current.blocks)
      }, delay)
    }
  }
}
