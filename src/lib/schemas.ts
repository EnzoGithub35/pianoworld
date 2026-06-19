import { z } from 'zod'
import {
  EVENT_DESCRIPTION_MAX,
  EVENT_LOCATION_MAX,
  EVENT_TITLE_MAX,
  PASSWORD_MIN_LENGTH,
  PIANO_ADDRESS_MAX,
  PIANO_COMMENT_MAX,
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
  PSEUDO_REGEX,
  REPORT_REASON_MAX,
  REQUEST_MESSAGE_MAX,
  REQUEST_SUBJECT_MAX,
  SESSION_DURATION_MAX,
  SESSION_DURATION_MIN,
  SESSION_FUTURE_DAYS_MAX
} from '@/lib/constants'
import { PIANO_QUALITIES } from '@/types/database'

/**
 * Schemas zod centralisés. Tout ce qui valide une saisie utilisateur passe par
 * ici, pour qu'un changement de règle (longueur max, format pseudo, etc.) se
 * propage automatiquement à tous les forms.
 *
 * Convention :
 *  - les messages d'erreur sont en français, prêts à être affichés tel quel
 *  - chaque schema correspond à UN form (pas à UNE table — Insert ≠ form)
 */

export const pseudoSchema = z
  .string()
  .min(PSEUDO_MIN_LENGTH, `Pseudo : ${PSEUDO_MIN_LENGTH} caractères minimum`)
  .max(PSEUDO_MAX_LENGTH, `Pseudo : ${PSEUDO_MAX_LENGTH} caractères maximum`)
  .regex(PSEUDO_REGEX, 'Caractères autorisés : lettres, chiffres, _ - .')

