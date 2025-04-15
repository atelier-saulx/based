// Assume drawSegment function from the previous answer is defined here:
type LineSegment = 'h' | 'v' | 'lt' | 'rt' | 'rb' | 'lb' | 'e'

const drawSegment = (
  type: LineSegment,
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
  SCALE: number,
  grid,
) => {
  const cellX = x * SCALE
  const cellY = y * SCALE
  const halfScale = SCALE / 2

  ctx.beginPath()

  switch (type) {
    case 'h':
      ctx.moveTo(cellX, cellY + halfScale)
      ctx.lineTo(cellX + SCALE, cellY + halfScale)
      break
    case 'v':
      ctx.moveTo(cellX + halfScale, cellY)
      ctx.lineTo(cellX + halfScale, cellY + SCALE)
      //   grid.setWalkableAt(x, y, false)
      break
    case 'rb': // Connects mid-left and mid-top
      ctx.arc(cellX + SCALE, cellY + SCALE, halfScale, Math.PI, 1.5 * Math.PI) // Center bottom-right
      break
    case 'lb': // Connects mid-top and mid-right
      ctx.arc(cellX, cellY + SCALE, halfScale, 1.5 * Math.PI, 2 * Math.PI) // Center bottom-left
      break
    case 'lt': // Connects mid-right and mid-bottom
      ctx.arc(cellX, cellY, halfScale, 0, 0.5 * Math.PI) // Center top-left
      break
    case 'rt': // Connects mid-bottom and mid-left
      ctx.arc(cellX + SCALE, cellY, halfScale, 0.5 * Math.PI, Math.PI) // Center top-right
      break
    case 'e':
      ctx.arc(
        cellX + SCALE * 0.5,
        cellY + SCALE * 0.5,
        halfScale * 0.5,
        0,
        Math.PI * 2,
      ) // Center top-right
      break
  }

  ctx.stroke()
}

const isEqual = (a: Int8Array, b: Int8Array) => {
  if (a[0] !== b[0]) {
    return false
  } else if (a[1] !== b[1]) {
    return false
  } else if (a[2] !== b[2]) {
    return false
  } else if (a[3] !== b[3]) {
    return false
  }
  return true
}

// const colors = [
//   `rgb(57,237,78)`,
//   `rgb(52,228,197)`,
//   `rgb(66,59,164)`,
//   `rgb(153,204,176)`,
//   `rgb(31,197,254)`,
//   `rgb(131,172,180)`,
//   `rgb(214,20,6)`,
//   `rgb(49,194,228)`,
//   `rgb(129,230,168)`,
//   `rgb(243,45,137)`,
//   `rgb(89,113,175)`,
//   `rgb(13,159,147)`,
//   `rgb(171,133,212)`,
// ]

const drawPath = (
  pathFull: any,
  ctx: CanvasRenderingContext2D,
  SCALE: number,
  grid,
) => {
  //   const randomColor = colors[~~(Math.random() * colors.length)]

  const randomColor =
    pathFull.b.name === '__self'
      ? '#ccc'
      : `rgb(${~~(Math.random() * 255)},${~~(Math.random() * 255)},${~~(Math.random() * 255)})`
  ctx.strokeStyle = randomColor
  ctx.lineWidth = Math.max(1, Math.min(5, SCALE / 4))

  const path = pathFull.path
  const startLeft = pathFull.startLeft
  const endLeft = pathFull.endLeft

  for (let i = 0; i < path.length; i++) {
    const currentPoint = path[i]
    const prevPoint = path[i - 1] || [
      currentPoint[0] + (startLeft ? 1 : -1),
      currentPoint[1],
    ]
    const nextPoint = path[i + 1] || [
      currentPoint[0] + (endLeft ? -1 : 0),
      currentPoint[1],
    ]

    const vec = new Int8Array([
      currentPoint[0] - prevPoint[0],
      currentPoint[1] - prevPoint[1],
      nextPoint[0] - currentPoint[0],
      nextPoint[1] - currentPoint[1],
    ])

    let segmentType: LineSegment | null = null

    if (currentPoint[2]) {
      segmentType = currentPoint[2]
    } else if (isEqual(vec, new Int8Array([1, 0, 0, -1]))) {
      segmentType = 'lt'
    } else if (isEqual(vec, new Int8Array([0, -1, 1, 0]))) {
      segmentType = 'rb'
    } else if (isEqual(vec, new Int8Array([0, 1, 0, 0]))) {
      segmentType = 'lt'
    } else if (isEqual(vec, new Int8Array([1, 0, 1, 0]))) {
      segmentType = 'h'
    } else if (isEqual(vec, new Int8Array([0, -1, 0, -1]))) {
      segmentType = 'v'
    } else if (isEqual(vec, new Int8Array([1, 0, 0, 1]))) {
      segmentType = 'lb'
    } else if (isEqual(vec, new Int8Array([0, 1, 0, 1]))) {
      segmentType = 'v'
    } else if (isEqual(vec, new Int8Array([0, 1, 1, 0]))) {
      segmentType = 'rt'
    } else if (isEqual(vec, new Int8Array([1, 0, 0, 0]))) {
      segmentType = 'h'
    } else if (isEqual(vec, new Int8Array([-1, 0, 0, 1]))) {
      segmentType = 'rb'
    } else if (isEqual(vec, new Int8Array([-1, 0, -1, 0]))) {
      segmentType = 'h'
    } else if (isEqual(vec, new Int8Array([-0, 1, -1, 0]))) {
      if (!path[i + 1] && endLeft) {
        console.log('BUG', endLeft)
        segmentType = 'rt'
      } else {
        segmentType = 'lt'
      }
    } else if (isEqual(vec, new Int8Array([-1, 0, 0, 0]))) {
      segmentType = 'h'
    } else if (isEqual(vec, new Int8Array([-1, 0, 0, -1]))) {
      segmentType = 'rt'
    } else if (isEqual(vec, new Int8Array([0, -1, 0, 0]))) {
      segmentType = 'rb'
    } else if (isEqual(vec, new Int8Array([0, -1, -1, 0]))) {
      segmentType = 'lb'
    } else if (isEqual(vec, new Int8Array([1, 0, -1, 0]))) {
      segmentType = 'h'
    } else if (isEqual(vec, new Int8Array([0, -1, 0, 1]))) {
      segmentType = 'rb'
    } else {
      segmentType = 'e'

      console.log(vec)
    }

    drawSegment(segmentType, currentPoint[0], currentPoint[1], ctx, SCALE, grid)
  }
}

export default drawPath
