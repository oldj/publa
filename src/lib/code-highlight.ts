import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

export const codeHighlightLanguages = {
  plaintext,
  javascript,
  typescript,
  xml,
  css,
  scss,
  json,
  bash,
  shell,
  markdown,
  yaml,
  diff,
  sql,
  python,
  go,
  rust,
  java,
}

export const codeHighlightAliases: Record<string, string[]> = {
  plaintext: ['text', 'plain'],
  javascript: ['js'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'svg'],
  shell: ['sh', 'zsh'],
  markdown: ['md'],
  yaml: ['yml'],
}
