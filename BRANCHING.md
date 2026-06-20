# Stratégie de branche — PianoWorld (solo)

Modèle : **GitHub Flow** simple + Conventional Commits + branche unique de production.
Pourquoi : minimum d'overhead pour un dev solo, mais discipline pro : chaque change passe par une PR, CI verte obligatoire, history linéaire.

---

## Branches

| Nom             | Rôle                            | Protection                  | Déploiement Vercel                      |
| --------------- | ------------------------------- | --------------------------- | --------------------------------------- |
| `main`          | Production, toujours déployable | ✅ activée (cf. ci-dessous) | **Auto-deploy prod** sur push           |
| `<type>/<slug>` | Travail en cours                | ❌                          | **Preview deploy** automatique sur push |

Pas de `develop`. Pas de `release`. Pas de `hotfix`. Tout passe par `main` via PR.

### Convention de nommage des branches

`<type>/<short-slug>` — kebab-case, ≤ 50 caractères.

| Type        | Quand l'utiliser                       | Exemple                               |
| ----------- | -------------------------------------- | ------------------------------------- |
| `feat/`     | Nouvelle fonctionnalité user           | `feat/calendar-shared-sessions`       |
| `fix/`      | Correction de bug                      | `fix/cookie-banner-iphone-safari`     |
| `security/` | Durcissement / patch sécu              | `security/rls-profiles-column-grants` |
| `chore/`    | Build, deps, refactor sans impact user | `chore/upgrade-tanstack-query`        |
| `docs/`     | Documentation uniquement               | `docs/branching-strategy`             |
| `test/`     | Tests uniquement (ajout/refactor)      | `test/playwright-signup-flow`         |
| `ci/`       | Pipelines, hooks, tooling              | `ci/coverage-threshold`               |
| `perf/`     | Optimisation perf mesurée              | `perf/leaflet-tile-cache`             |

**Règle d'or** : 1 branche = 1 PR = 1 thème. Si pendant le dev tu découvres autre chose, ouvre une autre branche.

---

## Workflow standard

```powershell
# 1. Toujours partir d'un main à jour
git switch main
git pull --ff-only

# 2. Créer la branche
git switch -c feat/cgu-checkbox

# 3. Coder, committer (chaque commit = atomique, message Conventional)
git add src/components/Auth/SignupForm.tsx src/lib/schemas.ts
git commit -m "feat(auth): require CGU acceptance on signup"

# 4. Pusher
git push -u origin feat/cgu-checkbox

# 5. Ouvrir une PR vers main (GitHub UI ou gh CLI)
#    → CI tourne automatiquement (typecheck + lint + tests + build, ~3 min)
#    → Vercel poste un Preview URL en commentaire
#    → Tu vérifies le diff + tu testes l'URL preview sur mobile
#
#    Note: les E2E Playwright (Sprint 11) tournent en nightly cron ou manual
#    dispatch (.github/workflows/e2e.yml), PAS sur les PRs (pour garder le
#    check rapide). Lance localement si tu touches un golden path :
#    `npm run test:e2e:setup && npm run test:e2e`

# 6. Merge (default: Create a merge commit) une fois CI verte
#    → Vercel auto-deploy main en prod
#    → Supprimer la branche locale + remote
git switch main
git pull --ff-only
git branch -d feat/cgu-checkbox
git push origin --delete feat/cgu-checkbox
```

### Pourquoi une PR même solo ?

- Force la **CI** à passer avant merge
- Le **diff GitHub** met en évidence ce que tu n'as pas vu en local
- Le **Preview Vercel** te permet de tester sur ton tel avant de toucher la prod
- L'**historique** reste lisible (1 PR = 1 ligne dans `git log`)
- Si tu reprends 6 mois après, tu retrouves le contexte dans la description PR

### Squash, rebase, ou merge commit ?

**Pratique actuelle** : `Create a merge commit` via GitHub UI (les PRs Sprints 6-11 utilisent toutes des merge commits — cf. `git log main --oneline`). Cela préserve l'identité du commit de la feature (`feat(sprint-X): ...`) tout en marquant le merge sur main avec un commit `Merge pull request #N from ...`.

Alternatives selon le contexte :

- **Squash & merge** : pour une PR avec beaucoup de commits intermédiaires ("wip", "fix lint", etc.) qu'on veut aplatir. Plus rare en pratique.
- **Rebase & merge** : pour préserver plusieurs commits atomiques (1 commit par étape de refactor) sans merge commit. Peu utilisé.

Tous bloquent `git push --force sur main` (branch protection). Voir [POST-DEPLOY.md § Cleanup branches](docs/POST-DEPLOY.md) pour le nettoyage des branches squash/merge-ées.

---

## Conventional Commits

Format imposé par commitlint au commit-msg hook.

```
<type>(<scope>): <résumé impératif, minuscule, ≤ 100 chars>

[corps optionnel : pourquoi, contexte, breaking changes]

[footer optionnel : Closes #X, Co-authored-by, BREAKING CHANGE: …]
```

