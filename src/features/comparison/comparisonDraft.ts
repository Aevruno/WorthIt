import type { Comparison, Criterion, Option } from '../../types'

/**
 * In-progress comparison state for the comparison flow.
 * Everything here is entered by the user; nothing is looked up or invented.
 * The draft is converted to the shared `Comparison` contract only when finished.
 */

export type CategoryLabel = 'Tech' | 'Gaming' | 'Cars' | 'Travel' | 'Other'

export interface CategoryInfo {
  label: CategoryLabel
  emoji: string
  hint: string
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { label: 'Tech', emoji: '💻', hint: 'Laptops, phones, headphones' },
  { label: 'Gaming', emoji: '🎮', hint: 'Consoles, PCs, handhelds' },
  { label: 'Cars', emoji: '🚗', hint: 'New, used, or leased' },
  { label: 'Travel', emoji: '✈️', hint: 'Trips, hotels, destinations' },
  { label: 'Other', emoji: '✨', hint: 'Anything else' },
]

/** Suggestions are just criterion names. Importance and scores always come from the user. */
export const SUGGESTED_CRITERIA: Record<CategoryLabel, readonly string[]> = {
  Tech: ['Price', 'Performance', 'Battery Life', 'Portability', 'Design'],
  Gaming: ['Performance', 'Price', 'Game Library', 'Portability', 'Online Features'],
  Cars: ['Price', 'Fuel Economy', 'Reliability', 'Comfort', 'Performance'],
  Travel: ['Price', 'Location', 'Comfort', 'Things to Do', 'Convenience'],
  Other: ['Price', 'Quality', 'Convenience', 'Durability', 'Design'],
}

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 5
export const MAX_CRITERIA = 8
export const MIN_IMPORTANCE = 1
export const MAX_IMPORTANCE = 10
export const DEFAULT_IMPORTANCE = 5
/** Matches the shared contract: user-entered scores are 0–10. */
export const MIN_SCORE = 0
export const MAX_SCORE = 10
export const MAX_TITLE_LENGTH = 80
export const MAX_NAME_LENGTH = 40
export const MAX_SUBTITLE_LENGTH = 60

export interface DraftOption {
  id: string
  name: string
  /** Raw text from the price field; parsed on validation. */
  price: string
  subtitle: string
}

export interface DraftCriterion {
  id: string
  name: string
  importance: number
  /**
   * New criteria are always `true` (the score screen asks "how good is it, 10 = best").
   * Comparisons opened for editing keep whatever they were saved with, so editing never
   * silently flips how an existing criterion is scored.
   */
  higherIsBetter: boolean
}

/** optionId → criterionId → score */
export type DraftScores = Record<string, Record<string, number>>

export interface ComparisonDraft {
  title: string
  category: CategoryLabel
  options: DraftOption[]
  criteria: DraftCriterion[]
  scores: DraftScores
}

export function isCategoryLabel(value: string): value is CategoryLabel {
  return CATEGORIES.some((category) => category.label === value)
}

/** `crypto.randomUUID` is missing outside secure contexts (e.g. a LAN IP over http). */
export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyOption(id: string = createId()): DraftOption {
  return { id, name: '', price: '', subtitle: '' }
}

export function createDraft(category: CategoryLabel = 'Tech', makeId: () => string = createId): ComparisonDraft {
  return {
    title: '',
    category,
    options: [emptyOption(makeId()), emptyOption(makeId())],
    criteria: [],
    scores: {},
  }
}

/** Collapses whitespace so "Dell  XPS " and "dell xps" count as the same name. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export type PriceParse = { ok: true; value: number | undefined } | { ok: false }

/** Accepts blank, "999", "1,299.99", or "$1,299". Rejects negatives and other text. */
export function parsePrice(text: string): PriceParse {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, value: undefined }
  const compact = trimmed.replace(/^\$/, '').replace(/[\s,]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(compact)) return { ok: false }
  const value = Number(compact)
  if (!Number.isFinite(value) || value > 1_000_000_000) return { ok: false }
  return { ok: true, value }
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return priceFormatter.format(value)
}

// ---------- Validation ----------

export interface OptionErrors {
  name?: string
  price?: string
  subtitle?: string
}

