import terminalKit from 'terminal-kit'
const term = terminalKit.terminal

export function contextTerminalKit({
  title,
  header: headerContent = [],
  rows: { sort: sortOrder = 'desc' },
  scrollMode = 'item',
}: Based.Context.Terminal.Get): Based.Context.Terminal.ReturnedFunctions {
  let autoScroll = true
  let scrollPosition = 0
  let navigationIndex = 0
  const itemIndexMap = new Map<number, { start: number; lines: number }>()
  let headerLines: string[] = []
  const contentLines: string[] = []

  term.clear()
  term.eraseDisplayAbove()
  term.grabInput({ mouse: 'motion', safe: true })

  if (title) {
    term(`\x1b]0;${title}\x07`)
  }

  const prepareContent = (
    content: Based.Context.Terminal.ContentRaw,
  ): string[][] => {
    if (Array.isArray(content)) {
      return content.map((line) => line.split('\n'))
    }

    if (typeof content === 'string') {
      return [content.split('\n')]
    }

    return []
  }

  const renderScrollbar = () => {
    const contentHeight = term.height - headerLines.length
    const totalContent = contentLines.length

    if (totalContent <= contentHeight) return

    const maxScrollPosition = totalContent - contentHeight
    const scrollbarHeight = Math.max(
      1,
      Math.floor((contentHeight * contentHeight) / totalContent),
    )
    const scrollbarPosition = Math.floor(
      (contentHeight - scrollbarHeight) * (scrollPosition / maxScrollPosition),
    )

    for (let i = 0; i < contentHeight; i++) {
      term.moveTo(term.width, headerLines.length + i + 1)
      term('│')
    }

    term.bold()

    for (let i = 0; i < scrollbarHeight; i++) {
      term.moveTo(term.width, headerLines.length + scrollbarPosition + i + 1)
      term('█')
    }

    term.styleReset()
  }

  const navigateItems = (direction: 'up' | 'down') => {
    const maxIndex = itemIndexMap.size - 1

    if (sortOrder === 'desc') {
      if (direction === 'down') {
        navigationIndex = Math.max(0, navigationIndex - 1)
      } else if (direction === 'up') {
        navigationIndex = Math.min(maxIndex, navigationIndex + 1)
      }
    } else {
      if (direction === 'down') {
        navigationIndex = Math.min(maxIndex, navigationIndex + 1)
      } else if (direction === 'up') {
        navigationIndex = Math.max(0, navigationIndex - 1)
      }
    }

    autoScroll = false
    ensureItemVisibility(navigationIndex)
    render()
  }

  const ensureItemVisibility = (index: number) => {
    const item = itemIndexMap.get(index)

    if (!item) return

    const contentHeight = term.height - headerLines.length
    const itemEnd = item.start + item.lines

    if (item.start < scrollPosition) {
      scrollPosition = item.start
    } else if (itemEnd > scrollPosition + contentHeight) {
      scrollPosition = itemEnd - contentHeight
    }
  }

  const addHeaderRows = (content: Based.Context.Terminal.ContentRaw) => {
    headerLines = prepareContent(content).flat()
    headerLines.push('─'.repeat(process.stdout.columns))
  }

  const addContainerRows = (content: Based.Context.Terminal.ContentRaw) => {
    const groupedLines = prepareContent(content)
    const contentHeight = term.height - headerLines.length - 1

    for (const lines of groupedLines) {
      const newIndex = itemIndexMap.size
      const startPosition = sortOrder === 'asc' ? contentLines.length : 0

      itemIndexMap.set(newIndex, { start: startPosition, lines: lines.length })

      if (sortOrder === 'asc') {
        contentLines.push(...lines)
      } else {
        contentLines.unshift(...lines)

        for (const [key, value] of itemIndexMap) {
          if (key !== newIndex) {
            itemIndexMap.set(key, {
              start: value.start + lines.length,
              lines: value.lines,
            })
          }
        }
      }

      if (lines.length > contentHeight) {
        scrollPosition = startPosition
      }
    }

    if (autoScroll) {
      navigationIndex = itemIndexMap.size - 1
    }

    if (!autoScroll && sortOrder === 'desc') {
      scrollPosition = Math.min(scrollPosition, contentLines.length - 1)
    } else if (autoScroll) {
      scrollPosition =
        sortOrder === 'asc'
          ? Math.max(0, contentLines.length - contentHeight)
          : 0
    }

    if (scrollPosition >= contentLines.length && sortOrder === 'desc') {
      autoScroll = true
    } else if (scrollPosition <= 0 && sortOrder === 'asc') {
      autoScroll = true
    }

    render()
  }

  const render = () => {
    term.hideCursor()
    term.moveTo(1, 1)
    term.eraseDisplayBelow()
    const contentHeight = term.height - headerLines.length

    headerLines.forEach((line, i) => {
      term.moveTo(1, i + 1)
      term.eraseLine()
      term(line)
    })

    const visibleLines = contentLines.slice(
      scrollPosition,
      scrollPosition + contentHeight,
    )

    visibleLines.forEach((line, i) => {
      const lineIndex = scrollPosition + i
      term.moveTo(1, headerLines.length + i + 1)
      term.eraseLine()

      const { start } = itemIndexMap.get(navigationIndex) || { start: 0 }

      if (lineIndex === start) {
        term.bold(`>>> ${line}`)
      } else {
        term(` ${line}`)
      }
    })

    renderScrollbar()
  }

  term.on('mouse', (name: string, data) => {
    const contentHeight = term.height - headerLines.length
    if (data.y > headerLines.length && data.y <= term.height) {
      if (name === 'MOUSE_WHEEL_UP') {
        if (scrollPosition > 0) {
          scrollPosition--
          autoScroll = false
        } else {
          autoScroll = true
        }
      } else if (name === 'MOUSE_WHEEL_DOWN') {
        const maxScrollPosition = contentLines.length - contentHeight
        if (scrollPosition < maxScrollPosition) {
          scrollPosition++
          autoScroll = false
        } else {
          autoScroll = true
        }
      }

      render()
    }
  })

  term.on('key', (name: string) => {
    if (scrollMode === 'item') {
      if (name === 'UP') {
        navigateItems('up')
      } else if (name === 'DOWN') {
        navigateItems('down')
      }
    }

    if (name === 'CTRL_C' || name === 'ESCAPE' || name === 'q') {
      term.grabInput(false)
      term.hideCursor(false)
      term.clear()

      if (exitCallback) {
        exitCallback()
      }

      term.processExit(0)
    }
  })

  let exitCallback: (() => void) | null = null

  const kill = (fn?: () => void) => {
    if (fn) {
      exitCallback = fn
    }
  }

  addHeaderRows(headerContent)

  for (let index = 0; index <= term.height; index++) {
    console.log()
  }

  return {
    kill,
    render,
    header: addHeaderRows,
    addRow: addContainerRows,
  }
}
