/**
 */

export function cookieStringToObject(cookieString: string): { [key: string]: string } {
  const cookieObj: { [key: string]: string } = {}
  const cookieArray = cookieString.split(';')
  for (let i = 0; i < cookieArray.length; i++) {
    const cookie = cookieArray[i].trim()
    const cookieKv = cookie.split('=')
    cookieObj[cookieKv[0]] = cookieKv[1]
  }
  return cookieObj
}

export function cookieObjectToString(cookieObject: { [key: string]: string }): string {
  let cookieString = ''
  for (const key in cookieObject) {
    if (Object.prototype.hasOwnProperty.call(cookieObject, key)) {
      cookieString += `${key}=${cookieObject[key]}; `
    }
  }
  return cookieString
}
