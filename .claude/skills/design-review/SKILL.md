---
name: design-review
description: Revue design/UX d'une page ou d'un composant PianoWorld face au design system "Bois de piano" — tokens couleur/typo, primitives UI (CVA + cn), patterns mobile-first (safe-area, bottom-sheet, bottom nav, cibles tactiles), cohérence des formulaires, dark mode, animations. Retourne une liste d'écarts priorisés avec le fix concret + le fichier source de référence. Use this skill when the user asks "revois le design de X", "c'est cohérent UI ?", "design review", "check le style", or before merging a new view/component. Pointe vers /a11y-audit pour l'accessibilité fine.
---

# Design Review

Revue de cohérence design/UX d'un composant ou d'une page face au design system PianoWorld (palette "Bois de piano", primitives locales, patterns mobile-first PWA). Objectif : éviter la dérive visuelle et la réinvention de primitives existantes.

## When to use this skill

- L'utilisateur dit "revois le design de X", "c'est cohérent niveau UI ?", "design review", "check le style de cette page"
- Avant de merger une nouvelle vue / un nouveau composant
- L'utilisateur invoque `/design-review` (avec le chemin du fichier/dossier en argument si fourni)

Si aucune cible n'est précisée, demander quel fichier/dossier/écran review (ou prendre le diff courant `git diff --name-only`).

## Méthode

1. Lire la/les cible(s) + les primitives de référence ci-dessous.
2. Comparer point par point la checklist.
3. Rendre une liste d'écarts priorisés (🔴 incohérence visible / 🟠 réutilisation manquée / 🟡 polish), chacun avec : ce qui ne va pas, le fix, le fichier de référence.
4. Toujours terminer en pointant vers `/a11y-audit` pour l'accessibilité (hors périmètre ici).

## Checklist design (référencer les vrais fichiers)

### 1. Tokens couleur — pas de hex/RGB en dur

- Couleurs **uniquement** via classes Tailwind sémantiques mappées sur les CSS vars : `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-destructive`, `ring-ring`. Réf. [src/index.css](../../../src/index.css) (`:root` + `.dark`) et [tailwind.config.js](../../../tailwind.config.js).
- ❌ Pas de `#hex`, `rgb()`, ni `text-[#...]` arbitraire. **Seule exception légitime** : les couleurs de qualité piano (`QUALITY_COLORS` dans [src/types/database.ts](../../../src/types/database.ts)) appliquées en `style={{ backgroundColor }}`.
- Rayon via `rounded-md`/`rounded-lg`/`rounded-2xl` (dérivés de `--radius`), pas de `rounded-[7px]`.

### 2. Typographie

- Gros titres / éléments d'identité → `.font-display` (Fraunces). Corps + UI → Inter (défaut). Réf. `src/index.css`.
- Tailles via utilitaires (`text-sm`, `text-base`, `text-lg`) — cohérence avec les composants voisins.

### 3. Réutiliser les primitives — ne pas réinventer

Avant de coder un bouton/champ/modale/onglet, vérifier [src/components/ui/](../../../src/components/ui/) :
`Button`, `Input`, `Label`, `Textarea`, `Dialog`, `Tabs`, `Badge`, `Avatar`, `Switch`, `Skeleton`, `EmptyState`.

- Variants via **CVA** (`Button`, `Badge`) — utiliser la prop `variant`/`size`, pas des classes ad hoc qui dupliquent un variant existant.
- Classes conditionnelles via `cn()` ([src/lib/utils.ts](../../../src/lib/utils.ts)), jamais de concat de strings manuelle.
- 🔴 Signaler tout `<button>`/`<input>`/modale custom qui aurait dû réutiliser une primitive.

### 4. Mobile-first (PWA)

- **Safe-area** : tout élément fixe ou collé au bas (modale, banner, nav) doit gérer `env(safe-area-inset-bottom)`. Réf. [src/components/ui/Dialog.tsx](../../../src/components/ui/Dialog.tsx), [src/components/Layout/NavBar.tsx](../../../src/components/Layout/NavBar.tsx).
- **Bottom-sheet** : une modale s'ouvre depuis le bas sur mobile (`items-end`) puis se centre en `sm:` (`sm:items-center`), coins `rounded-t-2xl` → `sm:rounded-2xl`. Suivre le pattern de `Dialog.tsx`.
- **Cibles tactiles** ≥ ~40px de haut (`h-10` pour inputs/boutons par défaut ; `h-9`=`sm` réservé aux zones denses).
- **Layout** : le contenu sous la NavBar doit respecter `pb-16` (cf. [src/components/Layout/AppShell.tsx](../../../src/components/Layout/AppShell.tsx)).
- **Largeurs** : modales/cartes plafonnées (`max-w-sm`/`max-w-md`) pour rester lisibles.

### 5. Formulaires (cohérence UX)

- Layout : `space-y-4` sur le `<form>`, `space-y-2` par groupe de champ.
- Erreur de champ : `<p className="text-xs text-destructive">` sous le champ.
- Validation : schema **zod centralisé** dans [src/lib/schemas.ts](../../../src/lib/schemas.ts) + `zodResolver` (jamais de schema inline).
- Erreurs serveur : `toast.error(getErrorMessage(err, 'Fallback FR'))` ([src/lib/errors.ts](../../../src/lib/errors.ts)) — messages spécialisés (`isRateLimitError`, `isInvalidPassword`).
- Bouton de submit : prop `loading` du `Button` + désactivation anti double-submit.

### 6. Dark mode

- Vérifier le rendu en `.dark` : toute couleur passant par les tokens marche automatiquement. 🔴 Une couleur en dur casse le dark mode.
- Contraste AA en light **et** dark (renvoyer vers `/a11y-audit` pour le détail).

### 7. Animations & feedback

- Réutiliser les keyframes d'`index.css` : `animate-fade-in`, `slide-up`, `slide-up-modal`, `scale-in`, `pulse-ring`, `.skeleton`. Ne pas inventer de durées/courbes ad hoc.
- États de chargement : `Skeleton` (listes/cartes), `Button loading` (actions). Vide : `EmptyState`.

### 8. Icônes

- `lucide-react`, importées nommément. Tailles cohérentes : `h-5 w-5` (nav/standard), `h-4 w-4` (boutons compacts), `h-8 w-8`+ (héros/onboarding).

## Output format

```
# Design review — <cible>

## 🔴 Incohérences visibles (N)
- [chemin:ligne] <écart> → <fix> (réf. <fichier de référence>)

## 🟠 Réutilisations manquées (N)
- [chemin:ligne] Bouton custom au lieu de <Button variant="…"> → remplacer (réf. src/components/ui/Button.tsx)

## 🟡 Polish (N)
- …

## ✅ Conforme
- <points déjà bien alignés>

→ Pour l'accessibilité (ARIA, clavier, contraste), lance /a11y-audit sur cette cible.
```

Si tout est conforme : "✅ Cohérent avec le design system Bois de piano. RAS côté tokens/primitives/mobile."

## Notes

- Pas de Workflow — revue directe par lecture de fichiers.
- Ce skill **détecte**, il n'applique pas les fixes (sauf si l'utilisateur le demande ensuite explicitement).
- Périmètre = cohérence visuelle/UX. L'accessibilité fine est déléguée à `/a11y-audit`.
