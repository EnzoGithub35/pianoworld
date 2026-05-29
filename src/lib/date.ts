import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'

dayjs.extend(relativeTime)
dayjs.locale('fr')

export function fromNow(date: string | Date): string {
  return dayjs(date).fromNow()
}

export function formatDate(date: string | Date): string {
  return dayjs(date).format('D MMM YYYY')
}

export function formatDateTime(date: string | Date): string {
  return dayjs(date).format('D MMM YYYY à HH:mm')
}