export interface SetupValidation {
  valid: boolean
  title?: string
  /** Problems with the option list as a whole (too few, too many). */
  options?: string
  perOption: Record<string, OptionErrors>
}

/** Returns the names (normalized) that appear more than once. */
function duplicateNames(names: string[]): Set<string> {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const name of names) {
    const key = normalizeName(name)
    if (!key) continue
    if (seen.has(key)) dupes.add(key)
    seen.add(key)
  }
  return dupes
}

export function validateOptions(options: DraftOption[]): Pick<SetupValidation, 'options' | 'perOption'> {
  const perOption: Record<string, OptionErrors> = {}
  const dupes = duplicateNames(options.map((option) => option.name))

  for (const option of options) {
    const errors: OptionErrors = {}
    const name = cleanText(option.name)
    if (!name) errors.name = 'Give this option a name.'
    else if (name.length > MAX_NAME_LENGTH) errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`
    else if (dupes.has(normalizeName(name))) errors.name = `You already have an option called “${name}”. Use a different name.`

    if (!parsePrice(option.price).ok) errors.price = 'Enter a price like 999 or 1,299.99, or leave it blank.'
    if (cleanText(option.subtitle).length > MAX_SUBTITLE_LENGTH) {
      errors.subtitle = `Keep the note under ${MAX_SUBTITLE_LENGTH} characters.`
    }
    if (Object.keys(errors).length > 0) perOption[option.id] = errors
  }

  let listError: string | undefined
  if (options.length === 0) listError = 'Add at least two options to compare.'
  else if (options.length < MIN_OPTIONS) listError = 'Add one more option. You need at least two to compare.'
  else if (options.length > MAX_OPTIONS) listError = `You can compare up to ${MAX_OPTIONS} options.`

  return { options: listError, perOption }
}

export function validateSetup(draft: Pick<ComparisonDraft, 'title' | 'options'>): SetupValidation {
  const title = cleanText(draft.title)
  let titleError: string | undefined
  if (!title) titleError = 'Give your comparison a title, like “Which laptop should I buy?”'
  else if (title.length > MAX_TITLE_LENGTH) titleError = `Keep the title under ${MAX_TITLE_LENGTH} characters.`

  const { options, perOption } = validateOptions(draft.options)
  return {
    valid: !titleError && !options && Object.keys(perOption).length === 0,
    title: titleError,
    options,
    perOption,
  }
}

/** Validates a name the user is about to add as a criterion. */
export function validateNewCriterionName(name: string, criteria: DraftCriterion[]): string | undefined {
  const clean = cleanText(name)
  if (!clean) return 'Type something that matters to you, like “Warranty”.'
  if (clean.length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH} characters.`
  if (criteria.some((criterion) => normalizeName(criterion.name) === normalizeName(clean))) {
    return `“${clean}” is already on your list.`
  }
  if (criteria.length >= MAX_CRITERIA) return `You can pick up to ${MAX_CRITERIA} things. Remove one to add another.`
  return undefined
}

export function validateCriteria(criteria: DraftCriterion[]): string | undefined {
  if (criteria.length === 0) return 'Pick at least one thing that matters to you.'
  if (criteria.length > MAX_CRITERIA) return `You can pick up to ${MAX_CRITERIA} things.`
  if (duplicateNames(criteria.map((criterion) => criterion.name)).size > 0) return 'Each criterion needs a different name.'
  for (const criterion of criteria) {
    if (!cleanText(criterion.name)) return 'Every criterion needs a name.'
    if (!isValidImportance(criterion.importance)) {
      return `Importance must be a whole number from ${MIN_IMPORTANCE} to ${MAX_IMPORTANCE}.`
    }
  }
  return undefined
}

export function isValidImportance(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_IMPORTANCE && value <= MAX_IMPORTANCE
}

export function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE
}

// ---------- Importance display ----------

export type ImportanceLevel = 'low' | 'medium' | 'high' | 'top'

export function importanceLevel(importance: number): ImportanceLevel {
  if (importance <= 3) return 'low'
  if (importance <= 6) return 'medium'
  if (importance <= 8) return 'high'
  return 'top'
}

export const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  low: 'Nice to have',
  medium: 'Important',
  high: 'Very important',
  top: 'Must have',
}

