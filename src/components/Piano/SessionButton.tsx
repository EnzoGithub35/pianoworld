import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SessionDialog } from './SessionDialog'

export function SessionButton({ pianoId }: { pianoId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="flex-1 gap-2" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        J'y vais
      </Button>
      <SessionDialog open={open} pianoId={pianoId} onClose={() => setOpen(false)} />
    </>
  )
}
