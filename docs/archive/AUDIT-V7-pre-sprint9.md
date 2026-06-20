# PianoWorld — Audit v7 (archivé pre-Sprint 9)

> 📌 **Document archivé le 2026-06-20**. Audit conduit avant les Sprints 9-11. De nombreux findings P0/P1 ont été résolus depuis. Conservé pour la méthodologie et l'historique des décisions, **pas pour le statut courant**.
>
> Pour le statut actuel, voir :
>
> - [CLAUDE.md § Sprints récents (6-11)](../../CLAUDE.md) — commits livrés et backlog actif
> - [docs/POST-DEPLOY.md](../POST-DEPLOY.md) — actions post-merge et backlog opérationnel
> - [docs/SECURITY.md § Backlog](../SECURITY.md) — état sécurité courant
>
> ## Findings de cet audit déjà résolus dans Sprints 9-11
>
> - ✅ **B.4 pgTAP RLS tests** absents → **Sprint 9 (cf5f84b)** : 88 assertions / 7 fichiers
> - ✅ **B.5 Playwright E2E** absents → **Sprint 11 (88509f4)** : 5 golden paths + Supabase local
> - ✅ **Dialog X button 28px (P1 a11y)** → **résolu** (h-11 w-11 = 44px dans DialogClose)
> - ✅ **PianoPage header buttons 32px (P1 a11y)** → **résolu** (h-11 w-11)
> - ✅ **FAB MapPage sans safe-area-inset** → **résolu** ([MapPage.tsx:18](../../src/pages/MapPage.tsx#L18) `style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}`)
> - ✅ **`notify_favorite_update` transitional state** → **résolu** (présent dans [`NOTIFICATION_CATEGORIES`](../../src/lib/constants.ts) ligne 103)
> - ✅ **NavBar 5e icône Users transitional** → **résolu Sprint 6** (cf. [NavBar.tsx](../../src/components/Layout/NavBar.tsx))
> - ✅ **Photon autocomplete dans AddPianoFlow** → **résolu Sprint 6**
> - ✅ **A.7 EXIF strip + A.6.4 signup IP rate-limit** → **résolu Sprint 7**
>
> ---
>
> ## Document original ci-dessous (conservé)

> Audit transversal mené sur l'état v7 (PR-A backend search + favoris + amis livrée, frontend PR-B à venir).
>
> Persona cible : **Newcomer mobile-first FR**. Premier-utilisateur qui découvre PianoWorld via un lien partagé. Mobile uniquement (360-414px). Patience friction onboarding ~30 secondes avant abandon.

---

## Résumé exécutif

### Métriques

| Métrique                              |                       Valeur |
| ------------------------------------- | ---------------------------: |
| Findings totaux retenus               |                      **148** |
| P0 — bloquants                        |                        **1** |
| P1 — importants                       |                       **21** |
| P2 — améliorations                    |                       **75** |
| P3 — backlog                          |                       **51** |
| Findings droppés (adversarial verify) |                            1 |
| Total initial workflow                | 149 (5 dimensions × ~30 max) |
| Agents lancés (Map + Verify)          |                          155 |
| Tokens consommés                      |                        ~798k |

### Top 10 actionables (P0 + P1 triés par effort ↑ × impact ↓)

| #   | Sev | Titre                                                                                     | Effort | Impact | Fichier                                                     |
| --- | --- | ----------------------------------------------------------------------------------------- | ------ | ------ | ----------------------------------------------------------- |
| 1   | P0  | AddFriendButton Accepter/Refuser inline casse - findPendingId stub retourne null          | S      | fort   | `src/components/Friends/AddFriendButton.tsx:55-61, 115-153` |
| 2   | P1  | Bouton X close Dialog sous 44px (p-1 + h-5 icon = 28px hit area)                          | XS     | fort   | `src/components/ui/Dialog.tsx:39-46`                        |
| 3   | P1  | FAB MapPage bottom-4 sans safe-area : collision avec home indicator iPhone                | XS     | fort   | `src/pages/MapPage.tsx:13-20`                               |
| 4   | P1  | Dialog X dupliqué : 2 boutons Fermer dans le DOM (backdrop + icone) - bruit screen reader | XS     | moyen  | `src/components/ui/Dialog.tsx:27-46`                        |
| 5   | P1  | VisitButton 'J'y suis passé' contredit ActivityTab 'a joué ici'                           | XS     | moyen  | `src/components/Piano/VisitButton.tsx:55`                   |
| 6   | P1  | Tap targets icon-only sous 44px sur PianoPage header (Pencil/Trash2 hit area ~32px)       | S      | fort   | `src/pages/PianoPage.tsx:63-89`                             |
| 7   | P1  | OfflineBanner top fixe sans compensation du main - cache le header de chaque page         | S      | fort   | `src/components/Layout/OfflineBanner.tsx:11-20`             |
| 8   | P1  | EmptyState ActivityTab 0 piano - CTA discret en lien text-xs                              | S      | fort   | `src/components/Dashboard/ActivityTab.tsx:99-113`           |
| 9   | P1  | Favori vs Bookmark vs Suivre v7 : label final pas tranché                                 | S      | fort   | `src/types/database.ts:97-99`                               |
| 10  | P1  | Notification email vers /dashboard deconnecte perd la destination                         | S      | fort   | `src/App.tsx:53-67`                                         |

### Quick wins additionnels (P2 effort XS/S × impact fort)

| Sev | Titre                                                                             | Effort | Fichier                                             |
| --- | --------------------------------------------------------------------------------- | ------ | --------------------------------------------------- |
| P2  | Tutorial 4 slides obligatoires bloque l'entree via lien partage                   | S      | `src/components/Onboarding/Tutorial.tsx:33-95`      |
| P2  | AddPianoFlow modal fullscreen sans safe-area-top : header cache sous le notch     | XS     | `src/components/Map/AddPianoFlow.tsx:182-192`       |
| P2  | EditPianoForm bouton X sans padding (24x24px) + pas de garde isDirty au close     | S      | `src/components/Piano/EditPianoForm.tsx:113-117`    |
| P2  | AddFriendButton pending_received : findPendingId stub - tap Accepter ne fait rien | S      | `src/components/Friends/AddFriendButton.tsx:55-160` |
| P2  | Photos uploadées non strippées EXIF (GPS leak via metadata)                       | S      | `src/lib/photo.ts:36-58`                            |
| P2  | verify_my_password : pas de protection contre brute-force online                  | XS     | `supabase/schema.sql:974-996`                       |
| P2  | search_users similarity threshold > 0.1 = partial-match leak (énumération souple) | S      | `supabase/schema.sql:2657-2707`                     |
| P2  | Quality labels Désastreux / Potable subjectifs sans guidance                      | S      | `src/types/database.ts:18-25`                       |
| P2  | Dashboard tab 'Mes demandes' ambigu : feedback admin vs amitié                    | XS     | `src/pages/Dashboard.tsx:89-94`                     |
| P2  | Tutorial 4 slides sans mention 'Installer la PWA'                                 | S      | `src/components/Onboarding/Tutorial.tsx:6-27`       |
| P2  | Post-signup redirect tombe sur la carte sans onboarding contextuel                | S      | `src/pages/AuthPage.tsx:138-139`                    |
| P2  | Pas de route /me ni de lien 'Mon profil' - newcomer ne peut pas voir son profil   | S      | `src/App.tsx:63-68`                                 |

---

## Méthodologie

Workflow multi-agents adversarial en 3 phases via le tool Workflow (token budget ~800k) :

**Phase 1 — Map (5 finder agents en parallèle)** : chaque dimension (UX, sécurité, utilité, compréhension, navigation) a son agent briefé sur le persona newcomer mobile-first FR + une liste de fichiers cibles + ~30 questions guidées. Chaque agent retourne ≤30 findings via JSON Schema (severity P0/P1/P2/P3, file:line, symptôme, pourquoi pour newcomer, fix concret, effort XS/S/M/L, impact faible/moyen/fort).

**Phase 2 — Adversarial verify (1 critique par finding, fan-out parallèle ~150 agents)** : chaque finding individuel passe devant un verifier skeptique avec consigne _"par défaut keep, drop UNIQUEMENT si clairement spéculatif"_. Sortie : `is_real` + `severity_correction` + `effort_correction` + `reason`. Findings droppés et corrections appliqués.

**Phase 3 — Completeness critic** : 1 agent reçoit la liste des findings retenus et auto-pose questions complémentaires sur perf/a11y/RGPD/scalability/maintenance/testability/i18n/resilience/observability/moderation/pedagogy/motivation. ⚠️ **Cette phase a échoué pour cause de rate-limit API** (1 agent failure). Voir section 6 où j'ai ajouté manuellement les findings completeness post-workflow.

**Failures notables** : 28 verifies de la dimension navigation-discoverability ont raté (rate-limit groupé, fin de run). Leur fallback est _keep_ — ces findings sont conservés tels quels (severity inchangée). Acceptable car l'agent verify était surtout là pour drop le spéculatif, pas pour corriger la majorité.

---

## 1. UX & ergonomie mobile

**Total : 30 findings** (0 P0, 5 P1, 19 P2, 6 P3)

### P1 — Important (5)

#### [P1] Tap targets icon-only sous 44px sur PianoPage header (Pencil/Trash2 hit area ~32px)

- **Où** : `src/pages/PianoPage.tsx:63-89`
- **Symptôme** : Les boutons Retour (ArrowLeft h-5), Modifier (Pencil h-4) et Supprimer (Trash2 h-4) sont enveloppes dans un button p-1.5 sans h/w min. Hit area = ~32px x 32px. Sur 360px en plein soleil, le newcomer manque le bouton Retour 1 fois sur 3 et touche par accident Trash2 a cote (l'auteur peut accidentellement detruire son propre piano).
- **Pourquoi (newcomer)** : Apple HIG et Android Material exigent 44x44px / 48x48dp. Le newcomer mobile-first qui decouvre l'app via lien partage tappe imprecisement (premier usage, doigt non guide visuellement). Risque de tap accidentel sur destructif (Trash2) tres eleve car les 3 icones sont colles (gap-2).
- **Fix** : Wrapper les 3 buttons avec min-h-[44px] min-w-[44px] flex items-center justify-center, ou utiliser <Button variant="ghost" size="icon"> (h-10 w-10 deja defini). Ajouter aussi un gap-3 entre Pencil et Trash2 et idealement deplacer Trash2 dans un menu kebab.
- **Effort** : S · **Impact** : fort
- **Verify** : Code confirme: lignes 63-89 utilisent button p-1.5 + icons h-4/h-5 -> hit area 28-32px, gap-2 entre Pencil et Trash2 destructif. Severity P1 et effort S correctement calibres.

#### [P1] Bouton X close Dialog sous 44px (p-1 + h-5 icon = 28px hit area)

- **Où** : `src/components/ui/Dialog.tsx:39-46`
- **Symptôme** : Le bouton fermer (X) du Dialog est p-1 autour d'un X h-5 w-5 - hit area ~28px x 28px. Sur 320-360px, le newcomer mobile cherche a fermer ReportDialog / SessionDialog / DeleteAccountDialog et rate la cible, frustration immediate.
- **Pourquoi (newcomer)** : Ce composant est utilise partout (PianoReportButton, SessionDialog, DeleteAccountDialog, RemoveFriendDialog, etc.). Un newcomer mobile-first qui n'arrive pas a fermer une modal abandonne en < 30s. WCAG 2.5.5 cible minimum 44x44px.
- **Fix** : Remplacer className="rounded-full p-1 ..." par "rounded-full p-2.5 ..." (passe a 44px) ou ajouter min-h-[44px] min-w-[44px]. Pareil pour le X du AddPianoFlow header ligne 188 (p-1.5 = 36px).
- **Effort** : XS · **Impact** : fort
- **Verify** : Verified at Dialog.tsx:43 — p-1 + h-5 icon = 28px hit area, under the 44px mobile target. Used in many critical modals (Report, Session, Delete, RemoveFriend), real friction for newcomer mobile-first. P1 + XS appropriate.

#### [P1] Dialog X dupliqué : 2 boutons Fermer dans le DOM (backdrop + icone) - bruit screen reader

- **Où** : `src/components/ui/Dialog.tsx:27-46`
- **Symptôme** : Le composant Dialog rend un <button aria-label="Fermer" inset-0 h-full w-full> en backdrop ET un <button aria-label="Fermer"> avec icone X. Deux elements identiques pour l'AT. Un user VoiceOver entend 'Fermer, bouton' deux fois consecutives.
- **Pourquoi (newcomer)** : Le newcomer qui utilise un lecteur d'ecran (ou voice control iOS) recoit du bruit. Un seul bouton accessible 'Fermer' devrait suffire. Le backdrop devrait etre aria-hidden=true (decoratif).
- **Fix** : Sur le backdrop button : remplacer aria-label par aria-hidden="true" et tabIndex={-1}, ou utiliser un div onClick=onClose role=presentation (mais perd le clavier - l'Echap est deja gere ligne 18).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirme : lignes 27-32 et 39-46 exposent deux boutons aria-label="Fermer" identiques. VoiceOver/voice control les annoncent tous deux, bruit AT reel. P1 et XS coherents.

#### [P1] OfflineBanner top fixe sans compensation du main - cache le header de chaque page

- **Où** : `src/components/Layout/OfflineBanner.tsx:11-20`
- **Symptôme** : OfflineBanner fixed top-0 z-[1500] avec paddingTop safe-area, mais le main d'AppShell.tsx ligne 16 a juste pb-16, sans compensation pt offline. En offline iPhone notch, le banner cache le titre 'Paramètres' et surtout le bouton Retour de PianoPage.
- **Pourquoi (newcomer)** : Newcomer mobile-first en metro/avion (offline frequent en mobilite francaise) ne voit plus le bouton Retour de PianoPage. Pense que l'app est cassee. Critique car il a clique un lien partage et ne peut plus revenir.
- **Fix** : Detecter online dans AppShell et ajouter pt-9 au main quand offline. Ex : <main className={cn('flex-1 overflow-hidden pb-16', !online && 'pt-9')}>. Ou rendre OfflineBanner sticky inline plutot que fixed.
- **Effort** : S · **Impact** : fort
- **Verify** : OfflineBanner.tsx:13 est fixed top-0 + safe-area, AppShell.tsx:16 n'a que pb-16 sans pt offline-aware, PianoPage utilise p-4 simple. Le banner recouvre bien le bouton Retour en offline iPhone notch.

#### [P1] FAB MapPage bottom-4 sans safe-area : collision avec home indicator iPhone

- **Où** : `src/pages/MapPage.tsx:13-20`
- **Symptôme** : Le FAB '+' est absolute bottom-4 right-4 z-[500]. AppShell main pb-16 reserve la place NavBar, mais le FAB n'a pas d'env(safe-area-inset-bottom). Sur iPhone home indicator, le FAB est tres pres du bord (16px) et fait collision avec le geste swipe-home.
- **Pourquoi (newcomer)** : Newcomer iPhone iOS 14+ avec home indicator : 50%+ des taps sur le FAB declenchent un swipe home accidentel, l'app passe en arriere-plan. Frustration majeure des le 1er essai d'ajout de piano.
- **Fix** : Ajouter style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }} au FAB, ou className="... bottom-[calc(1rem+env(safe-area-inset-bottom))]". Verifier aussi z-[500] vs LocateMeButton z-[400] : ne se chevauchent pas.
- **Effort** : XS · **Impact** : fort
- **Verify** : Confirme ligne 17: bottom-4 right-4 sans env(safe-area-inset-bottom), FAB a 16px du bord physique sur iPhone home indicator zone — collision swipe-home reelle pour newcomer mobile-first PWA.

### P2 — Amélioration (19)

#### [P2] Toast Toaster top-center entre en collision avec OfflineBanner et headers sticky

- **Où** : `src/main.tsx:39-55`
- **Symptôme** : Le Toaster react-hot-toast est top-center. Quand offline, le OfflineBanner z-[1500] occupe top + safe-area-top ; le toast peut etre derriere ou par-dessus. Sur PianoPage header sticky top-0 z-10, le toast en top-center cache le titre + bouton Retour pendant 3s.
- **Pourquoi (newcomer)** : Newcomer mobile : un toast 'Piano ajoute !' ou erreur rate-limit s'affiche sous le banner offline, illisible. Sur PianoPage avec header sticky, le toast couvre le bouton Retour pendant 3s - frustration.
- **Fix** : Soit deplacer Toaster en position="bottom-center" avec containerStyle margin-bottom: calc(env(safe-area-inset-bottom) + 5rem) pour eviter NavBar, soit ajouter containerStyle={{ top: 'calc(env(safe-area-inset-top) + 3rem)' }} pour passer sous le banner offline.
- **Effort** : S · **Impact** : moyen
- **Verify** : Verified: Toaster top-center (main.tsx:40) sans offset, OfflineBanner fixed top-0 z-[1500] et headers PianoPage/UserPage/LegalPage sticky top-0 z-10 - collision reelle 3s. P1 trop alarmiste pour overlap transitoire non bloquant.

#### [P2] Tutorial 4 slides obligatoires bloque l'entree via lien partage

- **Où** : `src/components/Onboarding/Tutorial.tsx:33-95`
- **Symptôme** : Au 1er chargement de MapPage (entry via lien partage = piano specifique en arriere-plan), Tutorial pop avec 4 slides obligatoires. Le bouton 'Passer' est mt-3 text-xs et tres discret (gris). Le newcomer qui voulait juste voir le piano partage met 10-20s a comprendre qu'il peut skipper.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first qui decouvre via lien partage : la friction onboarding > 5s = drop-off. La 1ere chose qu'il voit est un tutoriel decontextualise sur des features qu'il n'a pas demande. Le bouton Skip discret est anti-pattern guilt-trip classique.
- **Fix** : 1) Rendre 'Passer' plus visible (variant ghost + h-9 + place a droite du bouton primaire). 2) Ne pas montrer Tutorial si l'entry route est /piano/:id depuis un lien (detection via document.referrer ou navigation state). 3) Reduire a 2 slides max.
- **Effort** : S · **Impact** : fort
- **Verify** : Verifie ligne 88: 'Passer' est bien mt-3 text-xs text-muted-foreground (discret, anti-pattern guilt-trip). 4 slides confirmes lignes 6-27, aucun bypass selon entry route. Severity P2 et effort S coherents avec l'ampleur du fix UX.

#### [P2] Tutorial localStorage sans try/catch - re-pop sur Safari incognito

- **Où** : `src/components/Onboarding/Tutorial.tsx:33-46`
- **Symptôme** : Le check localStorage.getItem(TUTORIAL_STORAGE_KEY) est fait sans fallback try/catch. En mode incognito Safari iOS, le localStorage throw au .setItem (quota), et le Tutorial re-pop a chaque navigation vers MapPage car la cle n'a pas pu etre ecrite.
- **Pourquoi (newcomer)** : Newcomer en navigation privee (cas frequent quand on teste un lien suspect / wifi public) voit le tutorial a chaque tap sur l'icone Carte de la NavBar. Blocker total - perception d'app cassee.
- **Fix** : Wrapper localStorage dans try/catch (suivre le pattern CookieBanner.tsx ligne 22-32). Si localStorage indisponible, mettre setOpen(false) en fallback (assume vu pour cette session memoire).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verified at Tutorial.tsx:33-46: localStorage.getItem (L34) and setItem (L44) are both unguarded; Safari iOS incognito throws on setItem (quota=0), causing tutorial to re-pop on every MapPage visit. Fix and severity P2/XS are accurate.

#### [P2] Dialog : pas d'auto-focus sur premier input quand ouvert

- **Où** : `src/components/ui/Dialog.tsx:15-50`
- **Symptôme** : Quand un Dialog s'ouvre (PianoReportButton, EditPseudoDialog, ChangePasswordDialog, DeleteAccountDialog, AddPianoFlow confirmClose, SessionDialog), aucun element n'est focus auto. Le clavier mobile virtuel ne s'ouvre pas - l'utilisateur doit tap sur le champ + scroll + relancer.
- **Pourquoi (newcomer)** : Newcomer mobile-first : ouvrir Dialog Signaler -> doit tap sur le champ 'Raison' (2 taps au lieu de 0). L'a11y-audit signale deja focus trap manquant (C.1 backlog). Sur iOS Safari, auto-focus dans modal animee echoue meme avec autoFocus prop.
- **Fix** : Dans Dialog.tsx, useEffect quand open passe true : querySelector('input, textarea, button:not([aria-label=Fermer])') premier puis .focus({ preventScroll: true }). Pour iOS, setTimeout(0) apres animation. Bonus : focus-trap simple via inert sur le reste du DOM.
- **Effort** : M · **Impact** : moyen
- **Verify** : Dialog.tsx l.15-22 ne contient qu'un handler Escape. Aucun auto-focus, aucun focus trap. Symptome reel: tap supplementaire requis pour ouvrir le clavier mobile sur tous les Dialog cites. P2 et effort M coherents.

#### [P2] Bottom-sheet Dialog : pas de drag handle ni swipe-to-close (gesture mobile attendu)

- **Où** : `src/components/ui/Dialog.tsx:33-36`
- **Symptôme** : Le Dialog rend une bottom-sheet mobile (items-end + rounded-t-2xl + animate-slide-up-modal) mais aucune barre de drag (handle bar) visible en haut. Aucun gesture swipe-down pour fermer. Le newcomer iOS habitue aux bottom-sheets natives (Instagram, Apple Plans) tente swipe down et rien ne se passe.
- **Pourquoi (newcomer)** : Pattern d'interaction mobile critique attendu. Le mobile-design skill mentionne 'bottom-sheet drag-to-close'. Sans barre, le newcomer ne sait pas que c'est une sheet - il cherche le X (cf finding tap target).
- **Fix** : Ajouter en haut du conteneur popover sous le rounded-t-2xl : <div className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-border" aria-hidden /> (visible mobile only). Pour le drag : envisager wrapper minimal touchstart/touchmove/touchend (tracker dy > 100px = onClose).
- **Effort** : M · **Impact** : moyen
- **Verify** : Code confirme Dialog.tsx:33-36 : bottom-sheet (items-end + rounded-t-2xl + slide-up) sans handle ni swipe-to-close ; seuls Escape/overlay/X ferment. Gap mobile-native reel, P2 et effort M coherents.

#### [P2] AddPianoFlow modal fullscreen sans safe-area-top : header cache sous le notch

- **Où** : `src/components/Map/AddPianoFlow.tsx:182-192`
- **Symptôme** : Le conteneur AddPianoFlow est <div className="fixed inset-0 z-[1000] flex flex-col bg-background"> avec un header p-4 sans paddingTop safe-area. Sur iPhone X+ et Android avec encoche, le titre 'Ajouter un piano' et le bouton X sont caches sous le notch.
- **Pourquoi (newcomer)** : Newcomer iPhone : ouvre le FAB '+', ne voit plus le bouton X pour fermer (cache sous notch). Impossible de quitter le formulaire sans le completer. Le footer ligne 348-350 a bien le safe-area-bottom mais le header est oublie.
- **Fix** : Ajouter style={{ paddingTop: 'env(safe-area-inset-top)' }} sur le header (pas le wrapper, sinon le decor descend). Idem dans EditPianoForm.tsx ligne 113 qui a le meme oubli.
- **Effort** : XS · **Impact** : fort
- **Verify** : Verifie ligne 182-192 (AddPianoFlow) et 112-118 (EditPianoForm) : header p-4 sans paddingTop safe-area sur conteneur fixed inset-0, le titre/bouton X chevauchent le notch iPhone. Footer a bien safe-area-bottom (asymetrie confirmee).

#### [P2] EditPianoForm bouton X sans padding (24x24px) + pas de garde isDirty au close

- **Où** : `src/components/Piano/EditPianoForm.tsx:113-117`
- **Symptôme** : Le button du header EditPianoForm n'a pas de padding (juste aria-label=Fermer avec X h-6 w-6). Hit area = 24x24px. Bien en dessous des 44px. Le bouton X de AddPianoFlow a au moins p-1.5. Aussi : pas de confirmClose si user a modifie.
- **Pourquoi (newcomer)** : Modale destructive : ferme = perd les modifs si non sauvees. Le newcomer qui veut annuler une edition tape a cote, se retrouve coince. Pas de garde 'tu vas perdre tes modifs' comme dans AddPianoFlow ligne 67-126 - regression UX.
- **Fix** : Ajouter className="rounded-full p-2.5 hover:bg-accent" (min 44px). Ajouter aussi un isDirty + confirmClose comme dans AddPianoFlow - sinon le user perd ses changes au moindre tap mal place sur le X.
- **Effort** : S · **Impact** : fort
- **Verify** : Verified: EditPianoForm.tsx:115-117 bouton sans padding (24x24) et zero isDirty/confirmClose, alors qu'AddPianoFlow:67,70-71,123-126 a tout le pattern. Double regression UX reelle pour newcomer mobile.

#### [P2] NavBar 4 items deja serre sur 320px - 5e onglet futur tronque les labels

- **Où** : `src/components/Layout/NavBar.tsx:5-54`
- **Symptôme** : items array a 4 entrees, chacune flex-1 dans max-w-md (448px). Sur 320px : chaque tab = 80px avec label text-[11px] 'Recherche' / 'Paramètres'. Les labels touchent les bords. Si 5e onglet ajoute (Favoris v7), passage a 64px/tab - 'Paramètres' troncate.
- **Pourquoi (newcomer)** : v7 evoquee : 'search + favoris + amis backend livres, frontend PR-B a venir' suggere qu'un onglet sera ajoute. Sur 320px (iPhone SE 1ere gen / Android entry-level encore en service France 2026), le label deviendra illisible et la cible tactile passe sous 48px.
- **Fix** : Garder 4 onglets, deplacer 'Amis' en sous-tab Dashboard (deja fait via /dashboard?tab=friends). Si 5 items obligatoire : en 320px masquer les labels (icones only avec sm:inline sur les labels) ou raccourcir 'Paramètres' -> 'Compte'. Eviter scroll horizontal sur bottom nav (anti-pattern).
- **Effort** : S · **Impact** : moyen
- **Verify** : Confirmé: 4 NavLink flex-1 dans max-w-md avec labels text-[11px] dont 'Paramètres' (10 chars) - sur 320px chaque tab ~80px déjà serré, 5e onglet le réduirait à 64px et tronquerait le label.

#### [P2] AdminPage tab state non URL-synced - back navigation perd le contexte (C.4)

- **Où** : `src/pages/AdminPage.tsx:20-80`
- **Symptôme** : useState('kpis') pour le tab actif. Quand l'admin clique 'Audit log' et fait back, l'app revient a /settings, perdant le tab - il doit re-cliquer Audit log. Aussi, impossible de partager un lien vers '/admin?tab=audit' (deep link Sentry / Slack).
- **Pourquoi (newcomer)** : Pattern deja resolu sur Dashboard.tsx (ligne 33-49) avec useSearchParams. AdminPage devrait suivre le meme pattern pour coherence. Admin (souvent en moderation tournee mensuelle) revient sur un lien et perd son contexte.
- **Fix** : Copier le pattern Dashboard.tsx 33-49 : const [searchParams, setSearchParams] = useSearchParams(); initialTab depuis ?tab=; setSearchParams au onValueChange avec replace: true.
- **Effort** : XS · **Impact** : faible
- **Verify** : Verified: AdminPage.tsx:23 uses plain useState('kpis') with no URL sync, while Dashboard.tsx:33-49 already implements the useSearchParams pattern - inconsistency confirmed, deep-links to /admin?tab=audit impossible.

#### [P2] Tabs : pas de navigation clavier ArrowLeft/ArrowRight (C.2 backlog)

