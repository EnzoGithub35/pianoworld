---
name: quality-check
description: Lance la gate qualité PianoWorld en local — typecheck, lint, tests Vitest (incl. snapshot RLS), build avec mesure du bundle. Stoppe à la première erreur et propose le fix le plus probable. Use this skill when the user asks "quality check", "vérif rapide", "tout est ok ?", "check qualité", "pre-commit check", or invokes /quality-check directly. Use BEFORE committing or pushing to confirm que lint/types/tests/build sont tous verts.
---

# Quality Check

Gate qualité rapide pour PianoWorld. Exécute en séquence les 4 vérifications obligatoires avant tout commit ou push. Stoppe net à la première erreur et propose un fix.

## When to use this skill

- L'utilisateur dit "quality check", "vérif rapide", "tout est ok ?", "check qualité"
- L'utilisateur est sur le point de commit/push et veut confirmer
- L'utilisateur invoque `/quality-check`
- Avant d'invoquer `/ship-it` (ship-it tourne déjà ces checks mais cumule le security audit — quality-check est plus rapide pour boucles d'itération)

## Steps

Exécute en séquence (PAS en parallèle — l'ordre importe car chaque étape couvre une couche différente, et stopper à la 1re erreur économise du temps).

### Étape 1 — TypeScript

```
npm run typecheck
```

Si échec : afficher l'erreur brute, stopper, ne pas lancer les étapes suivantes. Le user doit fixer les types avant.

### Étape 2 — ESLint

```
npm run lint
```

Si échec : afficher les erreurs avec `file:line`, stopper. Suggérer `npm run lint:fix` si les erreurs sont auto-fixables (formatage, ordre d'imports).

### Étape 3 — Tests Vitest

```
npm test
```

Si échec :

- Si c'est un snapshot RLS qui diffère (`security-snapshot.test.ts`), suggérer `npm test -- -u` **après** vérification visuelle du diff (cf. CLAUDE.md gotcha "Snapshot RLS").
- Pour les autres tests : afficher les 3 premiers tests failed avec leur erreur.
- Stopper, ne pas lancer le build.

### Étape 4 — Build + bundle

```
npm run build
```

Si échec : afficher l'erreur de build. Stopper.

Sinon, parser la sortie pour mesurer la taille gzip du chunk `index` (ligne du type `dist/assets/index-XXXX.js   25.41 kB │ gzip:  8.34 kB`). Le budget est **100 KB gzip** (gate CI, cf. `.github/workflows/ci.yml`). Si dépassement, signaler comme warning (pas un blocker).

## Output format

Sortie courte, en français, format checklist (les chiffres ci-dessous sont illustratifs) :

```
✅ TypeScript ok
✅ ESLint ok (0 warnings)
✅ Tests : X/Y passed
✅ Build : index 25.41 KB gzip (budget 100 KB)

→ Tout est vert, ready à commit.
```

Si une étape échoue :

```
✅ TypeScript ok
✅ ESLint ok
❌ Tests : 1 failed
   src/lib/__tests__/security-snapshot.test.ts > matches current RLS snapshot

   Snapshot mismatch — le schema.sql a changé.
   → Vérifier le diff visuellement, puis : npm test -- -u
   (cf. CLAUDE.md gotcha "Snapshot RLS")
```

## Conventions PianoWorld respectées

- **Branche solo** : ce skill ne push pas, ne commit pas. C'est une gate locale uniquement.
- **Snapshot RLS** : reconnaître ce cas et suggérer `-u` (cf. CLAUDE.md "Snapshot RLS").
- **Bundle budget** : 100 KB gzip pour `index` (gate CI).
- **--legacy-peer-deps** : non requis pour ces commandes (déjà configuré côté install).
- **Erreurs lisibles** : afficher les erreurs brutes Vitest/ESLint, pas de paraphrase qui perd l'info `file:line`.

## Fix patterns courants

| Erreur                                                   | Fix suggéré                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TS2304 `Cannot find name 'X'`                            | Import manquant — vérifier l'alias `@/`                                                    |
| TS2322 `Type 'string' is not assignable to type 'never'` | Probable `interface` au lieu de `type` dans `src/types/database.ts` (cf. CLAUDE.md gotcha) |
| ESLint `no-console`                                      | Remplacer par `logger.X` depuis `@/lib/logger`                                             |
| Vitest snapshot diff `security-snapshot`                 | Schéma modifié — vérifier le diff puis `npm test -- -u`                                    |
| Build error `Could not resolve "X"`                      | `npm install --legacy-peer-deps` puis retry                                                |
| Bundle > 100 KB gzip sur index                           | Vérifier nouveaux imports lourds, suggérer lazy via `React.lazy()`                         |

## Notes

- Pas de Workflow ici — exécution Bash séquentielle directe.
- Durée typique : ~20-40s sur PianoWorld.
- Si l'utilisateur veut le check complet incluant l'audit sécurité, suggérer `/ship-it`.
