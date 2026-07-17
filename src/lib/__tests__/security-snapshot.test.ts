import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Snapshot test de toute la surface sécurité serveur définie dans
 * supabase/schema.sql.
 *
 * Objectif : empêcher qu'une policy RLS, un trigger, un grant ou une RPC
 * SECURITY DEFINER soient ajoutés/supprimés/modifiés SANS revue explicite.
 * Toute modif force un diff sur le fichier snapshot — le reviewer doit
 * justifier le changement dans la PR.
 *
 * Approche : parsing du SQL via regex (pas d'exécution DB nécessaire en CI).
 * Limitations :
 *  - Ne détecte pas les policies créées via le Supabase Dashboard manuellement
 *  - Ne valide pas la sémantique des USING/WITH CHECK, juste leur présence
 *  - Sensible aux drop + create successifs sur la même policy (on garde le DERNIER)
 *
 * Quand le snapshot diffère :
 *  1. Vérifier que c'est intentionnel
 *  2. Si oui : `npm test -- -u` pour mettre à jour
 *  3. Committer le snapshot avec le commit qui modifie le SQL
 */

const SCHEMA_PATH = path.join(__dirname, '../../../supabase/schema.sql')

type PolicyRecord = {
  table: string
  name: string
  operation: string
  using: string | null
  withCheck: string | null
}

type TriggerRecord = {
  table: string
  name: string
  timing: string
  events: string
  fn: string
}

type FunctionRecord = {
  name: string
  args: string
  returns: string
  language: string
  security: 'definer' | 'invoker'
  searchPath: string | null
}

type GrantRecord = {
  type: 'grant' | 'revoke'
  privileges: string
  object: string
  grantee: string
}

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function extractPolicies(sql: string): PolicyRecord[] {
  // create policy NAME on TABLE for OP [using (...)] [with check (...)]
  const re = /create\s+policy\s+(\w+)\s+on\s+([\w.]+)\s+for\s+(\w+)([\s\S]*?)(?=;)/gi
  const records = new Map<string, PolicyRecord>()
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const [, name, table, operation, rest] = m
    const usingMatch = rest.match(/using\s*\(([\s\S]*?)\)\s*(?:with check|$|;)/i)
    const checkMatch = rest.match(/with check\s*\(([\s\S]*?)\)\s*(?:$|;)/i)
    // Clé table+name : si recréée plus loin, la dernière gagne
    records.set(`${table}.${name}`, {
      table: table.replace(/^public\./, ''),
      name,
      operation: operation.toLowerCase(),
      using: usingMatch ? normalize(usingMatch[1]) : null,
      withCheck: checkMatch ? normalize(checkMatch[1]) : null
    })
  }
  // Retire les policies droppées sans recréation
  const dropRe = /drop\s+policy(?:\s+if\s+exists)?\s+(\w+)\s+on\s+([\w.]+)/gi
  let d: RegExpExecArray | null
  while ((d = dropRe.exec(sql)) !== null) {
    const [, name, table] = d
    const key = `${table}.${name}`
    // Si après ce drop il y a un create policy avec la même clé, on garde le record
    const sliceAfter = sql.slice(d.index + d[0].length)
    const recreated = new RegExp(
      `create\\s+policy\\s+${name}\\s+on\\s+${table.replace('.', '\\.')}`,
      'i'
    ).test(sliceAfter)
    if (!recreated) records.delete(key)
  }
  return Array.from(records.values()).sort((a, b) =>
    `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`)
  )
}

function extractTriggers(sql: string): TriggerRecord[] {
  // create trigger NAME [before|after] EVENTS on TABLE for each row execute function FN(...)
  const re =
    /create\s+trigger\s+(\w+)\s+(before|after|instead\s+of)\s+([\w\s,]+?)\s+on\s+([\w.]+)\s+for\s+each\s+row\s+execute\s+(?:function|procedure)\s+([\w.]+)/gi
  const records = new Map<string, TriggerRecord>()
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const [, name, timing, events, table, fn] = m
    records.set(`${table}.${name}`, {
      table: table.replace(/^public\./, ''),
      name,
      timing: normalize(timing).toLowerCase(),
      events: normalize(events).toLowerCase(),
      fn: fn.replace(/^public\./, '')
    })
  }
  return Array.from(records.values()).sort((a, b) =>
    `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`)
  )
}

