<!-- Titre de la PR : <type>(<scope>): <résumé impératif> -->
<!-- Exemple : feat(notif): retry exponential backoff on outbox -->

## Quoi

Brève description du changement (1-3 lignes).

## Pourquoi

Le besoin / le bug / le contexte. Linker l'issue si pertinent (`Closes #X`).

## Comment tester

Étapes concrètes :

- [ ] `npm run dev` → naviguer vers …
- [ ] Cas nominal : …
- [ ] Cas d'erreur : …
- [ ] (Si DB) Re-exécuter `supabase/schema.sql` au préalable

## Checklist avant merge

- [ ] `npm test` passe en local
- [ ] `npm run lint` sans erreurs
- [ ] `npm run build` OK (index < 100 KB gzip)
- [ ] Si SQL touché : snapshot RLS mis à jour si nécessaire (`npm test -- -u`)
- [ ] Si secret/env var ajouté : `.env.example` à jour + Vercel/Supabase configurés
- [ ] Si breaking change : `BREAKING CHANGE:` dans le commit + noté ci-dessous
- [ ] Preview Vercel testé sur mobile (golden path)

## Breaking changes / Migration

_Aucun_ ou détailler.

## Screenshots / GIF (si UI)

_Optionnel mais aide à se relire dans 6 mois._