- **Où** : `src/components/ui/Tabs.tsx:76-110`
- **Symptôme** : TabsTrigger n'a pas de onKeyDown handler. tabIndex={isActive ? 0 : -1} suggere l'intention d'un roving tabindex (WAI-ARIA pattern), mais aucune logique ArrowLeft/Right/Home/End. Un utilisateur clavier coince sur 'Activite' ne peut pas atteindre 'Demandes' sans tabber a travers toute la page.
- **Pourquoi (newcomer)** : C.2 backlog known. Persona newcomer mobile-first peu concerne directement, mais regression a11y sur Bluetooth keyboard (iPad accessible / desktop screen-reader). Sur iPad avec Magic Keyboard, c'est bloquant.
- **Fix** : Dans TabsList, capturer onKeyDown : si ArrowLeft/Right, recuperer les enfants TabsTrigger via ref, focus le suivant/precedent en wrapping. Pattern reference WAI-ARIA Authoring Practices 'Tabs with Automatic Activation'. Voir /a11y-audit skill.
- **Effort** : M · **Impact** : moyen
- **Verify** : Confirme : tabIndex roving present (l.96) + JSDoc promet 'clavier ←→' (l.5) mais aucun onKeyDown sur TabsList/Trigger ; promesse a11y non tenue, P2/M coherent.

#### [P2] Dialog focus pas piege - Tab sort de la modal vers le contenu en arriere-plan

- **Où** : `src/components/ui/Dialog.tsx:24-50`
- **Symptôme** : Pas de focus trap implemente. Quand un Dialog est ouvert (ex: DeleteAccountDialog avec 2 champs sensibles), tab depuis le bouton 'Supprimer' va sur le button backdrop, puis sort dans la NavBar derriere - le user peut activer 'Carte' sans fermer la modal, leaks UX.
- **Pourquoi (newcomer)** : C.1 backlog known. Critique pour DeleteAccountDialog (destructive irreversible) - un keyboard user qui croit avoir annule peut accidentellement supprimer son compte via un Enter clavier mal place.
- **Fix** : Implementer un mini focus-trap : a l'open, identifier first/last focusable, intercepter Tab/Shift+Tab pour wrapper. Lib focus-trap-react (~2KB) ou inline. Au minimum, ajouter tabIndex={-1} sur l'overlay button ligne 27 pour le retirer du tab order.
- **Effort** : M · **Impact** : moyen
- **Verify** : Confirme: Dialog.tsx n'a aucun focus trap (juste Escape l.17-22), backdrop button l.27 est focusable, rien n'empeche Tab de sortir vers la NavBar. Risque reel sur DeleteAccountDialog. P2/M coherents.

#### [P2] AddPianoFlow geoloc refusee : toast generique sans CTA fallback explicite

- **Où** : `src/components/Map/AddPianoFlow.tsx:101-109`
- **Symptôme** : Si l'user refuse la geoloc (premiere demande iOS = permission popup native), le catch fait toast.error('Position indisponible'). Pas de message expliquant 'tu peux quand meme cliquer sur la carte'. Le bandeau MapPin ligne 243-248 explique mais seulement si coords absent - n'apparait pas apres refus actif.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui refuse la geoloc (raison securite/privacy ou Chrome qui a deja refuse pour le domaine) doit comprendre qu'il peut continuer. Sans guide, beaucoup abandonnent en pensant que c'est un blocker.
- **Fix** : Apres echec geoloc, toast avec icon + message clair : 'Tu peux choisir l'emplacement en cliquant sur la carte ou en tapant l'adresse'. Optionnellement, focus auto sur l'input adresse pour proposer la saisie textuelle direct.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirme: catch ligne 106-108 ne donne aucun guide fallback dans le toast. Le hint MapPin ligne 243-248 s'affiche bien (coords reste null apres refus) mais est passif et domine par le toast rouge - gap reel pour newcomer mobile.

#### [P2] AddFriendButton pending_received : findPendingId stub - tap Accepter ne fait rien

- **Où** : `src/components/Friends/AddFriendButton.tsx:55-160`
- **Symptôme** : findPendingId est commente 'best-effort' et retourne null systematiquement (ligne 60). Quand value === 'pending_received', le clic Accepter ou Refuser affiche un toast 'Reponds depuis Dashboard -> Amis -> Demandes recues' au lieu d'agir. Le user tape, croit avoir accepte, doit faire 3 taps de plus.
- **Pourquoi (newcomer)** : v6 social merge - feature 'amis' livree mais l'action critique 'accepter depuis la page user' ne fonctionne pas en pratique. Newcomer qui recoit une invitation par @ via SearchPage va sur le profil pour 'Accepter' et tombe sur un toast confus.
- **Fix** : Resoudre findPendingId : 1) ajouter un parametre dans useFriendStatus qui retourne aussi le request_id ; 2) ou fetch direct friend_requests where sender=target AND receiver=me AND status=pending. Sinon, remplacer les boutons par lien direct vers /dashboard?tab=friends&sub=received.
- **Effort** : S · **Impact** : fort
- **Verify** : Verifie AddFriendButton.tsx:60 - findPendingId retourne null systematiquement. Les boutons Accepter/Refuser (lignes 115-156) tombent toujours dans le toast fallback. Action critique non fonctionnelle. P2/S corrects.

#### [P2] Dashboard 5 onglets scrollable sans indicateur visuel d'overflow droite

- **Où** : `src/pages/Dashboard.tsx:77-95`
- **Symptôme** : TabsList scrollable overflow-x-auto scrollbar-none. Sur 320px les 5 onglets (Activite, Communaute, Evenements, Amis, Mes demandes) ne tiennent pas - la moitie droite est cachee. Aucun gradient/chevron pour suggerer le scroll. Le badge pendingFriendsCount sur Amis peut etre hors viewport.
- **Pourquoi (newcomer)** : Newcomer ouvre Dashboard et ne voit pas 'Mes demandes' (cache a droite). Le badge friend pending (qui doit creer du retour user) est invisible. Anti-pattern bien connu : scrollable container sans indicateur d'overflow visible.
- **Fix** : Ajouter un gradient fade a droite via ::after sur TabsList scrollable (white->transparent mask 24px). Ou scroller automatiquement vers le tab actif au mount (ref.scrollIntoView({ inline: 'center' })). Ou afficher un mini chevron pulsant cote droit.
- **Effort** : S · **Impact** : moyen
- **Verify** : Confirmed Dashboard.tsx:77-95 uses TabsList scrollable with overflow-x-auto scrollbar-none and zero overflow affordance; 5 FR labels + 2 badges exceed 320-360px so 'Mes demandes' and pendingFriendsCount badge are invisible to newcomers.

#### [P2] CommunityTab toggle Calendar/List non persiste - reset 'list' a chaque visite

- **Où** : `src/components/Community/CommunityTab.tsx:29-91`
- **Symptôme** : useState<ViewMode>('list') : le choix vue Calendrier/Liste est perdu au demontage (navigation hors Dashboard puis retour). Le newcomer qui prefere la vue Calendrier doit retoggler chaque fois. Aussi : pas dans l'URL searchParams.
- **Pourquoi (newcomer)** : Pattern attendu : si tu choisis explicitement une vue, le systeme s'en souvient (localStorage ou URL searchParam). Sur Dashboard ?tab=community le state n'est pas dans l'URL, donc partage du lien ouvre toujours Liste meme si l'expediteur preferait Calendrier.
- **Fix** : Persister via localStorage (key COMMUNITY_VIEW_KEY dans constants.ts). useEffect au mount qui lit la valeur ; setView wrap pour ecrire. Ou ajouter ?view=calendar dans le searchParams parent Dashboard.
- **Effort** : XS · **Impact** : faible
- **Verify** : Confirmed line 29: useState<ViewMode>('list') sans persistence (ni localStorage ni searchParam), reset systematique au demontage. P2/XS justes.

#### [P2] Calendar 14j horizontal sans scroll-snap - days coupes 50/50 au swipe

- **Où** : `src/components/Community/CommunityTab.tsx:218-257`
- **Symptôme** : Les jours sont overflow-x-auto avec min-w-[52px] flex-col. Aucun scroll-snap-type: x mandatory. Sur swipe rapide mobile, le scroll s'arrete sur un jour coupe 50/50 - la date affichee n'est pas claire. Aucun scroll-padding pour que le jour selectionne soit auto-centre.
- **Pourquoi (newcomer)** : Newcomer mobile-first decouvre la vue calendrier, swipe, voit '14' a moitie cache - confusion. Pattern iOS App Store / TikTok day picker = scroll-snap natif. Sans snap, l'experience parait amateur.
- **Fix** : Ajouter className="... snap-x snap-mandatory scroll-px-3" sur le conteneur scroll + className="... snap-start" sur chaque button day. Bonus : useEffect qui scrollIntoView le selected/today au mount avec inline: 'center' behavior: 'smooth'.
- **Effort** : XS · **Impact** : faible
- **Verify** : Verified line 218 lacks snap-x snap-mandatory and line 230 lacks snap-start; no scrollIntoView for today/selected. 14 days x ~56px overflows mobile viewport, swipe stops on half-cut day. P2/XS appropriate.

#### [P2] card-hover :hover sticky sur touch device - shadow reste apres tap-release

- **Où** : `src/index.css:191-198`
- **Symptôme** : .card-hover:hover translate-Y(-1px) shadow-md applique a TOUS les liens (FriendCard, EventRow, PianoMap popups, UserPage piano cards, SearchPage results). Sur mobile, :hover declenche au tap et reste sticky jusqu'au tap ailleurs - la card reste shadow + decalee, le user pense qu'elle est selectionnee.
- **Pourquoi (newcomer)** : Le persona newcomer mobile-first tape une card, navigue dessus, revient - la card precedente est encore shadow elevated. Incoherence visuelle persistante. Pire : sur tap-and-hold pour annuler, le shadow reste plusieurs secondes.
- **Fix** : Wrapper le hover dans @media (hover: hover) { .card-hover:hover {...} } - ne s'applique qu'aux periph avec hover reel (souris). Sur mobile, garder transition mais sans hover. Bonus : ajouter active:scale-[0.98] pour le retour tactile sur tap.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Le code à src/index.css:195-198 applique bien :hover sans guard @media (hover: hover), causant le sticky hover sur touch confirmé; P2 et XS sont justes.

#### [P2] Animations sans prefers-reduced-motion - pulse-ring infinie + slide modal

- **Où** : `src/index.css:152-222`
- **Symptôme** : Aucune media query @media (prefers-reduced-motion: reduce) dans index.css. Les animations slide-up-modal (Dialog, Tutorial, AddPianoFlow, CookieBanner), pulse-ring (markers actifs PianoMap), shimmer (Skeleton omnipresent), animate-fade-in tournent en continu sans respect du setting OS.
- **Pourquoi (newcomer)** : WCAG 2.1 AA 2.3.3 demande de respecter reduce-motion. Newcomer avec motion sickness / TDAH / migraine vestibulaire : la pulse-ring infinie autour des markers actifs declenche un malaise en quelques secondes. Setting iOS Reduce Motion ignore.
- **Fix** : Ajouter en fin de index.css : @media (prefers-reduced-motion: reduce) { .animate-fade-in, .animate-slide-up, .animate-slide-up-modal, .animate-scale-in, .pulse-ring, .skeleton { animation: none !important; transition: none !important; } }
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirme : index.css n'a aucune media query prefers-reduced-motion, pulse-ring tourne en infinite, shimmer aussi - WCAG 2.3.3 viole, fix CSS trivial.

#### [P2] CookieBanner z-[1200] cache la NavBar + FAB pendant les premieres 800ms

- **Où** : `src/components/Layout/CookieBanner.tsx:46-89`
- **Symptôme** : CookieBanner fixed bottom-0 z-[1200] avec safe-area-bottom. Sur 320px sa hauteur ~140px (icone + 2 paragraphes + bouton + close). Pendant l'affichage initial il cache la NavBar (z-50) ET le FAB MapPage (z-[500]). Newcomer qui veut taper '+' au lancement doit d'abord dismiss le banner.
- **Pourquoi (newcomer)** : Funnel onboarding entrant via /map : user voit la carte + Tutorial (z-[2000] correct) + CookieBanner masque NavBar + FAB. 3 obstacles avant d'interagir. Newcomer abandonne. La sequence devrait etre Tutorial -> CookieBanner -> usage libre.
- **Fix** : 1) Si Tutorial visible -> ne pas afficher CookieBanner (attendre Tutorial dismiss via meme localStorage check). 2) Ou positionner CookieBanner en top plutot que bottom. 3) Ou rendre le banner plus compact (une ligne + bouton, h~56px).
- **Effort** : S · **Impact** : moyen
- **Verify** : Verifie: CookieBanner z-[1200] (line 50) recouvre bien NavBar z-50 et FAB z-[500], tous fixed bottom-0. Sur 320px le card ~140px masque NavBar + FAB jusqu'au dismiss. Friction reelle pour newcomer mobile.

### P3 — Backlog / idée (6)

#### [P3] Photo upload : pas de progress indicator - newcomer pense l'app figee en 3G

- **Où** : `src/components/Map/AddPianoFlow.tsx:144-167`
- **Symptôme** : handleSubmit fait await uploadPianoPhoto puis insert piano. Photo compressee a 200KB mais sur 3G metro l'upload peut prendre 5-10s. Aucun feedback granulaire - juste Button loading qui affiche '...' (Button.tsx ligne 45). Pas de 'Compression / Upload 60% / Enregistrement'.
- **Pourquoi (newcomer)** : Le Button rendu loading n'affiche que '...' (Button.tsx ligne 45). En 3G/4G congestione, newcomer pense l'app freeze, double-tap (bloque par guard ligne 130), ferme. Aucun moyen de cancel l'upload en cours. Perception de bug critique.
- **Fix** : 1) Diviser submit en etapes setStatus('compressing'|'uploading'|'saving') affiche dans footer. 2) Garder Button loading mais texte 'Envoi photo... 60%' (xhr progress callback dans uploadPianoPhoto). 3) Bouton 'Annuler envoi' optionnel.
- **Effort** : M · **Impact** : moyen
- **Verify** : Button.tsx:45 confirme loading='…' uniquement, AddPianoFlow.tsx:144-167 await sequentiel sans progress, uploadPianoPhoto sans callback xhr — symptome reel sur 3G, mais P3 plus juste car edge case metro + toast final fournit cloture.

#### [P3] Avatar HSL : collisions de couleur sur pseudos courts - confusion identite

- **Où** : `src/components/ui/Avatar.tsx:22-30`
- **Symptôme** : hueFromPseudo retourne hash % 360. Pour pseudos courts (3-5 chars), le set des hues reels est limite. Le degrade applique saturation/lightness fixes (65%, 50%/40%) - ~20-30 visuels distincts en pratique. Sur CommunityTab (5+ events avec auteurs differents par jour), 2-3 avatars apparaissent identiques visuellement.
- **Pourquoi (newcomer)** : Persona newcomer qui essaie de reconnaitre @alex vs @leo via la couleur de l'avatar : si tous deux ont hue 200 +/- 10, distinction impossible. Devient critique avec FriendsTab + SessionList ou plusieurs avatars sont stackes en VisitorStack.
- **Fix** : Soit utiliser palette discrete 12-16 couleurs choisies (hash % 16 -> palette[i]). Soit varier saturation et lightness selon hash secondary. Garder l'initiale ; envisager 2 lettres pour 'XY' au lieu de 'X' (ligne 45 utilise charAt(0) only).
- **Effort** : S · **Impact** : faible
- **Verify** : FNV-1a hash bien reparti mais ~18-24 hues perceptuellement distincts en 360 degres avec S/L fixes -> collisions reelles en stacks; cosmetique non bloquant pour newcomer donc P3 plutot que P2.

#### [P3] SignupForm checkbox CGU 16x16 - cible trop petite, erreur acceptCgu hors viewport

- **Où** : `src/components/Auth/SignupForm.tsx:67-97`
- **Symptôme** : <input type="checkbox" h-4 w-4> = 16x16px hit area. Le <label> englobe heureusement le texte (etend la zone), mais si user veut tap precisement la checkbox (sans tap sur 'CGU' qui ouvre target=\_blank), il doit viser 16px. Sur 360px en marchant : 1 essai sur 2. L'erreur acceptCgu est sous le scroll mobile.
- **Pourquoi (newcomer)** : Etape critique du funnel signup : sans cocher CGU, le submit echoue silencieusement (form validation). Newcomer ne comprend pas pourquoi 'Creer mon compte' ne fait rien - l'erreur acceptCgu apparait en bas, sous le scroll mobile, invisible jusqu'a scroll.
- **Fix** : Augmenter visuellement la checkbox a h-5 w-5, ou wrapper dans span min-h-[44px] min-w-[44px] inline-flex items-center justify-center. Scroll smooth vers l'erreur acceptCgu en cas de submission echouee (ref.current?.scrollIntoView).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verifie SignupForm.tsx:69-73 : checkbox h-4 w-4 (16px) sous le seuil 44px tactile. Le label englobe le texte mais la checkbox elle-meme reste petite, et l'erreur acceptCgu (l.94-96) suit en DOM, donc potentiellement sous le fold mobile.

#### [P3] Pas de pull-to-refresh ni refetch manuel - feed Communaute/Friends stale

- **Où** : `src/pages/Dashboard.tsx:97-113`
- **Symptôme** : main.tsx configure refetchOnWindowFocus: false (ligne 19). Aucun pull-to-refresh, aucun bouton refresh visible sur Dashboard, CommunityTab, FriendsTab. L'user qui veut voir si nouvelle session ajoutee doit naviguer hors puis revenir - mais refetchOnWindowFocus off, donc reload page complet requis.
- **Pourquoi (newcomer)** : Newcomer qui attend une demande d'ami acceptee ou une nouvelle session live regarde la liste 30s puis abandonne car 'rien ne se passe'. Pattern attendu sur Instagram / Twitter mobile = pull-to-refresh universel.
- **Fix** : Option 1 : activer refetchOnWindowFocus: true (stale 30s deja). Option 2 : implementer pull-to-refresh via use-gesture (4KB). Option 3 : bouton 'Actualiser' compact en haut de chaque tab visible apres > 60s sans refetch.
- **Effort** : M · **Impact** : moyen
- **Verify** : Verifie: main.tsx:19 a bien refetchOnWindowFocus:false avec staleTime 30s, et Dashboard.tsx:97-113 n'expose aucun bouton refresh ni pull-to-refresh sur les 5 tabs - newcomer attendant un ack d'ami ou session live ne verra rien jusqu'a reload manuel.

#### [P3] PianoPage section Mise a jour : bouton 'Annuler' ambigu (suggere annuler MAJ deja faite)

