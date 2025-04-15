import { Schema, StrictSchema, parse } from '@based/schema'
import initPathFindingLib from './pfLib.js'
import { TypeVisual } from './types.js'
import { render } from './render.js'
import { positionTypes } from './positionTypes.js'
initPathFindingLib()

export class Ctx {
  scale: number
  padding: number
  margin: number
  propHeight: number
  propWidth: number
  fontSize: number
  w: number
  h: number
  // ------------
  canvasHolder: HTMLCanvasElement
  measure: CanvasRenderingContext2D
  canvas: CanvasRenderingContext2D
  types: { [key: string]: TypeVisual } = {}
  // ------------
  schema: StrictSchema
  typesArray: TypeVisual[] = []
  rootElement: Element
  // ------------
  finder: any
  grid: any
  wTmp: number

  constructor(schema: Schema, element: Element) {
    this.scale = 25
    this.padding = 2
    this.margin = 8
    this.propHeight = 1
    this.propWidth = 5
    this.fontSize = this.propHeight * this.scale * 0.7
    this.rootElement = element

    this.schema = parse(schema).schema

    const canvasMeasure = document.createElement('canvas')
    canvasMeasure.height = 30
    canvasMeasure.width = 300
    this.measure = canvasMeasure.getContext('2d')
    this.measure.font = `${this.fontSize}px SF Pro Display`

    //  width / height
    this.changeDimensions(element.getBoundingClientRect().width, true)

    const resizeObserver = new ResizeObserver((entries) => {
      const w = element.getBoundingClientRect().width
      if (w !== this.wTmp) {
        this.changeDimensions(element.getBoundingClientRect().width, false)
        console.log('Size changed')
      }
    })

    resizeObserver.observe(element)

    // @ts-ignore
    this.finder = new PF.OrthogonalJumpPointFinder({
      allowDiagonal: false,
      // @ts-ignore
      heuristic: PF.Heuristic.euclidian,
    })
  }

  createCtx() {
    // add min height
    let canvash = 0 // window.innerHeight - this.scale * 2 - 20
    for (var n = 0; n < this.typesArray.length; n++) {
      const t = this.typesArray[n]
      const max = (t.fit.y + this.padding * 2 + t.h) * this.scale
      if (max > canvash) {
        canvash = max
      }
    }
    if (!this.canvas) {
      const canvas = document.createElement('canvas')
      canvas.height = canvash
      canvas.width = window.innerWidth - this.scale * 2 - 25
      canvas.style.margin = this.scale + 'px'
      this.canvasHolder = canvas
      this.canvas = canvas.getContext('2d')
      this.canvas.font = `${this.fontSize}px SF Pro Display`
      this.rootElement.appendChild(canvas)
    } else {
      //   this.canvas.clearRect(
      //     0,
      //     0,
      //     this.canvasHolder.width,
      //     this.canvasHolder.height,
      //   )
      this.canvas.reset()
      this.canvasHolder.height = canvash
      this.canvasHolder.width = window.innerWidth - this.scale * 2 - 25
    }
  }

  reset() {
    this.typesArray = []
    this.types = {}
  }

  changeDimensions(width: number, initial?: Boolean) {
    this.wTmp = width
    const windowW = width - this.scale * 2
    const w = Math.floor(windowW / this.scale)
    const MAX_AREA = 100
    const m = MAX_AREA / w
    const h = ~~(m * 200)
    // 20k items max
    this.w = w
    this.h = h

    if (!initial) {
      this.reset()
      // go remove canvas!
      positionTypes(this)
      render(this)
    }
  }

  textWidth(text: string, size?: number) {
    if (size) {
      this.measure.font = `${size}px SF Pro Display`
    }
    let m = Math.ceil(this.measure.measureText(text).width / this.scale)
    this.measure.font = `${this.fontSize}px SF Pro Display`
    return m
  }
}