function extractFunctions(sql: string): FunctionRecord[] {
  // create [or replace] function NAME(ARGS) returns RETURNS language LANG [security definer]
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\(([^)]*)\)\s*returns\s+([^\n]+?)\s*language\s+(\w+)([\s\S]*?)(?=\$\$)/gi
  const records = new Map<string, FunctionRecord>()
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const [, name, args, returns, language, modifiers] = m
    const definer = /security\s+definer/i.test(modifiers)
    const spMatch = modifiers.match(/set\s+search_path\s*=\s*([^\n;]+)/i)
    records.set(name, {
      name: name.replace(/^public\./, ''),
      args: normalize(args),
      returns: normalize(returns).replace(/;$/, ''),
      language: language.toLowerCase(),
      security: definer ? 'definer' : 'invoker',
      searchPath: spMatch ? normalize(spMatch[1]) : null
    })
  }
  return Array.from(records.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function extractGrants(sql: string): GrantRecord[] {
  // grant|revoke PRIV [(cols)] on OBJ to|from GRANTEE
  const re =
    /(grant|revoke)\s+(.+?)\s+on\s+(?:function\s+|table\s+)?([\w.()\s,]+?)\s+(?:to|from)\s+([\w,\s]+?)(?:;|$)/gim
  const records: GrantRecord[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    const [, op, privileges, object, grantee] = m
    records.push({
      type: op.toLowerCase() as 'grant' | 'revoke',
      privileges: normalize(privileges).toLowerCase(),
      object: normalize(object).replace(/^public\./, ''),
      grantee: normalize(grantee).toLowerCase()
    })
  }
  // Tri stable pour snapshot reproductible
  return records.sort((a, b) =>
    `${a.object}.${a.grantee}.${a.type}.${a.privileges}`.localeCompare(
      `${b.object}.${b.grantee}.${b.type}.${b.privileges}`
    )
  )
}

function extractRlsEnabled(sql: string): string[] {
  const re = /alter\s+table\s+([\w.]+)\s+enable\s+row\s+level\s+security/gi
  const tables = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) {
    tables.add(m[1].replace(/^public\./, ''))
  }
  return Array.from(tables).sort()
}

describe('Security surface snapshot', () => {
  const sql = readFileSync(SCHEMA_PATH, 'utf-8')

  it('RLS-enabled tables', () => {
    const tables = extractRlsEnabled(sql)
    expect(tables).toMatchSnapshot()
  })

  it('Policies RLS', () => {
    const policies = extractPolicies(sql)
    expect(policies).toMatchSnapshot()
  })

  it('Triggers', () => {
    const triggers = extractTriggers(sql)
    expect(triggers).toMatchSnapshot()
  })

  it('Functions SECURITY DEFINER (sécurité-sensibles)', () => {
    const fns = extractFunctions(sql).filter((f) => f.security === 'definer')
    expect(fns).toMatchSnapshot()
  })

  it('Grants & Revokes', () => {
    const grants = extractGrants(sql)
    expect(grants).toMatchSnapshot()
  })

  it('Garde-fous : tables sensibles ont RLS activée', () => {
    const tables = extractRlsEnabled(sql)
    const expectedRls = [
      'profiles',
      'pianos',
      'piano_updates',
      'piano_reports',
      'piano_visits',
      'piano_sessions',
      'events',
      'event_participants',
      'user_requests',
      'notification_preferences',
      'push_subscriptions',
      'notifications_outbox',
      'rate_limit_buckets',
      'audit_log'
    ]
    for (const t of expectedRls) {
      expect(tables, `Table ${t} doit avoir RLS activée`).toContain(t)
    }
  })

  it('Garde-fous : chaque RPC admin est SECURITY DEFINER', () => {
    const fns = extractFunctions(sql)
    const adminRpcs = [
      'set_user_role',
      'set_user_banned',
      'resolve_report',
      'force_delete_piano',
      'reply_to_request',
      'write_audit_log',
      'admin_list_users',
      'admin_kpis'
    ]
    for (const name of adminRpcs) {
      const fn = fns.find((f) => f.name === name)
      expect(fn, `RPC ${name} doit exister`).toBeTruthy()
      expect(fn?.security, `RPC ${name} doit être SECURITY DEFINER`).toBe('definer')
      expect(fn?.searchPath, `RPC ${name} doit fixer search_path`).toBeTruthy()
    }
  })
})
