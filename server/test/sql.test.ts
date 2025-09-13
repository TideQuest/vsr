import { describe, it, expect } from 'vitest'
import { extractSql, isSelectOnly } from '../src/utils/sql.js'

describe('sql utils', () => {
  it('extracts fenced sql', () => {
    const out = extractSql('```sql\nSELECT * FROM users;\n```')
    expect(out).toBe('SELECT * FROM users')
  })

  it('validates select only', () => {
    expect(isSelectOnly('SELECT 1')).toBe(true)
    expect(isSelectOnly('WITH a AS (SELECT 1) SELECT * FROM a')).toBe(true)
    expect(isSelectOnly('DELETE FROM users')).toBe(false)
  })
})

