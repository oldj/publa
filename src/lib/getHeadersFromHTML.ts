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
  let lastRawLevel = 0
  let normalLevel = 1
  let number = '1'

  html = html.replace(/<h([1-6])([^>]*)>(.+?)<\/h[1-6]>/g, (match, level, attrs, title) => {
    let rawLevel = parseInt(level)
    let rawTitle = title.replace(/<[^>]*>/g, '')
    rawTitle = rawTitle.replace(/^\s*\d+[\s.、]/g, '')
    rawTitle = rawTitle.replace(/^\s+|\s+$/g, '')

    if (idx > 0) {
      if (rawLevel > lastRawLevel) {
        normalLevel += 1
        number = number + '.1'
      } else if (rawLevel < lastRawLevel) {
        normalLevel -= 1
        number = numberInc(number.substr(0, number.lastIndexOf('.')))
      } else {
        number = numberInc(number)
      }
    }
    if (normalLevel < 1) {
      normalLevel = 1
    } else if (normalLevel > 6) {
      normalLevel = 6
    }

    lastRawLevel = rawLevel

    headers.push({
      level: normalLevel,
      title: rawTitle,
      number,
    })

    attrs = attrs.replace(/data-toc-id=".*?"/gi, '')

    idx++

    return `<h${level} data-toc-id="${number}"${attrs}><a id="${
      number || idx
    }-${rawTitle}"></a>${title}</h${level}>`
  })

  return { html, headers }
}
