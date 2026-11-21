// 收集浏览器解析过的规则，保留 @import、媒体查询和 CSS 嵌套的原始层级。
function* rulesIn(rules: CSSRuleList): Generator<CSSRule> {
  for (const rule of rules) {
    yield rule
    if (rule instanceof CSSImportRule && rule.styleSheet) {
      yield* sheetRules(rule.styleSheet)
    } else if ('cssRules' in rule) {
      yield* rulesIn((rule as CSSGroupingRule).cssRules)
    }
  }
}

function* sheetRules(sheet: CSSStyleSheet): Generator<CSSRule> {
  try {
    yield* rulesIn(sheet.cssRules)
  } catch (error) {
    // 跨域导入仍由浏览器渲染，只有允许读取 CSSOM 的样式才能适配根字号和字体。
    if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error
  }
}

let fontSet = 0

function registerFonts(rules: CSSRule[], target: CSSStyleSheet) {
  const prefix = `publa-editor-${++fontSet}-`
  const aliases = new Map<string, string>()
  for (const rule of rules) {
    if (!(rule instanceof CSSFontFaceRule)) continue
    const family = rule.style
      .getPropertyValue('font-family')
      .replace(/^["']|["']$/g, '')
      .toLowerCase()
    const alias = aliases.get(family) ?? prefix + aliases.size
    aliases.set(family, alias)
    // Firefox 的字体描述符只读。先构造完整规则，再一次性注册专用字体。
    const base = rule.parentStyleSheet?.href ?? document.baseURI
    const src = rule.style
      .getPropertyValue('src')
      .replace(/url\("([^"]*)"\)/g, (match, url: string) => {
        const resolved = URL.parse(url, base)
        return resolved ? `url(${JSON.stringify(resolved.href)})` : match
      })
    let css = `@font-face { ${rule.style.cssText}; font-family: ${alias}; src: ${src}; }`
    // 同名字体可以按屏宽或浏览器能力切换；复制到主文档时保留这些条件。
    let parent = rule.parentRule ?? rule.parentStyleSheet?.ownerRule
    while (parent) {
      if (parent instanceof CSSMediaRule || parent instanceof CSSImportRule) {
        if (parent.media.mediaText) css = `@media ${parent.media.mediaText} { ${css} }`
      }
      if (parent instanceof CSSSupportsRule) css = `@supports ${parent.conditionText} { ${css} }`
      if (parent instanceof CSSImportRule && parent.supportsText) {
        css = `@supports (${parent.supportsText}) { ${css} }`
      }
      parent = parent.parentRule ?? parent.parentStyleSheet?.ownerRule
    }
    target.insertRule(css, target.cssRules.length)
  }
  return aliases
}

function replaceRem(text: string, unit: string) {
  return text.replace(
    /url\([^)]*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?<![\w.-])(-?(?:\d*\.\d+|\d+))rem\b/gi,
    (match, size?: string) => (size ? `calc(${size} * var(${unit}, 1rem))` : match),
  )
}

function adaptFonts(styles: CSSStyleDeclaration[], aliases: Map<string, string>) {
  if (!aliases.size) return
  const declarations = new Map<string, CSSStyleDeclaration[]>()
  for (const style of styles) {
    for (const name of style) {
      if (!name.startsWith('--')) continue
      const definitions = declarations.get(name) ?? []
      definitions.push(style)
      declarations.set(name, definitions)
    }
  }

  const variables = new Set<string>()
  const fontVariable = (name: string) => '--publa-editor-' + fontSet + name
  const parser = document.createElement('span').style
  const renameFamilies = (value: string) =>
    value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^"'(),]+/g, (part) => {
      const key = part
        .trim()
        .replace(/^["']|["']$/g, '')
        .toLowerCase()
      return aliases.get(key) ?? part
    })
  const fontValue = (value: string) => {
    // 只在字体上下文中读取专用变量。主题的条件规则未生效时，仍可读取行内或继承的原值。
    const closing: string[] = []
    const referenced = value.replace(
      /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\bvar\(\s*(--[\w-]+)|[()]/gi,
      (part, name?: string) => {
        if (name && declarations.has(name) && !name.startsWith('--publa-editor-')) {
          variables.add(name)
          closing.push('))')
          return 'var(' + fontVariable(name) + ', ' + part
        }
        if (name || part === '(') closing.push(')')
        if (part === ')') return closing.pop() ?? part
        return part
      },
    )
    // 变量可以保存整个 font 简写。交给浏览器拆出字体族，避免把字重或字号当成字体名。
    parser.cssText = ''
    parser.font = referenced
    if (parser.fontFamily) {
      const families = renameFamilies(parser.fontFamily)
      if (families === parser.fontFamily) return referenced
      parser.fontFamily = families
      return parser.font
    }
    return renameFamilies(referenced)
  }
  for (const style of styles) {
    const name = style.font ? 'font' : 'font-family'
    const value = style.getPropertyValue(name)
    if (!value) continue
    const renamed = fontValue(value)
    if (renamed !== value) style.setProperty(name, renamed, style.getPropertyPriority(name))
  }
  // 包括嵌套 var() 引入的变量；在原规则上写入副本，继承、媒体条件与优先级随原定义生效。
  for (const name of variables) {
    for (const style of declarations.get(name)!) {
      const value = fontValue(style.getPropertyValue(name))
      style.setProperty(fontVariable(name), value, style.getPropertyPriority(name))
    }
  }
}

export function adaptEditorTheme(sheets: CSSStyleSheet[], fonts: CSSStyleSheet) {
  const rules = sheets.flatMap((sheet) => Array.from(sheetRules(sheet)))
  const aliases = registerFonts(rules, fonts)
  const styleRules = rules.filter((rule) => rule instanceof CSSStyleRule)
  for (const rule of styleRules) {
    // Shadow DOM 没有自己的 :root，让它匹配编辑区的 html。
    if (rule.selectorText.includes(':root')) {
      rule.selectorText = rule.selectorText.replace(/"[^"]*"|'[^']*'|:root\b/g, (part) =>
        part === ':root' ? '[data-editor-document]' : part,
      )
    }
    const style = rule.style
    const original = style.cssText
    const adjusted = replaceRem(original, '--publa-editor-rem')
    if (adjusted !== original) {
      // 带 var() 的简写在 CSSOM 中可能只有简写值，枚举长属性会漏掉字号和间距。
      const property = style.font ? 'font' : 'font-size'
      const font = style.getPropertyValue(property)
      const priority = style.getPropertyPriority(property)
      style.cssText = adjusted
      const adjustedFont = replaceRem(font, '--publa-editor-font-rem')
      if (adjustedFont !== font) style.setProperty(property, adjustedFont, priority)
    }
  }
  adaptFonts(
    styleRules.map((rule) => rule.style),
    aliases,
  )
}
