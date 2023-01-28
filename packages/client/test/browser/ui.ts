import { padLeft } from '@saulx/utils'

export const button = (label: string, fn: () => void) => {
  const button = document.createElement('button')
  button.innerHTML = label
  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'
  button.onclick = fn
  document.body.appendChild(button)
}

export const toggleButton = (label: string, fn: () => () => void) => {
  const button = document.createElement('button')
  button.innerHTML = label
  button.style.padding = '16px'
  button.style.border = '2px solid #000'
  button.style.borderRadius = '4px'
  button.style.fontSize = '14px'
  button.style.fontWeight = 'bold'
  button.style.cursor = 'pointer'
  button.style.margin = '10px'
  button.style.fontFamily = 'Andale Mono'
  let cl: any = fn
  button.onclick = () => {
    cl = cl()
    if (!cl) {
      button.style.backgroundColor = '#fff'
      button.style.color = '#000'
      cl = fn
    } else {
      button.style.backgroundColor = '#000'
      button.style.color = '#fff'
    }
  }
  document.body.appendChild(button)
}

export const logs = (): ((...args: any[]) => void) => {
  const div = document.createElement('div')
  const logs: string[] = []
  div.style.padding = '16px'
  div.style.border = '2px solid #000'
  div.style.borderRadius = '4px'
  div.style.fontSize = '14px'
  div.style.fontWeight = 'bold'
  div.style.cursor = 'pointer'
  div.style.fontFamily = 'Andale Mono'
  div.style.height = '400px'
  div.style.margin = '10px'
  div.style.overflowY = 'scroll'
  div.onclick = () => {}
  document.body.appendChild(div)
  return (...args) => {
    const d = new Date()
    logs.push(
      `<div style="margin-top:4px;margin-bottom:8px"><span style="font-size:12px;color:#ccc">${d.getHours()}:${padLeft(
        '' + d.getMinutes(),
        2,
        '0'
      )}:${padLeft('' + d.getSeconds(), 2, '0')}:${padLeft(
        '' + d.getMilliseconds(),
        3,
        '0'
      )}</span> ${args
        .map((v) => {
          if (typeof v === 'object') {
            return JSON.stringify(v, null, 2)
          }
          return v
        })
        .join(': ')}</div>`
    )

    if (logs.length > 250) {
      logs.shift()
    }

    div.innerHTML = logs.join('')

    div.scrollTop = div.scrollHeight
  }
}
