import { useState } from 'react'
import { Inbox, MessageSquare, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/Tabs'
import {
  useAdminRequests,
  type UserRequestWithUser
} from '@/hooks/useUserRequests'
import { fromNow } from '@/lib/date'
import { ReplyDialog } from './ReplyDialog'

function RequestRow({
  request,
  onReply
}: {
  request: UserRequestWithUser
  onReply: (r: UserRequestWithUser) => void
}) {
  return (
    <li className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-start gap-3">
        <Avatar pseudo={request.author?.pseudo} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {request.author?.pseudo ? (
              <Link
                to={`/user/${request.author.pseudo}`}
                className="font-semibold text-primary"
              >
                @{request.author.pseudo}
              </Link>
            ) : (
              <span className="font-semibold">utilisateur</span>
            )}{' '}
            <span className="text-muted-foreground">· {fromNow(request.created_at)}</span>
          </p>
          <p className="mt-0.5 font-medium">{request.subject}</p>
        </div>
        {request.status === 'open' ? (
          <Badge variant="warning">À traiter</Badge>
        ) : (
          <Badge variant="success">Répondue</Badge>
        )}
      </header>

      <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">
        {request.message}
      </p>

      {request.admin_reply && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-3 w-3" />
            Réponse · {request.replied_at ? fromNow(request.replied_at) : ''}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{request.admin_reply}</p>
        </div>
      )}

      {request.status === 'open' && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => onReply(request)} className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Répondre
          </Button>
        </div>
      )}
    </li>
  )
}

export function RequestsAdminTab() {
  const [status, setStatus] = useState<'open' | 'answered'>('open')
  const [replyTarget, setReplyTarget] = useState<UserRequestWithUser | null>(null)
  const { data: requests, isLoading } = useAdminRequests(status)

  return (
    <div className="space-y-4 p-4 pb-24">
      <Tabs value={status} onValueChange={(v) => setStatus(v as 'open' | 'answered')}>
        <TabsList>
          <TabsTrigger value="open">À traiter</TabsTrigger>
          <TabsTrigger value="answered">Répondues</TabsTrigger>
        </TabsList>

        <TabsContent value={status} className="pt-3">
          {isLoading && (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          )}

          {!isLoading && requests && requests.length === 0 && (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title={status === 'open' ? 'Inbox vide' : 'Aucune demande répondue'}
              description={
                status === 'open'
                  ? 'Aucune demande en attente pour le moment.'
                  : 'Tu n\'as pas encore répondu à de demandes.'
              }
            />
          )}

          <ul className="space-y-3">
            {requests?.map((r) => (
              <RequestRow key={r.id} request={r} onReply={setReplyTarget} />
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <ReplyDialog
        open={!!replyTarget}
        request={replyTarget}
        onClose={() => setReplyTarget(null)}
      />
    </div>
  )
}
