#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx'])

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

function isJsonResponseCall(node) {
  if (!ts.isCallExpression(node)) return false
  if (!ts.isPropertyAccessExpression(node.expression)) return false
  const receiver = node.expression.expression.getText()
  return (
    node.expression.name.text === 'json' && (receiver === 'NextResponse' || receiver === 'Response')
  )
}

function collectVariableInitializers(sourceFile) {
  const bindings = new Map()

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !bindings.has(node.name.text)
    ) {
      bindings.set(node.name.text, node.initializer)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return bindings
}

function expressionContainsMessageAccess(node, bindings, seen = new Set()) {
  if (!node) return false

  const key = `${node.pos}:${node.end}`
  if (seen.has(key)) return false
  seen.add(key)

  if (ts.isIdentifier(node)) {
    const initializer = bindings.get(node.text)
    if (initializer) {
      return expressionContainsMessageAccess(initializer, bindings, seen)
    }
    return false
  }

  if (ts.isPropertyAccessExpression(node) && node.name.text === 'message') {
    return true
  }

  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === 'message'
  ) {
    return true
  }

  let found = false
  ts.forEachChild(node, (child) => {
    if (!found && expressionContainsMessageAccess(child, bindings, seen)) {
      found = true
    }
  })
  return found
}

function resolveObjectLiteral(node, bindings, seen = new Set()) {
  if (!node) return null

  const key = `${node.pos}:${node.end}`
  if (seen.has(key)) return null
  seen.add(key)

  if (ts.isObjectLiteralExpression(node)) return node

  if (ts.isIdentifier(node)) {
    const initializer = bindings.get(node.text)
    if (!initializer) return null
    return resolveObjectLiteral(initializer, bindings, seen)
  }

  return null
}

function analyzeFile(filePath) {
  const sourceFile = createSourceFile(filePath)
  const bindings = collectVariableInitializers(sourceFile)
  const findings = []

  function visit(node) {
    if (isJsonResponseCall(node)) {
      const payload = resolveObjectLiteral(node.arguments[0], bindings)
      if (payload) {
        for (const property of payload.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          if (getPropertyName(property.name) !== 'message') continue
          if (expressionContainsMessageAccess(property.initializer, bindings)) {
            findings.push(
              buildFinding(
                sourceFile,
                property.initializer,
                '检测到 API 响应直接透传底层 message，请改为返回稳定 code/key 再由路由层翻译',
              ),
            )
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const files = [
  ...collectFiles(path.join(process.cwd(), 'src/app/api'), isCodeFile),
  ...collectFiles(path.join(process.cwd(), 'src/server/auth'), isCodeFile),
]

const findings = files.flatMap(analyzeFile).sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file)
  return a.line - b.line || a.column - b.column
})

if (findings.length > 0) {
  console.error('API message leak guard failed:')
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line}:${finding.column} ${finding.reason}\n  ${finding.snippet}`,
    )
  }
  process.exit(1)
}

console.log(`API message leak guard passed (${files.length} files checked).`)
