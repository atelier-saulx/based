import {
  ConsoleManager,
  Box,
  InPageWidgetBuilder,
  ConsoleGuiOptions,
  KeyListenerArgs,
  StyledElement,
} from 'console-gui-tools'
import { parseMessage } from './parseMessage.js'
import { AppContext } from './AppContext.js'

export const getTerminal = ({
  title,
  header: headerContent = [],
  lines: linesConfig = {
    sort: 'asc',
  },
}: Based.Context.Terminal): Based.Context.TerminalFunctions => {
  const context: AppContext = AppContext.getInstance()
  let autoScroll: boolean = true
  let logPopup: boolean = false

  const GUI = new ConsoleManager({
    title,
    layoutOptions: {
      boxed: false,
      type: 'single',
      fitHeight: true,
    },
    logLocation: 'popup',
    logPageSize: 30,
    enableMouse: true,
  } as ConsoleGuiOptions)

  const headerElement = new Box({
    id: 'header',
    x: 0,
    y: 0,
    width: GUI.Screen.width,
    style: {
      boxed: false,
    },
  })

  const containerElement = new Box({
    id: 'container',
    x: 0,
    y: 0,
    width: GUI.Screen.width,
    height: GUI.Screen.height,
    style: {
      boxed: false,
    },
  })

  const scrollPercentage = (
    scrollPosition: number,
    containerSize: number,
    containerHeight: number,
  ) => {
    if (containerHeight >= containerSize) {
      return 100
    }

    const porcentagem =
      (scrollPosition / (containerSize - containerHeight)) * 100

    return Math.min(Math.max(porcentagem, 0), 100)
  }

  const isAsc = linesConfig.sort === 'asc'
  const containerLines = new InPageWidgetBuilder(GUI.Screen.height)
  const containerHeight = () => containerElement.absoluteValues.height
  const containerContentSize = () => containerLines.content.length
  const scrollPosition = () => containerLines.scrollIndex
  const scrollPositionPercentage = () =>
    scrollPercentage(
      scrollPosition(),
      containerContentSize(),
      containerHeight(),
    )
  const lineElement = '─'.repeat(process.stdout.columns)

  const addRow = (element: InPageWidgetBuilder, content: string) =>
    element.addRow({
      text: parseMessage(content),
    })

  const addContainerRow = (element: InPageWidgetBuilder, content: string) => {
    const lastPosition = scrollPosition()

    if (isAsc) {
      addRow(element, content)
    } else {
      element.content.unshift([
        { text: parseMessage(content) },
      ] as StyledElement[])
    }

    const isToStopScrolling =
      containerContentSize() > containerHeight() && !autoScroll

    if (isToStopScrolling) {
      const newPosition = isAsc
        ? Math.min(lastPosition + 1, containerContentSize() - containerHeight())
        : lastPosition

      element.setScrollIndex(newPosition)
    } else {
      const newPosition = isAsc ? 0 : containerContentSize() - containerHeight()

      element.setScrollIndex(newPosition)
    }
  }

  const kill: Based.Context.TerminalFunctions['kill'] = (fn: any) =>
    GUI.on('exit', fn)
  const render: Based.Context.TerminalFunctions['render'] = () => GUI.refresh()
  const header: Based.Context.TerminalFunctions['header'] = (
    content: string | string[],
  ) => {
    const isArray = Array.isArray(content)

    if (!content || (isArray && !content.length)) {
      render()
      return
    }

    const height = isArray ? content.length + 1 : 1
    const row = new InPageWidgetBuilder(height)

    if (isArray) {
      for (const value of content) {
        addRow(row, value)
      }
    } else {
      addRow(row, content)
    }

    addRow(row, lineElement)

    headerElement.setContent(row)

    headerElement.absoluteValues = {
      x: 0,
      y: 0,
      width: GUI.Screen.width,
      height,
    }

    containerElement.absoluteValues = {
      x: 0,
      y: headerElement.absoluteValues.height,
      width: GUI.Screen.width,
      height: GUI.Screen.height - height,
    }

    render()
  }
  const setTable: Based.Context.TerminalFunctions['setTable'] = () => {}
  const addLine: Based.Context.TerminalFunctions['addLine'] = (
    content: string | string[],
  ) => {
    const isArray = Array.isArray(content)

    if (!content || (isArray && !content.length)) {
      render()
      return
    }

    if (isArray) {
      if (linesConfig && linesConfig?.sort === 'asc') {
        content.reverse()
      }

      for (const value of content) {
        addContainerRow(containerLines, value)
      }
    } else {
      addContainerRow(containerLines, content)
    }

    containerElement.setContent(containerLines)

    render()
  }

  context.event.on('directions', ({ name }: Based.Context.DirectionsEvent) => {
    switch (name) {
      case 'up':
        if (isAsc && scrollPositionPercentage() < 100) {
          autoScroll = false
        } else if (!isAsc && scrollPositionPercentage() === 100) {
          autoScroll = true
        }

        containerLines.increaseScrollIndex()
        break
      case 'down':
        if (isAsc && scrollPositionPercentage() === 0) {
          autoScroll = true
        } else if (!isAsc && scrollPositionPercentage() < 100) {
          autoScroll = false
        }

        containerLines.decreaseScrollIndex()
        break

      default:
        break
    }
  })

  process.stdin.on('keypress', (_, { name }: KeyListenerArgs) => {
    switch (name) {
      case 'escape':
        if (logPopup) {
          logPopup = false
        } else {
          GUI.emit('exit')
        }

        break
      case 'q':
        GUI.emit('exit')

        break
      case 'l':
        if (logPopup) return

        console.clear()
        logPopup = true
        GUI.showLogPopup()
        break
      default:
        break
    }
  })

  header(headerContent)
  render()

  return {
    kill,
    render,
    header,
    setTable,
    addLine,
    autoScroll,
  }
}
