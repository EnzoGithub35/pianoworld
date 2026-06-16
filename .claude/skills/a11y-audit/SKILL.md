---
name: a11y-audit
description: Audit d'accessibilité d'un composant ou d'une page PianoWorld (PWA mobile-first) — liaison erreur↔champ (aria-invalid / aria-describedby), labels ARIA sur boutons icône-only, navigation clavier (notamment les flèches sur Tabs), focus visible et gestion du focus des Dialog, contraste WCAG AA light+dark, live regions. Cible les gaps connus du projet. Retourne des findings priorisés avec le fix concret. Use this skill when the user asks "vérifie l'accessibilité", "a11y", "c'est utilisable au clavier / lecteur d'écran ?", "audit accessibilité", or invokes /a11y-audit.
---

# A11y Audit

Audit d'accessibilité ciblé pour PianoWorld. Le projet a déjà de bonnes bases (focus-visible partout, ARIA sur `Tabs`/`Switch`/`Dialog`, live regions sur les banners) — ce skill se concentre sur les **gaps réels identifiés** et les bonnes pratiques mobile/lecteur d'écran.

## When to use this skill

- L'utilisateur dit "vérifie l'accessibilité", "a11y", "navigable au clavier ?", "lecteur d'écran", "audit accessibilité"
- L'utilisateur invoque `/a11y-audit` (cible en argument si fournie ; sinon demander quel composant/page)
- Après `/design-review` (qui délègue ici l'accessibilité)

## Gaps connus du projet (vérifier en priorité)

### 1. Liaison erreur ↔ champ — ABSENTE aujourd'hui (priorité haute)

[src/components/ui/Input.tsx](../../../src/components/ui/Input.tsx) est un wrapper nu : pas d'`aria-invalid` ni d'`aria-describedby`. Dans les formulaires, l'erreur (`<p className="text-xs text-destructive">`) n'est **pas reliée** au champ → un lecteur d'écran ne l'annonce pas.

- **Fix** : sur le champ en erreur, `aria-invalid={!!errors.x}` + `aria-describedby="x-error"` ; sur le `<p>` d'erreur, `id="x-error"` + `role="alert"`.
- Cible : tous les formulaires sous `src/components/**` (Auth, Piano, Friends, Settings, Requests…).

### 2. Navigation clavier des Tabs — promesse non tenue

[src/components/ui/Tabs.tsx](../../../src/components/ui/Tabs.tsx) a déjà : `role="tablist"`/`role="tab"`/`role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, et le **roving tabIndex** (`tabIndex={isActive ? 0 : -1}`). **Mais** le commentaire du fichier annonce « clavier ←→ » alors qu'aucun `onKeyDown` n'implémente le déplacement par flèches.

- **Fix** : ajouter sur `TabsList`/`TabsTrigger` un handler `onKeyDown` (ArrowLeft/ArrowRight → focus + active l'onglet voisin, Home/End → premier/dernier), conforme au pattern WAI-ARIA Tabs. C'est le seul morceau manquant pour rendre le roving tabIndex utile.

### 3. Boutons icône-only sans `aria-label`

Vérifier chaque `<button>` ne contenant qu'une icône lucide (filtres carte, fermeture, géoloc, actions de carte) : il faut un `aria-label` explicite. Certains en ont (close, locate), d'autres non (ex. bouton filtre `PianoMap`).

- **Fix** : `aria-label="Filtrer les pianos"` etc. L'icône décorative reste `aria-hidden`.

## Checklist générale

### 4. Focus visible & gestion du focus

- Tous les interactifs doivent garder `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (déjà la norme — signaler tout élément cliquable custom qui l'a perdu, ex. `<div onClick>` sans `role`/`tabIndex`).
- `Dialog` ([src/components/ui/Dialog.tsx](../../../src/components/ui/Dialog.tsx)) : à l'ouverture, déplacer le focus dans la modale ; à la fermeture, le rendre au déclencheur ; idéalement piéger le focus (focus trap) et exposer `role="dialog"` + `aria-modal="true"` + `aria-labelledby` sur le titre. Vérifier ce qui manque.
- Pas de `<div onClick>` sans `role="button"` + `tabIndex={0}` + handler clavier (Enter/Espace).

### 5. Contraste WCAG AA (light + dark)

- Texte normal ≥ 4.5:1, texte large ≥ 3:1. Points de vigilance : `text-muted-foreground` sur `bg-background`/`bg-muted`, texte sur `bg-primary`, badges de qualité (`QUALITY_COLORS`). Vérifier dans les deux thèmes (`.dark`).

### 6. Sémantique & landmarks

- Hiérarchie de titres cohérente (un seul `h1` logique par vue, pas de saut de niveau).
- Images/avatars décoratifs `aria-hidden` ; images porteuses de sens avec `alt`.
- Listes = vraies listes (`<ul>/<li>`) quand c'est sémantiquement une liste.

### 7. Live regions (déjà partiellement en place)

- `CookieBanner` (`aria-live="polite"`) et `OfflineBanner` (`role="status"`) sont OK — vérifier la cohérence. Les changements d'état importants (toast critique, soumission) doivent être annoncés (les toasts react-hot-toast ne le sont pas toujours nativement).

### 8. Cibles tactiles & zoom

- Cibles ≥ ~40px (cf. `/design-review`). Ne pas bloquer le zoom (`user-scalable=no` interdit dans le meta viewport).

## Output format

```
# Audit accessibilité — <cible>

## 🔴 Bloquant lecteur d'écran / clavier (N)
- [chemin:ligne] <gap> → <fix précis> (réf. <fichier>)

## 🟠 Important (N)
- …

## 🟡 Amélioration (N)
- …

## ✅ Déjà conforme
- focus-visible présent ; Tabs ARIA OK ; live regions banners OK ; …
```

Toujours rappeler en tête les 3 gaps connus s'ils concernent la cible (erreur↔champ, flèches Tabs, aria-label icônes).

## Notes

- Pas de Workflow — audit direct par lecture.
- Ce skill **détecte** ; il n'applique les fixes que si l'utilisateur le demande ensuite.
- Réfs WAI-ARIA Authoring Practices : patterns Tabs, Dialog (modal), Alert. Les appliquer plutôt que d'inventer.
- Complément naturel de `/design-review` (cohérence visuelle) — les deux couvrent des périmètres distincts.
