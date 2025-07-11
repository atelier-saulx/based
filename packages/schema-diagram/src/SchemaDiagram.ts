import { Schema, StrictSchema, parse } from '@based/schema'
import initPathFindingLib from './pfLib.js'
import { FilterOps, TypeVisual } from './types.js'
import { render } from './render.js'
import { positionTypes } from './positionTypes.js'
import { filterSchema } from './utils.js'
initPathFindingLib()

export class SchemaDiagram {
  scale: number
  padding: number
  margin: number
  propHeight: number
  propWidth: number
  fontSize: number
  w: number
  h: number
  noOverlap: boolean = true
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
  pixelScale: number
  // ------------
  filterInternal: FilterOps
  origSchema: StrictSchema
  // ------------
  backgroundGrid: boolean = true

  constructor(schema: Schema, element: Element) {
    this.scale = 25
    this.padding = 3
    this.margin = 8
    this.propHeight = 1
    this.propWidth = 5
    this.fontSize = this.propHeight * this.scale * 0.7
    this.rootElement = element

    this.pixelScale = 0.75
    this.origSchema = parse(schema).schema
    this.schema = this.origSchema

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

  createSchemaDiagram() {
    let canvash = 0
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
      canvas.width = Math.floor(this.wTmp / this.scale) * this.scale
      this.canvasHolder = canvas
      // canvas.style.transformOrigin = '0px 0px'
      // canvas.style.border = '1px solid blue'

      canvas.style.width = canvas.width * this.pixelScale + 'px'
      this.canvas = canvas.getContext('2d')
      this.canvas.font = `${this.fontSize}px SF Pro Display`
      this.rootElement.appendChild(canvas)
    } else {
      this.canvasHolder.height = canvash
      this.canvasHolder.width = Math.floor(this.wTmp / this.scale) * this.scale
      this.canvasHolder.style.width =
        this.canvasHolder.width * this.pixelScale + 'px'

      this.canvas.reset()
      this.canvas.font = `${this.fontSize}px SF Pro Display`
      this.canvas.strokeStyle = '#fff'
    }
  }

  changeDimensions(width: number, initial?: Boolean) {
    this.wTmp = width / this.pixelScale
    const windowW = width / this.pixelScale - this.scale * 2
    const w = Math.floor(windowW / this.scale)
    const MAX_AREA = 100
    const m = MAX_AREA / w
    const h = ~~(m * 200)
    // 20k items max
    this.w = w
    this.h = h

    if (!initial) {
      this.render()
    }
  }

  filter(filter: string) {
    filterSchema(this, { filter })
    this.render()
  }

  clearFilter() {
    this.schema = this.origSchema
    this.filterInternal = undefined
    this.render()
  }

  render() {
    this.typesArray = []
    this.types = {}
    positionTypes(this)
    render(this)
  }

  toggleGrid(val?: boolean) {
    if (val !== undefined) {
      this.backgroundGrid = val
      this.render()
    } else {
      this.backgroundGrid = !this.backgroundGrid
      this.render()
    }
  }

  downloadPng() {
    window.requestAnimationFrame(() => {
      const origGrid = this.backgroundGrid
      this.toggleGrid(false)
      var link = document.createElement('a')
      link.download = 'schema.png'
      link.href = this.canvasHolder.toDataURL()
      link.click()
      this.toggleGrid(origGrid)
    })
  }

  updateSchema(schema: Schema) {
    this.origSchema = parse(schema).schema
    this.schema = this.origSchema
    this.render()
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
