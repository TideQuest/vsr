// Utility helpers for safe-ish SQL execution via LLM output

export function extractSql(text: string): string {
  // Pull SQL inside triple backticks if present, otherwise return the text
  const fence = text.match(/```(?:sql)?\n([\s\S]*?)```/i)
  const raw = (fence ? fence[1] : text).trim()
  return raw.replace(/;\s*$/g, '')
}

export function isSelectOnly(sql: string): boolean {
  const s = sql.trim().toLowerCase()
  // allow `with` CTE that leads to select
  return (
    s.startsWith('select') ||
    s.startsWith('with') && /\bselect\b/.test(s)
  ) && !/(insert|update|delete|drop|alter|truncate|create)\b/.test(s)
}

