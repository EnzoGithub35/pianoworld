import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserMinus } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { fromNow } from '@/lib/date'
import { RemoveFriendDialog } from './RemoveFriendDialog'
import type { FriendProfile } from '@/types/database'

export function FriendCard({ friend }: { friend: FriendProfile }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <Link
        to={`/user/${encodeURIComponent(friend.pseudo)}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Avatar pseudo={friend.pseudo} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">@{friend.pseudo}</p>
          <p className="truncate text-xs text-muted-foreground">
            {friend.friendship_since
              ? `Amis depuis ${fromNow(friend.friendship_since)}`
              : 'Ami'}
          </p>
        </div>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Retirer @${friend.pseudo}`}
      >
        <UserMinus className="h-4 w-4" />
      </Button>
      <RemoveFriendDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        friendId={friend.id}
        friendPseudo={friend.pseudo}
      />
    </div>
  )
}
