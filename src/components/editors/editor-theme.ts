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

export function adaptEditorTheme(sheets: CSSStyleSheet[], fonts: CSSStyleSheet) {
  const rules = sheets.flatMap((sheet) => Array.from(sheetRules(sheet)))
  const aliases = registerFonts(rules, fonts)
  for (const rule of rules) {
    if (!(rule instanceof CSSStyleRule)) continue
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

    if (!aliases.size) continue
    for (const name of ['font', ...Array.from(style)]) {
      if (name !== 'font-family' && name !== 'font' && !name.startsWith('--')) continue
      const value = style.getPropertyValue(name)
      // 引号中的逗号属于字体名；括号内还可能有 var() 的回退字体。
      const renamed = value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^"'(),]+/g, (part) => {
        const key = part
          .trim()
          .replace(/^["']|["']$/g, '')
          .toLowerCase()
        return aliases.get(key) ?? part
      })
      if (renamed !== value) style.setProperty(name, renamed, style.getPropertyPriority(name))
    }
  }
}
