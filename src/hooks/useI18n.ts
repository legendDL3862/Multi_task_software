import { strings } from '../i18n'
import { useAppStore } from '../store/useAppStore'

export function useI18n() {
  const locale = useAppStore((s) => s.settings.locale)
  return strings[locale]
}
