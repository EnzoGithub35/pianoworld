import { Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'

type WindowWithShare = typeof window & {
  navigator: Navigator & { share?: (data: ShareData) => Promise<void> }
}

export function PianoShareButton({
  pianoId,
  address
}: {
  pianoId: string
  address: string
}) {
  const handleShare = async () => {
    const url = `${window.location.origin}/piano/${pianoId}`
    const text = `Découvre ce piano sur PianoWorld : ${address}`
    const nav = (window as WindowWithShare).navigator
    try {
      if (nav.share) {
        await nav.share({ title: 'PianoWorld', text, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Lien copié')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(url)
        toast.success('Lien copié')
      } catch {
        toast.error('Impossible de partager')
      }
    }
  }

  return (
    <Button variant="outline" className="flex-1 gap-2" onClick={handleShare}>
      <Send className="h-4 w-4" /> Envoyer à un ami
    </Button>
  )
}