- **Où** : `src/pages/PianoPage.tsx:162-187`
- **Symptôme** : Le bouton bascule entre 'Mettre a jour' (closed) et 'Annuler' (open). 'Annuler' suggere 'annuler la mise a jour' alors qu'il n'y a rien a annuler encore (le formulaire n'a pas ete soumis). Confusion semantique. Plus parlant : 'Fermer' ou un chevron rotatif.
- **Pourquoi (newcomer)** : Newcomer qui tape 'Mise a jour' pour partager 'le piano est encore la', voit 'Annuler' apparaitre - pense qu'il a annule quelque chose, sort, perd l'intent. Detail mais impactant pour la conversion sur ce feature cle de la communaute.
- **Fix** : Remplacer 'Annuler' par 'Fermer' ou utiliser un chevron rotatif (ChevronDown / ChevronUp). Ou faire que la section soit toujours ouverte (accordion plutot que toggle).
- **Effort** : XS · **Impact** : faible
- **Verify** : Code confirme : ligne 174 toggle 'Annuler'/'Mettre a jour' sans saisie en cours. Nit semantique reel mais convention FR repandue (Annuler = abandonner l'action en cours), P3/XS justifie.

#### [P3] ConfirmPending : pas d'auto-detection session confirmed - newcomer reste bloque

- **Où** : `src/components/Auth/ConfirmPending.tsx:16-85`
- **Symptôme** : Le user clique le lien email -> ouvre un onglet -> confirme. Mais l'onglet d'origine (ConfirmPending) ne sait pas et reste bloque sur 'Verifie ta boite mail'. User doit tap 'Aller a la connexion' OU recharger. Aucun polling supabase.auth.getSession() pour detecter passage user -> user.confirmed.
- **Pourquoi (newcomer)** : Newcomer mobile-first fait signup, valide email (iOS Mail puis Safari nouveau tab), revient sur l'onglet d'origine - voit toujours 'Verifie ta boite mail'. Confus. Pense que l'email n'est pas valide. Drop-off post-signup eleve.
- **Fix** : Ajouter useEffect avec setInterval(2000) qui appelle supabase.auth.getSession() ; quand session.user.email_confirmed_at != null, navigate('/'). Stop apres 5min. Bonus : ecouter document.visibilitychange pour re-check immediatement au refocus de l'onglet.
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirme: ConfirmPending.tsx ne contient aucun polling getSession() ni listener visibilitychange/onAuthStateChange. L'onglet reste figé jusqu'a action manuelle. Symptome reel pour newcomer mobile, P3/S coherents.

---

## 2. Cybersécurité & privacy

**Total : 28 findings** (0 P0, 2 P1, 10 P2, 16 P3)

### P1 — Important (2)

#### [P1] CSP autorise 'unsafe-inline' sur script-src + style-src (XSS pivot)

- **Où** : `vercel.json:37`
- **Symptôme** : Header CSP contient script-src 'self' 'unsafe-inline' et style-src 'self' 'unsafe-inline'. Toute injection HTML (via piano.comment, friend pseudo, report reason 1-500 chars) deviendrait exécutable. La defense-in-depth React JSX-escape est cassée si un dangerouslySetInnerHTML / svg / event handler glisse.
- **Pourquoi (newcomer)** : Pour un newcomer mobile-first qui découvre l'app via lien partagé, scénario d'attaque toxique (compte tout neuf, session active, pas méfiant). Un seul commentaire piano malicieux = vol de token Supabase via localStorage. Acknowledged dans docs/SECURITY.md §15 backlog A.5.
- **Fix** : Cf. A.5 du backlog : Vercel Edge middleware qui génère un nonce par requête, l'injecte dans le HTML et remplace 'unsafe-inline' par 'nonce-<random>'. Bloque le P1 sans changer le code applicatif.
- **Effort** : M · **Impact** : fort
- **Verify** : vercel.json:37 contient bien script-src 'self' 'unsafe-inline' + style-src 'self' 'unsafe-inline'; defense-in-depth XSS effectivement cassee, P1/M coherents avec backlog A.5.

#### [P1] Signup sans rate-limit IP (botnet → flooding signups → spam Resend quota)

- **Où** : `src/contexts/AuthContext.tsx:131-175`
- **Symptôme** : signUp() appelle supabase.auth.signUp directement. Pas de captcha, pas de proof-of-work. Un script qui itère sur email\_$i@10minutemail.com génère des centaines de comptes et déclenche autant de mails Resend (free tier 100/jour, 3000/mois) → DoS quota mail + DKIM-reputation collapse.
- **Pourquoi (newcomer)** : Pour un newcomer mobile-first qui essaie de s'inscrire le jour où le quota Resend explose, plus aucun mail de confirmation n'arrive — abandon silencieux des 30s mentionnées dans persona. Acknowledged backlog A.6.4.
- **Fix** : Edge Function dédiée /auth-signup-gate qui (1) check Cloudflare Turnstile token, (2) rate-limit IP via Deno KV (5/heure), (3) re-emet vers supabase.auth.admin.createUser. Le client appelle l'Edge plutôt que supabase.auth.signUp direct.
- **Effort** : L · **Impact** : fort
- **Verify** : Code confirme: signUp ligne 150 appelle supabase.auth.signUp directement sans captcha/IP rate-limit; CLAUDE.md acknowledge backlog A.6.4; risque quota Resend free-tier reel.

### P2 — Amélioration (10)

#### [P2] push_subscriptions p256dh + auth_secret stockés en clair (DB leak = push spoofing)

- **Où** : `supabase/schema.sql:598-607`
- **Symptôme** : Les colonnes p256dh et auth_secret de push_subscriptions sont text NOT NULL en clair. Un dump DB (backup volé, replica compromise) donne accès aux endpoints + clés de chiffrement → attaquant peut envoyer des push arbitraires aux users (phishing 'Cliquez ici pour confirmer votre compte').
- **Pourquoi (newcomer)** : Push usurpé sur un newcomer mobile-first = surface d'attaque énorme : le user vient d'installer la PWA, habitué aux notifs PianoWorld natives sur lockscreen iOS, clique sans réfléchir. Acknowledged backlog A.1.2.
- **Fix** : Court terme : minimiser le blast radius via purge agressive des push_subscriptions inactives (last_used_at < now() - 90 days) et auto-rotation VAPID tous les 6 mois. Long terme A.1.2 : chiffrement applicatif AES-GCM avec une clé dans Edge Functions secrets.
- **Effort** : L · **Impact** : fort
- **Verify** : Plaintext p256dh/auth_secret confirmé schema.sql:602-603, mais exploit nécessite dump DB (Supabase chiffre at rest) et impact limité au push spoofing — P2 defense-in-depth plus juste que P1, backlog A.1.2 déjà acknowledged.

#### [P2] Photos uploadées non strippées EXIF (GPS leak via metadata)

- **Où** : `src/lib/photo.ts:36-58`
- **Symptôme** : compressPhoto() passe par browser-image-compression qui re-encode en JPEG mais NE GARANTIT PAS le strip des tags EXIF. Les iPhone/Android écrivent GPSLatitude/GPSLongitude par défaut. La photo finit en bucket public piano-photos, n'importe qui peut télécharger et lire les coordonnées du domicile de l'uploader.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui ajoute son premier piano avec une photo prise chez lui plus tôt → leak des coordonnées GPS de son appartement, accessibles publiquement. Article 5 RGPD (minimisation) en infraction. Acknowledged backlog A.7.
- **Fix** : Court terme : ajouter exifr.remove() ou re-canvas vers blob (drawImage force strip de tous les tags non-pixel) dans compressPhoto. Long terme A.7 : Edge Function process-photo qui re-download, exifr.remove, re-upload. Test : 'exiftool photo.jpg' doit ne rien retourner.
- **Effort** : S · **Impact** : fort
- **Verify** : Real concern (bucket public + acknowledged backlog A.7), mais browser-image-compression strip EXIF par defaut via canvas re-encode (preserveExif: false default) → risque attenue, P2 plus juste que P1.

#### [P2] find_user_by_email rate-limit per-user mais pas per-IP — botnet attaquable

- **Où** : `supabase/schema.sql:2712-2749`
- **Symptôme** : Rate-limit 5/24h indexé sur auth.uid(). Un attaquant qui contrôle 1000 comptes (signup gratuit ouvert sans rate-limit IP) peut probe 5000 emails/jour. Avec un dictionnaire de 500K emails leakés, l'énumération prend <100 jours et est totalement légitime côté logs (chaque compte est nominalement under limit).
- **Pourquoi (newcomer)** : Newcomer mobile-first qui s'inscrit avec son email pro → un mois plus tard reçoit du spam ciblé 'PianoWorld user' depuis listes vendues. RGPD violations : énumération + perte d'opt-out.
- **Fix** : Soit baisser le rate-limit à 3/24h ET ajouter un compteur global anonyme (table 'user_search_email_global' avec 1000/heure max) ; soit déplacer la RPC dans une Edge Function avec rate-limit IP via Deno KV. Mieux : combiner avec A.6.4.
- **Effort** : M · **Impact** : fort
- **Verify** : Confirmed: rate-limit indexé sur auth.uid() seul (schema.sql:2620,2628,2639), pas de cap IP/global. Mais email confirmation gate ajoute friction réelle à l'acquisition de 100K comptes → P2 plus honnête que P1.

#### [P2] 2FA admin absent — vol de session admin = takeover total

- **Où** : `supabase/schema.sql:245-282`
- **Symptôme** : is_admin()/is_superadmin() ne checkent que profiles.role. Aucun second facteur. Si la session d'un admin est volée (phishing, XSS via 'unsafe-inline', replay JWT non rotaté), l'attaquant a accès à set_user_role, reply_to_request. Le re-auth password protège set_user_banned/force_delete_piano mais PAS set_user_role et reply_to_request.
- **Pourquoi (newcomer)** : Backlog A.6.3 : Supabase MFA TOTP est dispo mais non câblé. Un superadmin compromis peut promote un complice, demote la victime, ban tout le monde, supprimer tous les pianos. Cascade catastrophique non-recoverable.
- **Fix** : Activer Supabase MFA, créer un wrapper RPC require_recent_mfa(p_factor_id, p_code) à appeler en début de chaque RPC sensible (set_user_role, force_delete_piano, reply_to_request, delete_my_account).
- **Effort** : L · **Impact** : fort
- **Verify** : Verified: set_user_role (schema.sql:1542) et reply_to_request (1629) n'ont aucun re-auth ni MFA, contrairement à set_user_banned/force_delete_piano qui exigent verify_my_password — inconsistance réelle et A.6.3 explicitement backlog.

#### [P2] verify_my_password : pas de protection contre brute-force online

- **Où** : `supabase/schema.sql:974-996`
- **Symptôme** : extensions.crypt(p, v_hash) prend ~100ms (bcrypt cost 10). Mais AUCUN rate-limit n'est appliqué (pas d'appel à enforce_caller_rate_limit). Un attaquant ayant volé une session JWT peut tester 50 password/sec côté serveur SQL et ne déclenchera ni erreur ni alerte. Pour 8 chars : faisable en quelques jours.
- **Pourquoi (newcomer)** : C'est l'unique barrière protégeant delete_my_account, force_delete_piano, set_user_banned. Sans rate-limit la barrière est illusoire.
- **Fix** : Ajouter perform public.enforce_caller_rate_limit('verify_password', 10, '1 hour'::interval) en début de verify_my_password. 10/h est suffisant pour les usages légitimes et coupe à plat le brute-force.
- **Effort** : XS · **Impact** : fort
- **Verify** : Confirmed schema.sql:974-996 : aucun enforce_caller_rate_limit dans verify_my_password alors que le helper existe et est utilisé ailleurs. Bcrypt ~100ms => brute-force online possible avec JWT volé, gate des RPCs irréversibles.

#### [P2] Sentry scrubber incomplet : pas de téléphone / IPv6 / UA / coordonnées GPS

- **Où** : `src/lib/sentry.ts:18-41`
- **Symptôme** : Les regex scrubbent UNIQUEMENT email + JWT. Manquent : téléphones FR (06/07/+33), IPv4/IPv6 littérales dans messages, user-agent identifiants, coordonnées GPS (lat/lng floats qui fuient si logger.warn passe ctx avec lat/lng).
- **Pourquoi (newcomer)** : Newcomer mobile-first dont la 1re session piano est près de chez lui → si un crash logge ctx {lat, lng}, ses coords domicile fuient vers Sentry, non listé dans le DPA. RGPD article 32.
- **Fix** : Étendre scrubString avec : COORDS_REGEX /\b-?\d{1,2}\.\d{4,}\b/ → '[coord]' ; PHONE_REGEX /\b(?:0|\+33)[1-9](?:[\s.-]?\d{2}){4}\b/ → '[phone]' ; IPV4_REGEX /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ → '[ip]'.
- **Effort** : S · **Impact** : moyen
- **Verify** : Verified: scrubber at sentry.ts:18-23 ne couvre que email + JWT; GPS coords particulièrement plausibles dans ctx PianoWorld (geoloc, AddPianoFlow) → fuite domicile vers Sentry réelle. P2 + effort S corrects.

#### [P2] delete_my_account non audité (anonymous deletes invisibles)

- **Où** : `supabase/schema.sql:1293-1309`
- **Symptôme** : delete_my_account fait DELETE FROM auth.users sans appeler write_audit_log. Si un admin enquête sur 'comptes disparus en masse en 24h' (signe d'un attacker qui supprime des comptes après pivot), aucune trace.
- **Pourquoi (newcomer)** : Persona admin investiguant : impossible de distinguer 'le user a vraiment voulu partir' de 'un attaquant qui efface ses traces après pivot'. RGPD article 30 demande qu'on puisse documenter les suppressions sur demande.
- **Fix** : Avant DELETE FROM auth.users, perform public.write_audit_log('delete_my_account_self', uid, jsonb_build_object('email_hash', encode(digest(v_email, 'sha256'), 'hex'))). On garde uid + sha256(email) sans la PII brute.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirmed schema.sql:1293-1309: delete_my_account fait DELETE FROM auth.users sans write_audit_log, alors que force_delete_piano, set_user_banned, set_user_role, resolve_report tous logguent. Vrai gap audit, P2+XS justes.

#### [P2] pg_cron purges non documentées comme actives (friend_arriving_dedup, friendship_rejections)

- **Où** : `supabase/schema.sql:1855, 1869, 3042-3057`
- **Symptôme** : Commentaires l. 1855/1869 disent 'Purge pg_cron hebdomadaire/mensuelle (cf. section 13)' mais section 13 ne montre QUE notif-retry et notif-purge. Les cron.schedule pour friendship_rejections (30j) et friend_arriving_dedup (hebdo) sont ABSENTS. → tables grossissent indéfiniment, cooldown anti-stalking jamais purgé.
- **Pourquoi (newcomer)** : Anti-stalking cassé à terme (10 ans de friendship_rejections persistantes = registre social-engineering attractif). Newcomer victime de harcèlement : la trace de la 1re demande rejetée reste à vie.
- **Fix** : Ajouter dans section 13 deux cron.schedule explicites : 'friendship-rejections-purge' weekly DELETE WHERE rejected_at < now() - 30d ; 'friend-arriving-dedup-purge' weekly DELETE WHERE last_queued_at < now() - 7d. Documenter à exécuter au déploiement.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirmed: l.1855/1869 référencent une purge pg_cron mais section 13 (l.3042-3057) ne définit que notif-retry/notif-purge. Les deux tables grossissent sans limite, trail anti-stalking persistant.

#### [P2] search_users similarity threshold > 0.1 = partial-match leak (énumération souple)

- **Où** : `supabase/schema.sql:2657-2707`
- **Symptôme** : LIKE '%' || v_q || '%' + similarity > 0.1 retourne first_name + last_name de TOUS les users matchant 2+ chars. Aucun rate-limit. Un attaquant peut iterate sur 'aa'..'zz' (676 queries) et reconstruire la liste de tous users qui ont opt-in noms + leur (id, pseudo, first_name, last_name).
- **Pourquoi (newcomer)** : Tout l'effort privacy v7 sur first_name/last_name opt-in est neutralisé. Newcomer mobile-first qui opt-in son vrai nom pour matcher un ami → finit dans une base de scraping après énumération α-β.
- **Fix** : (1) Ajouter rate-limit dur 30/heure via enforce_caller_rate_limit('search_users', 30, '1 hour'). (2) Augmenter la similarity threshold à > 0.3 (vraie pertinence). (3) Refuser les queries < 3 chars.
- **Effort** : S · **Impact** : fort
- **Verify** : Code confirme exactement: schema.sql:2656 commente explicitement "Pas de rate-limit", LIKE %% sur 3 colonnes lignes 2694-2696, threshold 0.1 ligne 2701, min 2 chars ligne 2677 → énumération α-β réelle qui neutralise l'opt-in PII v7.

#### [P2] search_pianos retourne created_by uuid → association piano↔user même si banned

- **Où** : `supabase/schema.sql:2753-2809`
- **Symptôme** : RETURNS inclut created_by uuid + author_pseudo. Le LEFT JOIN profiles ne filtre PAS banned_at IS NULL. Si l'auteur d'un piano a été banni, son uuid + son pseudo restent visibles. La RPC list_piano_presence filtre banned_at correctement, mais search_pianos non.
- **Pourquoi (newcomer)** : Newcomer qui cherche 'Beaubourg' et tombe sur un piano créé par un user banni → voit @harceleur_banni en tant qu'auteur. L'utilité du ban est cassée pour les contenus persistants. Incohérent avec le reste.
- **Fix** : Dans search_pianos, ajouter à la clause WHERE : 'and (prof.banned_at is null or prof.id is null)'. Acceptable : si l'auteur a été supprimé (left join null), on garde le piano avec author_pseudo = null (front affiche '@anonyme').
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verified at schema.sql:2793-2798: left join profiles has no banned_at filter, and created_by + author_pseudo are exposed in RETURNS — banned authors leak through search_pianos, inconsistent with list_piano_presence.

### P3 — Backlog / idée (16)

#### [P3] search_users et toggle_piano_favorite reads non tracés (manque visibilité opérationnelle)

- **Où** : `supabase/schema.sql:2657-2707, 2847-2891`
- **Symptôme** : Aucune trace côté audit_log pour find_user_by_email (volontaire), toggle_piano_favorite, search_users, search_pianos. Si un attaquant énumère des emails à 5/jour pendant 6 mois pour cartographier 900 emails, on ne voit RIEN. Le rate_limit_buckets perd la trace après expiration de fenêtre.
- **Pourquoi (newcomer)** : Tradeoff documenté (anti-registre d'énumération). MAIS pour l'observabilité, on devrait logger en agrégé. Sans dashboard 'comportement anormal', impossible de détecter un compte qui scrappe la base users.
- **Fix** : Créer une vue materialized public.security_metrics_daily refresh quotidien : counts(action) groupés par actor_id (anonymisé via hashtext) depuis rate_limit_buckets + audit_log. Pas de PII, juste compteurs. Permet alerts seuil sans registre nominatif.
- **Effort** : M · **Impact** : moyen
- **Verify** : Constat exact (aucun audit_log sur ces reads), mais c'est un gap d'observabilité opérationnel intentionnel (anti-registre d'énumération documenté) avec rate-limit 5/24h déjà en place — P3 nice-to-have, pas P2.

#### [P3] Webhook secret + VAPID keys : pas de procédure de rotation documentée

- **Où** : `supabase/schema.sql:3029-3040`
- **Symptôme** : Section 13 dit 'WEBHOOK_SECRET (openssl rand -base64 32)' et 'VAPID_PUBLIC_KEY/PRIVATE' comme setup one-shot. Aucune procédure pour rotate si le secret leak en logs Vercel, ni pour rotate VAPID (qui obligerait à re-inscrire tous les push_subscriptions car la public key change).
- **Pourquoi (newcomer)** : Lifecycle gap. Pour un newcomer admin qui hérite du projet plus tard, aucune doc rotation = secret leak = panic mode.
- **Fix** : Ajouter docs/SECURITY.md une section 17 'Rotation procedures' : webhook → générer nouveau secret, deux valides 5min ('x-webhook-secret-next') puis flip. VAPID → nouvelle paire, BROADCAST 'vapid_rotation' aux clients qui re-subscribe, garder ancienne 30j pour transition.
- **Effort** : S · **Impact** : moyen
- **Verify** : Verified: schema.sql:3022-3037 documents one-shot secret setup, docs/SECURITY.md (16 sections) ne couvre aucune procédure de rotation pour WEBHOOK_SECRET ni VAPID — vrai lifecycle gap, mais plus P3 que P2 (doc nice-to-have, pas vuln active).

#### [P3] enforce_caller_rate_limit pas appliqué sur verify_my_password / update_my_profile_names / search_users

- **Où** : `supabase/schema.sql:974, 2657, 2812`
- **Symptôme** : L'infrastructure enforce_caller_rate_limit existe (l. 2609) et utilisée par find_user_by_email. Mais 3 autres RPCs sans rate-limit : (1) verify_my_password (brute-force), (2) update_my_profile_names (spam-update 1000x/sec déclenche WAL bloat free tier), (3) search_users (énumération α-β).
- **Pourquoi (newcomer)** : Pattern d'usage : enforce_caller_rate_limit est documenté comme 'helper pour RPCs où trigger ne fire pas'. Doit être utilisé partout. Newcomer mobile qui clique 20x un bouton 'update names' → 20 INSERTs dans rate_limit_buckets sans plafond.
- **Fix** : Ajouter en haut de update_my_profile_names : perform public.enforce_caller_rate_limit('profile_names_update', 20, '24 hours'). Idem search_users (30/hour). Idem verify_my_password (10/hour, plus serré).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verifie: helper existe l.2609, absent des 3 RPCs. Mais verify_my_password gated auth.uid (pas pre-auth), search_users justif explicite l.2656 (public). Seul update_my_profile_names vrai gap. P3 plus juste.

#### [P3] Storage piano_photos_delete_own : owner peut être NULL → policy inopérante

- **Où** : `supabase/schema.sql:135-137`
- **Symptôme** : Policy delete using (bucket_id = 'piano-photos' and auth.uid()::text = owner::text). owner peut être NULL pour des uploads via Edge/service_role. NULL = NULL = false en USING → photos orphelines jamais supprimables par UI, seulement par SQL manuel. Quota Storage consommé indéfiniment.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui supprime son piano avec photo → si photo uploadée via Edge (owner null), deletePianoPhoto échoue silencieusement. Quota Storage 1Go → app muette pour nouveaux uploads. Bug latent opérationnel.
- **Fix** : Ajouter policy admin fallback : 'create policy piano_photos_delete_admin on storage.objects for delete using (bucket_id = piano-photos and public.is_admin())'. Et cron mensuel DELETE FROM storage.objects WHERE owner IS NULL AND created_at < now() - 90 days.
- **Effort** : S · **Impact** : moyen
- **Verify** : Policy schema.sql:135-137 manque fallback admin et NULL=NULL=false en USING, mais uploads actuels passent client-side authenticated (photo.ts:67) donc owner toujours set. Bug latent/hardening, pas actif → P3 plus juste.

#### [P3] Sentry beforeSend : pas de safeguard contre infinite loop (scrubDeep peut crash → re-trigger)

- **Où** : `src/lib/sentry.ts:27-41, 53-69`
- **Symptôme** : scrubDeep utilise Object.entries() qui throw sur des Proxy avec get throwant ou objets frozen circulaires depth>8. Si scrubDeep throw dans beforeSend, Sentry retry sans le hook → event original (non-scrubé) envoyé. Ou pire : le throw devient nouvel event qui re-passe par beforeSend → boucle.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui crash sur un edge case (objet Leaflet circular ref) → au mieux event leaking PII, au pire crash browser sur retry. Defense-in-depth manqué.
- **Fix** : Wrap scrubDeep dans try/catch : 'try { return scrubDeep(event) } catch { return null }' (drop event silencieusement). Drop > leak. Idem beforeBreadcrumb. Vitest test : passer un Proxy throwant.
- **Effort** : XS · **Impact** : moyen
- **Verify** : scrubDeep (sentry.ts:27-41) uses Object.entries with no try/catch at lines 64/68; Proxy/circular refs can throw. Sentry SDK swallows throws (no infinite loop, no leak), but defense-in-depth wrap is legit XS fix. P3 plus juste.

#### [P3] AuthContext safety timer 8s : état corrompu si signup en cours (loading=false avant fetchProfile)

- **Où** : `src/contexts/AuthContext.tsx:68-72, 99-113`
- **Symptôme** : Le safetyTimer set loading=false sans clear le state user/session/profile. Si pendant ces 8s un signUp() pose une session via auth.signUp + le profile arrive 9s plus tard via onAuthStateChange, l'UI a déjà décidé 'pas connecté' et flickere vers 'connecté'. Surface pour MITM ralentissant fetchProfile.
- **Pourquoi (newcomer)** : Pour un newcomer mobile-first qui a 30s de patience, voir un état UI incohérent immédiatement après signup = abandon. Pas vraiment privacy/sécu mais availability + corner case auth confusing.
- **Fix** : Au lieu de juste setLoading(false), set un état explicite { state: 'timeout' } et afficher toast 'connexion lente, retry' avec bouton retry qui ré-appelle init(). Évite le flicker silencieux.
- **Effort** : S · **Impact** : faible
- **Verify** : Code confirme : safetyTimer L68-72 ne touche pas user/session/profile, et onAuthStateChange L99-113 peut flipper l'UI plus tard. Mais edge case UI pur (>8s lag) sans corruption ni privacy → P3 plus juste que P2.

#### [P3] Email confirmation désactivation manuelle casse handle_new_user silencieusement

- **Où** : `supabase/schema.sql:1340-1378`
- **Symptôme** : handle*new_user dépend de raw_user_meta_data.pseudo. Si admin active OAuth (Google) sans s'assurer que pseudo arrive, on tombe sur fallback 'user*<uuid>' silencieux. Le user croit avoir un compte normal mais son pseudo est bizarre.
- **Pourquoi (newcomer)** : Gotchas CLAUDE.md mentionne 'Email confirmation Supabase DOIT être activée' mais pas check côté code. Un newcomer admin qui désactive par exploration → casse silencieusement le flow signup.
- **Fix** : Dans handle*new_user, raise warning si pseudo manquant: 'if v_pseudo like \'user*%\' then raise warning' ou créer row dans audit_log pour visibilité admin des fallbacks anormaux.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Fallback silencieux confirmé (schema.sql:1353-1356) sans warning ni audit. Réel mais P3 — déclenchement requiert action admin spéculative (OAuth mal configuré) hors flow actuel, user peut rename via EditPseudoDialog.

#### [P3] Resend MAIL_FROM=onboarding@resend.dev : spam risk + brand confusion

- **Où** : `supabase/functions/send-notification/index.ts:43`
- **Symptôme** : MAIL_FROM default 'onboarding@resend.dev'. Domaine partagé Resend, SPF/DKIM signés par Resend mais visible 'via resend.dev' dans Gmail. Très probable spam-folder pour Outlook/Office365. ET un autre projet Resend qui spamme → reputation collapse pour PianoWorld aussi.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui ne reçoit jamais l'email de confirmation (spam) → abandon irrémédiable de l'onboarding selon persona 30s. En prod c'est bloquant.
- **Fix** : Avant go-live public, configurer un domaine custom dans Resend (mail.pianoworld.app), DNS DKIM+SPF+DMARC, et set MAIL_FROM=no-reply@mail.pianoworld.app. Effort 1h DNS + propagation.
- **Effort** : S · **Impact** : moyen
- **Verify** : Confirmé ligne 43 : MAIL_FROM default 'onboarding@resend.dev', domaine partagé Resend qui finit en spam Outlook/Office365 et risque deliverability collapse en prod. P3 et effort S réalistes pour un fix DNS pré-go-live.

#### [P3] Edge Function index.ts utilise console.error → erreurs muettes côté Sentry

- **Où** : `supabase/functions/send-notification/index.ts:154, 177, 281, 303`
- **Symptôme** : console.error utilisé 4 fois. Ces logs sortent dans Supabase Edge Function logs (rétention 7j free tier) mais ne montent JAMAIS vers Sentry — l'Edge n'importe pas @sentry/deno. Si Resend tombe ou DB en pause, les notifs ratent silencieusement.
- **Pourquoi (newcomer)** : Persona admin newcomer qui découvre 2 semaines plus tard 'pourquoi mes users ne reçoivent jamais leurs mails ?' = incident invisible. Pour réponse à incident, manquer les logs Edge = aveugle.
- **Fix** : Ajouter import Sentry Deno (npm:@sentry/deno) en haut de index.ts, init avec SENTRY_DSN_EDGE secret, et remplacer console.error par Sentry.captureException + console.error. Garde local debug + alerte automatique prod.
- **Effort** : S · **Impact** : moyen
- **Verify** : Verified at index.ts:154, 177, 231, 281, 303 — 5x console.error with zero Sentry/observability hookup in the Edge runtime, so Resend/DB failures sit only in 7d Supabase Edge logs as claimed.

#### [P3] is_banned : user banni peut continuer 5min avant que session client expire

- **Où** : `src/contexts/AuthContext.tsx:222-227`
- **Symptôme** : useEffect check profile.banned_at après chaque refresh get_my_profile, mais pas de Realtime subscription. Entre le moment où set_user_banned est appelé et le prochain refresh côté front, le user banni peut continuer 5min (cache TanStack Query, no realtime sur profile). RLS bloque les inserts via is_banned mais la session UI continue.
- **Pourquoi (newcomer)** : Newcomer admin qui bannit un harceleur immédiatement → le harceleur a 5min de window pour continuer à envoyer des friend_requests / créer des piano_visits avant que son AuthContext refresh.
- **Fix** : Soit (1) Realtime subscription sur profile.banned_at qui force signOut() instantané ; soit (2) côté set_user_banned, DELETE FROM auth.refresh_tokens WHERE user_id = target → force signOut au prochain page-load. Option 2 préférée (instant kill).
- **Effort** : M · **Impact** : moyen
- **Verify** : Confirmed at AuthContext.tsx:222-227 - banned check only fires on profile state change via onAuthStateChange (no Realtime, no polling). Banned user keeps UI session until token refresh. RLS blocks mutations but UI stays alive.

#### [P3] delete_my_account ne supprime PAS les photos storage du user

- **Où** : `supabase/schema.sql:1293-1309`
- **Symptôme** : delete_my_account DELETE FROM auth.users cascade sur profiles + dépendances FK. MAIS storage.objects n'a PAS de FK vers auth.users. Les photos sous {userId}/uuid.jpg restent dans le bucket public 'piano-photos' indéfiniment, accessibles via URL. Les rows pianos cascade mais les photos en storage restent orphelines.
- **Pourquoi (newcomer)** : Article 17 RGPD violation directe : le user a demandé l'effacement intégral, ses photos (potentiellement avec EXIF GPS) restent accessibles. Newcomer mobile-first qui supprime son compte croit que tout part. RGPD 'sans délai indu' ≠ jamais.
- **Fix** : Dans delete_my_account, AVANT DELETE FROM auth.users, faire 'DELETE FROM storage.objects WHERE bucket_id = \'piano-photos\' AND owner::uuid = uid'. Fallback : trigger AFTER DELETE ON auth.users qui purge storage par path prefix uid + '/'.
- **Effort** : S · **Impact** : fort
- **Verify** : Verifie schema.sql:1293-1309: delete_my_account ne supprime que auth.users. Bucket piano-photos public (l.124), photos sous {userId}/uuid.jpg (photo.ts:66). Aucun trigger storage. RGPD Art.17 viole, fix S correct.

#### [P3] friend_arriving payload : sender_pseudo + piano_address persistent dans outbox 30j

- **Où** : `supabase/schema.sql:2044-2054`
- **Symptôme** : Payload outbox contient sender_pseudo + piano_address en clair. SELECT gated admin, mais : (1) admin compromis voit toutes les sessions friends-only via dump outbox, (2) même après mark sent, la row outbox garde sender_pseudo + piano_address 30j → admin curieux voit 'qui est allé jouer où'.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui crée session friends-only 'Beaubourg samedi 21h' → admin sentinel voit l'info. Friends-only = privacy explicite, casser via outbox = trahit l'opt-in.
- **Fix** : Purger sender_pseudo + piano_address du payload APRÈS livraison (Edge Function : UPDATE notifications_outbox SET payload = payload - 'sender_pseudo' - 'piano_address' WHERE id = $1 AND status = 'sent'). Delivery déjà eu lieu, l'historique brûle.
- **Effort** : S · **Impact** : moyen
- **Verify** : Verifie schema.sql:2044-2054 confirme sender_pseudo + piano_address en clair dans payload, purge_old_notifications (l.1786) ne retire qu'apres 30j post-sent : fenetre de leak vers admin curieux reelle, fix UPDATE post-mark_sent trivial.

#### [P3] VITE_SENTRY_DSN exposé client-side : facile à abuser (spam Sentry quota)

- **Où** : `src/lib/sentry.ts:44-46`
- **Symptôme** : VITE_SENTRY_DSN build-time injected donc présent dans le JS bundle servi à anon. Un attaquant peut récupérer le DSN, POST des events directement vers https://\*.sentry.io → flooder le quota 5k events/mois. Sentry a rate-limit interne mais quota mensuel se prend dans la tête → admin perd toute observabilité.
- **Pourquoi (newcomer)** : Limitation Sentry par design mais valable de poser le risque. Newcomer admin qui surveille les errors via Sentry → quota épuisé = aveugle sur les vraies erreurs.
- **Fix** : Configurer Sentry SDK avec denyUrls + allowUrls qui filtre par origin (drop events qui n'ont pas notre app URL en window.location). Activer Sentry 'Inbound Filters > Events from same IP' côté server.
- **Effort** : S · **Impact** : faible
- **Verify** : DSN bien public côté bundle (sentry.ts:44-46) ; abus quota possible mais DSN est conçu comme public par Sentry, mitigation existe via Inbound Filters. P3/S calibré.

#### [P3] delete_my_account : verify_my_password seul (pas de 2FA même si MFA configurée)

- **Où** : `supabase/schema.sql:1293-1309`
- **Symptôme** : Re-auth password cohérent mais si l'user a configuré la 2FA Supabase (TOTP), delete_my_account ne demande PAS le second facteur. Un attaquant qui phish le password (mais pas le TOTP) peut détruire le compte. Cohérence : si on respecte la 2FA pour login, on devrait pour delete (irréversible).
- **Pourquoi (newcomer)** : Acknowledged backlog A.6.3. Quand implémentée, ne pas oublier delete_my_account dans le scope (et set_user_role, reply_to_request).
- **Fix** : Coupler avec A.6.3 : require_recent_mfa wrapper appelé en début de delete_my_account si l'user a une MFA factor. Si pas de factor, garder verify_my_password seul. Recommandation UI 'active la 2FA avant des actions irréversibles'.
- **Effort** : M · **Impact** : moyen
- **Verify** : Code confirme : delete_my_account ne vérifie que verify_my_password sans facteur MFA même si configuré ; cohérence avec A.6.3 backlog, P3 (dépend que l'user ait activé 2FA et que password soit phishé séparément).

#### [P3] ChangePasswordDialog : pas de signOut des autres devices après changement

- **Où** : `src/components/Settings/ChangePasswordDialog.tsx:78-90`
- **Symptôme** : Après auth.updateUser({ password }), la session courante reste valide ET les refresh tokens sur les autres devices/onglets aussi. Si l'user change son password précisément parce qu'un device est compromis, l'attacker garde la session active sur ce device.
- **Pourquoi (newcomer)** : Newcomer qui découvre 'mon compte a été hacké, je vais changer mon mdp' → ne déconnecte pas l'attaquant. Supabase recommande revokeAllOtherSessions après updateUser, non fait ici.
- **Fix** : Après updateUser success, appeler 'await supabase.auth.signOut({ scope: \'others\' })' pour invalider toutes les autres sessions. Garder la courante. Toast 'Mot de passe changé. Autres devices déconnectés.'
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirmed at lines 79-90: updateUser is called without signOut({scope:'others'}); compromised devices keep their session post-rotation. P3/XS sont calibrés.

#### [P3] CookieBanner : transparence CNIL OK mais pas de mention durée + finalité par cookie

- **Où** : `src/components/Layout/CookieBanner.tsx:57-67`
- **Symptôme** : Le bandeau dit 'cookies essentiels (session, préférences)' et renvoie à /legal#privacy. CNIL exige (reco 2020) que finalité + durée + destinataire de chaque cookie soient accessibles en 1 clic. /legal#privacy doit lister : sb-\* (session, 7j) / pianoworld:theme (illimité) / pianoworld:cookie-consent (1 an).
- **Pourquoi (newcomer)** : Newcomer mobile-first FR averti privacy lit le bandeau, clique 'En savoir plus', cherche la liste exacte → si absente, abandon perçu manque de sérieux. CNIL peut sanctionner même sans plainte.
- **Fix** : Ajouter une section 'Liste détaillée des cookies' dans /legal#privacy avec tableau : nom | finalité | durée | destinataire. Mettre à jour CookieBanner pour pointer vers '/legal#privacy-cookies-table'.
- **Effort** : S · **Impact** : faible
- **Verify** : Le bandeau renvoie bien vers /legal#privacy sans tableau detaille nom/finalite/duree/destinataire; la reco CNIL 2020 reste applicable meme pour cookies essentiels, donc finding legitime mais effectivement P3 mineur.

---

## 3. Doublons, features inutiles, gaps critiques

**Total : 30 findings** (1 P0, 4 P1, 13 P2, 12 P3)

### P0 — Bloquant (1)

#### [P0] AddFriendButton Accepter/Refuser inline casse - findPendingId stub retourne null

- **Où** : `src/components/Friends/AddFriendButton.tsx:55-61, 115-153`
- **Symptôme** : findPendingId retourne 'return null' en dur. Le newcomer qui consulte le profil de quelqu'un qui lui a envoye une demande voit Accepter/Refuser inline mais le clic n'aboutit qu'a un toast 'Reponds depuis Dashboard > Amis > Demandes recues'. Unique chemin, pas un fallback.
- **Pourquoi (newcomer)** : Le newcomer mobile-first decouvre l'app via lien partage, atterrit sur un profil, voit Accepter, clique, est renvoye en Dashboard avec 3 sous-tabs. Frustration immediate dans les 30s critiques.
- **Fix** : Implementer findPendingId reellement via useFriendRequests('received') (deja en cache): filtrer r.user_id === targetUserId. Sinon, supprimer les boutons inline et afficher juste un lien 'Repondre' qui deep-link Dashboard?tab=friends&sub=received.
- **Effort** : S · **Impact** : fort
- **Notes** : Bug fonctionnel + UX dead-end pour newcomer.
- **Verify** : Verified: AddFriendButton.tsx:55-61 findPendingId returns null en dur, donc les boutons Accepter/Refuser inline (lignes 115-152) tombent toujours sur le toast fallback. Dead-end UX confirmé pour newcomer. P0 et effort S corrects.

### P1 — Important (4)

#### [P1] Doublon Activite vs Communaute - newcomer confusion

- **Où** : `src/pages/Dashboard.tsx:78-103`
- **Symptôme** : Deux tabs sur cinq (Activite, Communaute) listent les memes evenements. useRecentFeed (15 items, +-36h sur sessions, inclut ajouts/MAJ) et useCommunityFeed (300 items, +-14j, visits+sessions sans ajouts) se chevauchent a 80%.
- **Pourquoi (newcomer)** : Le newcomer mobile-first avec 30s d'attention doit deviner la difference entre 'Activite recente' et 'Communaute'. Les deux contiennent les memes faces et adresses; les titres ne disent pas pourquoi cliquer ailleurs.
- **Fix** : Fusionner en une seule tab 'Activite' avec filtres (Tous / Live / Passages / Sessions) ou supprimer CommunityTab. Garder le calendrier comme vue secondaire dans Activite (toggle).
- **Effort** : M · **Impact** : fort
- **Notes** : Anti-feature candidate: CommunityTab dans sa forme actuelle.
- **Verify** : Confirmed: useRecentFeed and useCommunityFeed both pull piano_visits + piano_sessions with overlapping time windows, and Dashboard.tsx:78-79 puts both tabs adjacent without disambiguating labels — real friction for a 30s-attention newcomer.

#### [P1] Tab Evenements vide a vie pour 99% des users solo

- **Où** : `src/components/Events/EventsTab.tsx:22-32`
- **Symptôme** : useEvents(false) ne renvoie rien si aucun admin n'a cree d'event. EmptyState 'L'equipe organisera bientot quelque chose.' Une slot full-tab consommee pour un contenu admin-only quasiment jamais rempli en solo dev.
- **Pourquoi (newcomer)** : Le newcomer voit 5 tabs et clique par curiosite sur Evenements. Tomber sur un vide systematique devalue la barre entiere et installe l'idee que l'app est vide.
- **Fix** : Masquer la tab Evenements tant que events.length === 0 (ou la rendre visible qu'aux admins jusqu'au premier event). Alternativement fusionner Evenements dans Communaute en bandeau.
- **Effort** : S · **Impact** : moyen
- **Notes** : Anti-feature candidate dans la phase solo.
- **Verify** : Code confirme EventsTab.tsx:22-32 affiche un EmptyState systematique quand aucun admin n a cree d event ; en phase solo dev, l onglet est effectivement vide en permanence, ce qui devalue la navigation pour un newcomer.

#### [P1] Ghost-reject + cooldown 30j invisible - demandeur frustre

- **Où** : `src/components/Friends/FriendRequestCard.tsx:11-20`
- **Symptôme** : Commentaire explicite: 'Aucune notif n'est envoyee sur reject, donc le requester ne sait pas qu'il a ete refuse'. Cote DB friendship_rejections cree un cooldown 30j invisible. Le newcomer renvoie une demande -> P0001 rate_limit_exceeded ou erreur silencieuse -> confusion totale.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first: il pense 'mon clic n'a pas marche' et retente. Premier ami requis (sans amis jamais d'amis) -> friction critique sur le premier vrai cas d'usage social.
- **Fix** : Cote AddFriendButton: intercepter l'erreur cooldown specifique et afficher 'Tu pourras retenter dans X jours'. Ou exposer un statut pending_blocked dans get_friend_status pour afficher 'Indisponible' au lieu de 'Ajouter en ami'.
- **Effort** : M · **Impact** : fort
- **Verify** : Reject silencieux schema.sql:2241, raise forbidden 42501 schema.sql:2107, AddFriendButton.tsx:67 intercepte que rate limit.</reason> <parameter name="severity_correction">P1</parameter> <parameter name="effort_correction">M</parameter> </invoke>

#### [P1] EmptyState ActivityTab 0 piano - CTA discret en lien text-xs

- **Où** : `src/components/Dashboard/ActivityTab.tsx:99-113`
- **Symptôme** : Quand le feed est vide, EmptyState avec CTA 'Aller a la carte' rendu en lien text-xs. Comparativement aux 2 stats cards 0/0% en bloc visuel haut, l'invitation a agir est noyee.
- **Pourquoi (newcomer)** : Newcomer arrive par lien partage -> atterri sur Dashboard (route par defaut) -> voit '0 / 0%' -> conclusion: app vide je m'en vais.
- **Fix** : Remplacer le lien texte par un Button (variant default, taille md) avec icone Map + texte 'Ouvrir la carte'. Si total=0 proposer aussi bouton 'Ajouter le premier piano' qui ouvre AddPianoFlow directement.
- **Effort** : S · **Impact** : fort
- **Verify** : Confirme lignes 104-110: action EmptyState est un Link text-xs font-medium text-primary hover:underline (lien-texte) sous deux stat cards 0/0% dominantes. Risque reel d'abandon newcomer post-auth. P1 justifie.

### P2 — Amélioration (13)

#### [P2] Tab Mes demandes prend un slot pour usage tres rare

- **Où** : `src/pages/Dashboard.tsx:89-94`
- **Symptôme** : La 5e tab Mes demandes est un canal support/feedback. Pour un newcomer 1ere semaine, probabilite d'usage <2%. Slot tab paye en permanence sur barre TabsList scrollable a 360px.
- **Pourquoi (newcomer)** : Le newcomer mobile-first n'a aucune raison de cliquer la dans ses 30s. Le badge 'Nouvelle reponse' n'apparait jamais sur un premier usage.
- **Fix** : Deplacer Mes demandes dans SettingsPage (section Support). Garder un badge global si reponse non vue. Recupere un slot tab pour features utiles.
- **Effort** : M · **Impact** : moyen
- **Notes** : Anti-feature cote Dashboard.
- **Verify** : Le 5e tab Mes demandes existe bien (Dashboard.tsx:89-94) sur TabsList scrollable, peu pertinent pour newcomer 1ere semaine; mais TabsList scrollable attenue la friction donc P2 plus juste, et deplacement vers Settings + badge global = effort M.

#### [P2] SessionDialog promet une notif aux amis qui ne partira pas (0 ami)

- **Où** : `src/components/Piano/SessionDialog.tsx:193-244`
- **Symptôme** : Si friendsCount === 0, switch friends-only desactive et CTA 'ajoute-en d'abord' apparait (bon). Mais texte ligne 243 'Tes amis recevront une notification' s'affiche alors qu'aucune notif ne partira (0 ami). Mensonge UX involontaire.
- **Pourquoi (newcomer)** : Le newcomer mobile-first ne saisit pas le mental-model Visite vs Session. Texte promet un effet qui n'aura aucun effet en pratique pour un solo user.
- **Fix** : Conditionner le texte ligne 240-244: si friendsCount === 0, dire 'Tu peux y jouer maintenant. Ajoute des amis pour qu'ils soient notifies la prochaine fois.' au lieu de promettre des notifs qui ne partiront pas.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirme ligne 240-244: le texte fallback else affiche 'Tes amis recevront une notification' alors que si friendsCount===0 visibility reste 'public' par default et aucune notif ami ne partira. Mensonge UX reel. P2/XS coherents.

#### [P2] AddPianoFlow - confirm abandon trop sensible (coords seuls = dirty)

- **Où** : `src/components/Map/AddPianoFlow.tsx:70-72, 123-126, 356-385`
- **Symptôme** : isDirty s'active des qu'on a juste choisi des coords. Fermer = dialog 'Abandonner ?' systematique meme si l'user a juste clique une fois pour explorer.
- **Pourquoi (newcomer)** : Le newcomer qui explore par curiosite 'ajouter un piano' clique pour tester, change d'avis, ferme -> dialog de friction. Avec 30s d'attention il quitte l'app pas le formulaire.
- **Fix** : Elever le seuil isDirty: ne declencher la confirmation que si address ou comment ou photo ont ete remplis (pas juste les coords seuls). Coords sans rien d'autre = fermeture directe.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verified at src/components/Map/AddPianoFlow.tsx:70-71: isDirty inclut !!coords, donc tout tap sur "ma position" ou drag declenche le dialog d'abandon a la fermeture meme sans saisie utilisateur reelle.

#### [P2] Premier ami impossible sans amis - search par pseudo exact requis

- **Où** : `src/pages/SearchPage.tsx:36-73`
- **Symptôme** : USER_SEARCH_MIN_CHARS caracteres minimum sur le pseudo, donc le newcomer doit deja connaitre un pseudo PianoWorld pour ajouter quelqu'un. Aucune piste de decouverte.
- **Pourquoi (newcomer)** : Persona newcomer arrive via lien partage: il n'a aucun pseudo en tete. Donc fonctionnellement il ne peut pas se faire d'amis -> sessions friends-only deviennent inaccessibles -> feature backend orpheline.
- **Fix** : Court terme: afficher un placeholder d'exemples (top 3 contributeurs les plus actifs) sur SearchPage vide. Moyen terme: page Decouvrir avec users actifs recemment (limit 10).
- **Effort** : M · **Impact** : fort
- **Verify** : Confirme: SearchPage.tsx:27 demande un pseudo (min 2 chars) sans aucune piste de decouverte. Newcomer sans contact externe ne peut pas amorcer son reseau. P2 plus juste que P1 car app reste utilisable sans amis (carte publique).

#### [P2] Mental-model Visite vs Session pas explicite

- **Où** : `src/components/Piano/PianoActivity.tsx:27-30`
- **Symptôme** : VisitButton ('J'y suis passe') et SessionButton ('J'y vais') cote a cote. Aucun texte n'explique la difference (passe vs present-futur, public vs amis-notifie).
- **Pourquoi (newcomer)** : Persona 30s attention sur mobile: il choisit le premier bouton comprehensible et passe a cote du coeur social de l'app (sessions friends).
- **Fix** : Ajouter un micro-tooltip ou un sous-titre 1 ligne sous chaque bouton: 'Tu y es passe' (deja fait) vs 'Tu y vas maintenant' (en cours/planifie + visible amis).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirme: les deux boutons ('J'y suis passé' / 'J'y vais') sont juxtaposés sans aucun helper text dans PianoActivity.tsx:27-30, distinction passé/présent + broadcast social opaque pour newcomer 30s.

#### [P2] PianoUpdateForm - 3 champs alors qu'un seul suffirait au newcomer

- **Où** : `src/components/Piano/PianoUpdateForm.tsx:68-138`
- **Symptôme** : Le formulaire MAJ demande: encore la (Oui/Non obligatoire) + qualite (4 options optionnelles) + commentaire (textarea optionnelle + compteur). Pour un newcomer qui veut juste cocher Encore la, friction visuelle.
- **Pourquoi (newcomer)** : Newcomer mobile-first 30s: il appuie Oui et veut envoyer. La presence des 2 autres champs lui fait croire qu'il doit les remplir -> abandon.
- **Fix** : Restructurer en 2 etapes: 1) bouton bi-etat 'Encore la / Disparu' qui submit direct si rien d'autre touche. 2) Toggle 'Plus de details' (collapse) pour qualite + commentaire pour les power-users.
- **Effort** : M · **Impact** : moyen
- **Verify** : Code confirme 3 blocs visibles (lines 68-132); les "(optionnel)" mitigent mais le newcomer scanne en 30s et voit 3 champs - friction reelle. P2/M coherent.

#### [P2] Alerte doublon piano 50m trop discrete - newcomer cree des doublons

- **Où** : `src/components/Map/AddPianoFlow.tsx:250-261`
- **Symptôme** : Bloc orange 'Un piano existe deja a moins de 50m' apparait au-dessus de l'adresse, sans interruption ni scroll-into-view. Sur mobile 360px, l'utilisateur scroll vers le bouton Ajouter et ne le voit pas.
- **Pourquoi (newcomer)** : Le newcomer cree un doublon involontairement, ce qui pollue la carte et decoit les contributeurs existants.
- **Fix** : 1) auto-scroll vers le bloc warning quand nearbyDuplicate apparait. 2) Faire du bouton 'Ajouter ce piano' secondary + un primary 'Voir le piano existant' (lien /piano/:id du doublon).
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirme: bloc warning lignes 250-261 sans scrollIntoView ni CTA vers le piano existant, soft-tone "tu peux quand meme l'ajouter" - newcomer mobile scroll vers le bouton Ajouter sans voir l'alerte.

#### [P2] Feeds Dashboard figes - pas de refetchInterval

- **Où** : `src/hooks/useRecentFeed.ts:77-115`
- **Symptôme** : useActivePianoIds a refetchInterval (pulse map a jour). Mais useRecentFeed et useCommunityFeed n'ont pas de refetchInterval -> feeds figes tant que la fenetre n'a pas le focus.
- **Pourquoi (newcomer)** : Newcomer mobile qui ouvre Dashboard 30 minutes apres pour voir 'qui joue' verra des infos figees. L'attente d'une vie en temps reel n'est pas honoree.
- **Fix** : Ajouter refetchInterval: 60_000 sur useCommunityFeed (src/hooks/useCommunityFeed.ts) et useRecentFeed (ou refetchOnWindowFocus).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirmed: useRecentFeed (line 78) and useCommunityFeed (line 49) declare useQuery without refetchInterval ni refetchOnWindowFocus explicite, donc feeds figes hors focus tab; fix XS realiste, P2 approprie pour newcomer revenant 30 min plus tard.

#### [P2] PianoShareButton - aucun partage de l'app elle-meme

- **Où** : `src/pages/PianoPage.tsx:148-152`
- **Symptôme** : Le bouton Partager n'existe que dans la page detail d'un piano. Aucune action de partage de l'app elle-meme (Dashboard, MapPage). Mecanisme viral limite.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first vient via un lien partage -> mais lui-meme n'aura pas l'idee de partager l'app puisque rien ne le suggere.
- **Fix** : Ajouter un partage app-wide soit dans NavBar soit dans SettingsPage 'Partager PianoWorld'. URL = origin + texte 'Decouvre la carte des pianos publics autour de toi'.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verifie: PianoShareButton est uniquement en src/pages/PianoPage.tsx:151, aucun partage app-wide dans SettingsPage ni NavBar - finding correct, severity P2 et effort XS coherents.

#### [P2] NotificationPreferences - 5 toggles + push opt-in trop fine, sans preset

- **Où** : `src/components/Settings/NotificationPreferences.tsx:85-120`
- **Symptôme** : Le newcomer arrive sur 5 toggles regroupes en 4 sections + 1 toggle push + 1 ligne d'etat. Aucun preregelage 'minimal/normal/tout'. Tout ON par defaut cote DB.
- **Pourquoi (newcomer)** : Newcomer mobile-first ecran 360px: long scroll pour finir sur push opt-in qui requiert permission navigateur. Friction decourageante pour aller chercher le push qui est le vrai canal mobile.
- **Fix** : 1) Promouvoir push opt-in en haut, avant les categories. 2) Ajouter 3 boutons radio en tete 'Essentiel / Normal (defaut) / Tout' qui presetent les 5 toggles. Le detail reste en accordeon.
- **Effort** : M · **Impact** : moyen
- **Verify** : Code confirme: 4 sections + 5 toggles puis push opt-in en dernier (lignes 87-120), aucun preset, scroll long sur 360px avant d'atteindre le vrai canal mobile (push). Severity/effort coherents.