/** Share of the whole decision this criterion carries, as a whole percentage. */
export function importanceShare(criterion: DraftCriterion, criteria: DraftCriterion[]): number {
  const total = criteria.reduce((sum, item) => sum + item.importance, 0)
  if (total <= 0) return 0
  return Math.round((criterion.importance / total) * 100)
}

// ---------- Draft updates (pure) ----------

export function addOption(draft: ComparisonDraft, id: string = createId()): ComparisonDraft {
  if (draft.options.length >= MAX_OPTIONS) return draft
  return { ...draft, options: [...draft.options, emptyOption(id)] }
}

export function updateOption(draft: ComparisonDraft, id: string, patch: Partial<Omit<DraftOption, 'id'>>): ComparisonDraft {
  return {
    ...draft,
    options: draft.options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
  }
}

export function removeOption(draft: ComparisonDraft, id: string): ComparisonDraft {
  const { [id]: _removed, ...scores } = draft.scores
  return { ...draft, options: draft.options.filter((option) => option.id !== id), scores }
}

export function addCriterion(draft: ComparisonDraft, name: string, id: string = createId()): ComparisonDraft {
  if (validateNewCriterionName(name, draft.criteria)) return draft
  return {
    ...draft,
    criteria: [...draft.criteria, { id, name: cleanText(name), importance: DEFAULT_IMPORTANCE, higherIsBetter: true }],
  }
}

export function removeCriterion(draft: ComparisonDraft, id: string): ComparisonDraft {
  const scores: DraftScores = {}
  for (const [optionId, byCriterion] of Object.entries(draft.scores)) {
    const { [id]: _removed, ...rest } = byCriterion
    scores[optionId] = rest
  }
  return { ...draft, criteria: draft.criteria.filter((criterion) => criterion.id !== id), scores }
}

export function setImportance(draft: ComparisonDraft, id: string, importance: number): ComparisonDraft {
  const clamped = Math.min(MAX_IMPORTANCE, Math.max(MIN_IMPORTANCE, Math.round(importance)))
  return {
    ...draft,
    criteria: draft.criteria.map((criterion) => (criterion.id === id ? { ...criterion, importance: clamped } : criterion)),
  }
}

export function setScore(draft: ComparisonDraft, optionId: string, criterionId: string, score: number): ComparisonDraft {
  if (!isValidScore(score)) return draft
  return {
    ...draft,
    scores: { ...draft.scores, [optionId]: { ...draft.scores[optionId], [criterionId]: score } },
  }
}

export function getScore(draft: ComparisonDraft, optionId: string, criterionId: string): number | undefined {
  const score = draft.scores[optionId]?.[criterionId]
  return isValidScore(score) ? score : undefined
}

// ---------- Scoring progress ----------

export function isCriterionComplete(draft: ComparisonDraft, criterionId: string): boolean {
  return draft.options.length > 0 && draft.options.every((option) => getScore(draft, option.id, criterionId) !== undefined)
}

export interface ScoreProgress {
  completedCriteria: number
  totalCriteria: number
  missingScores: number
  complete: boolean
}

export function scoreProgress(draft: ComparisonDraft): ScoreProgress {
  let missingScores = 0
  for (const criterion of draft.criteria) {
    for (const option of draft.options) {
      if (getScore(draft, option.id, criterion.id) === undefined) missingScores += 1
    }
  }
  const completedCriteria = draft.criteria.filter((criterion) => isCriterionComplete(draft, criterion.id)).length
  return {
    completedCriteria,
    totalCriteria: draft.criteria.length,
    missingScores,
    complete: draft.criteria.length > 0 && draft.options.length > 0 && missingScores === 0,
  }
}

/** Index of the first criterion that still has missing scores, or -1. */
export function firstIncompleteCriterion(draft: ComparisonDraft): number {
  return draft.criteria.findIndex((criterion) => !isCriterionComplete(draft, criterion.id))
}

// ---------- Conversion to the shared contract ----------

export interface BuildMeta {
  id: string
  now: string
  createdAt?: string
}

/**
 * Converts a finished draft to the shared `Comparison`. Throws with a readable
 * message if anything is still invalid, so the UI never saves a half-built result.
 * New criteria are "higher is better" (the score screen asks how well each option
 * does, 10 = best for you, including for price); edited ones keep their saved direction.
 */