> ⚠️ La limite `header-max-length: 100` est définie dans [commitlint.config.js](commitlint.config.js). Les acronymes en uppercase (`RGPD`, `CGU`, `RLS`, `RPC`, `CI`) cassent commitlint en milieu de sujet → écrire `rgpd`, `cgu`, `rls`, `rpc`, `ci` dans le subject. Le body peut être normal.

### Types autorisés

`feat`, `fix`, `security`, `chore`, `docs`, `test`, `ci`, `perf`, `refactor`, `style`, `build`, `revert`.

### Scopes recommandés (libres mais cohérents)

`auth`, `map`, `piano`, `session`, `visit`, `event`, `admin`, `settings`, `notif`, `push`, `rls`, `db`, `lib`, `ui`, `legal`, `pwa`, `sentry`, `i18n`.

**`sprint-<n>` ou `sprint-<n>-<topic>`** : utilisé pour les audits cross-cutting / refactors bulk (ex: `feat(sprint-11-e2e): ...`, `feat(sprint-9-pgtap): ...`, `feat(sprint-7-sec): ...`). Convention en active depuis les Sprints 6-11 (cf. [CLAUDE.md § Sprints récents](CLAUDE.md)).

### Exemples concrets

```
feat(auth): add CGU checkbox on signup form
fix(map): pulse animation no longer triggered on hidden markers
security(rls): hide role/banned_at columns from public profiles select
chore(deps): bump @sentry/react to 10.55
docs(branching): add solo workflow guide
test(lib): cover isRateLimitError and isInvalidPassword
ci(actions): add bundle-size budget guard on index chunk
```

### Breaking changes

```
feat(auth)!: rework signup flow with email confirmation

BREAKING CHANGE: AuthContext.signUp returns { needsConfirmation, email }
au lieu de Promise<void>. Adapter les composants appelants.
```

Le `!` après le scope + le footer `BREAKING CHANGE:` déclenchent le bump major lors d'une release.

---

## Branch protection sur `main` (à faire UNE fois dans GitHub UI)

`Settings → Branches → Add classic branch protection rule`

- **Branch name pattern** : `main`
- ✅ Require a pull request before merging
  - ✅ Require approvals : 0 (solo)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - ✅ Require branches to be up to date before merging
  - Status checks à exiger : `quality`, `build` (les jobs du workflow `ci.yml`)
- ✅ Require conversation resolution before merging
- ✅ Require linear history (force le squash/rebase)
- ❌ Allow force pushes : OFF
- ❌ Allow deletions : OFF
- ✅ Include administrators (toi compris — la discipline marche que si tu te l'imposes aussi)

Une fois activé, **tu ne peux plus push directement sur main**. Tout passe par PR + CI verte.

---

## Releases (versioning + changelog)

SemVer : `v0.MINOR.PATCH` tant que < 1.0.

Convention :

- **MAJOR** (1.0.0) : sortie publique stable
- **MINOR** : nouvelle feature (commits `feat`)
- **PATCH** : bugfix, sécu, chore (commits `fix`, `security`, `chore`)

### Créer une release

```powershell
# 1. Sur main à jour, vérifier qu'on est bien à jour avec origin
git switch main
git pull --ff-only

# 2. Taguer
git tag -a v0.4.0 -m "v0.4.0 — Notifications + Community + Security pass"
git push origin v0.4.0

# 3. Sur GitHub : Releases → Draft a new release → choose tag v0.4.0
#    → Generate release notes (auto depuis les PR titles)
#    → Publish
```

Le tag déclenche aussi un déploiement Vercel marqué « production » dans le dashboard.

---

## Hotfix urgent en prod

Pas de branche dédiée — même flux GitHub Flow :

1. `git switch -c fix/critical-xxx`
2. Fix + commit + push
3. PR → review rapide → squash merge
4. Tag patch `v0.4.1`

Le seul truc à respecter : **CI doit passer**. Pas de contournement « urgent ».

---

## Cheat sheet PowerShell

```powershell
# Branche en cours
git branch --show-current

# Liste des branches locales
git branch

# Branches mergées qu'on peut nettoyer
git branch --merged main | Where-Object { $_ -notmatch '^\*|main$' }

# Supprimer une branche locale + remote
$b = 'feat/foo'
git branch -d $b
git push origin --delete $b

# Reset propre d'une branche locale qui a divergé (DANGEREUX, perd les commits locaux)
git fetch origin
git reset --hard origin/main

# Voir l'historique compact
git log --oneline --graph --decorate -20
```

---

## Anti-patterns (à NE PAS faire)

- ❌ Commit direct sur `main` (la branch protection l'empêchera)
- ❌ Branche qui vit > 2 semaines (merge-conflict guaranteed, et tu oublies le contexte)
- ❌ Mélanger feat + fix + refactor dans une seule PR
- ❌ Force push sur `main` (configuré DENY)
- ❌ Skip de la CI avec `--no-verify` (cf. CLAUDE.md gotcha)
- ❌ Merge commit sur `main` (perd la linéarité)
- ❌ Commit messages flous (`update`, `fix bug`, `wip`)
- ❌ PR de 50 fichiers sans description (toi-même tu sauras plus dans 3 mois)
