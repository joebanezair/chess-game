'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Ban, CheckCircle2, ChevronLeft, ChevronRight, Crown, LoaderCircle, LockKeyhole, Search, Shield, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, type User } from '@/lib/api';
import { cn } from '@/lib/utils';

type AdminUser = Pick<User, 'id' | 'username' | 'email' | 'role'> & {
  disabledAt: string | null; createdAt: string;
};
type Results = { users: AdminUser[]; total: number; page: number; pageSize: number };

export default function AdminPage() {
  const [me, setMe] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [items, setItems] = useState<Results | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((result) => setMe(result.user))
      .catch((err: Error) => setError(err.message))
      .finally(() => setChecking(false));
  }, []);

  const refresh = useCallback(async () => {
    if (me?.role !== 'ADMIN') return;
    try {
      const result = await api<Results>('/admin/users?' + new URLSearchParams({
        search: filter, page: String(page),
      }));
      setItems(result);
    } catch (cause) { setError((cause as Error).message); }
  }, [me?.role, filter, page]);

  useEffect(() => { void refresh(); }, [refresh]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setFilter(search);
  }

  async function changeStatus(user: AdminUser) {
    if (user.role === 'ADMIN' || user.id === me?.id) return;
    const disabling = !user.disabledAt;
    const action = disabling ? 'disable' : 're-enable';
    if (!window.confirm(`Are you sure you want to ${action} @${user.username}?${disabling ? ' They will immediately lose account access and live game connections.' : ''}`)) return;
    const reason = disabling ? window.prompt('Reason for disabling this account (optional; Cancel to abort):', '') : '';
    if (reason === null) return;
    setBusy(user.id); setError(''); setSuccess('');
    try {
      await api('/admin/users/' + encodeURIComponent(user.id) + '/status', {
        method: 'PATCH',
        body: JSON.stringify({ disabled: disabling, reason: reason || undefined }),
      });
      setSuccess(`@${user.username} has been ${disabling ? 'disabled' : 're-enabled'}.`);
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(null); }
  }

  return <div className="min-h-screen">
    <header className="border-b border-line/80 bg-ink/90">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-gold text-ink"><Crown size={23}/></span>
          <span className="font-display text-2xl font-bold">crown<span className="text-gold">.</span></span>
          <span className="ml-1 hidden border-l border-line pl-4 text-xs font-semibold uppercase tracking-wider text-gold sm:block">Administration</span>
        </a>
        <a href="/" className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-cream"><ArrowLeft size={16}/> Return to game</a>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      {checking ? <div className="flex items-center gap-3 text-muted"><LoaderCircle className="animate-spin text-gold"/> Checking permissions...</div>
        : !me || me.role !== 'ADMIN' ? <Card className="mx-auto max-w-lg p-8 text-center">
          <LockKeyhole size={32} className="mx-auto mb-4 text-gold"/>
          <h1 className="font-display text-3xl">Restricted access</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Only authorized administrators can access account management. Ask the server operator to grant the admin role, then sign in again.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <a href="/" className="mt-5 inline-flex h-10 items-center rounded-lg bg-gold px-4 text-sm font-semibold text-ink">Back to Crown</a>
        </Card> : <>
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-3 flex items-center gap-2"><ShieldCheck size={15}/> ADMIN CONSOLE</div>
              <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Account management<span className="text-gold">.</span></h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">Search player accounts and manage access. Every change is audited. Disabled users cannot log in, matchmake, or continue live games.</p>
            </div>
            <span className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-bold text-gold"><Shield size={15}/> {me.username}</span>
          </div>
          <Card className="p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-gold/10 text-gold"><Users size={22}/></span><div><h2 className="text-lg font-semibold">Registered users</h2><p className="text-xs text-muted">{items?.total ?? '—'} accounts match your search</p></div></div>
              <form onSubmit={submit} className="flex w-full gap-2 sm:w-auto">
                <input className="field min-w-0 flex-1 sm:w-60" aria-label="Search usernames or emails" placeholder="Search name or email" maxLength={80} value={search} onChange={(event) => setSearch(event.target.value)}/>
                <Button type="submit"><Search size={16}/><span className="hidden sm:inline">Search</span></Button>
              </form>
            </div>
            {error && <p role="alert" className="mb-4 rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
            {success && <p role="status" className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 text-sm text-emerald-300">{success}</p>}
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-line bg-ink/70 text-xs uppercase tracking-wider text-muted"><tr><th className="px-5 py-4 font-semibold">Player</th><th className="px-5 py-4 font-semibold">Role</th><th className="px-5 py-4 font-semibold">Status</th><th className="px-5 py-4 text-right font-semibold">Action</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(items?.users ?? []).map((person) => <tr key={person.id} className="hover:bg-white/[.025]">
                    <td className="px-5 py-4"><span className="block font-semibold text-cream">@{person.username}</span><span className="mt-1 block text-xs text-muted">{person.email}</span></td>
                    <td className="px-5 py-4"><span className={cn('text-xs font-semibold', person.role === 'ADMIN' ? 'text-gold' : 'text-muted')}>{person.role === 'ADMIN' ? 'Administrator' : 'Player'}</span></td>
                    <td className="px-5 py-4"><span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', person.disabledAt ? 'bg-red-900/25 text-red-300' : 'bg-emerald-900/25 text-emerald-300')}><span className={cn('size-1.5 rounded-full', person.disabledAt ? 'bg-red-400' : 'bg-emerald-400')}/>{person.disabledAt ? 'Disabled' : 'Active'}</span></td>
                    <td className="px-5 py-4 text-right">{person.role === 'ADMIN' ? <span className="text-xs text-muted">Protected</span> : <Button variant={person.disabledAt ? 'secondary' : 'danger'} size="sm" disabled={busy !== null} onClick={() => void changeStatus(person)}>{busy === person.id ? <LoaderCircle size={14} className="animate-spin"/> : person.disabledAt ? <CheckCircle2 size={14}/> : <Ban size={14}/>} {person.disabledAt ? 'Enable' : 'Disable'}</Button>}</td>
                  </tr>)}
                  {items && !items.users.length && <tr><td colSpan={4} className="px-5 py-14 text-center text-muted">No users found. Try another search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-muted">Page {page} of {Math.max(1, Math.ceil((items?.total || 0) / 20))}</p>
              <div className="flex gap-2"><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}><ChevronLeft size={16}/> Previous</Button><Button variant="secondary" size="sm" disabled={!items || page * 20 >= items.total} onClick={() => setPage((n) => n + 1)}>Next <ChevronRight size={16}/></Button></div>
            </div>
          </Card>
          <p className="mt-5 text-xs leading-6 text-muted"><LockKeyhole size={13} className="mr-1 inline text-gold"/> Admin accounts are protected from being disabled through this panel. User changes are recorded in the audit database.</p>
        </>}
    </main>
  </div>;
}