export function buildComparison(draft: ComparisonDraft, meta: BuildMeta): Comparison {
  const setup = validateSetup(draft)
  if (!setup.valid) throw new Error('Some options or the title still need fixing.')
  const criteriaError = validateCriteria(draft.criteria)
  if (criteriaError) throw new Error(criteriaError)
  if (!scoreProgress(draft).complete) throw new Error('Score every option for every criterion first.')

  const criteria: Criterion[] = draft.criteria.map((criterion) => ({
    id: criterion.id,
    name: cleanText(criterion.name),
    importance: criterion.importance,
    higherIsBetter: criterion.higherIsBetter,
  }))

  const options: Option[] = draft.options.map((option) => {
    const scores: Record<string, number> = {}
    for (const criterion of draft.criteria) {
      scores[criterion.id] = draft.scores[option.id][criterion.id]
    }
    const result: Option = { id: option.id, name: cleanText(option.name), scores }
    const price = parsePrice(option.price)
    if (price.ok && price.value !== undefined) result.price = price.value
    const subtitle = cleanText(option.subtitle)
    if (subtitle) result.subtitle = subtitle
    return result
  })

  return {
    id: meta.id,
    title: cleanText(draft.title),
    category: draft.category,
    options,
    criteria,
    createdAt: meta.createdAt ?? meta.now,
    updatedAt: meta.now,
  }
}

// ---------- Editing an existing comparison ----------

export interface EditableComparison {
  draft: ComparisonDraft
  /**
   * Plain-language notes about anything adjusted to fit this editor (for example a
   * fractional score rounded to a whole number). Empty when the comparison loaded as-is.
   * The UI shows these so nothing changes silently.
   */
  adjustments: string[]
}

function matchCategory(category: string): CategoryLabel | undefined {
  const key = category.trim().toLowerCase()
  return CATEGORIES.find((item) => item.label.toLowerCase() === key)?.label
}

/**
 * Turns a saved `Comparison` back into an editable draft. IDs are kept so saving
 * updates the same record. Criterion direction (`higherIsBetter`) is preserved.
 */
export function draftFromComparison(comparison: Comparison): EditableComparison {
  const adjustments: string[] = []

  const category = matchCategory(comparison.category)
  if (!category) {
    adjustments.push(`Category “${comparison.category}” isn’t one of this editor’s categories, so it’s shown as Other.`)
  }

  const criteria: DraftCriterion[] = comparison.criteria.map((criterion) => {
    let importance = criterion.importance
    if (!isValidImportance(importance)) {
      importance = Number.isFinite(importance)
        ? Math.min(MAX_IMPORTANCE, Math.max(MIN_IMPORTANCE, Math.round(importance)))
        : DEFAULT_IMPORTANCE
      adjustments.push(
        `“${criterion.name}” had importance ${criterion.importance}. Importance here is ${MIN_IMPORTANCE}–${MAX_IMPORTANCE}, so it’s now ${importance}.`,
      )
    }
    return { id: criterion.id, name: criterion.name, importance, higherIsBetter: criterion.higherIsBetter }
  })

  const scores: DraftScores = {}
  let rounded = 0
  for (const option of comparison.options) {
    const byCriterion: Record<string, number> = {}
    for (const criterion of comparison.criteria) {
      const score = option.scores[criterion.id]
      if (typeof score !== 'number' || !Number.isFinite(score) || score < MIN_SCORE || score > MAX_SCORE) continue
      const whole = Math.round(score)
      if (whole !== score) rounded += 1
      byCriterion[criterion.id] = whole
    }
    scores[option.id] = byCriterion
  }
  if (rounded > 0) {
    adjustments.push(`${rounded} score${rounded === 1 ? ' was' : 's were'} rounded to the nearest whole number.`)
  }

  const options: DraftOption[] = comparison.options.map((option) => ({
    id: option.id,
    name: option.name,
    price: option.price !== undefined && Number.isFinite(option.price) ? String(option.price) : '',
    subtitle: option.subtitle ?? '',
  }))

  return {
    draft: { title: comparison.title, category: category ?? 'Other', options, criteria, scores },
    adjustments,
  }
}
