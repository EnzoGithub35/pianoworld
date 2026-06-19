// @ts-nocheck — Edge Function Deno, types Deno/npm résolus à l'exécution
//
// Sprint 7 sécu (A.6.4 backlog) — Rate-limit signup par IP.
//
// Pattern :
//  1. Le frontend appelle CETTE fonction AVANT `supabase.auth.signUp`
//  2. On hash l'IP du caller (SHA-256 + SIGNUP_IP_HASH_SALT env)
//  3. On appelle la RPC `check_signup_ip_allowed(ip_hash)` qui count + insert
//     atomically via advisory lock
//  4. Si refusé (>= 5 tentatives en 24h) → 429
//  5. Si autorisé → 200 {allowed: true} → le frontend procède au auth.signUp
//
// L'attempt est compté AVANT le signup réel, donc un signup qui fail (email
// déjà pris, mot de passe faible) consomme tout de même 1 attempt. Compromis
// accepté : ça pénalise légèrement les humains qui se trompent (4 retries
// dispos sur 24h), mais empêche un bot de scanner indéfiniment des emails.
//
// Configurer dans Supabase > Edge Functions > Secrets :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injectés)
//   - SIGNUP_IP_HASH_SALT (openssl rand -base64 32)
//
// Déploiement : supabase functions deploy signup-protected

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SIGNUP_IP_HASH_SALT = Deno.env.get('SIGNUP_IP_HASH_SALT') ?? ''

if (!SIGNUP_IP_HASH_SALT) {
  console.warn(
    'signup-protected: SIGNUP_IP_HASH_SALT not set — hashes will be rainbow-tableable. Configure it.'
  )
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

/** Extrait la première IP du header x-forwarded-for (Vercel/proxy). */
function extractClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real.trim()
  // En local Supabase, pas de proxy → IP non identifiable, on hash 'local'
  return 'unknown'
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + SIGNUP_IP_HASH_SALT)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const ip = extractClientIp(req)
  const ipHash = await hashIp(ip)

  const { data, error } = await supabase.rpc('check_signup_ip_allowed', {
    p_ip_hash: ipHash
  })

  if (error) {
    console.error('signup-protected: RPC failed', error)
    // Fail-open : si la RPC plante, on laisse passer le signup plutôt que de
    // bloquer toute l'app. Le rate-limit côté DB Supabase Auth reste actif.
    return jsonResponse({ allowed: true, fallback: true })
  }

  if (data !== true) {
    return jsonResponse(
      {
        allowed: false,
        error: 'signup_ip_rate_limit',
        message:
          'Trop de tentatives depuis cette connexion. Réessaie dans quelques heures.'
      },
      429
    )
  }

  return jsonResponse({ allowed: true })
})
