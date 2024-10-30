import {
  ConsoleManager,
  Box,
  InPageWidgetBuilder,
  ConsoleGuiOptions,
  KeyListenerArgs,
} from 'console-gui-tools'
import { parseMessage } from './parseMessage.js'
import { AppContext } from './AppContext.js'

export const getTerminal = ({
  title,
  header: headerContent = [],
  lines: linesConfig = {
    sort: 'desc',
  },
}) => {
  const context: AppContext = AppContext.getInstance()
  // let autoScroll: boolean = true
  let logPopup: boolean = false

  const GUI = new ConsoleManager({
    title,
    layoutOptions: {
      boxed: false,
      type: 'single',
      fitHeight: true,
    },
    logLocation: 'popup',
    logPageSize: 50,
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
  const containerLines = new InPageWidgetBuilder(GUI.Screen.height)

  const lineElement = '─'.repeat(process.stdout.columns)

  const addRow = (element: InPageWidgetBuilder, content: string) =>
    element.addRow({
      text: parseMessage(content),
    })

  const kill: Based.Context.TerminalFunctions['kill'] = (fn: any) =>
    GUI.on('exit', fn)
  const render: Based.Context.TerminalFunctions['render'] = () => GUI.refresh()
  const header = (content: string | string[]) => {
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
        addRow(containerLines, value)
      }
    } else {
      addRow(containerLines, content)
    }

    containerElement.setContent(containerLines)

    render()
  }

  context.event.on('directions', ({ name }: Based.Context.DirectionsEvent) => {
    switch (name) {
      case 'up':
        console.log('PRA CIMA!!!!!!')
        break
      case 'down':
        console.log('PRA BAIXO!!!!!')
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
  }
}
