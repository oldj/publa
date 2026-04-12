#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const CHINESE_RE = /[\u3400-\u9fff]/
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const UI_ATTRIBUTE_NAMES = new Set([
  'title',
  'label',
  'placeholder',
  'description',
  'aria-label',
  'alt',
  'content',
])
const UI_PROPERTY_NAMES = new Set([
  'title',
  'label',
  'placeholder',
  'description',
  'message',
  'confirmText',
  'cancelText',
  'content',
])

function toPosixRelative(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function isCodeFile(filePath) {
  if (!CODE_EXTENSIONS.has(path.extname(filePath))) return false
  if (filePath.endsWith('.d.ts')) return false
  if (filePath.includes('.test.') || filePath.includes('.spec.')) return false
  return true
}

function collectFiles(dirPath, predicate, result = []) {
  if (!fs.existsSync(dirPath)) return result

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, predicate, result)
      continue
    }

    if (predicate(fullPath)) {
      result.push(fullPath)
    }
  }

  return result
}

function createSourceFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  return ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text
  }

  return null
}

function getLiteralText(node) {
  if (ts.isStringLiteralLike(node)) {
    return node.text
  }

  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join('')
  }

  return null
}

function hasChinese(text) {
  return Boolean(text) && CHINESE_RE.test(text)
}

function buildFinding(sourceFile, node, reason) {
  const start = node.getStart(sourceFile)
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start)
  const snippet = sourceFile.text.slice(start, node.getEnd()).split('\n', 1)[0].trim()

  return {
    file: toPosixRelative(sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    reason,
    snippet,
  }
}

function findUiContext(node) {
  let current = node.parent

  while (current) {
    if (ts.isJsxAttribute(current)) {
      return {
        type: 'jsx-attribute',
        name: current.name.getText(),
      }
    }

    if (ts.isPropertyAssignment(current)) {
      return {
        type: 'object-property',
        name: getPropertyName(current.name),
      }
    }

    current = current.parent
  }

  return null
}

function analyzeUiFile(filePath) {
  const sourceFile = createSourceFile(filePath)
  const findings = []

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim()
      if (hasChinese(text)) {
        findings.push(buildFinding(sourceFile, node, '检测到 JSX 直接文案，请迁移到消息文件'))
      }
    }

    const literalText = getLiteralText(node)
    if (hasChinese(literalText)) {
      const context = findUiContext(node)

      if (context?.type === 'jsx-attribute' && UI_ATTRIBUTE_NAMES.has(context.name)) {
        findings.push(
          buildFinding(
            sourceFile,
            node,
            `检测到 JSX 属性 ${context.name} 使用了中文硬编码，请改为走 i18n`,
          ),
        )
      } else if (context?.type === 'object-property' && UI_PROPERTY_NAMES.has(context.name)) {
        findings.push(
          buildFinding(
            sourceFile,
            node,
            `检测到对象属性 ${context.name} 使用了中文硬编码，请改为走 i18n`,
          ),
        )
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

function isErrorConstructor(node) {
  if (!ts.isIdentifier(node.expression)) return false
  return ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'].includes(
    node.expression.text,
  )
}

function analyzeServerErrorFile(filePath) {
  const sourceFile = createSourceFile(filePath)
  const findings = []

  function visit(node) {
    if (ts.isThrowStatement(node) && node.expression) {
      if (ts.isNewExpression(node.expression) && isErrorConstructor(node.expression)) {
        const firstArg = node.expression.arguments?.[0]
        const literalText = firstArg ? getLiteralText(firstArg) : null
        if (hasChinese(literalText)) {
          findings.push(
            buildFinding(sourceFile, firstArg, '检测到中文异常文案，内部或底层异常应统一使用英文'),
          )
        }
      } else {
        const literalText = getLiteralText(node.expression)
        if (hasChinese(literalText)) {
          findings.push(
            buildFinding(
              sourceFile,
              node.expression,
              '检测到中文异常文案，内部或底层异常应统一使用英文',
            ),
          )
        }
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const name = getPropertyName(node.name)
      const literalText = getLiteralText(node.initializer)
      if (name === 'message' && hasChinese(literalText)) {
        findings.push(
          buildFinding(
            sourceFile,
            node.initializer,
            '检测到中文 message 文案，服务层失败结果不要直接拼中文自然语言',
          ),
        )
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const uiFiles = [
  ...collectFiles(path.join(process.cwd(), 'src/app'), (filePath) => {
    if (!isCodeFile(filePath)) return false
    if (filePath.includes(`${path.sep}api${path.sep}`)) return false
    if (path.basename(filePath).startsWith('route.')) return false
    return true
  }),
  ...collectFiles(path.join(process.cwd(), 'src/components'), isCodeFile),
]

const serverFiles = [
  ...collectFiles(path.join(process.cwd(), 'src/server'), (filePath) => {
    if (!isCodeFile(filePath)) return false
    if (filePath.endsWith(`${path.sep}seed.ts`)) return false
    return true
  }),
  ...collectFiles(path.join(process.cwd(), 'src/app/api'), isCodeFile),
]

const findings = [
  ...uiFiles.flatMap(analyzeUiFile),
  ...serverFiles.flatMap(analyzeServerErrorFile),
].sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  return a.line - b.line || a.column - b.column
})

if (findings.length > 0) {
  console.error('I18n runtime guard failed:')
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line}:${finding.column} ${finding.reason}\n  ${finding.snippet}`,
    )
  }
  process.exit(1)
}

console.log(
  `I18n runtime guard passed (${uiFiles.length} UI files, ${serverFiles.length} server files checked).`,
)