#### [P2] Premier ajout piano - geoloc immediate sans pre-explication

- **Où** : `src/components/Map/AddPianoFlow.tsx:227-247`
- **Symptôme** : A l'ouverture, AddPianoFlow montre carte vide + bandeau 'Clique sur la carte ou utilise Ma position'. Ma position = appel navigator.geolocation -> prompt systeme. Pas de pre-explication 'On va te demander ta position pour...'.
- **Pourquoi (newcomer)** : Newcomer mobile-first refuse souvent la geoloc par mefiance native. Si refus -> flow inutilisable sans expliquer comment cliquer sur la carte.
- **Fix** : Pre-affichage 'On va te demander ta position pour pre-remplir l'adresse. Tu peux refuser et cliquer directement sur la carte.' sous le titre. Bouton Ma position devient secondary, Clic sur la carte devient l'option par defaut.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Verified: bouton 'Ma position' (line 227-239) declenche navigator.geolocation sans pre-explication; le hint 'Clique sur la carte' (line 244-247) est discret et apparait apres. Friction reelle pour newcomer mobile qui refuse la geoloc.

#### [P2] SettingsPage long scroll - Se deconnecter sous la ligne, Zone dangereuse loin

- **Où** : `src/pages/SettingsPage.tsx:200-222`
- **Symptôme** : 7 sections empilees. Le newcomer qui veut juste se deconnecter doit scroller au-dela de Compte/Social/Notifications/Apparence/Donnees/[Admin]. Bouton Supprimer mon compte encore plus bas.
- **Pourquoi (newcomer)** : Newcomer perdu sur la deconnexion -> friction. La section Zone dangereuse tout en bas est tres loin sur 360px.
- **Fix** : Remonter Session au-dessus de Donnees (RGPD). Ou ajouter une icone de deconnexion dans le header de SettingsPage (top-right).
- **Effort** : XS · **Impact** : faible
- **Verify** : Confirme: Session (signOut) en ligne 200 sous Compte/Social/Notifications/Apparence/Donnees/[Admin], Zone dangereuse encore plus bas ligne 215 - friction reelle pour newcomer mobile 360px qui veut juste se deconnecter.

#### [P2] MyRequestsTab pas relie au flow newcomer - bruit permanent

- **Où** : `src/components/Requests/MyRequestsTab.tsx:17-54`
- **Symptôme** : Bouton Nouvelle demande en haut a droite. EmptyState sans CTA. Newcomer n'a aucune raison d'ouvrir cette tab. La preference notify_request_reply (toggle dans Settings) regle quelque chose qui n'arrive jamais.
- **Pourquoi (newcomer)** : Persona newcomer ne deviendra utilisateur de support qu'en derniere extremite. Le bouton Nouvelle demande visible permanent + le toggle Settings deviennent du bruit pour 99% des users la 1ere semaine.
- **Fix** : 1) Deplacer cette tab dans Settings ou en bouton 'Besoin d'aide ?' en bas de SettingsPage. 2) Garder le toggle notify_request_reply dans le preset 'Tout' uniquement, hors de la preset Normal.
- **Effort** : S · **Impact** : faible
- **Notes** : Anti-feature visibilite: tab Mes demandes n'a pas sa place en hub principal.
- **Verify** : Code confirme : bouton 'Nouvelle demande' permanent en haut, EmptyState sans CTA contextuel, aucun lien avec le flow newcomer ; severity P2 et effort S coherents.

### P3 — Backlog / idée (12)

#### [P3] Tutorial 100% passif - lecture pure sans action et non relancable

- **Où** : `src/components/Onboarding/Tutorial.tsx:6-27, 75-93`
- **Symptôme** : 4 slides texte puis bouton Commencer ferme le modal. Aucune action concrete pendant ou apres. Pas de relance possible (TUTORIAL_STORAGE_KEY a vie).
- **Pourquoi (newcomer)** : Le newcomer mobile-first 30s d'attention: 4 slides a lire = 15-25s avant interaction. Souvent il 'Passe' (ligne 88) et l'apprentissage est perdu. Pas de re-declenchement depuis Settings.
- **Fix** : 1) Reduire a 2 slides max OU passer en tooltips contextuels. 2) Ajouter un CTA final qui ouvre AddPianoFlow directement. 3) Bouton 'Revoir le tutoriel' dans SettingsPage qui supprime TUTORIAL_STORAGE_KEY et redirige /map.
- **Effort** : M · **Impact** : fort
- **Verify** : Confirme: 4 slides passifs (lignes 6-27), aucun CTA d'action, close()/Passer ecrit TUTORIAL_STORAGE_KEY de maniere definitive (ligne 44) sans aucune entree dans SettingsPage pour relancer.

#### [P3] Aucun feedback positif post-action (XP, badges, animation)

- **Où** : `src/components/Piano/VisitButton.tsx:34-39`
- **Symptôme** : Apres 'J'y suis passe': toast.success('Passage enregistre') + bouton 'Enregistre' 3s. Idem pour Session. Aucun feedback retrocompensatoire (compteur personnel, achievements, anim).
- **Pourquoi (newcomer)** : Persona newcomer mobile-first qui decouvre une app communautaire: il a besoin de dopamine immediate pour valider que son geste compte. Le toast neutre ne motive pas le 2e usage.
- **Fix** : A minima: afficher dans le toast 'Passage enregistre, +1 piano visite (3 au total)' avec agregat user. Plus tard: page profil 'Mes passages', petit badge +1 qui s'envole vers la NavBar.
- **Effort** : M · **Impact** : moyen
- **Verify** : Confirmé lignes 34-39 : toast neutre + cooldown 3s sans agrégat ni gamification. Légitime pour newcomer mais c'est un nice-to-have d'engagement, pas un blocage UX → P3 plus juste que P2.

#### [P3] PianoReportButton volontairement discret - OK ne pas modifier

- **Où** : `src/components/Piano/PianoReportButton.tsx:49-55`
- **Symptôme** : Bouton Signaler en text-xs muted-foreground sous Partager. Discret par design (anti-spam).
- **Pourquoi (newcomer)** : Persona newcomer pas concerne: il n'a aucun contexte pour juger un piano abusif. La discretion est volontaire et adaptee.
- **Fix** : Pas de fix. A NE PAS rendre plus visible. Garder tel quel.
- **Effort** : XS · **Impact** : faible
- **Notes** : Anti-feature de promotion: ne PAS mettre en avant Signaler.
- **Verify** : Le bouton est bien volontairement discret (text-xs muted-foreground) et le finding recommande de NE PAS modifier — auto-cohérent et correct pour un newcomer sans contexte d'abus.

#### [P3] Aucun undo destructive - retirer ami, supprimer piano, push off

- **Où** : `src/components/Friends/RemoveFriendDialog.tsx:33-43`
- **Symptôme** : removeFriend execute direct via RPC remove_friendship, sans undo dans toast. Idem pour desabonner push, supprimer piano. Le confirm textuel 'retirer' compense partiellement mais n'offre pas de retour arriere.
- **Pourquoi (newcomer)** : Newcomer mobile-first a 30s d'attention peut taper retirer par mimetisme. Un undo de 5s aurait evite la perte. Pour push: opt-out involontaire definitif jusqu'a nouvelle permission navigateur.
- **Fix** : Pour removeFriend: toast avec action Annuler qui re-send la friendship request automatiquement (5s timeout). Pour push deja OK car re-toggle re-declenche subscribeToPush.
- **Effort** : M · **Impact** : faible
- **Verify** : Code confirme: removeFriend fire direct RPC sans undo (l.36-39), toast success sans action. Mais friction typed-confirm + reversibilite explicite ("nouvelle demande a tout moment") degradent le risque newcomer; P3 plus juste.

#### [P3] FriendsTab - 3 sous-tabs alors que Envoyees rarement consulte

- **Où** : `src/components/Friends/FriendsTab.tsx:43-67`
- **Symptôme** : Le newcomer ouvre FriendsTab -> voit 3 sous-tabs avec compteurs. Le tab Envoyees n'a d'interet qu'au cas ou l'user veut annuler une demande - usage rare. Slot pris.
- **Pourquoi (newcomer)** : Sur mobile 360px, 3 sous-tabs raccourcissent l'espace de contenu. Le newcomer cherche comment ajouter un ami qui est masque dans EmptyState apres scroll.
- **Fix** : Fusionner Envoyees en accordeon discret en bas de Mes amis (sous-titre 'X demandes en attente, voir'). Garder uniquement Mes amis + Recues en tabs principales.
- **Effort** : S · **Impact** : faible
- **Verify** : Le code confirme 3 sous-tabs (lignes 43-67) sur Tabs scrollable mobile; l'observation est correcte mais l'impact reste cosmetique car TabsList est scrollable et 'Mes amis' contient deja le CTA EmptyState - degrade en P3.

#### [P3] VisitButton vs PianoUpdateForm still_there - redondance semantique

- **Où** : `src/components/Piano/VisitButton.tsx:46-57`
- **Symptôme** : VisitButton 'J'y suis passe' enregistre un piano_visit. PianoUpdateForm a un toggle 'Le piano est-il toujours la ? Oui/Non' produit un piano_update. Pour le newcomer, 'je suis passe devant et il est encore la' devrait etre un seul geste - aujourd'hui c'est 2 formulaires.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first qui passe devant un piano veut signaler en 1 clic. Forcer 'J'y suis passe' PUIS 'Mise a jour > Oui > Enregistrer' double la friction.
- **Fix** : Sur PianoPage, apres 'J'y suis passe' reussi, proposer dans le toast une action 'Encore la ?' (Yes/No quick) qui insere le piano_update directement. Evite la friction du 2e formulaire pour 95% des cas.
- **Effort** : M · **Impact** : moyen
- **Verify** : Redondance confirmée (VisitButton:46-57 = 1 clic, PianoUpdateForm:33-65 = form multi-champs avec still_there required). Friction réelle mais sémantiques distinctes (audit vs mutation) — nice-to-have, pas blocker, P3 plus juste.

#### [P3] Tab Mes demandes label peu accrocheur - confusion avec demandes d'amis

- **Où** : `src/pages/Dashboard.tsx:89-94`
- **Symptôme** : Label 'Mes demandes' pour un user qui n'en a jamais envoye = vide de sens. Confusion avec demandes d'amis (tab Amis juste a cote).
- **Pourquoi (newcomer)** : Persona newcomer mobile-first lit Mes demandes et pense aux demandes d'amis. Confusion lexicale.
- **Fix** : Renommer 'Aide & feedback' ou 'Support' (label conforme a la finalite reelle).
- **Effort** : XS · **Impact** : faible
- **Verify** : Tab 'Mes demandes' (L89-94) collé au tab 'Amis' (L81-88) qui affiche déjà un badge de friend requests : confusion lexicale plausible pour un newcomer. P3/XS calibrés correctement (simple renommage).

#### [P3] AddFriendButton pending_received sans contexte d'origine

