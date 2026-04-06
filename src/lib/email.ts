/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

export const isEmail = (str: string): boolean => {
  return /^\w+((.\w+)|(-\w+))@[A-Za-z0-9]+((.|-)[A-Za-z0-9]+).[A-Za-z0-9]+$/.test(str)
}
