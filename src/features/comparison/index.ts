// Public API of the comparison feature. See INTEGRATION.md for how to mount it.
export { ComparisonFlow, type ComparisonFlowProps } from './ComparisonFlow'
export {
  openDefaultPersistence,
  persistenceFromStore,
  type ComparisonPersistence,
} from './comparisonStorage'
export { draftFromComparison, type EditableComparison } from './comparisonDraft'