- **Où** : `src/components/Friends/AddFriendButton.tsx:106-159`
- **Symptôme** : Sur la page d'un user qui m'a envoye une demande, je vois Accepter/Refuser mais aucun rappel '@X t'a envoye une demande il y a 2 jours'. Le contexte vient de la tab Recues, pas du profil.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first qui decouvre le profil de quelqu'un (via lien partage d'un piano) voit deux boutons sans comprendre pourquoi Accepter. Acte volontaire transforme en clic involontaire.
- **Fix** : Au-dessus des boutons, micro-bandeau 'Tu as recu une demande de @pseudo il y a X' pour donner le contexte.
- **Effort** : S · **Impact** : faible
- **Verify** : Code confirme: deux boutons Accepter/Refuser sans contexte explicatif sur le profil. Pour un newcomer, l'absence de rappel "X t'a envoye une demande" rend le clic confus. P3 plus juste car edge case visite directe.

#### [P3] Doublon SettingsPage - lien Amis vs Tab Amis Dashboard

- **Où** : `src/pages/SettingsPage.tsx:129-147`
- **Symptôme** : Section Social > Mes amis redirige vers /dashboard?tab=friends. 2 chemins vers la meme chose. La section Settings Social n'a qu'une ligne.
- **Pourquoi (newcomer)** : Persona newcomer pas penalise (2 chemins = pas de cul-de-sac) mais surcharge cognitive et hauteur scroll Settings inutile.
- **Fix** : Supprimer la section Social de SettingsPage (les amis vivent dans Dashboard). Ou la fusionner avec Notifications. Recupere de la hauteur.
- **Effort** : XS · **Impact** : faible
- **Notes** : Anti-feature: section Social a une ligne dans Settings.
- **Verify** : Confirmed: SettingsPage.tsx:129-147 contient une section "Social" a une seule ligne qui redirige vers /dashboard?tab=friends, doublon de surface avec le tab Amis du Dashboard.

#### [P3] Compteur de caracteres AddPianoFlow comment - micro-friction permanente

- **Où** : `src/components/Map/AddPianoFlow.tsx:340-342`
- **Symptôme** : Compteur '0/PIANO_COMMENT_MAX' affiche en permanence sous le textarea. Limite rarement atteinte par un newcomer; la jauge induit une pression a remplir.
- **Pourquoi (newcomer)** : Persona newcomer mobile-first: commentaire obligatoire (asterisque rouge ligne 331) mais aucune indication 'minimum X mots'. Le compteur cumule pousse a ecrire long.
- **Fix** : N'afficher le compteur qu'au-dela de 80% de la limite. Avant, juste un placeholder enrichi 'Ex: ouvre 7j/7, acces libre, interieur'.
- **Effort** : XS · **Impact** : faible
- **Verify** : Code confirme: compteur permanent lignes 340-342, asterisque obligatoire ligne 331, aucun minimum indique - micro-friction reelle mais marginale, P3/XS justifies.

#### [P3] useRecentFeed - 4 requetes parallel + merge client, scale latent

- **Où** : `src/hooks/useRecentFeed.ts:84-115`
- **Symptôme** : 4 requetes Supabase independantes pour ajouts/MAJ/visits/sessions, fusionnees et triees cote client puis slice(limit). Commentaire propre l'avoue.
- **Pourquoi (newcomer)** : Pas un risque newcomer immediat mais une page Dashboard qui charge en >1.5s sur 4G degradee (~4 RTT a Supabase eu-west-3) ennuie quand le persona n'a que 30s avant abandon.
- **Fix** : Court terme OK. Moyen terme: creer une RPC get_recent_feed(limit) qui fait l'union SQL et retourne deja trie.
- **Effort** : M · **Impact** : faible
- **Verify** : Code confirme: 4 requetes parallel + merge/sort/slice client (lignes 84-115, 158-159), commentaire l'avoue (70-72). Severite P3 et effort M corrects pour une RPC SQL UNION.

#### [P3] Search par pseudo case-insensitive substring - pas de tolerance typo

- **Où** : `src/pages/SearchPage.tsx:50-73`
- **Symptôme** : useUserSearch fait probablement un ilike '%query%'. Pas de fuzzy/typo tolerance. Pseudos sensibles a la frappe au doigt.
- **Pourquoi (newcomer)** : Newcomer mobile-first tape avec doigt -> typo frequente. Un seul caractere faux = Aucun resultat.
- **Fix** : Tolerer typos via pg_trgm similarity() cote RPC, ou normalisation Unicode + retrait des accents avant ilike. Faible priorite MVP newcomer.
- **Effort** : L · **Impact** : faible
- **Verify** : Confirmed src/hooks/useUsers.ts:26 uses .ilike('pseudo', `%${trimmed}%`) with no fuzzy matching; mobile typos do yield zero results. P3/L are accurate (substring ilike already absorbs many partials, full trigram fix needs DB work).

---

## 4. Compréhension, vocabulaire, mental model

**Total : 30 findings** (0 P0, 3 P1, 15 P2, 12 P3)

### P1 — Important (3)

#### [P1] Combo Visit (Passage) + Session (J'y vais) déroutant pour newcomer

- **Où** : `src/components/Piano/PianoActivity.tsx:27-30`
- **Symptôme** : Deux boutons côte-à-côte : 'J'y suis passé' (VisitButton ligne 55) et 'J'y vais' (SessionButton ligne 13). Sans contexte, on ne saisit pas que l'un est rétrospectif et l'autre prospectif. Le mot 'passage' est ambigu.
- **Pourquoi (newcomer)** : Newcomer mobile-first 30s avant abandon : il voit deux CTAs proches, clique au hasard, crée une mauvaise donnée et perd confiance. C'est le coeur de la valeur communautaire — mal expliqué, la feature meurt.
- **Fix** : Étiqueter avec verbes différenciés : 'J'y suis allé jouer' (visit) vs 'Je prévois d'y jouer' (session). Ajouter mini légende 'Maintenant ou plus tard ?' ou regrouper dans un seul flow 'Ajouter une présence' avec radio passé/futur.
- **Effort** : M · **Impact** : fort
- **Verify** : Confirmed at PianoActivity.tsx:27-30: VisitButton ("J'y suis passé", Footprints) and SessionButton ("J'y vais", CalendarPlus) sit side-by-side with similar weight; the past/future distinction is subtle in FR and ambiguous for a 30s newcomer.

#### [P1] VisitButton 'J'y suis passé' contredit ActivityTab 'a joué ici'

- **Où** : `src/components/Piano/VisitButton.tsx:55`
- **Symptôme** : Bouton 'J'y suis passé' mais feed Dashboard rend 'a joué ici' (ActivityTab.tsx ligne 216). Label CTA suggère un simple passage alors que le feed traduit en 'joué' (action musicale). Privacy dit 'passages' (générique).
- **Pourquoi (newcomer)** : Newcomer non-musicien clique 'J'y suis passé' pour signaler qu'il a vu le piano (ne sait pas jouer) — mais son nom apparaît ensuite comme 'a joué ici' dans le feed. Faux témoignage involontaire frustrant.
- **Fix** : Aligner sur un verbe neutre : 'J'y suis passé' partout (feed inclus), OU si l'intention est 'a joué', renommer le bouton 'J'y ai joué' + valider qu'un non-musicien comprend que ce n'est pas pour lui.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Confirmed: VisitButton.tsx:55 dit "J'y suis passé" (icone Footprints = passage) tandis qu'ActivityTab.tsx:216 affiche "a joué ici" pour le meme visit event — incoherence reelle qui peut faire passer un newcomer non-musicien pour quelqu'un qui a joue.

#### [P1] Favori vs Bookmark vs Suivre v7 : label final pas tranché

- **Où** : `src/types/database.ts:97-99`
- **Symptôme** : Trois termes mélangés : notify_favorite_update (99) + commentaire 'piano que je suis (favori)' (98) + templates.ts ligne 264 'piano que tu suis' + ligne 276 'MAJ sur un piano que tu suis 🔖' (icône bookmark).
- **Pourquoi (newcomer)** : Newcomer cherche 'Favoris' (réflexe iOS Safari/Insta). Si la PR-B introduit un bouton 'Suivre' (verbe Twitter) il devra deviner que c'est l'équivalent. Trois mots = trois mental models différents.
- **Fix** : Trancher avant PR-B : 'Favoris' (substantif neutre, étoile pictogram). Remplacer 'tu suis' dans templates.ts par 'que tu as mis en favori'. Renommer label notify_favorite_update dans constants.ts en 'Mise à jour d'un piano favori'.
- **Effort** : S · **Impact** : fort
- **Verify** : Confirmé : templates.ts:264,276 dit "tu suis 🔖" alors que database.ts:98 commente "favori" et la clé est notify_favorite_update — 3 modèles mentaux pour newcomer avant PR-B. À trancher.

### P2 — Amélioration (15)

#### [P2] Quality labels Désastreux / Potable subjectifs sans guidance

- **Où** : `src/types/database.ts:18-25`
- **Symptôme** : QUALITY_LABELS expose 'Neuf', 'Bon état', 'Potable', 'Désaccordé', 'Désastreux', 'Autre' sans description. Aucune tooltip dans AddPianoFlow (308-327) ni MapFilters (65-86). Newcomer hésite entre 'Potable' et 'Désaccordé'.
- **Pourquoi (newcomer)** : Le newcomer mobile-first non-pianiste ne sait pas évaluer un piano. Sans guidance (touches collantes ? désaccord ?), il choisit au pif et la donnée devient bruit. Risque d'abandon de la création par peur de mal noter.
- **Fix** : Ajouter une description sous chaque label (ex: 'Désaccordé : sonne faux mais jouable', 'Désastreux : touches cassées'). Renommer 'Désastreux' en 'Hors service' (factuel). Exposer hint via popover dans AddPianoFlow et MapFilters.
- **Effort** : S · **Impact** : fort
- **Verify** : Labels sans description confirmés (database.ts:18-25, AddPianoFlow:308-327, MapFilters:65-86). Vraie ambiguïté Potable/Désaccordé pour newcomer non-pianiste, mais clarté pas blocage flow → P2 plus juste que P1.

#### [P2] 'Encore là' / 'Disparu' présence binaire trop tranchée

- **Où** : `src/components/Map/MapFilters.tsx:92-98`
- **Symptôme** : Filtre Présence : Tous / Encore là / Disparus. PianoUpdateForm 'Le piano est-il toujours là ?' Oui/Non. Pas de nuance pour 'déplacé', 'sous bâche', 'inaccessible'. ActivityTab ligne 182 affiche 'Disparu' comme fait absolu.
- **Pourquoi (newcomer)** : Newcomer voit piano marqué 'Disparu' (opacité 0.5 PianoMap.tsx 146), pense qu'il faut l'ignorer. Or la personne précédente s'est peut-être trompée. Mental model 'binaire éternel' ne reflète pas la réalité d'un piano public.
- **Fix** : Renommer 'Disparu' en 'Signalé absent' (factuel, daté). Ajouter '(dernier passage : il y a Xj)' à côté du label dans PianoHistory. Filtre : 'Tous / Présents / Absents (récemment)'.
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirmé (MapFilters.tsx:95-96 + PianoMap.tsx:146 opacité 0.5). Binaire éternel trompe le newcomer (un piano peut être temporairement bâché). Mais wording/nuance, pas blocage fonctionnel → P2 plus juste que P1.

#### [P2] Dashboard tab 'Mes demandes' ambigu : feedback admin vs amitié

- **Où** : `src/pages/Dashboard.tsx:89-94`
- **Symptôme** : Onglet 'Mes demandes' (ligne 91) côtoie 'Amis' (ligne 81) qui contient 'Demandes reçues/envoyées' (FriendsTab lignes 53,60). Le mot 'Demandes' apparait deux fois, confusion friendship vs support.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui veut accepter une demande d'ami clique 'Mes demandes' (intuition), tombe sur le support form, repart confus. Pire si une notif 'Réponse à ta demande' arrive : il pense que c'est un ami.
- **Fix** : Renommer 'Mes demandes' en 'Support' ou 'Aide & contact'. OU dans FriendsTab renommer 'Reçues/Envoyées' en 'Invitations reçues/envoyées'.
- **Effort** : XS · **Impact** : fort
- **Verify** : Verifie: Dashboard.tsx:89-94 affiche 'Mes demandes' juste a cote de 'Amis' (l.81) qui contient 'Recues/Envoyees' (FriendsTab l.53,60) — ambiguite reelle pour newcomer, mais impact modere (badge rare) donc P2 plus juste que P1.

#### [P2] Pseudo vs first_name/last_name v7 : ordre/typo non documenté

- **Où** : `src/types/database.ts:43-55`
- **Symptôme** : Profile expose pseudo + first_name + last_name (lignes 46, 52-54) mais aucun composant FR n'affiche encore les noms. UserSearchResult (254-260) prévoit first/last. Convention d'ordre 'Prénom Nom' vs 'Nom Prénom' non fixée. Pas de label centralisé.
- **Pourquoi (newcomer)** : Quand PR-B intégrera l'affichage, risque d'incohérence : '@pseudo (Prénom NOM)' vs '@pseudo · Nom Prénom'. Newcomer FR attend 'Prénom Nom' (convention française), pas 'Nom, Prénom' (admin). À fixer avant de coder l'UI.
- **Fix** : Ajouter dans constants.ts un helper formatFullName(first, last) qui renvoie 'Prénom NOM' (Prénom capitalisé + NOM majuscules style LinkedIn FR), null si les deux absents. Documenter convention dans CLAUDE.md.
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirmé : first_name/last_name sur Profile (52-54) et UserSearchResult (257-258), zéro usage UI, aucun helper formatFullName. Risque réel mais pré-emptif sans symptôme actuel → P2 plus honnête que P1.

#### [P2] getErrorMessage fallback 'Une erreur est survenue' sans next-step

- **Où** : `src/lib/errors.ts:31-44`
- **Symptôme** : Fallback générique 'Une erreur est survenue' (ligne 33) ne dit pas quoi faire. Aucune suggestion de retry, de vérifier la connexion, de réessayer dans X secondes.
- **Pourquoi (newcomer)** : Newcomer mobile-first en 4G qui voit ce message reste planté. Pas de mental model 'temporaire' vs 'cassé'. Patience 30s avant abandon : ce message tue la session.
- **Fix** : Remplacer fallback par 'Une erreur est survenue. Vérifie ta connexion et réessaie.' Standardiser tous les fallbacks call sites (VisitButton, SessionDialog, AddPianoFlow) avec un retry suggéré dans le toast.
- **Effort** : S · **Impact** : moyen
- **Verify** : Fallback générique confirmé ligne 33 sans next-step ; mais c'est un last-resort (la plupart des erreurs ont déjà un message), donc P2 plus juste que P1.

#### [P2] isRateLimitError toast 'réessaie demain' faux

- **Où** : `src/components/Friends/AddFriendButton.tsx:68-71`
- **Symptôme** : Toast 'Tu as envoyé trop de demandes aujourd'hui. Réessaie demain.' (70) — mais 'demain' n'est pas exact si la fenêtre est glissante 24h (RATE_LIMITS constants.ts 156). Wording pas réutilisé dans VisitButton, SessionDialog, AddPianoFlow.
- **Pourquoi (newcomer)** : Newcomer veut créer un piano et 2 sessions le même jour : il atteint piano_create (5/24h) et abandonne. Le 'demain' est faux : fenêtre redémarre 24h après la 1re action, pas à minuit. Pas de feedback de patience requise.
- **Fix** : Helper FR centralisé prenant action et formulant 'Limite atteinte pour {action} ({n} max par {window}). Réessaie dans X heures'. Utiliser RATE_LIMITS de constants.ts pour formatter dynamiquement.
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirme: toast dit "demain" mais RATE_LIMITS (constants.ts:149-157) declare fenetre glissante 24h — wording trompeur pour newcomer qui hit la limite en debut de journee.

#### [P2] Tutorial 4 slides sans mention 'Installer la PWA'

- **Où** : `src/components/Onboarding/Tutorial.tsx:6-27`
- **Symptôme** : Les 4 slides expliquent carte, ajouter, mettre à jour, et 'On y va !'. Aucune mention que PianoWorld s'installe en PWA. Pas d'explication des notifs push (qui nécessitent l'installation iOS — gotcha CLAUDE.md).
- **Pourquoi (newcomer)** : Newcomer mobile-first qui découvre via Safari iOS ne saura jamais qu'il peut installer l'app et recevoir des notifs. Il quittera après les 4 slides et oubliera PianoWorld faute de canal de re-engagement.
- **Fix** : Ajouter une 5e slide 'Ajoute PianoWorld à ton écran d'accueil pour recevoir des notifs quand un piano apparaît près de toi' avec lien vers instructions iOS/Android. Ou intégrer un prompt PWA dans NavBar.
- **Effort** : S · **Impact** : fort
- **Verify** : Code confirme 4 slides sans aucune mention PWA/notifs; gap réel pour newcomer iOS Safari qui ne saura jamais installer (gotcha CLAUDE.md confirme iOS push = PWA install obligatoire).

#### [P2] Tutorial slide 3 'Mets-le à jour' ambigu sur l'objet

- **Où** : `src/components/Onboarding/Tutorial.tsx:17-21`
- **Symptôme** : 'Mets-le à jour' avec text 'Quand tu passes devant un piano, indique s'il est toujours là'. Le pronom 'le' n'a pas d'antécédent (la carte ? le piano ? ma position ?). Concept 'mise à jour du piano par un tiers' nouveau.
- **Pourquoi (newcomer)** : Newcomer mobile-first non habitué aux apps communautaires (Wikipédia, OSM) ne comprend pas qu'il peut éditer la donnée d'autrui. Slide passée trop vite, action principale loupée.
- **Fix** : Titre : 'Mets à jour les pianos vus'. Texte : 'Quand tu croises un piano cartographié, signale s'il est toujours là, son état, et laisse un commentaire pour la communauté.'
- **Effort** : XS · **Impact** : moyen
- **Verify** : Vérifié L19-20 : titre "Mets-le à jour" sans antécédent dans le slide (le pronom renvoie au slide précédent), et l'idée d'éditer la donnée d'autrui n'est pas formulée. Gap réel pour newcomer non habitué aux apps communautaires.

#### [P2] MapFilters 'Disparus' ambigu : soft-deleted ou MAJ négative ?

- **Où** : `src/components/Map/MapFilters.tsx:92-114`
- **Symptôme** : Filtre 'Présence > Disparus' (96) affiche still_there=false. Un piano peut aussi être is_deleted=true (admin force_delete). Les deux états sont mélangés dans la conscience du user. PianoMap 146 ajoute opacity 0.5 sans légende.
- **Pourquoi (newcomer)** : Newcomer qui filtre 'Disparus' espère retrouver des pianos signalés absents (pour aller vérifier soi-même). Si rien ne s'affiche, il ne sait pas si c'est zéro résultat ou un bug.
- **Fix** : Renommer 'Disparus' en 'Signalés absents'. Ajouter tooltip explicatif : 'Pianos qu'un membre a indiqués comme absents lors de sa dernière visite.' Mention dans empty state quand 0 résultat.
- **Effort** : S · **Impact** : moyen
- **Verify** : Label "Disparus" est effectivement ambigu pour newcomer (file:line confirmés), mais is_deleted est filtré par RLS donc pas de vrai mélange d'états — c'est purement un problème de wording/clarté, ce qui justifie P2 plutôt que P1.

#### [P2] PianoPresenceCounter 'X session(s) en cours' compte sessions, pas humains

- **Où** : `src/components/Piano/PianoPresenceCounter.tsx:52-53`
- **Symptôme** : Label `${live.length} session${live.length > 1 ? 's' : ''} en cours` (52). Un piano avec 3 sessions simultanées affichera '3 sessions en cours' — l'user pense 'piano joué 3 fois ces derniers jours', pas '3 personnes jouent en ce moment'.
- **Pourquoi (newcomer)** : Newcomer voit '2 sessions en cours' et croit que c'est de l'historique. Le concept 'session' (technique) ne véhicule pas le live de 'pianistes présents'.
- **Fix** : Reformuler en humain : '{n} pianiste(s) joue(nt) actuellement' ou '{n} personne(s) au piano en ce moment'. Réserver le mot 'session' à l'UI de création (SessionDialog déjà 'J'y vais').
- **Effort** : XS · **Impact** : moyen
- **Verify** : Label ligne 52 utilise 'session(s)' technique ; pour newcomer, ça évoque historique pas présence live. Reformuler en 'pianiste(s) joue(nt)' clarifie. P2/XS justes (one-liner, non-bloquant).

#### [P2] Mail subject friend_arriving > 80 chars dépasse preview mobile

- **Où** : `PianoWorld/supabase/functions/send-notification/templates.ts:224`
- **Symptôme** : Subject `@${senderPseudo} ${verb} au piano de ${pianoAddress}` (224) : pseudo 30 chars + adresse jusqu'à 500 chars (PIANO_ADDRESS_MAX) atteint 100+ chars. HEADER_MAX_LENGTH=180 (35) tronque trop tard pour Gmail iOS (~70 chars).
- **Pourquoi (newcomer)** : Newcomer reçoit la notif sur iPhone Gmail/Mail : preview montre '@enzo joue actuellement au piano de 1 rue de la Tronchet…' tronqué, il ne voit pas le piano. Avec adresse longue le sens disparait.
- **Fix** : Réordonner pour mettre l'info actionnable en tête : `@${senderPseudo} joue maintenant — ${shortAddress}` où shortAddress prend les 40 premiers chars de pianoAddress. Appliquer aussi à piano_favorite_update (264).
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirme : ligne 224 concatène pseudo (30 max) + verb (jusqu'à 17 chars) + " au piano de " (13) + pianoAddress (jusqu'à 500), HEADER_MAX_LENGTH=180 tronque bien après le seuil ~70 chars de preview Gmail iOS ; même problème ligne 264.

#### [P2] ConfirmPending : 'Vérifie tes spams' message tardif

- **Où** : `src/components/Auth/ConfirmPending.tsx:39-58`
- **Symptôme** : Message ligne 59 dit 'Clique sur le lien dans l'email pour activer ton compte'. Mention des spams uniquement dans le toast post-resend (39), pas dès l'écran initial. Cooldown 60s (41) pas annoncé avant clic.
- **Pourquoi (newcomer)** : Newcomer mobile-first qui ne voit pas l'email dans sa boite (souvent dans spam Gmail première fois Resend) attend, retape inscription, double-compte. Le bouton 'Renvoyer (60s)' apparait seulement après clic, frustrant.
- **Fix** : Texte initial : 'Pense à vérifier tes spams.' Sous-texte du bouton Renvoyer : 'Renvoi possible toutes les 60s.' Préciser dans ConfirmPending ligne 56 que l'adresse mail affichée est cliquable pour ouvrir l'app mail.
- **Effort** : S · **Impact** : moyen
- **Verify** : Code confirme : mention spams uniquement dans toast post-clic (l.39), pas dans le texte initial (l.54-61), cooldown invisible avant 1er clic (l.72), email non cliquable (l.56). Newcomer plausible.

#### [P2] Settings 'Mode sombre' Row sans Switch visuel

- **Où** : `src/pages/SettingsPage.tsx:153-159`
- **Symptôme** : Section 'Apparence' (153) avec un seul Row 'Mode clair' / 'Mode sombre' (156). Le toggle change le label mais pas de Switch component utilisé. Le Row sugère 'tap pour ouvrir un sous-écran' (chevron implicite).
- **Pourquoi (newcomer)** : Newcomer cherche un Switch iOS (réflexe Settings.app). Le Row + chevron implicite sugère 'tap pour ouvrir une liste de thèmes', il clique, la couleur bascule, surprise. Friction faible mais visible.
- **Fix** : Remplacer le Row par un composant Switch (utilisé pour NotificationPreferences) avec label 'Mode sombre' et état on/off explicite. Préserver la section 'Apparence'.
- **Effort** : S · **Impact** : faible
- **Verify** : Confirmed: SettingsPage.tsx:154-158 uses Row (clickable item with toggle label) instead of a Switch primitive — inconsistent with NotificationPreferences which uses Switch, and breaks iOS Settings.app newcomer expectation.

#### [P2] Banned user message 'Ce compte a été suspendu' sans next-step

- **Où** : `src/contexts/AuthContext.tsx:225`
- **Symptôme** : Toast `'Ce compte a été suspendu', { id: 'banned' }` (225) puis signOut auto. Pas d'email de contact, pas de raison, pas de procédure de recours. Le mot 'suspendu' diffère de 'banni' utilisé en interne (UsersTab 78).
- **Pourquoi (newcomer)** : User banni (rare mais critique) ne sait pas s'il peut contester, à qui écrire. Si c'est une erreur admin, il quitte définitivement. Newcomer banni accidentellement (faux signalement) est perdu.
- **Fix** : Toast 'Ce compte a été suspendu. Pour toute question, contacte enzo.reine35@gmail.com'. Cohérence wording : utiliser 'suspendu' partout côté user, 'banni' réservé à l'admin UI.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirmed: AuthContext.tsx:225 affiche 'Ce compte a été suspendu' sans email de contact ni procédure de recours, et UsersTab.tsx:78 utilise 'banni' (incohérence wording confirmée). P2/XS justifiés.

#### [P2] PianoReportButton placeholder guide insuffisant

- **Où** : `src/components/Piano/PianoReportButton.tsx:57-68`
- **Symptôme** : Placeholder 'Décris le problème…' (67) générique. La description au-dessus (57-58) liste les motifs mais pas en bullets actionnables. 'Précise une raison' (toast 23, schema schemas.ts 118) est terse.
- **Pourquoi (newcomer)** : Newcomer qui veut signaler un faux piano hésite : 'doublon de l'autre rue' suffit ? Doit-il joindre une photo ? Sans guide, il écrit '?' ou abandonne le signalement.
- **Fix** : Remplacer placeholder par exemple concret : 'Ex: doublon du piano place du marché, photo non liée, signalement urgent…'. Reformuler 'Précise une raison' en 'Explique brièvement le problème (1-2 phrases)'.
- **Effort** : XS · **Impact** : faible
- **Verify** : Confirmé: placeholder l.67 'Décris le problème…' générique, exemples l.57-58 inline non-bullets, toast l.23 terse. Newcomer hésitant peut abandonner le signalement faute d'exemple actionnable. P2/XS cohérent.

### P3 — Backlog / idée (12)

#### [P3] Visibility 'Mes amis uniquement' newcomer sans amis = piège

- **Où** : `src/components/Piano/SessionDialog.tsx:193-237`
- **Symptôme** : Label 'Mes amis ({friendsCount})' ligne 234 montre '(0)' parfois. La branche conditionnelle ligne 194-207 propose 'Ta session sera publique'. Toast erreur ligne 83 'Tu n'as pas encore d'amis pour limiter la visibilité' utilise apostrophe droite incohérente.
- **Pourquoi (newcomer)** : Newcomer fraichement inscrit n'a aucun ami, ne comprend pas la notion 'session friends-only' (concept v6 spécifique). Le message 'Pour la limiter à tes amis, ajoute-en d'abord' (ligne 206) est cryptique pour qui débarque.
- **Fix** : Reformuler 'Visible par tes amis seulement (tu n'en as pas encore — invite quelqu'un d'abord)'. Ajouter mini-tooltip ? sur 'Mes amis' expliquant à quoi sert la visibilité limitée.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Wording ligne 205-206 reste cryptique pour newcomer, mais finding contient erreurs factuelles ('(0)' n'apparaît jamais car branche conditionnelle ligne 194 cache le radio). Bug cosmétique réel mais mineur.

#### [P3] isPermissionDenied jamais converti en message FR utilisateur

- **Où** : `src/lib/errors.ts:52-55`
- **Symptôme** : Helper existe mais aucun call site dans src/components/\*\* ne l'utilise. Conséquence : un user banni ou un état RLS denied retombe sur le message Postgres brut via getErrorMessage.
- **Pourquoi (newcomer)** : Newcomer banni (rare mais réel) ou en pleine race condition (session expirée) voit un message technique en anglais. Aucune piste : se reconnecter ? contacter support ?
- **Fix** : Dans chaque catch sensible (AddPianoFlow, SessionDialog, VisitButton, friends), ajouter `if (isPermissionDenied(err)) toast.error('Action non autorisée. Reconnecte-toi et réessaie.')`.
- **Effort** : S · **Impact** : moyen
- **Verify** : Helper bien defini + teste mais zero call site composants (confirme par grep) ; cas reel rare (banni/RLS race) donc P3 plus juste que P2, et l'ajout d'un if/toast dans 3-4 catch est S pas M.

#### [P3] CookieBanner CTA 'OK, compris' implique faux consentement

- **Où** : `src/components/Layout/CookieBanner.tsx:70-78`
- **Symptôme** : Bouton 'OK, compris' (75) + commentaire 17 'pas de bouton Refuser — il n'y a rien à refuser'. CNIL-OK. Mais newcomer FR habitué aux bandeaux RGPD massifs cherche 'Accepter/Refuser' et hésite pensant qu'il accepte du tracking.
- **Pourquoi (newcomer)** : Newcomer mobile-first méfiant clique X (croix 79-86) pour 'refuser', perd le contexte du bandeau, ne revient pas. La transparence CNIL est correcte mais le wording laisse un doute.
- **Fix** : Reformuler le texte pour insister sur l'absence de choix à faire : 'Aucun cookie publicitaire ni tracker tiers ici. Seules les préférences (thème, session) sont stockées localement.' CTA : 'J'ai compris' (plus définitif).
- **Effort** : XS · **Impact** : faible
- **Verify** : Code conforme (ligne 75 'OK, compris' + X 79-86). Ambiguïté CTA+croix réelle pour newcomer, mais le texte dit déjà 'uniquement essentiels / pas de tracking' donc impact mineur — P3 plus juste que P2.

