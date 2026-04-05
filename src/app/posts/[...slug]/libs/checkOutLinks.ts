export default function checkOutLinks(el: HTMLDivElement) {
  const { hostname } = window.location
  const links = el.getElementsByTagName('a')
  Array.from(links).map((link) => {
    const href = link.getAttribute('href')
    if (!href) return
    if (href.match(/^https?:/i) && !href.includes(hostname)) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  })
}
