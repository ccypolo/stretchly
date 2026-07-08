import 'chai/register-should'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import loadExternalIdeas from '../app/utils/externalIdeasLoader'

describe('externalIdeasLoader', function () {
  const testDir = join(tmpdir(), 'stretchly-test-external-ideas')

  function ensureTestDir () {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true })
    }
  }

  function cleanupTestDir () {
    rmSync(testDir, { recursive: true, force: true })
  }

  it('returns null when file path is empty', () => {
    const result = loadExternalIdeas('', 'miniBreak')
    should.not.exist(result)
  })

  it('returns null when file does not exist', () => {
    const result = loadExternalIdeas(join(testDir, 'nonexistent.json'), 'miniBreak')
    should.not.exist(result)
  })

  it('loads valid miniBreak ideas from file', () => {
    ensureTestDir()
    const filePath = join(testDir, 'valid-mini-ideas.json')
    const ideas = [
      { data: 'Idea 1', enabled: true },
      { data: 'Idea 2', enabled: false }
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'miniBreak')
    result.should.be.deep.equal(ideas)
    cleanupTestDir()
  })

  it('returns null when file content is not an array', () => {
    ensureTestDir()
    const filePath = join(testDir, 'not-array.json')
    writeFileSync(filePath, JSON.stringify({ data: 'not array' }))
    const result = loadExternalIdeas(filePath, 'longBreak')
    should.not.exist(result)
    cleanupTestDir()
  })

  it('returns null when file content is invalid JSON', () => {
    ensureTestDir()
    const filePath = join(testDir, 'invalid.json')
    writeFileSync(filePath, 'not valid json {{{')
    const result = loadExternalIdeas(filePath, 'miniBreak')
    should.not.exist(result)
    cleanupTestDir()
  })

  it('loads longBreak ideas with title+text format', () => {
    ensureTestDir()
    const filePath = join(testDir, 'long-break-ideas.json')
    const ideas = [
      { data: ['Title 1', 'Text 1'], enabled: true },
      { data: ['Title 2', 'Text 2'], enabled: false }
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'longBreak')
    result.should.be.deep.equal(ideas)
    cleanupTestDir()
  })

  it('filters out invalid miniBreak items (wrong data type)', () => {
    ensureTestDir()
    const filePath = join(testDir, 'mixed-mini-ideas.json')
    const ideas = [
      { data: 'Valid idea', enabled: true },
      { data: ['Title', 'Text'], enabled: true },
      { data: 123, enabled: true },
      'just a string'
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'miniBreak')
    result.should.have.length(1)
    result[0].data.should.equal('Valid idea')
    cleanupTestDir()
  })

  it('filters out invalid longBreak items (wrong data type)', () => {
    ensureTestDir()
    const filePath = join(testDir, 'mixed-long-ideas.json')
    const ideas = [
      { data: ['Title', 'Text'], enabled: true },
      { data: 'Just a string', enabled: true },
      { data: ['Only one item'], enabled: true },
      { data: [], enabled: true }
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'longBreak')
    result.should.have.length(1)
    result[0].data.should.deep.equal(['Title', 'Text'])
    cleanupTestDir()
  })

  it('returns null when all miniBreak items are invalid', () => {
    ensureTestDir()
    const filePath = join(testDir, 'all-invalid-mini.json')
    const ideas = [
      { data: ['Title', 'Text'], enabled: true },
      { data: 123, enabled: true },
      'just a string'
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'miniBreak')
    should.not.exist(result)
    cleanupTestDir()
  })

  it('returns null when all longBreak items are invalid', () => {
    ensureTestDir()
    const filePath = join(testDir, 'all-invalid-long.json')
    const ideas = [
      { data: 'Just a string', enabled: true },
      { data: ['Only one'], enabled: true }
    ]
    writeFileSync(filePath, JSON.stringify(ideas))
    const result = loadExternalIdeas(filePath, 'longBreak')
    should.not.exist(result)
    cleanupTestDir()
  })

  it('passes log object for logging', () => {
    ensureTestDir()
    const logMessages = []
    const mockLog = {
      info: (msg) => logMessages.push({ level: 'info', msg }),
      warn: (msg) => logMessages.push({ level: 'warn', msg })
    }
    const filePath = join(testDir, 'with-log.json')
    writeFileSync(filePath, JSON.stringify([{ data: 'test', enabled: true }]))
    loadExternalIdeas(filePath, 'miniBreak', mockLog)
    logMessages.should.have.length(1)
    logMessages[0].level.should.equal('info')
    cleanupTestDir()
  })
})