export const emailSchema = z.string().email('Email invalide')

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mot de passe : ${PASSWORD_MIN_LENGTH} caractères minimum`)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis')
})
export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  pseudo: pseudoSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptCgu: z.literal(true, {
    errorMap: () => ({ message: 'Tu dois accepter les CGU pour continuer' })
  })
})
export type SignupValues = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema
})
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string()
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Les mots de passe ne correspondent pas'
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

const qualitySchema = z.enum(
  PIANO_QUALITIES as [
    (typeof PIANO_QUALITIES)[number],
    ...Array<(typeof PIANO_QUALITIES)[number]>
  ]
)

/** Schema commun ajout & édition piano. */
export const pianoFormSchema = z.object({
  address: z
    .string()
    .trim()
    .min(1, 'Adresse requise')
    .max(PIANO_ADDRESS_MAX, `Adresse : ${PIANO_ADDRESS_MAX} caractères maximum`),
  comment: z
    .string()
    .trim()
    .min(1, 'Commentaire requis')
    .max(PIANO_COMMENT_MAX, `Commentaire : ${PIANO_COMMENT_MAX} caractères maximum`),
  quality: qualitySchema
})
export type PianoFormValues = z.infer<typeof pianoFormSchema>

export const pianoUpdateFormSchema = z
  .object({
    still_there: z.boolean({ required_error: 'Indique si le piano est toujours là' }),
    new_quality: qualitySchema.nullable(),
    comment: z
      .string()
      .max(PIANO_COMMENT_MAX, `Commentaire : ${PIANO_COMMENT_MAX} caractères maximum`)
      .optional()
  })
  .transform((v) => ({
    still_there: v.still_there,
    new_quality: v.new_quality,
    comment: v.comment?.trim() || null
  }))
export type PianoUpdateFormValues = z.infer<typeof pianoUpdateFormSchema>

export const reportFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Précise une raison')
    .max(REPORT_REASON_MAX, `Raison : ${REPORT_REASON_MAX} caractères maximum`)
})
export type ReportFormValues = z.infer<typeof reportFormSchema>

/**
 * Session de présence ("j'y vais"). On valide en input un Date (instance native)
 * + une durée en minutes. Les bornes mirrorent les CHECK SQL pour cohérence.
 */
const SESSION_MAX_PAST_MS = 60 * 60 * 1000 // 1h dans le passé tolérée (cf. SQL check)
const SESSION_MAX_FUTURE_MS = SESSION_FUTURE_DAYS_MAX * 24 * 60 * 60 * 1000

/* ===========================================================
 * v3 — Évènements & demandes utilisateurs
 * =========================================================== */

export const eventFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Titre requis')
      .max(EVENT_TITLE_MAX, `Titre : ${EVENT_TITLE_MAX} caractères max`),
    description: z
      .string()
      .trim()
      .min(1, 'Description requise')
      .max(
        EVENT_DESCRIPTION_MAX,
        `Description : ${EVENT_DESCRIPTION_MAX} caractères max`
      ),
    location: z
      .string()
      .trim()
      .min(1, 'Lieu requis')
      .max(EVENT_LOCATION_MAX, `Lieu : ${EVENT_LOCATION_MAX} caractères max`),
    starts_at: z
      .date({ required_error: 'Date requise', invalid_type_error: 'Date invalide' })
      .refine((d) => d.getTime() >= Date.now() - 60 * 60 * 1000, {
        message: "L'horaire est dans le passé"
      }),
    ends_at: z.date().nullable().optional(),
    max_participants: z.number().int().positive('Doit être positif').nullable().optional()
  })
  .refine((v) => !v.ends_at || v.ends_at.getTime() > v.starts_at.getTime(), {
    path: ['ends_at'],
    message: 'Doit être après le début'
  })
export type EventFormValues = z.infer<typeof eventFormSchema>

export const requestFormSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Sujet requis')
    .max(REQUEST_SUBJECT_MAX, `Sujet : ${REQUEST_SUBJECT_MAX} caractères max`),
  message: z
    .string()
    .trim()
    .min(1, 'Message requis')
    .max(REQUEST_MESSAGE_MAX, `Message : ${REQUEST_MESSAGE_MAX} caractères max`)
})
export type RequestFormValues = z.infer<typeof requestFormSchema>

export const replyFormSchema = z.object({
  reply: z
    .string()
    .trim()
    .min(1, 'Réponse requise')
    .max(REQUEST_MESSAGE_MAX, `Réponse : ${REQUEST_MESSAGE_MAX} caractères max`)
})
export type ReplyFormValues = z.infer<typeof replyFormSchema>

/* ===========================================================
 * v4 — Changement de mot de passe (utilisateur connecté)
 * =========================================================== */

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Mot de passe actuel requis'),
    next: passwordSchema,
    confirm: z.string()
  })
  .refine((d) => d.next === d.confirm, {
    path: ['confirm'],
    message: 'Les mots de passe ne correspondent pas'
  })
  .refine((d) => d.next !== d.current, {
    path: ['next'],
    message: 'Le nouveau mot de passe doit être différent'
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

/**
 * Confirmation de mot de passe pour les actions irréversibles (ban, suppression
 * piano forcée, suppression de compte). Le serveur revalide via
 * `verify_my_password()` côté RPC — le schéma front sert juste à exiger un input
 * non vide.
 */
export const passwordConfirmSchema = z.object({
  password: z.string().min(1, 'Mot de passe requis pour confirmer')
})
export type PasswordConfirmValues = z.infer<typeof passwordConfirmSchema>

export const sessionFormSchema = z.object({
  starts_at: z
    .date({
      required_error: 'Choisis un horaire',
      invalid_type_error: 'Horaire invalide'
    })
    .refine((d) => d.getTime() >= Date.now() - SESSION_MAX_PAST_MS, {
      message: "L'horaire est dans le passé"
    })
    .refine((d) => d.getTime() <= Date.now() + SESSION_MAX_FUTURE_MS, {
      message: `Au maximum ${SESSION_FUTURE_DAYS_MAX} jours à l'avance`
    }),
  duration_min: z
    .number({
      required_error: 'Choisis une durée',
      invalid_type_error: 'Durée invalide'
    })
    .int()
    .min(SESSION_DURATION_MIN, `Durée minimum ${SESSION_DURATION_MIN} min`)
    .max(SESSION_DURATION_MAX, `Durée maximum ${SESSION_DURATION_MAX} min`),
  /** v6 — qui voit cette session. Set-once côté DB (trigger BEFORE UPDATE). */
  visibility: z.enum(['public', 'friends']).default('public')
})
export type SessionFormValues = z.infer<typeof sessionFormSchema>

/**
 * v7 — Nom et prénom opt-in (RGPD : default NULL côté DB).
 * Empty string acceptée et convertie en NULL côté RPC update_my_profile_names.
 */
export const profileNamesSchema = z.object({
  first_name: z
    .string()
    .trim()
    .max(50, 'Maximum 50 caractères')
    .optional()
    .or(z.literal('')),
  last_name: z
    .string()
    .trim()
    .max(50, 'Maximum 50 caractères')
    .optional()
    .or(z.literal(''))
})
export type ProfileNamesValues = z.infer<typeof profileNamesSchema>

/**
 * v7 — Recherche utilisateur par email exact-match.
 * Le RPC find_user_by_email est rate-limité 5/24h serveur.
 */
export const emailSearchSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide')
})
export type EmailSearchValues = z.infer<typeof emailSearchSchema>
