/**
 */

export interface IHeader {
  level: number
  title: string
  number: string
}

const numberInc = (number: string): string => {
  let a = number.split('.')
  let b = a[a.length - 1]
  let c = Number(b) + 1
  a[a.length - 1] = String(c)
  return a.join('.')
}

export default (html: string): { html: string; headers: IHeader[] } => {
  let headers: IHeader[] = []
  let idx = 0
  let last_raw_level = 0
  let normal_level = 1
  let number = '1'

  html = html.replace(/<h([1-6])(.*)>(.+)<\/h[1-6]>/g, (match, level, attrs, title) => {
    let raw_level = parseInt(level)
    let raw_title = title.replace(/<[^>]*>/g, '')
    raw_title = raw_title.replace(/^\s*\d+[\s.、]/g, '')
    raw_title = raw_title.replace(/^\s+|\s+$/g, '')

    if (idx > 0) {
      if (raw_level > last_raw_level) {
        normal_level += 1
        number = number + '.1'
      } else if (raw_level < last_raw_level) {
        normal_level -= 1
        number = numberInc(number.substr(0, number.lastIndexOf('.')))
      } else {
        number = numberInc(number)
      }
    }
    if (normal_level < 1) {
      normal_level = 1
    } else if (normal_level > 6) {
      normal_level = 6
    }

    last_raw_level = raw_level

    headers.push({
      level: normal_level,
      title: raw_title,
      number,
    })

    attrs = attrs.replace(/data-toc-id=".*?"/gi, '')

    idx++

    return `<h${level} data-toc-id="${number}"${attrs}><a id="${
      number || idx
    }-${raw_title}"></a>${title}</h${level}>`
  })

  return { html, headers }
}