#### [P3] CGU checkbox SignupForm : lien \_blank perd contexte mobile

- **Où** : `src/components/Auth/SignupForm.tsx:67-97`
- **Symptôme** : Texte 'J'ai lu et j'accepte les CGU et la politique de confidentialité' ouvre target='\_blank' (lignes 77, 86). Sur iOS Safari, nouvel onglet recouvre l'inscription. Aucune indication de longueur (11 sections CGU).
- **Pourquoi (newcomer)** : Newcomer mobile-first qui clique le lien CGU perd son contexte d'inscription. À son retour, il refait tout (formulaire pas autosauvé). Patience 30s : il abandonne.
- **Fix** : Remplacer target='\_blank' par une modal/sheet in-app affichant CGU + Privacy en accordéon. Reformuler message d'erreur schemas.ts ligne 54 'Tu dois accepter les CGU' en 'Coche la case pour accepter les conditions.'
- **Effort** : M · **Impact** : moyen
- **Verify** : Code confirme target='\_blank' lignes 78/86 et message schemas.ts:54 — friction context-switch reelle, mais form state react-hook-form survit au \_blank (pas de 'refait tout'), donc P3 polish plutot que P2.

#### [P3] Confirmation 'retirer' RemoveFriendDialog : friction power-user

- **Où** : `src/components/Friends/RemoveFriendDialog.tsx:29-72`
- **Symptôme** : Pour retirer un ami il faut taper 'retirer' (31), texte fixe. Action réversible (re-friend possible). Le commentaire 14 invoque 'ralentir un attaquant ayant volé une session courte' — argument faible pour cette action non-destructrice.
- **Pourquoi (newcomer)** : Le newcomer qui s'est trompé d'ami doit taper un mot pour annuler une décision réversible. Power-user après 2-3 fois trouvera ça pénible. Le placeholder 'retirer' (70) donne la solution donc la friction est cosmétique.
- **Fix** : Garder un Confirm classique (Annuler/Retirer) sans saisie texte. Réserver la saisie textuelle aux actions irréversibles (delete account, ban admin).
- **Effort** : XS · **Impact** : faible
- **Verify** : Code confirme : saisie 'retirer' obligatoire (l.31) avec placeholder qui spoile (l.70), action reversible, justification securitaire faible — friction cosmetique reelle.

#### [P3] PianoUpdateForm 'toujours là' / 'encore là' synonymes incohérents

- **Où** : `src/components/Piano/PianoUpdateForm.tsx:70-97`
- **Symptôme** : Label 'Le piano est-il toujours là ?' (70) avec Oui/Non. Toast 'Indique si le piano est encore là' (36) utilise 'encore là'. PianoHistory 24 et MapFilters utilisent 'Encore là'. Trois variantes : toujours là / encore là / présent.
- **Pourquoi (newcomer)** : Newcomer FR perçoit ces synonymes mais une cohérence renforce le mental model. 'Toujours' implique permanence éternelle, 'Encore' est temporel — plus juste ici pour un piano public éphémère.
- **Fix** : Standardiser sur 'Encore là ?' partout (label question + filtres + history). Mettre à jour le schema zod required_error ligne 100 de schemas.ts en cohérence.
- **Effort** : XS · **Impact** : faible
- **Verify** : Verified: 'toujours là' (PianoUpdateForm:70, Tutorial:20, schemas.ts:100) coexiste avec 'encore là' (PianoUpdateForm:36 toast, PianoHistory:24, MapFilters:95, ActivityTab:182). Incohérence même dans le même composant.

#### [P3] NOTIFICATION_SECTION_LABELS 'Mes pianos' possessif ambigu v7

