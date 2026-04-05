/**
 * myCookie.ts
 */

export function cookieStringToObject(cookie_string: string): { [key: string]: string } {
  const cookie_obj: { [key: string]: string } = {}
  const cookie_array = cookie_string.split(';')
  for (let i = 0; i < cookie_array.length; i++) {
    const cookie = cookie_array[i].trim()
    const cookie_kv = cookie.split('=')
    cookie_obj[cookie_kv[0]] = cookie_kv[1]
  }
  return cookie_obj
}

export function cookieObjectToString(cookie_object: { [key: string]: string }): string {
  let cookie_string = ''
  for (const key in cookie_object) {
    if (Object.prototype.hasOwnProperty.call(cookie_object, key)) {
      cookie_string += `${key}=${cookie_object[key]}; `
    }
  }
  return cookie_string
}
