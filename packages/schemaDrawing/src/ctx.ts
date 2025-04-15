import { Schema, StrictSchema, parse } from '@based/schema'
import initPathFindingLib from './pfLib.js'
import { TypeVisual } from './types.js'
initPathFindingLib()

type Canvas = CanvasRenderingContext2D

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
  measure: Canvas
  canvas: Canvas
  types: { [key: string]: TypeVisual } = {}
  // ------------
  schema: StrictSchema
  typesArray: TypeVisual[] = []
  rootElement: Element
  // ------------
  finder: any
  grid: any

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

    const windowW = window.innerWidth - this.scale * 2
    const globalW = Math.floor(windowW / this.scale)
    const MAX_AREA = 100
    const m = MAX_AREA / globalW
    const globalH = ~~(m * 200)

    this.w = globalW
    this.h = globalH

    // @ts-ignore
    this.finder = new PF.OrthogonalJumpPointFinder({
      allowDiagonal: false,
      // @ts-ignore
      heuristic: PF.Heuristic.euclidian,
    })
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
