declare module '*.css' {
  const resource: { [key: string]: string }
  export = resource
}

declare module '*.scss' {
  const resource: { [key: string]: string }
  export = resource
}

declare module '*.svg' {
  const content: any
  export = content
}

declare module 'markdown-it-imsize'
declare module 'markdown-it-mathjax'
