/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import dayjs from 'dayjs'

export const nformat = (
  timeString: string,
  template: string = 'YYYY-MM-DD HH:mm:ss',
  invalidOut: string = '-',
): string => {
  if (!timeString) {
    return invalidOut
  }

  let d = dayjs(timeString)

  return d.isValid() ? d.format(template) : invalidOut
}