- **Où** : `src/lib/constants.ts:131-136`
- **Symptôme** : Label section 'Mes pianos' (132) regroupe notify*comments + notify_piano_updates déclenchés sur les pianos \_ajoutés* par l'user. Avec les favoris v7, 'Mes pianos' devient ambigu : pianos ajoutés ? favoris ?
- **Pourquoi (newcomer)** : Newcomer qui a ajouté 0 piano mais 3 favoris voit 'Mes pianos' et active les toggles, attendant les MAJ de favoris — qui ne viennent pas (notify_favorite_update n'est pas listé dans NOTIFICATION_CATEGORIES).
- **Fix** : Renommer la section en 'Pianos que j'ai ajoutés'. Ajouter une nouvelle section 'Pianos favoris' pour notify_favorite_update (à introduire dans NOTIFICATION_CATEGORIES et NOTIFICATION_SECTION_OF).
- **Effort** : S · **Impact** : moyen
- **Verify** : Confirmé: constants.ts:132 'Mes pianos' regroupe notify_comments+notify_piano_updates (pianos ajoutés). Avec favoris v7, 'Mes' devient ambigu pour newcomer. Rename label = P3 légitime. L'ajout notify_favorite_update reste une feature séparée.

#### [P3] SessionDialog Durée espace incohérent : '60min' vs '1h 30'

- **Où** : `src/components/Piano/SessionDialog.tsx:186`
- **Symptôme** : Boutons durée : `${d}min` ou `${d / 60}h${d % 60 ? " ${d % 60}" : ""}` (186) — donne '15min', '30min', '1h', '1h 30', '2h'. Espace incohérent (pas d'espace dans '15min' mais espace dans '1h 30'). Débord 360px.
- **Pourquoi (newcomer)** : Newcomer mobile-first lit '1h 30' comme '1h et 30s' ou '1h30min' ? Norme française : '1 h 30' avec espaces ou '1h30' sans. Aucune des deux ici. Sur petit écran 360px (5 colonnes 173) ça déborde.
- **Fix** : Standardiser : '15 min', '30 min', '1 h', '1 h 30', '2 h' (NBSP entre nombre et unité). Ou simplifier : '15 min' / '30 min' / '1 h' / '1 h30' / '2 h'.
- **Effort** : XS · **Impact** : faible
- **Verify** : Code ligne 186 confirme '15min' (sans espace) vs '1h 30' (espace + pas d'unité sur 30) — incohérent et ambigu pour un newcomer FR mobile.

#### [P3] Friends tabs 'Reçues / Envoyées' perdent le mot 'Demandes'

- **Où** : `src/components/Friends/FriendsTab.tsx:52-67`
- **Symptôme** : TabsTrigger 'Reçues' (53) et 'Envoyées' (60) sans préfixe 'Demandes'. Lisible seul = 'Reçues quoi ?'. Le badge primary à côté n'aide pas à inférer 'demandes d'amitié'.
- **Pourquoi (newcomer)** : Newcomer arrive sur la tab Amis, voit 3 sous-tabs : 'Mes amis | Reçues | Envoyées'. 'Reçues' isolé sans objet est mystérieux — il clique pour comprendre, perd 2-3s par essai.
- **Fix** : Renommer 'Demandes reçues' / 'Demandes envoyées' (ou si pas la place : 'Invits reçues' / 'Invits envoyées' qui tient sur 360px).
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirmé lignes 53/61 : 'Reçues'/'Envoyées' isolés sans contexte. Newcomer doit cliquer pour comprendre — mais le contexte 'Mes amis' à gauche aide à inférer 'demandes d'amitié', donc P3 plutôt que P2.

#### [P3] ResetPasswordForm 'Confirmer' label trop court

- **Où** : `src/components/Auth/ResetPasswordForm.tsx:55`
- **Symptôme** : Label 'Confirmer' (55) ambigu — confirmer quoi ? ChangePasswordDialog.tsx 124 fait mieux avec 'Confirmer le nouveau mot de passe'. Incohérence projet sur le même type de champ.
- **Pourquoi (newcomer)** : Newcomer mobile-first avec mot de passe collé/tapé une fois pense que 'Confirmer' valide le form. Erreur de saisie non détectée si même bug typo dans les deux champs.
- **Fix** : Label : 'Confirmer le nouveau mot de passe' (cohérence avec ChangePasswordDialog). Aligner schema resetPasswordSchema dans schemas.ts si nécessaire pour le message d'erreur.
- **Effort** : XS · **Impact** : faible
- **Verify** : Vérifié ligne 55 : label 'Confirmer' seul, incohérent avec ChangePasswordDialog. P3 et XS sont appropriés pour un simple changement de texte de label.

#### [P3] AuthPage 'Bon retour' / 'Rejoins l'aventure' tons inégaux

- **Où** : `src/pages/AuthPage.tsx:51-77`
- **Symptôme** : Login title 'Bon retour' (51), Signup 'Rejoins l'aventure' (75). 'Aventure' surjoue pour une carte de pianos. ConfirmPendingRoute 'Vérifie ta boîte mail' (123) est plat. Mix de registres : familier/marketing/neutre.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR perçoit l'inconsistance comme manque de polish. Le mot 'aventure' est cliché startup, peut faire peur ou paraître exagéré pour un newcomer pragmatique.
- **Fix** : Standardiser tons : 'Connexion' / 'Inscription' / 'Confirme ton email' (factuel) ; ou tout amical : 'Re-bonjour' / 'Bienvenue' / 'Boîte mail à vérifier'.
- **Effort** : XS · **Impact** : faible
- **Verify** : Code confirmé : titres "Bon retour" (L51), "Rejoins l'aventure" (L75), "Vérifie ta boîte mail" (L123) mélangent registres familier/marketing/neutre ; finding cosmétique réel mais mineur, P3/XS justifiés.

#### [P3] CTAs verbes mélangés : impératif / infinitif / 1re personne

- **Où** : `src/components/Map/AddPianoFlow.tsx:352`
- **Symptôme** : Mix conventions : 'Ajouter ce piano' (infinitif, 352), 'Enregistrer la mise à jour' (PianoUpdateForm 135), 'Valider' (SessionDialog 251), 'Créer mon compte' (SignupForm 99), 'Se connecter' (LoginForm 53), 'J'y vais' (SessionButton 13).
- **Pourquoi (newcomer)** : Newcomer mobile-first lit un mix verbal qui crée une sensation de bricolage. Les CTAs en '1re personne' sont engageants (Instagram-style) mais inconsistants avec 'Valider' froid. Friction cognitive faible mais réelle.
- **Fix** : Standardiser : CTAs principaux en infinitif neutre ('Ajouter', 'Enregistrer', 'Valider', 'Créer un compte', 'Se connecter', 'Supprimer mon compte'). Réserver 'J'y vais' / 'J'y suis passé' pour les actions communautaires de présence.
- **Effort** : S · **Impact** : faible
- **Verify** : Mix verbal confirme dans le code (infinitif + 1re personne + reflexive), mais l impact reel sur un newcomer est minime — "Creer mon compte" et "Se connecter" sont des conventions FR standard. Polish copy P3 plutot que friction P2.

---

## 5. Navigation, découvrabilité, onboarding

**Total : 30 findings** (0 P0, 7 P1, 18 P2, 5 P3)

### P1 — Important (7)

#### [P1] Dashboard 5 onglets sur mobile 360-414px - debordement obligatoire

- **Où** : `src/pages/Dashboard.tsx:77-95`
- **Symptôme** : 5 onglets (Activite, Communaute, Evenements, Amis, Mes demandes) avec `scrollable` TabsList. Sur 360px, seuls 2-3 sont visibles sans scroll horizontal. L onglet 'Amis' (badge pending) et 'Mes demandes' sont caches a droite.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: la decouvrabilite des Amis (feature sociale v7) souffre d etre cachee a droite. Le badge pending devient invisible si le user ne scroll pas la liste de tabs. 30s d attention = il rate la moitie du dashboard.
- **Fix** : Reduire a 4 onglets via fusion (Evenements + Communaute -> 'Communaute') OU rendre la TabsList plus dense (typo 12px + padding reduit) pour afficher 4-5 onglets sur 360px sans scroll.
- **Effort** : M · **Impact** : fort

#### [P1] Aucun bouton 'Ajouter aux favoris' sur PianoPage alors que la feature v7 existe

- **Où** : `src/pages/PianoPage.tsx:148-152`
- **Symptôme** : La PianoPage montre Naviguer / Partager / Signaler mais aucun bouton Favori, alors que le template mail `piano_favorite_update` (templates.ts:257) et le kind `piano_favorite_update` existent. Newcomer ne peut pas suivre un piano.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: feature documentee dans templates email backend (v7 PR-B promise), invisible cote UI. Le newcomer recoit un mail 'piano que tu suis a ete mis a jour' apres avoir clique nulle part = confusion totale.
- **Fix** : Ajouter PianoFavoriteButton (icone Bookmark) dans le row d actions ligne 149-152, derriere le bouton Partager. Synchroniser avec hook usePianoFavorite (a creer si absent).
- **Effort** : M · **Impact** : fort

#### [P1] Tutorial non re-lancable depuis Settings (4e gap d onboarding)

- **Où** : `src/components/Onboarding/Tutorial.tsx:33-46`
- **Symptôme** : Une fois TUTORIAL_STORAGE_KEY pose, plus aucun moyen de relancer le tutoriel. Aucun lien 'Revoir le tutoriel' dans SettingsPage. Le user qui clique 'Passer' trop vite perd l info pour toujours.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: il clique 'Passer' par reflexe puis se perd. Sans option de relance, il quitte. CLAUDE.md indique pourtant 're-launchable Settings' attendu dans le persona.
- **Fix** : Ajouter dans SettingsPage Section 'Aide' un Row 'Revoir le tutoriel' qui clear TUTORIAL_STORAGE_KEY puis navigate('/'). Exposer Tutorial avec une prop `forceOpen` pour le declencher manuellement.
- **Effort** : S · **Impact** : moyen

#### [P1] CookieBanner 800ms et Tutorial popup -> double pile de modals au landing

- **Où** : `src/components/Layout/CookieBanner.tsx:22-32`
- **Symptôme** : Au premier login le Tutorial (z-[2000]) et le CookieBanner (z-[1200]) s ouvrent ensemble apres 800ms. Le banner cookies arrive sous le Tutorial mais reste interactif derriere; quand on ferme le Tutorial le banner cookies est encore la = empilement de friction.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: 2 popups successifs = sentiment d intrusion immediate. 30s de patience = abandon avant meme la carte. Pas de file d attente d onboarding.
- **Fix** : Conditionner l affichage du CookieBanner a `!localStorage.getItem(TUTORIAL_STORAGE_KEY)` invertit OU le retarder a 5s + queue (afficher seulement quand Tutorial ferme). Au minimum verifier qu il s affiche apres le Tutorial.
- **Effort** : S · **Impact** : moyen

#### [P1] Push opt-in seulement dans Settings, jamais propose dans le flow onboarding

- **Où** : `src/components/Settings/NotificationPreferences.tsx:41-74`
- **Symptôme** : Le push opt-in se trouve uniquement dans SettingsPage. Le Tutorial.tsx (4 slides) ne le mentionne jamais. Newcomer ne saura jamais qu il peut recevoir des notifs sans aller fouiller dans Settings.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: la valeur sociale (amis arrivant, sessions) repose sur les notifs. Sans opt-in il ne recevra rien et la dimension communautaire devient invisible. Coherent avec persona 30s de patience.
- **Fix** : Ajouter un 5e slide Tutorial 'Reste informe' avec CTA 'Activer les notifications' qui appelle subscribeToPush. OU declencher un prompt post-1ere visite piano.
- **Effort** : M · **Impact** : fort

#### [P1] Geoloc demandee uniquement dans AddPianoFlow - pas d anticipation pour la carte

- **Où** : `src/pages/MapPage.tsx:10-25`
- **Symptôme** : La permission geoloc n est demandee qu au moment d ajouter un piano. La MapPage initialise sur Rennes par defaut. Newcomer hors Rennes ne voit rien d interessant et n a aucun signal qu il pourrait centrer sur sa position.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR (Paris/Lyon/etc.): carte vide centree Rennes = aucun piano visible. Il croit que l app est cassee. 30s d attention = abandon avant meme de voir la valeur.
- **Fix** : Ajouter un bouton LocateMeButton plus proeminent (deja existe en composant) ET demander la permission geoloc au mount avec confirmation soft 'On centre la carte sur toi?'. OU au moins detecter si carte vide a l ecran et afficher un EmptyState avec CTA.
- **Effort** : M · **Impact** : fort

#### [P1] Notification email vers /dashboard deconnecte perd la destination

- **Où** : `src/App.tsx:53-67`
- **Symptôme** : Les templates email pointent vers `/dashboard` ou `/piano/{id}` (templates.ts:121, 196, 242). /piano/:id est public, donc OK. Mais /dashboard et /dashboard?tab=friends sont sous RequireAuth - sans state preserved. L user clique le lien depuis le mail sans session active -> redirect `/auth` puis post-login -> `/` (MapPage), perdant le contexte du mail.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: il recoit son 1er mail 'demande d ami', clique, doit se reconnecter, arrive sur la carte sans rapport. Friction massive entre intention et action.
- **Fix** : Implementer dans RequireAuth la preservation de location.pathname + search via state, puis dans AuthPage apres signIn: navigate vers la location originale. Pattern standard React Router (state.from).
- **Effort** : S · **Impact** : fort

### P2 — Amélioration (18)

#### [P2] Post-signup redirect tombe sur la carte sans onboarding contextuel

- **Où** : `src/pages/AuthPage.tsx:138-139`
- **Symptôme** : Apres confirmation email, l utilisateur est redirige sur `/` (MapPage) via `<Navigate to="/" replace />`. Le Tutorial popup s y declenche, mais le newcomer arrive sur une carte centree Rennes sans contexte de ce qu il vient de faire (compte cree).
- **Pourquoi (newcomer)** : Newcomer mobile-first FR avec 30s de patience: aucun message de bienvenue (toast 'Bienvenue!' du SignupForm est mort car le user a quitte pour aller dans son mail). Il decouvre la carte avant de comprendre les amis/favoris/dashboard.
- **Fix** : Rediriger vers /dashboard?welcome=1 avec un message d accueil ou afficher un toast persiste via sessionStorage post-confirmation. Ou differer le Tutorial pour mentionner explicitement les 4 onglets dashboard + amis.
- **Effort** : S · **Impact** : fort
- **Verify** : Confirmed AuthPage.tsx:139 redirige authentifies vers `/` sans contexte post-confirmation; toast SignupForm est mort apres detour mail, mais Tutorial sur MapPage mitige partiellement donc P2 plus juste que P1.

#### [P2] NavBar: ordre Accueil/Carte/Recherche/Parametres pas mobile-first FR optimal

- **Où** : `src/components/Layout/NavBar.tsx:5-10`
- **Symptôme** : L ordre place 'Accueil' (Dashboard avec stats) en premier alors que le coeur du produit est la Carte. Le newcomer qui clique l icone 'Accueil' atterrit sur un onglet 'Activite' qui montre des stats globales abstraites au lieu de la carte.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: convention iOS/Android = mettre le coeur d usage au centre/premier item. Ici la carte (vraie raison de venir) est en 2e position, et l icone LayoutDashboard est ambigu. Risque de quitter avant de comprendre que c est une carte.
- **Fix** : Inverser: Carte (1er, MapIcon), Accueil/Activite (2e), Recherche (3e), Parametres (4e). Ou renommer 'Accueil' vers 'Activite' pour matcher le label des onglets dashboard.
- **Effort** : XS · **Impact** : moyen
- **Verify** : Code confirme l'ordre Accueil/Carte/Recherche/Paramètres (NavBar.tsx:5-10) avec icône LayoutDashboard ambiguë; pour un newcomer arrivant via lien partagé, mettre la carte en premier est plus mobile-first, mais c'est de la friction modérée, pas P1.

#### [P2] Pas de route /me ni de lien 'Mon profil' - newcomer ne peut pas voir son profil

- **Où** : `src/App.tsx:63-68`
- **Symptôme** : L application a /user/:pseudo mais aucune route /me ni de lien direct dans Settings ou NavBar vers /user/{monPseudo}. Le newcomer doit deviner son pseudo et taper /user/xxx manuellement ou se chercher dans /search.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: convention universelle = voir son propre profil public en 1 tap. Ici impossible. Frustrant quand on veut partager son lien profil ou verifier ce que les autres voient.
- **Fix** : Ajouter une route /me qui redirige vers /user/{profile.pseudo}, plus un Row 'Mon profil public' dans SettingsPage Section 'Compte' qui pointe vers /user/{profile.pseudo}.
- **Effort** : S · **Impact** : fort
- **Verify** : Confirmed: App.tsx:67 only declares /user/:pseudo, and SettingsPage.tsx Compte section (lines 114-127) has no link to view one's own public profile — newcomer must know/type their pseudo, classic mobile-app convention violated.

#### [P2] Catchall `/*` redirige vers `/` sans message - perte de feedback URL invalide

- **Où** : `src/App.tsx:79`
- **Symptôme** : `<Route path="*" element={<Navigate to="/" replace />} />` redirige silencieusement /foo, /admin/lala, /piano/<bad-uuid> vers MapPage. Pas de toast, pas de page 404, l user ne sait pas que son lien est casse.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: il clique un lien partage Messenger casse, atterrit sur la carte, croit que l app est anormale. Pas de feedback = sentiment d insecurite.
- **Fix** : Creer une page NotFound (mobile-first, simple, avec CTA 'Aller a la carte') et la cabler sur le catchall. Garder le replace pour ne pas polluer l historique.
- **Effort** : S · **Impact** : moyen

#### [P2] AdminPage tabs non sync URL - lien partageable impossible (C.4 backlog)

- **Où** : `src/pages/AdminPage.tsx:23, 38-50`
- **Symptôme** : `const [tab, setTab] = useState<string>('kpis')` - le state n est pas synchro avec searchParams comme Dashboard l est. Impossible de partager /admin?tab=audit, et un refresh dans Audit log renvoie sur KPIs.
- **Pourquoi (newcomer)** : Persona admin: workflow casse pour partager un onglet. Aussi confusion newcomer si admin lui envoie un lien admin specifique - le tab attendu n est pas restaure.
- **Fix** : Adopter le meme pattern que Dashboard.tsx (useSearchParams + sync). Liste VALID_TABS partagee, syncing sur setTab.
- **Effort** : S · **Impact** : faible

#### [P2] Suspense SplashScreen plein ecran entre routes - flash brutal

- **Où** : `src/App.tsx:50`
- **Symptôme** : `<Suspense fallback={<SplashScreen />}>` englobe TOUTES les routes. Au premier hop entre /dashboard et /settings le SplashScreen plein ecran s affiche brievement le temps du chunk lazy = flash visuel.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: flash logo + spinner = sentiment d application lente / qui reload. 30s de patience = mauvaise impression. Coherence Splash/Skeleton/Spinner pas tenue.
- **Fix** : Wrapper le Suspense plus profond (par route) avec un Skeleton page-shape (carte / liste / form) au lieu du SplashScreen. Garder SplashScreen uniquement pour le boot initial.
- **Effort** : M · **Impact** : moyen

#### [P2] PianoShareButton intitule 'Partager' - manque promesse 'envoyer a un ami'

- **Où** : `src/components/Piano/PianoShareButton.tsx:32-37`
- **Symptôme** : Bouton libelle 'Partager' sans icone iOS share sheet ni preview. Le partage natif fonctionne mais newcomer ne sait pas qu il peut partager via Messenger/SMS/WhatsApp. Aucun appel a l action 'Envoyer a un ami'.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: le partage social est un canal d acquisition crucial. Label flou = il n essaie pas. La feature 'inviter un ami' est aussi un vehicule de retention.
- **Fix** : Renommer 'Envoyer' (avec icone Send) ou 'Partager ce piano'. Ajouter un texte de share plus actionnable. Optionnel: badge 'Envoyer a un ami' avec icone speech bubble.
- **Effort** : XS · **Impact** : moyen

#### [P2] Pas de page Aide/FAQ/Contact - 'Mes demandes' est l unique canal de support

- **Où** : `src/pages/SettingsPage.tsx:161-179`
- **Symptôme** : Aucune section 'Aide' ou 'FAQ' dans Settings. Le newcomer doit deviner que 'Mes demandes' (sous le Dashboard) est la facon de contacter le support. Le label 'Mes demandes' n est pas evocateur de support.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR perdu (geoloc, push, ajout piano qui rate, doublons): aucun chemin clair pour demander de l aide. 'Mes demandes' suggere des demandes faites par lui, pas du support.
- **Fix** : Ajouter une Section 'Aide' dans SettingsPage avec un Row 'Contact / Support' qui pointe vers /dashboard?tab=requests + Row 'Foire aux questions' qui ouvre une page statique (a creer). Renommer 'Mes demandes' -> 'Support'.
- **Effort** : M · **Impact** : moyen

#### [P2] Tutorial CTA 'Passer' bouton minuscule peu accessible (cible <44px)

- **Où** : `src/components/Onboarding/Tutorial.tsx:88-90`
- **Symptôme** : Le bouton 'Passer' est un `<button>` sans variant, texte `text-xs text-muted-foreground`, hors zone tactile recommandee (>=44x44). Sur 360px, cible difficile a atteindre.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: persona pressee veut skip mais cible ratee = double tap, accidentellement clique sur 'Commencer/Suivant'. Frustration immediate, sentiment de manipulation dark pattern.
- **Fix** : Augmenter la taille de la cible (padding y-3, min-h-11), garder visuellement subtil. Ou deplacer 'Passer' en X close icon top-right (h-11 w-11 tap area).
- **Effort** : XS · **Impact** : faible

#### [P2] /auth/reset accessible meme connecte - pas d alerte si user dejà logge

- **Où** : `src/pages/AuthPage.tsx:137-139`
- **Symptôme** : `if (user && !isReset && !isConfirmPending) return <Navigate to="/" replace />`. Si un user connecte clique sur un lien reset password recu par mail (ancien), il accede a ResetPasswordForm sans avoir demande le reset depuis cette session. Confusion.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: il a deja une session active sur le device et clique un lien reset depuis un mail recu hier = arrivee sur form 'nouveau mot de passe' sans contexte. Coherence flow casse.
- **Fix** : Sur ResetRoute, detecter user logge actif et afficher message 'Tu es deja connecte. Veux-tu changer ton mot de passe via Settings?' avec bouton vers /settings + ChangePasswordDialog.
- **Effort** : S · **Impact** : faible

#### [P2] AddFriendButton sur UserPage sans contexte d explication preventive

- **Où** : `src/pages/UserPage.tsx:67-69`
- **Symptôme** : Le bouton AddFriendButton apparait sec sur UserPage, sans texte expliquant ce que 'devenir ami' implique (sessions friends-only visibles, etc.). Newcomer ne sait pas l interet d ajouter.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: le concept 'amis' sur une carte de pianos est non evident. Sans micro-copy expliquant 'tu verras ses sessions privees et il verra les tiennes', le clic d ajout d ami se fait au hasard.
- **Fix** : Ajouter une micro-copy (text-xs muted) au-dessus du bouton: 'Devenez amis pour voir vos sessions friends-only respectives.' OU tooltip on hover/long-press.
- **Effort** : XS · **Impact** : moyen

#### [P2] Browser back sur PianoPage navigate(-1) peut envoyer hors app (deep link)

- **Où** : `src/pages/PianoPage.tsx:63-69`
- **Symptôme** : `onClick={() => navigate(-1)}`. Si user entre via deep link partage (Messenger -> /piano/:id), navigate(-1) le renvoie hors PWA / sur Messenger. Le bouton 'Retour' devient bouton 'quitter l app'.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR arrivant par lien partage = situation typique. Le back button ne le ramene pas dans l app PianoWorld mais hors session. Perte d acquisition.
- **Fix** : Fallback: si window.history.length <= 1 alors navigate('/') au lieu de navigate(-1). Pattern standard pour deep-link landing.
- **Effort** : XS · **Impact** : moyen

#### [P2] UserPage 'Retour' meme probleme: deep link vers /user/:pseudo sort de l app

- **Où** : `src/pages/UserPage.tsx:42-48`
- **Symptôme** : Meme pattern navigate(-1) sur UserPage. Si arrive depuis lien partage, sort de l app.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR clique sur profil d ami depuis mail/messenger -> back = quitte. Identique a PianoPage.
- **Fix** : Meme fix: fallback navigate('/dashboard?tab=friends') ou '/' si history.length <= 1.
- **Effort** : XS · **Impact** : moyen

#### [P2] MyRequestsTab EmptyState sans CTA - cul-de-sac visuel

- **Où** : `src/components/Requests/MyRequestsTab.tsx:48-54`
- **Symptôme** : L EmptyState 'Aucune demande pour l instant' n a pas de prop `action` alors que le bouton 'Nouvelle demande' est en haut. Le user mobile qui voit le placeholder en bas d ecran peut ne pas remonter au CTA.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: convention - le CTA doit etre dans l EmptyState pour eviter de scanner l ecran. Sans action sur l EmptyState, on a un cul-de-sac visuel.
- **Fix** : Ajouter prop `action={<Button size="sm" onClick={() => setCreating(true)}>Poser une question</Button>}` sur l EmptyState. Coherent avec FriendsTab.tsx qui propose des actions sur ses empty states.
- **Effort** : XS · **Impact** : faible

#### [P2] Settings: 'Mes amis' Row sans CTA 'Trouver des amis' si 0 ami

- **Où** : `src/pages/SettingsPage.tsx:129-147`
- **Symptôme** : La Section 'Social' montre `friends` count via `friendsLabel`. Si friendsCount = 0 et pendingCount = 0, friendsLabel est undefined -> juste un Row 'Mes amis' qui mene a /dashboard?tab=friends mais sans hint de quoi faire.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: en arrivant dans Settings il voit 'Mes amis' sans context. Pas de '0 amis - decouvre la communaute' qui inviterait au click.
- **Fix** : Quand friendsCount === 0, afficher friendsLabel = 'Trouve des pianistes' (au lieu de undefined). Ou ajouter un Row secondaire 'Inviter un ami' avec un partage du site.
- **Effort** : XS · **Impact** : faible

#### [P2] RequireAdmin redirige silencieusement sur / si non-admin - sans toast d info

- **Où** : `src/components/Layout/RequireAdmin.tsx:16`
- **Symptôme** : Un newcomer (ou un user qui a perdu son role) cliquant un lien /admin/X est redirige silencieusement vers /. Il ne comprend pas pourquoi.
- **Pourquoi (newcomer)** : Newcomer ou user demoted: confusion. Pas grave (pas de feature exposed) mais experience opaque. 30s de patience = irritation.
- **Fix** : Avant le Navigate, declencher un `toast.error('Acces administrateur requis')`. Ou afficher une page 'Permission refusee' (1 ligne) avec retour /.
- **Effort** : XS · **Impact** : faible

#### [P2] AuthLayout branding repete sans tagline produit pour landing newcomer

- **Où** : `src/pages/AuthPage.tsx:31-38`
- **Symptôme** : L AuthLayout affiche Logo + 'PianoWorld' + title + subtitle, mais aucun message d accroche du produit ('Carte communautaire des pianos publics'). Newcomer arrivant via lien partage ne sait pas ce qu il signe.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR arrivant via partage Messenger: il signe sans savoir le service. Conversion / confiance impactees.
- **Fix** : Ajouter sous le titre `<p className="text-xs text-muted-foreground">Carte communautaire des pianos publics de France</p>` sur SignupRoute uniquement (Login peut rester sec).
- **Effort** : XS · **Impact** : faible

#### [P2] ExportDataButton sans hint sur ce qu il contient - usefulness opaque

- **Où** : `src/components/Settings/ExportDataButton.tsx:53-62`
- **Symptôme** : Bouton 'Exporter mes donnees (JSON)' sans micro-copy explicative. Newcomer ne sait pas si c est RGPD obligation ou utile. Recoit un .json brut sans visualisation.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR pas tech: JSON est opaque. Sans explication ('Pour transferer vers une autre app' ou 'Pour archiver tes pianos'), il ne clique pas, donc passe a cote du droit RGPD.
- **Fix** : Ajouter description sous le bouton: 'Tes pianos, sessions, demandes en .json. Conforme RGPD.' Optionnel: futur bouton 'Exporter en PDF lisible'.
- **Effort** : XS · **Impact** : faible

### P3 — Backlog / idée (5)

#### [P3] URL deep-link Dashboard ne porte pas la sub-tab d Amis (received/sent)

- **Où** : `src/pages/Dashboard.tsx:67-95`
- **Symptôme** : `/dashboard?tab=friends` est shareable mais aucune sub-tab d Amis (list/received/sent) n est dans l URL (`<FriendsTab>` a son propre useState local). Lien partage ne peut pas pointer 'demandes recues directement'.
- **Pourquoi (newcomer)** : Newcomer recoit email 'demande d ami' avec URL /dashboard?tab=friends, atterrit sur 'Mes amis' au lieu de 'Recues'. Sous-feature de discovery cassee.
- **Fix** : Etendre FriendsTab pour lire searchParams 'sub' (list/received/sent) et email template pointer vers /dashboard?tab=friends&sub=received.
- **Effort** : S · **Impact** : moyen

#### [P3] Header Dashboard tagline 'Decouvre les pianos' affiche meme sur Amis/Demandes

- **Où** : `src/pages/Dashboard.tsx:60-65`
- **Symptôme** : Le subtitle 'Decouvre les pianos publics autour de toi' est statique en haut du Dashboard, meme sur l onglet Amis (rien a voir avec les pianos) ou Mes demandes (support).
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: incoherence visuelle entre header et contenu (Amis). Donne l impression que le content est mal range.
- **Fix** : Soit retirer le subtitle, soit le rendre dynamique selon `tab` (e.g. 'Tes pianistes preferes' pour amis).
- **Effort** : XS · **Impact** : faible

#### [P3] DeleteAccountDialog: signOut puis redirect sans confirmation visuelle persistante

- **Où** : `src/components/Settings/DeleteAccountDialog.tsx:60-63`
- **Symptôme** : Apres delete: `toast.success('Compte supprime')` + signOut, qui declenche redirect /auth. Toast disparait dans le redirect / change de Layout. User peut ne pas avoir vu la confirmation.
- **Pourquoi (newcomer)** : Newcomer (devenu ex-user) doit voir la confirmation visuelle de sa decision irreversible. Toast qui flash et disparait = anxiete 'ai-je bien supprime?'.
- **Fix** : Avant signOut, afficher dans le Dialog un ecran 'Compte supprime' avec bouton 'Retour' explicite. Ou navigate vers /auth/goodbye qui affiche un message persistant.
- **Effort** : S · **Impact** : faible

#### [P3] ChangePasswordDialog ferme sans hint sur les autres devices connectes

- **Où** : `src/components/Settings/ChangePasswordDialog.tsx:87-91`
- **Symptôme** : Apres update password: toast.success + close dialog. Aucun ecran de feedback sur le retour SettingsPage. User ne sait pas si autres devices sont deconnectes ou non (commentaire en code dit 'ne rotate PAS le refresh token').
- **Pourquoi (newcomer)** : Newcomer mobile-first FR: incertitude securite. 'Mes autres devices sont-ils encore connectes?'.
- **Fix** : Apres update, afficher un message court 'Mot de passe mis a jour. Tes autres devices restent connectes. Pour les deconnecter, va dans Session.' (info utile + rassurant).
- **Effort** : XS · **Impact** : faible

#### [P3] OfflineBanner sans CTA retry - newcomer sans feedback sur retour reseau

- **Où** : `src/components/Layout/OfflineBanner.tsx:8-21`
- **Symptôme** : Banner affiche un message statique sans bouton 'Reessayer' ni indication d action. Newcomer qui passe en tunnel ne sait pas si l app reagira au retour reseau.
- **Pourquoi (newcomer)** : Newcomer mobile-first FR en mobilite (metro/train): voit le banner, attend mais sans feedback. Ajoute de l anxiete.
- **Fix** : Ajouter un mini bouton 'Reessayer' a droite (icone RotateCw) qui force un refetch React Query / navigator.onLine recheck. Ou auto-disparait au retour online (deja le cas mais sans animation).
- **Effort** : XS · **Impact** : faible

---

## 6. Completeness — questions complémentaires (post-workflow)

⚠️ **L'agent completeness a échoué au runtime (rate-limit)**. Cette section a été composée manuellement à partir des dimensions auxiliaires qu'il devait couvrir, basée sur la lecture des findings retenus + l'inventaire backlog connu (cf. CLAUDE.md "Reste à faire").

### Performance

#### [P2] Bundle index 25 KB gzip incompressible — Leaflet CSS importé globalement

- **Où** : `src/main.tsx:11`
- **Symptôme** : `import 'leaflet/dist/leaflet.css'` au top-level ship le CSS Leaflet sur toutes les pages, même celles sans carte (Auth, Settings, Dashboard).
- **Pourquoi (newcomer)** : Le newcomer atterrit souvent sur `/piano/:id` (lien partagé) qui n'utilise pas Leaflet. CSS payload inutile = LCP/FCP dégradé sur 4G mobile.
- **Fix** : Déplacer `import 'leaflet/dist/leaflet.css'` dans `MapPage.tsx` (au top du fichier, juste après imports React). Vite tree-shake le CSS par chunk.
- **Effort** : XS · **Impact** : moyen
- **Notes** : Mentionné dans CLAUDE.md gotchas.

#### [P2] Refetch interval 30s sur usePianoPresence multiplie les RPCs sur 500 markers

- **Où** : `src/hooks/usePianoPresence.ts:29-30,53-54`
- **Symptôme** : `refetchInterval: PRESENCE_STALE_MS` (30s) sur `usePianoActiveCounts` + `usePianoPresenceList`. Avec 500+ pianos visibles + détail piano ouvert, c'est 2 queries/30s en permanence.
- **Pourquoi (newcomer)** : Quota Supabase free tier 500MB + budget egress. À 100+ users actifs simultanément en zone dense (Paris), risque de bursts.
- **Fix** : Réduire à 60s pour le batch (`get_active_piano_counts`) ; garder 30s pour le list-per-piano (action focus). Ou implémenter Realtime presence channel Supabase au lieu du polling.
- **Effort** : S (config) ou L (Realtime) · **Impact** : moyen

#### [P3] N+1 caché dans PianoMap markers — chaque marker re-mount sur changement quality/photo

- **Où** : `src/components/Map/PianoMap.tsx:138-139`
- **Symptôme** : `key={id + quality + photo_url + active}` force Leaflet à recréer le divIcon à chaque changement → cher sur 500 markers.
- **Pourquoi (newcomer)** : Premier load avec dataset important = flash blanc + lag interactions.
- **Fix** : Utiliser `refreshIcon()` sur le marker existant au lieu de re-mount (Leaflet API).
- **Effort** : M · **Impact** : faible

### Accessibilité (a11y) au-delà des findings UX déjà couverts

#### [P2] Pas de support `prefers-reduced-motion` sur pulse-ring + slide-up + fade-in

- **Où** : `src/index.css` (animations `@keyframes` pulse-ring, slide-up, scale-in, fade-in)
- **Symptôme** : Animations toujours actives même si `prefers-reduced-motion: reduce`. Pulse rouge actif sur 500 markers = très distractif.
- **Pourquoi (newcomer)** : 25% des utilisateurs ont `prefers-reduced-motion` activé (iOS Réduction des animations, Android Animations désactivées). WCAG 2.3.3.
- **Fix** : Wrapper toutes les animations dans `@media (prefers-reduced-motion: no-preference) { ... }` ou créer une utility `.motion-safe-only`.
- **Effort** : S · **Impact** : moyen

#### [P2] Contraste `text-muted-foreground` peut tomber sous WCAG AA en dark mode

- **Où** : `src/index.css` (CSS vars `--muted-foreground`)
- **Symptôme** : Texte secondaire (date, helper text, "Inscrit il y a 2h") avec couleur `--muted-foreground` peut ne pas respecter 4.5:1 contre `--background` dark.
- **Pourquoi (newcomer)** : En extérieur (sunlight), texte de date/lieu illisible → user revient pas.
- **Fix** : Audit avec Stark/axe DevTools, ajuster les HSL pour atteindre 4.5:1 en dark. Tester `text-muted-foreground` sur `bg-card` ET `bg-background` (les 2 surfaces).
- **Effort** : XS (audit) + S (corrections) · **Impact** : moyen

### RGPD au-delà des findings sécurité

#### [P1] CookieBanner ne distingue pas cookies essentiels vs analytics — non-conforme CNIL

- **Où** : `src/components/Layout/CookieBanner.tsx:19-90`
- **Symptôme** : Banner unique "OK compris" sans option "Refuser". Si Sentry est branché (collecte d'erreurs = traitement de données), le user n'a aucun choix.
- **Pourquoi (newcomer)** : RGPD + CNIL Délibération 2020 : "Refuser doit être aussi simple qu'Accepter". Risque amende + perte de confiance utilisateur soucieux de privacy.
- **Fix** : Ajouter bouton "Refuser" qui désactive Sentry + push subscriptions auto + tout opt-in non-essentiel. Distinguer dans le wording : "cookies de fonctionnement (obligatoires)" vs "mesures d'audience (optionnel)".
- **Effort** : S · **Impact** : fort
- **Notes** : Si pas de tracking analytics, le CookieBanner actuel est correct mais devrait expliciter "PianoWorld n'utilise pas de cookies de tracking" pour rassurer.

#### [P2] Export RGPD ne mentionne pas les données dérivées (recommandations, scores)

- **Où** : `supabase/schema.sql` `export_my_data()` lignes 2932-3004
- **Symptôme** : Export couvre toutes les tables source. v7+ pourrait ajouter des données dérivées (badges futurs, recommandations, scores virtualisés) qui ne seraient pas exportées.
- **Pourquoi (newcomer)** : Préventif — quand on ajoutera badges/XP/recommandations, oublier de les inclure expose à plaintes RGPD.
- **Fix** : Documenter dans docs/SECURITY.md une checklist "à chaque nouvelle table user-tied, étendre export_my_data" + ajouter un test snapshot du JSON shape.
- **Effort** : XS · **Impact** : faible

### Scalability free tier

#### [P2] Quota Supabase 500 MB DB se rapproche vite avec piano_visits + audit_log

- **Où** : `supabase/schema.sql` table `piano_visits`, `audit_log`, `notifications_outbox`
- **Symptôme** : 50 visites/user/24h × 1000 users actifs × 365j = ~18M rows piano_visits/an. Plus audit_log + notifications_outbox. À ~200 bytes/row → 3.6 GB/an. Free tier 500 MB.
- **Pourquoi (newcomer)** : Quand l'app scale, l'écran "service maintenance" remplace l'app sans warning.
- **Fix** : Ajouter pg_cron purge nightly sur `piano_visits` plus vieux que 365j + audit_log (déjà fait pour outbox). Documenter dans docs/DEVELOPMENT.md.
- **Effort** : XS · **Impact** : moyen
- **Notes** : Cf. `purge_old_notifications()` pattern existant.

#### [P3] Bundle 100 KB gzip budget se serre — index 25.66 KB actuel, plus PR-B v7 + futurs Realtime

- **Où** : `.github/workflows/ci.yml` budget check
- **Symptôme** : Index chunk croît à chaque feature. PR-B v7 ajoute Search + Favori + EditNames = +5-10 KB.
- **Pourquoi (newcomer)** : Mobile 4G : 100 KB = ~500ms TTI sur ralenti. Si budget cassé en CI, deploys bloqués.
- **Fix** : Audit `vite-bundle-visualizer` → identifier ce qui devrait être lazy (Sentry init, web-push API, dayjs locale FR).
- **Effort** : S · **Impact** : faible

### Maintenance debt

#### [P2] Comment header Dashboard.tsx dit "3 onglets" alors qu'il y en a 5

- **Où** : `src/pages/Dashboard.tsx:15-22`
- **Symptôme** : JSDoc obsolète. Cumulé avec d'autres comments stales = confusion pour devs ultérieurs.
- **Fix** : Mettre à jour le commentaire ou le supprimer. Pareil partout où des comments décrivent un état périmé.
- **Effort** : XS · **Impact** : faible
- **Notes** : Documenté dans CLAUDE.md gotchas.

#### [P3] Pas de dead-code detection en CI

- **Où** : `.github/workflows/ci.yml`
- **Symptôme** : ESLint warn `@typescript-eslint/no-unused-vars` mais pas de check sur les exports inutilisés ou les fichiers orphelins.
- **Fix** : Ajouter `knip` ou `ts-prune` en CI (continue-on-error).
- **Effort** : S · **Impact** : faible

### Testabilité

#### [P1] 0 tests pour les hooks v6 (useFriends, usePianoPresence) malgré logique optimistic + rollback complexe

- **Où** : `src/hooks/useFriends.ts`, `src/hooks/usePianoPresence.ts` (pas de `__tests__/` correspondants)
- **Symptôme** : Mutations avec optimistic + rollback en cas d'erreur RPC = code critique non testé. Régression possible silencieuse.
- **Pourquoi (newcomer)** : Si une mutation rollback mal, l'état UI diverge du serveur → newcomer voit un état contradictoire ("Demande envoyée" ET "Ajouter en ami" simultanément).
- **Fix** : Ajouter MSW (Mock Service Worker) + tests Vitest sur le rollback path. Au moins 5 tests sur `useFriends.sendRequest/acceptRequest/rejectRequest`.
- **Effort** : M · **Impact** : moyen
- **Notes** : Backlog B.3 mentionné dans CLAUDE.md.

#### [P2] Pas de Playwright e2e pour les golden paths (signup → ajout piano → MAJ → favoris)

- **Où** : Aucun dossier `e2e/`
- **Symptôme** : Toute régression cross-component (signup → confirm email → first piano) n'est attrapée qu'à la main.
- **Fix** : Setup Playwright + 3 tests : (1) signup happy path, (2) ajout piano, (3) friend request mutual flow.
- **Effort** : L · **Impact** : moyen
- **Notes** : Backlog B.5.

### Internationalisation

#### [P2] FR hardcodé partout — pas de framework i18n

- **Où** : `src/**/*.tsx` (toutes les chaînes UI), `src/lib/constants.ts` (labels), `src/lib/schemas.ts` (messages d'erreur zod), `supabase/functions/send-notification/templates.ts` (mails)
- **Symptôme** : Quand le projet voudra s'étendre Belgique/Suisse/Canada FR/Europe, il faudra refactor toute la copy. Pas de `react-intl` ou `i18next`.
- **Pourquoi (newcomer)** : Pas un problème actuel (newcomer FR), mais bloquant à l'expansion.
- **Fix** : Court terme : centraliser les strings dans un `src/lib/copy.ts` (FR uniquement). Moyen terme : migrer vers `i18next` quand le besoin réel se présente.
- **Effort** : L · **Impact** : faible (court terme), fort (long terme)

### Résilience

#### [P2] Supabase pausé 7j : flux d'auth peut afficher splash 8s puis timeout sans message clair

- **Où** : `src/contexts/AuthContext.tsx` safety timer
- **Symptôme** : Si le projet est en pause Supabase, le premier accès met 5-30s à réveiller la DB. Le safety timer 8s déclenche → UI dégradée sans explication.
- **Pourquoi (newcomer)** : Premier accès = mauvaise impression. "L'app est cassée."
- **Fix** : Détecter timeout vs vraie erreur. Afficher message "Service en réveil, encore quelques secondes..." si Supabase répond pas dans 5s mais le ping reste.
- **Effort** : M · **Impact** : faible (rare)

#### [P3] Edge Function down → notifications silencieusement perdues jusqu'au prochain pg_cron retry

- **Où** : `supabase/functions/send-notification/index.ts` + pg_cron retry \*/5
- **Symptôme** : Si Edge Function 502/timeout, la row outbox reste pending, retry exponentiel 2/4/8/16/32 min. Mais pas de monitoring/alerting.
- **Fix** : Sentry capture côté Edge Function pour les errors + dashboard Supabase Logs.
- **Effort** : S · **Impact** : faible

### Observabilité

#### [P2] Aucune métrique business (signups/jour, pianos ajoutés/semaine, friend requests, favoris créés)

- **Où** : Inexistant
- **Symptôme** : Impossible de mesurer la croissance, l'engagement, le taux d'abandon.
- **Pourquoi (newcomer)** : Indirect — sans data, impossible d'optimiser l'onboarding qui le concerne.
- **Fix** : Ajouter une vue SQL `public.daily_metrics` (admin-only) avec counts. Ou intégrer Plausible Analytics côté frontend (RGPD-friendly, sans cookie).
- **Effort** : M · **Impact** : moyen (pour le projet, pas le newcomer)

#### [P3] Sentry events budget 5000/mois — sans dashboard d'usage, risque de cap atteint silencieusement

- **Où** : `src/lib/sentry.ts`
- **Symptôme** : Si un bug spam Sentry, le quota se vide en quelques jours et les vrais events suivants ne remontent pas.
- **Fix** : Ajouter `maxBreadcrumbs: 50` + `sampleRate: 0.5` sur les events non-critiques. Suivre via Sentry UI "Stats".
- **Effort** : XS · **Impact** : faible

### Modération

#### [P2] Aucun outil au-delà du `force_delete_piano` + ban binaire

- **Où** : `src/pages/AdminPage.tsx` + `supabase/schema.sql` RPCs admin
- **Symptôme** : Spam commentaire profanity → admin doit force-delete piano entier (perd l'historique). Doxing dans `pianos.comment` ou `piano_updates.comment` → soft-delete le piano ne corrige pas l'historique.
- **Pourquoi (newcomer)** : Indirect — si l'app a du contenu sale visible, le newcomer la quitte sans revenir.
- **Fix** : Ajouter RPC `admin_edit_piano_comment(piano_id, new_comment)` + `admin_redact_update(update_id)` qui remplace par "[Contenu retiré]". Audit log obligatoire.
- **Effort** : M · **Impact** : moyen

### Pédagogie

#### [P2] Le pourquoi de "Refuser silencieux" + cooldown 30j n'est expliqué nulle part au demandeur

- **Où** : UI v6 friends — `AddFriendButton` + `FriendRequestCard` + page Settings
- **Symptôme** : User envoie demande → 60 jours plus tard, status toujours "Demande envoyée". Pas de feedback. Il retente, le RPC raise "forbidden" silencieux (cooldown). Frustration max.
- **Pourquoi (newcomer)** : Mauvaise expérience sociale = mauvaise rétention.
- **Fix** : Documenter dans un footer Help "Si ta demande n'a pas de réponse depuis longtemps, c'est peut-être que la personne préfère ne pas l'accepter. Reprends contact en personne." Et corriger `AddFriendButton` pour afficher "En attente — pas de réponse" plutôt que "Demande envoyée" après 30j (cf. backlog C.3).
- **Effort** : M · **Impact** : moyen
- **Notes** : Décision UX cohérente (ghost-reject = anti-stalking) mais pédagogie nulle.

### Motivation / feedback positif

#### [P2] Aucune célébration au premier ajout de piano ni à la première amitié

- **Où** : `src/components/Map/AddPianoFlow.tsx`, `src/hooks/useFriends.ts`
- **Symptôme** : Premier ajout piano = succès silencieux (juste un toast). Première amitié acceptée = idem. Aucun gain perçu.
- **Pourquoi (newcomer)** : Première action = première dopamine. Sans renforcement positif, retention faible.
- **Fix** : Modal de succès (confetti CSS) au 1er ajout : "🎹 Ton premier piano ! Merci de contribuer." Ou badge "Premier contributeur" temporaire dans le profile. Tracker via localStorage `pianoworld:milestones`.
- **Effort** : S · **Impact** : moyen
- **Notes** : Backlog produit (cf. docs/FONCTIONNALITES.md section idées) — la gamification est listée comme "quick win" rétention.

#### [P3] Aucun système XP/badge/level

- **Où** : N/A
- **Symptôme** : 100% des actions (ajouts, MAJ, visites, sessions) ne donnent aucun feedback gradué.
- **Fix** : Vue SQL `user_stats(user_id, total_pianos_added, total_updates, total_visits, total_sessions, level)` + composant `UserBadges` sur `/user/:pseudo`.
- **Effort** : L · **Impact** : moyen
- **Notes** : Cf. roadmap docs/FONCTIONNALITES.md.

---

## Synthèse priorisée (Pareto)

Tous les findings classés par **effort × impact** (du meilleur ROI au plus coûteux).

### Top 30 ROI (Pareto)

| #   | Sev | Effort | Impact | Titre                                                                   | Fichier                                                     |
| --- | --- | ------ | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | P0  | S      | fort   | AddFriendButton Accepter/Refuser inline casse - findPendingId stub ret… | `src/components/Friends/AddFriendButton.tsx:55-61, 115-153` |
| 2   | P1  | XS     | fort   | Bouton X close Dialog sous 44px (p-1 + h-5 icon = 28px hit area)        | `src/components/ui/Dialog.tsx:39-46`                        |
| 3   | P1  | XS     | fort   | FAB MapPage bottom-4 sans safe-area : collision avec home indicator iP… | `src/pages/MapPage.tsx:13-20`                               |
| 4   | P1  | XS     | moyen  | Dialog X dupliqué : 2 boutons Fermer dans le DOM (backdrop + icone) - … | `src/components/ui/Dialog.tsx:27-46`                        |
| 5   | P1  | XS     | moyen  | VisitButton 'J'y suis passé' contredit ActivityTab 'a joué ici'         | `src/components/Piano/VisitButton.tsx:55`                   |
| 6   | P1  | S      | fort   | Tap targets icon-only sous 44px sur PianoPage header (Pencil/Trash2 hi… | `src/pages/PianoPage.tsx:63-89`                             |
| 7   | P1  | S      | fort   | OfflineBanner top fixe sans compensation du main - cache le header de … | `src/components/Layout/OfflineBanner.tsx:11-20`             |
| 8   | P1  | S      | fort   | EmptyState ActivityTab 0 piano - CTA discret en lien text-xs            | `src/components/Dashboard/ActivityTab.tsx:99-113`           |
| 9   | P1  | S      | fort   | Favori vs Bookmark vs Suivre v7 : label final pas tranché               | `src/types/database.ts:97-99`                               |
| 10  | P1  | S      | fort   | Notification email vers /dashboard deconnecte perd la destination       | `src/App.tsx:53-67`                                         |
| 11  | P1  | S      | moyen  | Tab Evenements vide a vie pour 99% des users solo                       | `src/components/Events/EventsTab.tsx:22-32`                 |
| 12  | P1  | S      | moyen  | Tutorial non re-lancable depuis Settings (4e gap d onboarding)          | `src/components/Onboarding/Tutorial.tsx:33-46`              |
| 13  | P1  | S      | moyen  | CookieBanner 800ms et Tutorial popup -> double pile de modals au landi… | `src/components/Layout/CookieBanner.tsx:22-32`              |
| 14  | P1  | M      | fort   | CSP autorise 'unsafe-inline' sur script-src + style-src (XSS pivot)     | `vercel.json:37`                                            |
| 15  | P1  | M      | fort   | Doublon Activite vs Communaute - newcomer confusion                     | `src/pages/Dashboard.tsx:78-103`                            |
| 16  | P1  | M      | fort   | Ghost-reject + cooldown 30j invisible - demandeur frustre               | `src/components/Friends/FriendRequestCard.tsx:11-20`        |
| 17  | P1  | M      | fort   | Combo Visit (Passage) + Session (J'y vais) déroutant pour newcomer      | `src/components/Piano/PianoActivity.tsx:27-30`              |
| 18  | P1  | M      | fort   | Dashboard 5 onglets sur mobile 360-414px - debordement obligatoire      | `src/pages/Dashboard.tsx:77-95`                             |
| 19  | P1  | M      | fort   | Aucun bouton 'Ajouter aux favoris' sur PianoPage alors que la feature … | `src/pages/PianoPage.tsx:148-152`                           |
| 20  | P1  | M      | fort   | Push opt-in seulement dans Settings, jamais propose dans le flow onboa… | `src/components/Settings/NotificationPreferences.tsx:41-74` |
| 21  | P1  | M      | fort   | Geoloc demandee uniquement dans AddPianoFlow - pas d anticipation pour… | `src/pages/MapPage.tsx:10-25`                               |
| 22  | P1  | L      | fort   | Signup sans rate-limit IP (botnet → flooding signups → spam Resend quo… | `src/contexts/AuthContext.tsx:131-175`                      |
| 23  | P2  | XS     | fort   | AddPianoFlow modal fullscreen sans safe-area-top : header cache sous l… | `src/components/Map/AddPianoFlow.tsx:182-192`               |
| 24  | P2  | XS     | fort   | verify_my_password : pas de protection contre brute-force online        | `supabase/schema.sql:974-996`                               |
| 25  | P2  | XS     | fort   | Dashboard tab 'Mes demandes' ambigu : feedback admin vs amitié          | `src/pages/Dashboard.tsx:89-94`                             |
| 26  | P2  | XS     | moyen  | Tutorial localStorage sans try/catch - re-pop sur Safari incognito      | `src/components/Onboarding/Tutorial.tsx:33-46`              |
| 27  | P2  | XS     | moyen  | AddPianoFlow geoloc refusee : toast generique sans CTA fallback explic… | `src/components/Map/AddPianoFlow.tsx:101-109`               |
| 28  | P2  | XS     | moyen  | card-hover :hover sticky sur touch device - shadow reste apres tap-rel… | `src/index.css:191-198`                                     |
| 29  | P2  | XS     | moyen  | Animations sans prefers-reduced-motion - pulse-ring infinie + slide mo… | `src/index.css:152-222`                                     |
| 30  | P2  | XS     | moyen  | delete_my_account non audité (anonymous deletes invisibles)             | `supabase/schema.sql:1293-1309`                             |

### Quick wins recommandés (XS effort × impact fort/moyen, severities P1+P2)

| Sev | Titre                                                                             | Impact | Fichier                                                       |
| --- | --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| P1  | Bouton X close Dialog sous 44px (p-1 + h-5 icon = 28px hit area)                  | fort   | `src/components/ui/Dialog.tsx:39-46`                          |
| P1  | Dialog X dupliqué : 2 boutons Fermer dans le DOM (backdrop + icone) - bruit scre… | moyen  | `src/components/ui/Dialog.tsx:27-46`                          |
| P1  | FAB MapPage bottom-4 sans safe-area : collision avec home indicator iPhone        | fort   | `src/pages/MapPage.tsx:13-20`                                 |
| P2  | Tutorial localStorage sans try/catch - re-pop sur Safari incognito                | moyen  | `src/components/Onboarding/Tutorial.tsx:33-46`                |
| P2  | AddPianoFlow modal fullscreen sans safe-area-top : header cache sous le notch     | fort   | `src/components/Map/AddPianoFlow.tsx:182-192`                 |
| P2  | AddPianoFlow geoloc refusee : toast generique sans CTA fallback explicite         | moyen  | `src/components/Map/AddPianoFlow.tsx:101-109`                 |
| P2  | card-hover :hover sticky sur touch device - shadow reste apres tap-release        | moyen  | `src/index.css:191-198`                                       |
| P2  | Animations sans prefers-reduced-motion - pulse-ring infinie + slide modal         | moyen  | `src/index.css:152-222`                                       |
| P2  | verify_my_password : pas de protection contre brute-force online                  | fort   | `supabase/schema.sql:974-996`                                 |
| P2  | delete_my_account non audité (anonymous deletes invisibles)                       | moyen  | `supabase/schema.sql:1293-1309`                               |
| P2  | pg*cron purges non documentées comme actives (friend_arriving_dedup, friendship*… | moyen  | `supabase/schema.sql:1855, 1869, 3042-3057`                   |
| P2  | search_pianos retourne created_by uuid → association piano↔user même si banned    | moyen  | `supabase/schema.sql:2753-2809`                               |
| P2  | SessionDialog promet une notif aux amis qui ne partira pas (0 ami)                | moyen  | `src/components/Piano/SessionDialog.tsx:193-244`              |
| P2  | AddPianoFlow - confirm abandon trop sensible (coords seuls = dirty)               | moyen  | `src/components/Map/AddPianoFlow.tsx:70-72, 123-126, 356-385` |
| P2  | Mental-model Visite vs Session pas explicite                                      | moyen  | `src/components/Piano/PianoActivity.tsx:27-30`                |
| P2  | Feeds Dashboard figes - pas de refetchInterval                                    | moyen  | `src/hooks/useRecentFeed.ts:77-115`                           |
| P2  | PianoShareButton - aucun partage de l'app elle-meme                               | moyen  | `src/pages/PianoPage.tsx:148-152`                             |
| P2  | Premier ajout piano - geoloc immediate sans pre-explication                       | moyen  | `src/components/Map/AddPianoFlow.tsx:227-247`                 |
| P1  | VisitButton 'J'y suis passé' contredit ActivityTab 'a joué ici'                   | moyen  | `src/components/Piano/VisitButton.tsx:55`                     |
| P2  | Dashboard tab 'Mes demandes' ambigu : feedback admin vs amitié                    | fort   | `src/pages/Dashboard.tsx:89-94`                               |
| P2  | Tutorial slide 3 'Mets-le à jour' ambigu sur l'objet                              | moyen  | `src/components/Onboarding/Tutorial.tsx:17-21`                |
| P2  | PianoPresenceCounter 'X session(s) en cours' compte sessions, pas humains         | moyen  | `src/components/Piano/PianoPresenceCounter.tsx:52-53`         |
| P2  | Banned user message 'Ce compte a été suspendu' sans next-step                     | moyen  | `src/contexts/AuthContext.tsx:225`                            |
| P2  | NavBar: ordre Accueil/Carte/Recherche/Parametres pas mobile-first FR optimal      | moyen  | `src/components/Layout/NavBar.tsx:5-10`                       |
| P2  | PianoShareButton intitule 'Partager' - manque promesse 'envoyer a un ami'         | moyen  | `src/components/Piano/PianoShareButton.tsx:32-37`             |
| P2  | AddFriendButton sur UserPage sans contexte d explication preventive               | moyen  | `src/pages/UserPage.tsx:67-69`                                |
| P2  | Browser back sur PianoPage navigate(-1) peut envoyer hors app (deep link)         | moyen  | `src/pages/PianoPage.tsx:63-69`                               |
| P2  | UserPage 'Retour' meme probleme: deep link vers /user/:pseudo sort de l app       | moyen  | `src/pages/UserPage.tsx:42-48`                                |

**28 quick wins XS effort identifiés.** Faire ces 5-10 premiers en priorité = gain énorme pour < 1 journée de dev.

### Investissements long-terme (effort L × impact fort)

| Sev | Titre                                                                              | Fichier                                |
| --- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| P2  | push_subscriptions p256dh + auth_secret stockés en clair (DB leak = push spoofing) | `supabase/schema.sql:598-607`          |
| P1  | Signup sans rate-limit IP (botnet → flooding signups → spam Resend quota)          | `src/contexts/AuthContext.tsx:131-175` |
| P2  | 2FA admin absent — vol de session admin = takeover total                           | `supabase/schema.sql:245-282`          |

---

## Anti-features — décisions explicites de NE PAS faire

Décisions positives de ne PAS implémenter certaines choses, pour clarifier la vision produit et éviter le scope creep.

### 1. Pas de modération automatique des photos par IA en MVP

**Pourquoi** : v7 free-tier, pas de budget OpenAI Vision ni Replicate. Faux positifs coûteux UX. La modération communautaire (`PianoReportButton` + admin `force_delete_piano`) suffit jusqu'à 10k pianos.
**Quand revoir** : si > 50 reports/jour, alors investir dans une Edge Function process-photo + heuristique simple (taille / format / EXIF GPS strip).

### 2. Pas de "Block user" v1, le cooldown 30j suffit

**Pourquoi** : `friendship_rejections` cooldown 30j sur re-demande couvre ~90% des cas de stalking. Le block hard ajoute complexité (table dédiée + RLS + UI) sans valeur claire pour le persona newcomer mobile-first.
**Quand revoir** : si retours utilisateurs explicites "j'ai besoin de bloquer X", alors créer table `user_blocks` + RPCs.

### 3. Pas d'i18n multi-langues en v7

**Pourquoi** : 100% FR pour MVP. Migration `i18next` = effort L sans valeur immédiate (aucun utilisateur non-FR).
**Quand revoir** : quand 10% des inscriptions viennent d'IP non-FR, alors démarrer l'extraction des strings et la migration.

### 4. Pas de Realtime presence channel Supabase

**Pourquoi** : le polling 30s sur `get_active_piano_counts` est suffisant pour 99% des cas. Realtime = complexité socket + RLS subscription + edge cases déconnexion.
**Quand revoir** : quand 100+ users simultanés constants sur la carte, ou quand le quota Supabase egress devient un problème.

### 5. Pas de notification SMS, juste mail + push

**Pourquoi** : Twilio coûte. Push est gratuit (VAPID) et mail est gratuit (Resend 3000/mois). Si push fail → mail fallback.
**Quand revoir** : jamais, sauf cas particulier (vérification 2FA par SMS pour admins).

### 6. Pas d'audit log sur `delete_my_account` ni `toggle_piano_favorite`

**Pourquoi** : RGPD — ne pas créer un registre des suppressions ni des intérêts utilisateur. L'audit log est admin-only et trace les actions admin/destructives sur d'autres users, pas les actions self.
**Quand revoir** : jamais. Décision RGPD intentionnelle.

### 7. Pas de paywall ni de pub

**Pourquoi** : la valeur communautaire (carte gratuite + open data) est le pilier. Monétisation par dons + premium léger plus tard si besoin.
**Quand revoir** : quand le quota free tier sature et que les dons ne couvrent pas. Étudier "premium" léger (thèmes / badges / stats avancées) avant la pub.

---

## Annexe — index des fichiers référencés

### `PianoWorld/supabase/functions/send-notification/templates.ts` (1)

- [P2/comprehension-words] Mail subject friend_arriving > 80 chars dépasse preview mobile

### `src/App.tsx` (4)

- [P2/navigation-discoverability] Pas de route /me ni de lien 'Mon profil' - newcomer ne peut pas voir son profil
- [P1/navigation-discoverability] Notification email vers /dashboard deconnecte perd la destination
- [P2/navigation-discoverability] Catchall `/*` redirige vers `/` sans message - perte de feedback URL invalide
- [P2/navigation-discoverability] Suspense SplashScreen plein ecran entre routes - flash brutal

### `src/components/Auth/ConfirmPending.tsx` (2)

- [P3/ux-mobile] ConfirmPending : pas d'auto-detection session confirmed - newcomer reste bloque
- [P2/comprehension-words] ConfirmPending : 'Vérifie tes spams' message tardif

### `src/components/Auth/ResetPasswordForm.tsx` (1)

- [P3/comprehension-words] ResetPasswordForm 'Confirmer' label trop court

### `src/components/Auth/SignupForm.tsx` (2)

- [P3/ux-mobile] SignupForm checkbox CGU 16x16 - cible trop petite, erreur acceptCgu hors viewport
- [P3/comprehension-words] CGU checkbox SignupForm : lien \_blank perd contexte mobile

### `src/components/Community/CommunityTab.tsx` (2)

- [P2/ux-mobile] CommunityTab toggle Calendar/List non persiste - reset 'list' a chaque visite
- [P2/ux-mobile] Calendar 14j horizontal sans scroll-snap - days coupes 50/50 au swipe

### `src/components/Dashboard/ActivityTab.tsx` (1)

- [P1/utility-gaps] EmptyState ActivityTab 0 piano - CTA discret en lien text-xs

### `src/components/Events/EventsTab.tsx` (1)

- [P1/utility-gaps] Tab Evenements vide a vie pour 99% des users solo

### `src/components/Friends/AddFriendButton.tsx` (4)

- [P2/ux-mobile] AddFriendButton pending_received : findPendingId stub - tap Accepter ne fait rien
- [P0/utility-gaps] AddFriendButton Accepter/Refuser inline casse - findPendingId stub retourne null
- [P3/utility-gaps] AddFriendButton pending_received sans contexte d'origine
- [P2/comprehension-words] isRateLimitError toast 'réessaie demain' faux

### `src/components/Friends/FriendRequestCard.tsx` (1)

- [P1/utility-gaps] Ghost-reject + cooldown 30j invisible - demandeur frustre

### `src/components/Friends/FriendsTab.tsx` (2)

- [P3/utility-gaps] FriendsTab - 3 sous-tabs alors que Envoyees rarement consulte
- [P3/comprehension-words] Friends tabs 'Reçues / Envoyées' perdent le mot 'Demandes'

### `src/components/Friends/RemoveFriendDialog.tsx` (2)

- [P3/utility-gaps] Aucun undo destructive - retirer ami, supprimer piano, push off
- [P3/comprehension-words] Confirmation 'retirer' RemoveFriendDialog : friction power-user

### `src/components/Layout/CookieBanner.tsx` (4)

- [P2/ux-mobile] CookieBanner z-[1200] cache la NavBar + FAB pendant les premieres 800ms
- [P3/security-privacy] CookieBanner : transparence CNIL OK mais pas de mention durée + finalité par cookie
- [P3/comprehension-words] CookieBanner CTA 'OK, compris' implique faux consentement
- [P1/navigation-discoverability] CookieBanner 800ms et Tutorial popup -> double pile de modals au landing

### `src/components/Layout/NavBar.tsx` (2)

- [P2/ux-mobile] NavBar 4 items deja serre sur 320px - 5e onglet futur tronque les labels
- [P2/navigation-discoverability] NavBar: ordre Accueil/Carte/Recherche/Parametres pas mobile-first FR optimal

### `src/components/Layout/OfflineBanner.tsx` (2)

- [P1/ux-mobile] OfflineBanner top fixe sans compensation du main - cache le header de chaque page
- [P3/navigation-discoverability] OfflineBanner sans CTA retry - newcomer sans feedback sur retour reseau

### `src/components/Layout/RequireAdmin.tsx` (1)

- [P2/navigation-discoverability] RequireAdmin redirige silencieusement sur / si non-admin - sans toast d info

### `src/components/Map/AddPianoFlow.tsx` (8)

- [P2/ux-mobile] AddPianoFlow modal fullscreen sans safe-area-top : header cache sous le notch
- [P2/ux-mobile] AddPianoFlow geoloc refusee : toast generique sans CTA fallback explicite
- [P3/ux-mobile] Photo upload : pas de progress indicator - newcomer pense l'app figee en 3G
- [P2/utility-gaps] AddPianoFlow - confirm abandon trop sensible (coords seuls = dirty)
- [P2/utility-gaps] Alerte doublon piano 50m trop discrete - newcomer cree des doublons
- [P2/utility-gaps] Premier ajout piano - geoloc immediate sans pre-explication
- [P3/utility-gaps] Compteur de caracteres AddPianoFlow comment - micro-friction permanente
- [P3/comprehension-words] CTAs verbes mélangés : impératif / infinitif / 1re personne

### `src/components/Map/MapFilters.tsx` (2)

- [P2/comprehension-words] 'Encore là' / 'Disparu' présence binaire trop tranchée
- [P2/comprehension-words] MapFilters 'Disparus' ambigu : soft-deleted ou MAJ négative ?

### `src/components/Onboarding/Tutorial.tsx` (7)

- [P2/ux-mobile] Tutorial 4 slides obligatoires bloque l'entree via lien partage
- [P2/ux-mobile] Tutorial localStorage sans try/catch - re-pop sur Safari incognito
- [P3/utility-gaps] Tutorial 100% passif - lecture pure sans action et non relancable
- [P2/comprehension-words] Tutorial 4 slides sans mention 'Installer la PWA'
- [P2/comprehension-words] Tutorial slide 3 'Mets-le à jour' ambigu sur l'objet
- [P1/navigation-discoverability] Tutorial non re-lancable depuis Settings (4e gap d onboarding)
- [P2/navigation-discoverability] Tutorial CTA 'Passer' bouton minuscule peu accessible (cible <44px)

### `src/components/Piano/EditPianoForm.tsx` (1)

- [P2/ux-mobile] EditPianoForm bouton X sans padding (24x24px) + pas de garde isDirty au close

### `src/components/Piano/PianoActivity.tsx` (2)

- [P2/utility-gaps] Mental-model Visite vs Session pas explicite
- [P1/comprehension-words] Combo Visit (Passage) + Session (J'y vais) déroutant pour newcomer

### `src/components/Piano/PianoPresenceCounter.tsx` (1)

- [P2/comprehension-words] PianoPresenceCounter 'X session(s) en cours' compte sessions, pas humains

### `src/components/Piano/PianoReportButton.tsx` (2)

- [P3/utility-gaps] PianoReportButton volontairement discret - OK ne pas modifier
- [P2/comprehension-words] PianoReportButton placeholder guide insuffisant

### `src/components/Piano/PianoShareButton.tsx` (1)

- [P2/navigation-discoverability] PianoShareButton intitule 'Partager' - manque promesse 'envoyer a un ami'

### `src/components/Piano/PianoUpdateForm.tsx` (2)

- [P2/utility-gaps] PianoUpdateForm - 3 champs alors qu'un seul suffirait au newcomer
- [P3/comprehension-words] PianoUpdateForm 'toujours là' / 'encore là' synonymes incohérents

### `src/components/Piano/SessionDialog.tsx` (3)

- [P2/utility-gaps] SessionDialog promet une notif aux amis qui ne partira pas (0 ami)
- [P3/comprehension-words] Visibility 'Mes amis uniquement' newcomer sans amis = piège
- [P3/comprehension-words] SessionDialog Durée espace incohérent : '60min' vs '1h 30'

### `src/components/Piano/VisitButton.tsx` (3)

- [P3/utility-gaps] Aucun feedback positif post-action (XP, badges, animation)
- [P3/utility-gaps] VisitButton vs PianoUpdateForm still_there - redondance semantique
- [P1/comprehension-words] VisitButton 'J'y suis passé' contredit ActivityTab 'a joué ici'

### `src/components/Requests/MyRequestsTab.tsx` (2)

- [P2/utility-gaps] MyRequestsTab pas relie au flow newcomer - bruit permanent
- [P2/navigation-discoverability] MyRequestsTab EmptyState sans CTA - cul-de-sac visuel

### `src/components/Settings/ChangePasswordDialog.tsx` (2)

- [P3/security-privacy] ChangePasswordDialog : pas de signOut des autres devices après changement
- [P3/navigation-discoverability] ChangePasswordDialog ferme sans hint sur les autres devices connectes

### `src/components/Settings/DeleteAccountDialog.tsx` (1)

- [P3/navigation-discoverability] DeleteAccountDialog: signOut puis redirect sans confirmation visuelle persistante

### `src/components/Settings/ExportDataButton.tsx` (1)

- [P2/navigation-discoverability] ExportDataButton sans hint sur ce qu il contient - usefulness opaque

### `src/components/Settings/NotificationPreferences.tsx` (2)

- [P2/utility-gaps] NotificationPreferences - 5 toggles + push opt-in trop fine, sans preset
- [P1/navigation-discoverability] Push opt-in seulement dans Settings, jamais propose dans le flow onboarding

### `src/components/ui/Avatar.tsx` (1)

- [P3/ux-mobile] Avatar HSL : collisions de couleur sur pseudos courts - confusion identite

### `src/components/ui/Dialog.tsx` (5)

- [P1/ux-mobile] Bouton X close Dialog sous 44px (p-1 + h-5 icon = 28px hit area)
- [P1/ux-mobile] Dialog X dupliqué : 2 boutons Fermer dans le DOM (backdrop + icone) - bruit screen reader
- [P2/ux-mobile] Dialog : pas d'auto-focus sur premier input quand ouvert
- [P2/ux-mobile] Bottom-sheet Dialog : pas de drag handle ni swipe-to-close (gesture mobile attendu)
- [P2/ux-mobile] Dialog focus pas piege - Tab sort de la modal vers le contenu en arriere-plan

### `src/components/ui/Tabs.tsx` (1)

- [P2/ux-mobile] Tabs : pas de navigation clavier ArrowLeft/ArrowRight (C.2 backlog)

### `src/contexts/AuthContext.tsx` (4)

- [P1/security-privacy] Signup sans rate-limit IP (botnet → flooding signups → spam Resend quota)
- [P3/security-privacy] AuthContext safety timer 8s : état corrompu si signup en cours (loading=false avant fetchProfile)
- [P3/security-privacy] is_banned : user banni peut continuer 5min avant que session client expire
- [P2/comprehension-words] Banned user message 'Ce compte a été suspendu' sans next-step

### `src/hooks/useRecentFeed.ts` (2)

- [P2/utility-gaps] Feeds Dashboard figes - pas de refetchInterval
- [P3/utility-gaps] useRecentFeed - 4 requetes parallel + merge client, scale latent

### `src/index.css` (2)

- [P2/ux-mobile] card-hover :hover sticky sur touch device - shadow reste apres tap-release
- [P2/ux-mobile] Animations sans prefers-reduced-motion - pulse-ring infinie + slide modal

### `src/lib/constants.ts` (1)

- [P3/comprehension-words] NOTIFICATION_SECTION_LABELS 'Mes pianos' possessif ambigu v7

### `src/lib/errors.ts` (2)

- [P2/comprehension-words] getErrorMessage fallback 'Une erreur est survenue' sans next-step
- [P3/comprehension-words] isPermissionDenied jamais converti en message FR utilisateur

### `src/lib/photo.ts` (1)

- [P2/security-privacy] Photos uploadées non strippées EXIF (GPS leak via metadata)

### `src/lib/sentry.ts` (3)

- [P2/security-privacy] Sentry scrubber incomplet : pas de téléphone / IPv6 / UA / coordonnées GPS
- [P3/security-privacy] Sentry beforeSend : pas de safeguard contre infinite loop (scrubDeep peut crash → re-trigger)
- [P3/security-privacy] VITE_SENTRY_DSN exposé client-side : facile à abuser (spam Sentry quota)

### `src/main.tsx` (1)

- [P2/ux-mobile] Toast Toaster top-center entre en collision avec OfflineBanner et headers sticky

### `src/pages/AdminPage.tsx` (2)

- [P2/ux-mobile] AdminPage tab state non URL-synced - back navigation perd le contexte (C.4)
- [P2/navigation-discoverability] AdminPage tabs non sync URL - lien partageable impossible (C.4 backlog)

### `src/pages/AuthPage.tsx` (4)

- [P3/comprehension-words] AuthPage 'Bon retour' / 'Rejoins l'aventure' tons inégaux
- [P2/navigation-discoverability] Post-signup redirect tombe sur la carte sans onboarding contextuel
- [P2/navigation-discoverability] /auth/reset accessible meme connecte - pas d alerte si user dejà logge
- [P2/navigation-discoverability] AuthLayout branding repete sans tagline produit pour landing newcomer

### `src/pages/Dashboard.tsx` (9)

- [P2/ux-mobile] Dashboard 5 onglets scrollable sans indicateur visuel d'overflow droite
- [P3/ux-mobile] Pas de pull-to-refresh ni refetch manuel - feed Communaute/Friends stale
- [P1/utility-gaps] Doublon Activite vs Communaute - newcomer confusion
- [P2/utility-gaps] Tab Mes demandes prend un slot pour usage tres rare
- [P3/utility-gaps] Tab Mes demandes label peu accrocheur - confusion avec demandes d'amis
- [P2/comprehension-words] Dashboard tab 'Mes demandes' ambigu : feedback admin vs amitié
- [P1/navigation-discoverability] Dashboard 5 onglets sur mobile 360-414px - debordement obligatoire
- [P3/navigation-discoverability] URL deep-link Dashboard ne porte pas la sub-tab d Amis (received/sent)
- [P3/navigation-discoverability] Header Dashboard tagline 'Decouvre les pianos' affiche meme sur Amis/Demandes

### `src/pages/MapPage.tsx` (2)

- [P1/ux-mobile] FAB MapPage bottom-4 sans safe-area : collision avec home indicator iPhone
- [P1/navigation-discoverability] Geoloc demandee uniquement dans AddPianoFlow - pas d anticipation pour la carte

### `src/pages/PianoPage.tsx` (5)

- [P1/ux-mobile] Tap targets icon-only sous 44px sur PianoPage header (Pencil/Trash2 hit area ~32px)
- [P3/ux-mobile] PianoPage section Mise a jour : bouton 'Annuler' ambigu (suggere annuler MAJ deja faite)
- [P2/utility-gaps] PianoShareButton - aucun partage de l'app elle-meme
- [P1/navigation-discoverability] Aucun bouton 'Ajouter aux favoris' sur PianoPage alors que la feature v7 existe
- [P2/navigation-discoverability] Browser back sur PianoPage navigate(-1) peut envoyer hors app (deep link)

### `src/pages/SearchPage.tsx` (2)

- [P2/utility-gaps] Premier ami impossible sans amis - search par pseudo exact requis
- [P3/utility-gaps] Search par pseudo case-insensitive substring - pas de tolerance typo

### `src/pages/SettingsPage.tsx` (5)

- [P2/utility-gaps] SettingsPage long scroll - Se deconnecter sous la ligne, Zone dangereuse loin
- [P3/utility-gaps] Doublon SettingsPage - lien Amis vs Tab Amis Dashboard
- [P2/comprehension-words] Settings 'Mode sombre' Row sans Switch visuel
- [P2/navigation-discoverability] Pas de page Aide/FAQ/Contact - 'Mes demandes' est l unique canal de support
- [P2/navigation-discoverability] Settings: 'Mes amis' Row sans CTA 'Trouver des amis' si 0 ami

### `src/pages/UserPage.tsx` (2)

- [P2/navigation-discoverability] AddFriendButton sur UserPage sans contexte d explication preventive
- [P2/navigation-discoverability] UserPage 'Retour' meme probleme: deep link vers /user/:pseudo sort de l app

### `src/types/database.ts` (3)

- [P2/comprehension-words] Quality labels Désastreux / Potable subjectifs sans guidance
- [P2/comprehension-words] Pseudo vs first_name/last_name v7 : ordre/typo non documenté
- [P1/comprehension-words] Favori vs Bookmark vs Suivre v7 : label final pas tranché

### `supabase/functions/send-notification/index.ts` (2)

- [P3/security-privacy] Resend MAIL_FROM=onboarding@resend.dev : spam risk + brand confusion
- [P3/security-privacy] Edge Function index.ts utilise console.error → erreurs muettes côté Sentry

### `supabase/schema.sql` (16)

- [P2/security-privacy] push_subscriptions p256dh + auth_secret stockés en clair (DB leak = push spoofing)
- [P2/security-privacy] find_user_by_email rate-limit per-user mais pas per-IP — botnet attaquable
- [P2/security-privacy] 2FA admin absent — vol de session admin = takeover total
- [P2/security-privacy] verify_my_password : pas de protection contre brute-force online
- [P2/security-privacy] delete_my_account non audité (anonymous deletes invisibles)
- [P3/security-privacy] search_users et toggle_piano_favorite reads non tracés (manque visibilité opérationnelle)
- [P2/security-privacy] pg_cron purges non documentées comme actives (friend_arriving_dedup, friendship_rejections)
- [P3/security-privacy] Webhook secret + VAPID keys : pas de procédure de rotation documentée
- [P2/security-privacy] search_users similarity threshold > 0.1 = partial-match leak (énumération souple)
- [P2/security-privacy] search_pianos retourne created_by uuid → association piano↔user même si banned
- [P3/security-privacy] enforce_caller_rate_limit pas appliqué sur verify_my_password / update_my_profile_names / search_users
- [P3/security-privacy] Storage piano_photos_delete_own : owner peut être NULL → policy inopérante
- [P3/security-privacy] Email confirmation désactivation manuelle casse handle_new_user silencieusement
- [P3/security-privacy] delete_my_account ne supprime PAS les photos storage du user
- [P3/security-privacy] friend_arriving payload : sender_pseudo + piano_address persistent dans outbox 30j
- [P3/security-privacy] delete_my_account : verify_my_password seul (pas de 2FA même si MFA configurée)

### `vercel.json` (1)

- [P1/security-privacy] CSP autorise 'unsafe-inline' sur script-src + style-src (XSS pivot)
