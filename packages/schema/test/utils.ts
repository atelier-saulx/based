export const resultCollect = (arr: Array<any>) => {
  const returnArr: any = []
  for (let i = 0; i < arr.length; i++) {
    returnArr.push(
      arr[i].collected.map((v) => ({ path: v.path, value: v.value }))[0]
    )
  }
  return returnArr
}

export const errorCollect = (arr: Array<any>) => {
  const returnArr: any = []
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].errors) {
      returnArr.push(arr[i].errors)
    }
  }
  return returnArr
}
