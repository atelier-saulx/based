export const resultCollect = (arr: Array<any>) => {
  const returnArr: any = []
  for (let i = 0; i < arr.length; i++) {
    returnArr.push({
      path: arr[i].target.collected[0].path,
      value: arr[i].target.collected[0].value.value,
    })
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
