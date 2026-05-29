import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PianoMap } from '@/components/Map/PianoMap'
import { AddPianoFlow } from '@/components/Map/AddPianoFlow'
import { Tutorial } from '@/components/Onboarding/Tutorial'

export function MapPage() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="relative h-full w-full">
      <PianoMap />
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Ajouter un piano"
        className="absolute bottom-4 right-4 z-[500] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90"
      >
        <Plus className="h-7 w-7" />
      </button>
      {addOpen && <AddPianoFlow onClose={() => setAddOpen(false)} />}
      <Tutorial />
    </div>
  )
}
