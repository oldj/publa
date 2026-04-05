#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const migrationTagPattern = /^(\d{4})_(.+)$/
const migrationFilePattern = /^(\d{4})_(.+)\.sql$/
const snapshotFilePattern = /^(\d{4})_snapshot\.json$/

const targets = [
  { name: 'sqlite', dir: 'drizzle/sqlite' },
  { name: 'postgres', dir: 'drizzle/postgres' },
]

function toPosixRelative(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/')
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to parse JSON: ${toPosixRelative(filePath)} (${message})`)
  }
}

function getSortedFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b))
}

function validateTarget(target) {
  const errors = []
  const baseDir = path.join(process.cwd(), target.dir)
  const metaDir = path.join(baseDir, 'meta')
  const journalPath = path.join(metaDir, '_journal.json')

  if (!fs.existsSync(baseDir)) {
    errors.push(`Missing directory: ${toPosixRelative(baseDir)}`)
    return { errors, migrationCount: 0 }
  }

  if (!fs.existsSync(journalPath)) {
    errors.push(`Missing journal file: ${toPosixRelative(journalPath)}`)
    return { errors, migrationCount: 0 }
  }

  let journal
  try {
    journal = readJson(journalPath)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
    return { errors, migrationCount: 0 }
  }

  const entries = Array.isArray(journal.entries) ? journal.entries : null
  if (!entries) {
    errors.push(`Invalid journal format: ${toPosixRelative(journalPath)} missing entries array`)
    return { errors, migrationCount: 0 }
  }

  const sqlFiles = getSortedFiles(baseDir).filter((fileName) => migrationFilePattern.test(fileName))
  const snapshotFiles = getSortedFiles(metaDir).filter((fileName) => snapshotFilePattern.test(fileName))

  const journalTags = new Set()
  const journalPrefixes = []
  const sqlTagSet = new Set()
  const sqlPrefixMap = new Map()
  const snapshotPrefixSet = new Set()
  const snapshotCache = new Map()

  for (const sqlFile of sqlFiles) {
    const matched = sqlFile.match(migrationFilePattern)
    if (!matched) continue

    const prefix = matched[1]
    const tag = sqlFile.slice(0, -4)

    if (sqlPrefixMap.has(prefix)) {
      errors.push(
        `Duplicate migration prefix ${prefix} in ${target.name}: ${sqlPrefixMap.get(prefix)} and ${sqlFile}`,
      )
    } else {
      sqlPrefixMap.set(prefix, sqlFile)
    }

    sqlTagSet.add(tag)
  }

  for (const snapshotFile of snapshotFiles) {
    const matched = snapshotFile.match(snapshotFilePattern)
    if (!matched) continue
    snapshotPrefixSet.add(matched[1])
  }

  let previousWhen = -Infinity
  let previousPrefix = null
  let previousPrefixNumber = null
  let previousSnapshotId = null

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]

    if (entry.idx !== index) {
      errors.push(
        `Journal idx mismatch in ${target.name}: entry ${entry.tag ?? '<unknown>'} has idx ${entry.idx}, expected ${index}`,
      )
    }

    if (typeof entry.tag !== 'string') {
      errors.push(`Invalid journal tag at ${target.name} index ${index}`)
      continue
    }

    const tagMatch = entry.tag.match(migrationTagPattern)
    if (!tagMatch) {
      errors.push(`Invalid journal tag format in ${target.name}: ${entry.tag}`)
      continue
    }

    const prefix = tagMatch[1]
    const prefixNumber = Number(prefix)
    journalPrefixes.push(prefix)

    if (journalTags.has(entry.tag)) {
      errors.push(`Duplicate journal tag in ${target.name}: ${entry.tag}`)
    } else {
      journalTags.add(entry.tag)
    }

    if (previousPrefix !== null && prefix <= previousPrefix) {
      errors.push(
        `Migration prefix is not append-only in ${target.name}: ${entry.tag} appears after ${previousPrefix}`,
      )
    }
    previousPrefix = prefix

    if (typeof entry.when !== 'number' || Number.isNaN(entry.when)) {
      errors.push(`Invalid journal when in ${target.name}: ${entry.tag}`)
    } else if (entry.when <= previousWhen) {
      errors.push(
        `Journal when is not strictly increasing in ${target.name}: ${entry.tag} (${entry.when})`,
      )
    } else {
      previousWhen = entry.when
    }

    if (!sqlTagSet.has(entry.tag)) {
      errors.push(`Missing migration SQL file in ${target.name}: ${entry.tag}.sql`)
    }

    const snapshotFile = `${prefix}_snapshot.json`
    const snapshotPath = path.join(metaDir, snapshotFile)
    if (!snapshotPrefixSet.has(prefix) || !fs.existsSync(snapshotPath)) {
      errors.push(`Missing snapshot file in ${target.name}: ${snapshotFile}`)
      continue
    }

    let snapshot = snapshotCache.get(prefix)
    if (!snapshot) {
      try {
        snapshot = readJson(snapshotPath)
        snapshotCache.set(prefix, snapshot)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
        continue
      }
    }

    if (typeof snapshot.id !== 'string' || snapshot.id.length === 0) {
      errors.push(`Snapshot id is missing in ${target.name}: ${snapshotFile}`)
    }

    if (
      previousSnapshotId !== null
      && previousPrefixNumber !== null
      && prefixNumber === previousPrefixNumber + 1
      && snapshot.prevId !== previousSnapshotId
    ) {
      errors.push(
        `Snapshot chain is broken in ${target.name}: ${snapshotFile} prevId ${snapshot.prevId} does not match previous snapshot id ${previousSnapshotId}`,
      )
    }

    if (typeof snapshot.id === 'string' && snapshot.id.length > 0) {
      previousSnapshotId = snapshot.id
    }

    previousPrefixNumber = prefixNumber
  }

  for (const sqlFile of sqlFiles) {
    const tag = sqlFile.slice(0, -4)
    if (!journalTags.has(tag)) {
      errors.push(`SQL file is not tracked by journal in ${target.name}: ${sqlFile}`)
    }
  }

  const journalPrefixSet = new Set(journalPrefixes)
  for (const snapshotFile of snapshotFiles) {
    const matched = snapshotFile.match(snapshotFilePattern)
    if (!matched) continue

    const prefix = matched[1]
    if (!journalPrefixSet.has(prefix)) {
      errors.push(`Snapshot file is not tracked by journal in ${target.name}: ${snapshotFile}`)
    }
  }

  return { errors, migrationCount: entries.length }
}

const results = targets.map(validateTarget)
const allErrors = results.flatMap((result, index) =>
  result.errors.map((message) => `[${targets[index].name}] ${message}`))

if (allErrors.length > 0) {
  console.error('Migration chain check failed:')
  for (const message of allErrors) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

const summary = results
  .map((result, index) => `${targets[index].name}: ${result.migrationCount}`)
  .join(', ')

console.log(`Migration chain check passed. ${summary}`)
