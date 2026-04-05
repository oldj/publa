/**
 * time
 * @author: oldj
 * @homepage: https://oldj.net
 */

import dayjs from 'dayjs'

export const nformat = (time_string: string, template: string = 'YYYY-MM-DD HH:mm:ss', invalid_out: string = '-'): string => {
  if (!time_string) {
    return invalid_out
  }

  let d = dayjs(time_string)

  return d.isValid() ? d.format(template) : invalid_out
}
