'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Copy, Crown,
  Flag, Gamepad2, LoaderCircle, LogOut, Radio, ShieldCheck, Swords, Trophy, Users, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { API_URL, api, type Game, type GameListItem, type User } from '@/lib/api';
import { cn } from '@/lib/utils';

function PlayerBadge({ name, color, active, label }: {
  name: string; color: 'RED' | 'BLACK'; active: boolean; label: string;
}) {
  return <div className={cn('flex items-center gap-3 rounded-xl border p-3', active ? 'border-gold/50 bg-gold/10' : 'border-line bg-[#12191c]')}>
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-full border-2', color === 'RED' ? 'border-rose-700 bg-rose-900 text-rose-200' : 'border-slate-500 bg-[#253238] text-slate-200')}>
      <Crown size={17} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{name}</span>
      <span className="block text-xs text-muted">{label}</span>
    </span>
    {active && <span className="rounded-full bg-gold/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">To move</span>}
  </div>;
}

function LoginPanel({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setPending(true);
    try {
      const data = mode === 'register'
        ? { username, email, password }
        : { identifier, password };
      const result = await api<{ user: User }>('/auth/' + mode, { method: 'POST', body: JSON.stringify(data) });
      onAuth(result.user);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(false); }
  }

  return <div className="mx-auto grid max-w-5xl items-center gap-12 py-10 md:grid-cols-[1.1fr_.9fr] md:py-20">
    <div className="max-w-lg">
      <p className="eyebrow mb-5 flex items-center gap-2"><span className="size-2 rounded-full bg-gold" /> THE BOARD IS YOURS</p>
      <h1 className="font-display text-5xl leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
        Every move <em className="not-italic text-gold">matters.</em>
      </h1>
      <p className="mt-6 max-w-md text-lg leading-8 text-muted">Classic checkers, reimagined for the modern player. Challenge a friend, find a worthy opponent, and claim the crown.</p>
      <div className="mt-8 flex flex-wrap gap-4 text-xs text-[#c7cbbc] sm:gap-6">
        <span className="flex items-center gap-2"><Radio className="text-gold" size={16}/> Real-time matches</span>
        <span className="flex items-center gap-2"><ShieldCheck className="text-gold" size={16}/> Fair-play rules</span>
        <span className="flex items-center gap-2"><Users className="text-gold" size={16}/> Play your friends</span>
      </div>
      <div className="mt-12 hidden items-center gap-4 border-l-2 border-gold/60 pl-5 md:flex">
        <div className="flex -space-x-2">{['A','B','C'].map((name, i) => <div key={name} className={cn('grid size-10 place-items-center rounded-full border-2 border-ink text-xs font-bold', ['bg-[#52645a]','bg-[#725644]','bg-[#51445a]'][i])}>{name}</div>)}</div>
        <span className="text-sm text-muted">Your next rival is one match away.</span>
      </div>
    </div>
    <Card className="p-6 sm:p-8">
      <div className="mb-7">
        <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-gold/15 text-gold"><Crown size={26}/></div>
        <h2 className="font-display text-3xl">{mode === 'register' ? 'Join the table.' : 'Welcome back.'}</h2>
        <p className="mt-2 text-sm text-muted">{mode === 'register' ? 'Create your free account and start playing.' : 'The board is ready when you are.'}</p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink p-1 text-sm">
        {(['register','login'] as const).map((value) => <button key={value} className={cn('rounded-md px-3 py-2.5 font-semibold transition-colors', mode === value ? 'bg-[#303c3a] text-cream' : 'text-muted hover:text-cream')} onClick={() => { setMode(value); setError(''); }} type="button">{value === 'register' ? 'Create account' : 'Sign in'}</button>)}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' ? <>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Username<input className="field mt-2" placeholder="Choose a username" value={username} maxLength={20} minLength={3} autoComplete="username" onChange={(e) => setUsername(e.target.value)} required /></label>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Email address<input className="field mt-2" type="email" placeholder="you@example.com" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} required /></label>
        </> : <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Email or username<input className="field mt-2" placeholder="Your username or email" value={identifier} autoComplete="username" onChange={(e) => setIdentifier(e.target.value)} required /></label>}
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted">Password<input className="field mt-2" type="password" placeholder="At least 8 characters" value={password} minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p role="alert" className="rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
        <Button type="submit" disabled={pending} className="mt-2 w-full">{pending && <LoaderCircle size={16} className="animate-spin" />}{mode === 'register' ? 'Create free account' : 'Sign in'}<ArrowRight size={16}/></Button>
        <p className="text-center text-xs leading-5 text-muted">Play for free. No payment information required.</p>
      </form>
    </Card>
  </div>;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [recent, setRecent] = useState<GameListItem[]>([]);
  const [queued, setQueued] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);

  const navigate = useCallback((id: string | null, updateHistory = true) => {
    activeIdRef.current = id; setGameId(id); setGame(null); setSelected(null); setNotice('');
    if (updateHistory) window.history.pushState({}, '', id ? '/?game=' + encodeURIComponent(id) : '/');
  }, []);
  const refreshRecent = useCallback(async () => {
    try { setRecent(await api<GameListItem[]>('/games')); } catch { /* session may have ended */ }
  }, []);

  useEffect(() => {
    activeIdRef.current = new URLSearchParams(window.location.search).get('game');
    setGameId(activeIdRef.current);
    const onPop = () => navigate(new URLSearchParams(window.location.search).get('game'), false);
    window.addEventListener('popstate', onPop);
    api<{ user: User }>('/auth/me').then((response) => setUser(response.user)).catch(() => {}).finally(() => setChecking(false));
    return () => window.removeEventListener('popstate', onPop);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    void refreshRecent();
    const conn = io(API_URL, { transports: ['websocket'], withCredentials: true, reconnection: true });
    setSocket(conn);
    conn.on('queue:waiting', () => setQueued(true));
    conn.on('queue:left', () => setQueued(false));
    conn.on('queue:matched', ({ gameId: id }: { gameId: string }) => {
      setQueued(false); navigate(id); void refreshRecent();
    });
    conn.on('game:state', (state: Game) => {
      if (activeIdRef.current === state.id) setGame(state);
    });
    conn.on('game:error', (payload: { message: string }) => { setNotice(payload.message); });
    conn.on('connect_error', () => setNotice('Unable to connect to live matches. Is the game server running?'));
    const pulse = window.setInterval(() => { if (conn.connected) conn.emit('presence:ping'); }, 20000);
    return () => { window.clearInterval(pulse); conn.disconnect(); setSocket(null); };
  }, [user?.id, navigate, refreshRecent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || !gameId) return;
    let ignore = false;
    api<Game>('/games/' + encodeURIComponent(gameId)).then((result) => {
      if (!ignore) setGame(result);
    }).catch((error) => { if (!ignore) setNotice(error.message); });
    return () => { ignore = true; };
  }, [gameId, user?.id]);

  useEffect(() => { setSelected(null); if (game?.status === 'FINISHED') void refreshRecent(); }, [game?.version, game?.status, refreshRecent]);

  async function makeChallenge() {
    setNotice(''); setPending(true);
    try {
      const result = await api<{ id: string }>('/games', { method: 'POST' });
      navigate(result.id); void refreshRecent();
    } catch (error) { setNotice((error as Error).message); }
    finally { setPending(false); }
  }
  async function joinChallenge() {
    if (!gameId) return;
    setPending(true); setNotice('');
    try {
      await api('/games/' + encodeURIComponent(gameId) + '/join', { method: 'POST' });
      setGame(await api<Game>('/games/' + encodeURIComponent(gameId)));
      void refreshRecent();
    } catch (error) { setNotice((error as Error).message); }
    finally { setPending(false); }
  }
  async function resign() {
    if (!gameId || !window.confirm('Resign this game? Your opponent will win.')) return;
    setPending(true);
    try {
      await api('/games/' + encodeURIComponent(gameId) + '/resign', { method: 'POST' });
      setGame(await api<Game>('/games/' + encodeURIComponent(gameId)));
    } catch (error) { setNotice((error as Error).message); }
    finally { setPending(false); }
  }
  function queueUp() {
    if (!socket?.connected) { setNotice('Connecting to multiplayer server. Please try again shortly.'); return; }
    setQueued(true); setNotice(''); socket.emit('queue:join');
  }
  function cancelQueue() { socket?.emit('queue:leave'); setQueued(false); }
  function moveSquare(index: number) {
    if (!game || game.status !== 'ACTIVE' || game.meColor !== game.turn) return;
    const fromHere = game.legalMoves.filter((move) => move.from === index);
    const selectedMove = selected === null ? null : game.legalMoves.find((move) => move.from === selected && move.to === index);
    if (selectedMove) {
      if (socket?.connected) { socket.emit('game:move', { gameId: game.id, from: selectedMove.from, to: selectedMove.to }); setSelected(null); }
      else setNotice('Disconnected. Reconnect to make your move.');
    } else if (fromHere.length) setSelected(index);
    else setSelected(null);
  }
  async function copyInvite() {
    if (!gameId) return;
    try {
      await navigator.clipboard.writeText(window.location.origin + '/?game=' + encodeURIComponent(gameId));
      setCopied(true); window.setTimeout(() => setCopied(false), 2200);
    } catch { setNotice('Copy this page URL and share it with a friend.'); }
  }
  async function signOut() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null); setGame(null); setRecent([]); setQueued(false); navigate(null);
  }

  const playing = Boolean(game && game.meColor && game.status === 'ACTIVE');
  const yourTurn = Boolean(playing && game?.meColor === game?.turn);
  const winnerName = game?.winnerId === game?.red.id ? game.red.username : game?.winnerId === game?.black?.id ? game.black.username : null;
  const reds = game?.board.filter((p) => p === 'r' || p === 'R').length ?? 0;
  const blacks = game?.board.filter((p) => p === 'b' || p === 'B').length ?? 0;

  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button className="flex items-center gap-3 text-left" onClick={() => navigate(null)} aria-label="Crown home">
          <span className="grid size-10 place-items-center rounded-xl bg-gold text-ink"><Crown size={23} strokeWidth={2.5}/></span>
          <span className="font-display text-[26px] font-bold tracking-tight">crown<span className="text-gold">.</span></span>
          <span className="ml-2 hidden border-l border-line pl-4 text-[10px] font-bold uppercase tracking-[.22em] text-muted sm:block">CHECKERS CLUB</span>
        </button>
        {user ? <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:block">Signed in as <b className="text-cream">{user.username}</b></span>
          <span className="grid size-9 place-items-center rounded-full border border-gold/40 bg-gold/10 text-sm font-bold uppercase text-gold sm:hidden">{user.username[0]}</span>
          <Button size="sm" variant="ghost" onClick={() => void signOut()} aria-label="Sign out"><LogOut size={16}/><span className="hidden sm:inline">Sign out</span></Button>
        </div> : <span className="flex items-center gap-2 text-xs text-muted"><span className="size-2 animate-pulse rounded-full bg-emerald-400"/> FREE TO PLAY</span>}
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      {checking ? <div className="flex min-h-[60vh] items-center justify-center gap-3 text-muted"><LoaderCircle className="animate-spin text-gold" /> Loading the club...</div>
      : !user ? <LoginPanel onAuth={(next) => { setUser(next); setNotice(''); }}/>
      : <>
        {notice && <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200"><span>{notice}</span><button className="text-xl leading-none" aria-label="Dismiss alert" onClick={() => setNotice('')}>&times;</button></div>}
        {gameId ? <>
          <button className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-cream" onClick={() => navigate(null)}><ArrowLeft size={16}/> Back to lobby</button>
          {game ? <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow mb-2">THE ARENA / LIVE CHECKERS</p><h1 className="font-display text-3xl sm:text-4xl">{game.status === 'WAITING' ? 'Awaiting a challenger' : game.status === 'FINISHED' ? 'Game complete' : 'The board is set.'}</h1></div>
                <span className={cn('rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-widest', game.status === 'ACTIVE' ? 'border-emerald-600/40 bg-emerald-900/20 text-emerald-300' : 'border-line text-muted')}>{game.status === 'ACTIVE' ? '● Live match' : game.status}</span>
              </div>
              <div className="mx-auto board-frame">
                <div className="board-grid" role="group" aria-label="Checkers game board">
                  {Array.from({ length: 64 }, (_, displayIndex) => {
                    const index = game.meColor === 'BLACK' ? 63 - displayIndex : displayIndex;
                    const row = Math.floor(index / 8), col = index % 8;
                    const piece = game.board[index];
                    const starts = yourTurn && game.legalMoves.some((move) => move.from === index);
                    const target = yourTurn && selected !== null && game.legalMoves.some((move) => move.from === selected && move.to === index);
                    const color = piece?.toLowerCase() === 'r' ? 'red' : 'black';
                    return <button key={index} type="button"
                      aria-label={`Row ${row + 1}, column ${col + 1}${piece ? ', ' + (color === 'red' ? 'red' : 'black') + ' piece' : ''}${target ? ', legal destination' : ''}`}
                      aria-pressed={selected === index}
                      className={cn('board-cell', (row + col) % 2 === 0 ? 'light' : 'dark', (starts || target) && 'selectable', selected === index && 'selected', target && 'target')}
                      onClick={() => moveSquare(index)}>
                      {piece ? <div className={cn('piece', color, starts && 'legal-piece')}>{piece === 'R' || piece === 'B' ? <Crown size={20} strokeWidth={2.6}/> : null}</div>
                        : target ? <span className="target-dot" /> : null}
                    </button>;
                  })}
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-[574px] text-center text-xs leading-6 text-muted">
                {game.status === 'WAITING' ? 'Share this game with a friend to begin.'
                  : game.status === 'FINISHED' ? `${winnerName ?? 'The opponent'} wins. Well played!`
                  : yourTurn ? (game.forcedFrom !== null ? 'Continue your capture. Multiple jumps are mandatory.' : 'Your move. Select a highlighted piece, then its destination.') : 'Your opponent is thinking. The board updates automatically.'}
              </p>
            </section>
            <aside className="space-y-5">
              <Card className="p-5">
                <div className="mb-5 flex items-center justify-between"><span className="eyebrow">MATCH ROOM</span><Swords className="text-gold" size={20}/></div>
                <div className="space-y-3">
                  <PlayerBadge name={game.black?.username ?? 'Waiting for a player'} color="BLACK" active={game.status === 'ACTIVE' && game.turn === 'BLACK'} label={game.black ? `${blacks} pieces remaining` : 'Invite a challenger'} />
                  <div className="flex items-center justify-center gap-3 py-1 text-xs font-bold uppercase tracking-[.25em] text-muted"><span className="h-px w-10 bg-line"/> VS <span className="h-px w-10 bg-line"/></div>
                  <PlayerBadge name={game.red.username} color="RED" active={game.status === 'ACTIVE' && game.turn === 'RED'} label={`${reds} pieces remaining`} />
                </div>
                {game.status === 'FINISHED' && <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 p-4 text-center"><Trophy className="mx-auto mb-2 text-gold" size={26}/><div className="font-display text-xl">{game.winnerId === user.id ? 'Victory is yours!' : `${winnerName} wins`}</div></div>}
                {game.status === 'WAITING' && game.meColor === null && <Button className="mt-5 w-full" onClick={() => void joinChallenge()} disabled={pending}><Swords size={17}/> Accept challenge</Button>}
                {game.status === 'WAITING' && game.meColor === 'RED' && <div className="mt-5 space-y-3"><p className="text-sm text-muted">Your table is ready. Send this link to someone you want to play.</p><Button className="w-full" onClick={() => void copyInvite()}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? 'Invite link copied' : 'Copy invite link'}</Button></div>}
                {game.status === 'ACTIVE' && game.meColor && <><div className="mt-5 rounded-lg border border-line bg-ink p-3 text-center text-sm">{yourTurn ? <span className="font-semibold text-gold">● Your turn to move</span> : <span className="text-muted">◌ Waiting for opponent</span>}</div><Button className="mt-3 w-full" variant="danger" size="sm" disabled={pending} onClick={() => void resign()}><Flag size={14}/> Resign match</Button></>}
                {game.status === 'FINISHED' && <Button className="mt-5 w-full" onClick={() => navigate(null)}>Play another game <ArrowRight size={16}/></Button>}
              </Card>
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CircleHelp size={16} className="text-gold" /> How to play</div>
                <p className="text-sm leading-6 text-muted">Move diagonally on dark squares. Capture by jumping over an opposing piece. Captures are required, and reaching the far side crowns a king. Eliminate or block all opposing pieces to win.</p>
              </Card>
            </aside>
          </div> : <Card className="grid min-h-64 place-items-center p-10 text-center text-muted"><LoaderCircle className="mb-3 animate-spin text-gold"/>Loading your match...</Card>}
        </> : <>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div><p className="eyebrow mb-3 flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-400"/> THE CLUB IS OPEN</p><h1 className="font-display text-4xl tracking-tight sm:text-5xl">Ready for your <em className="not-italic text-gold">next move?</em></h1><p className="mt-3 text-muted">Welcome back, <span className="font-semibold text-cream">{user.username}</span>. Your next challenge awaits.</p></div>
            <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-4 py-2 text-xs text-muted"><ShieldCheck size={16} className="text-gold"/> Fair play · Real opponents</div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="relative overflow-hidden p-6 sm:p-8">
              <div className="absolute -right-12 -top-16 size-56 rounded-full border-[36px] border-gold/5"/>
              <div className="relative">
                <span className="mb-7 grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold"><Zap size={28}/></span>
                <p className="eyebrow mb-2">QUICK MATCH</p><h2 className="font-display text-3xl sm:text-4xl">Find your rival.</h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted">Enter the matchmaking queue and get paired with another player looking for a game.</p>
                <div className="mt-8">
                  {queued ? <Button className="w-full sm:w-auto" variant="secondary" onClick={cancelQueue}><LoaderCircle size={17} className="animate-spin"/> Searching... Cancel</Button>
                    : <Button className="w-full sm:w-auto" onClick={queueUp}><Gamepad2 size={18}/> Find a match <ArrowRight size={16}/></Button>}
                </div>
              </div>
            </Card>
            <Card className="relative overflow-hidden p-6 sm:p-8">
              <div className="absolute -right-10 -top-20 size-52 rotate-12 rounded-3xl border-[30px] border-white/[.025]"/>
              <div className="relative">
                <span className="mb-7 grid size-14 place-items-center rounded-2xl bg-[#314541] text-emerald-200"><Users size={27}/></span>
                <p className="eyebrow mb-2">PRIVATE CHALLENGE</p><h2 className="font-display text-3xl sm:text-4xl">Play a friend.</h2>
                <p className="mt-3 max-w-sm text-sm leading-7 text-muted">Create a private game room, share an invite link, and go head-to-head on your own terms.</p>
                <div className="mt-8"><Button variant="secondary" className="w-full sm:w-auto" onClick={() => void makeChallenge()} disabled={pending}><Swords size={18}/> Create a room <ArrowRight size={16}/></Button></div>
              </div>
            </Card>
          </div>
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between"><div><p className="eyebrow mb-1">YOUR JOURNEY</p><h2 className="font-display text-2xl sm:text-3xl">Recent matches</h2></div><span className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted">{recent.length} games</span></div>
            <Card className="overflow-hidden">
              {!recent.length ? <div className="flex flex-col items-center justify-center px-6 py-14 text-center"><span className="mb-4 grid size-14 place-items-center rounded-full bg-gold/10 text-gold"><Trophy size={25}/></span><h3 className="font-display text-xl">Every champion starts somewhere.</h3><p className="mt-2 text-sm text-muted">Your completed and active games will appear here.</p></div>
                : <div className="divide-y divide-line">{recent.map((item) => {
                  const other = item.redPlayerId === user.id ? item.blackPlayer?.username : item.redPlayer.username;
                  return <button key={item.id} className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[.035]" onClick={() => navigate(item.id)}>
                    <span className="grid size-11 place-items-center rounded-xl bg-[#2a3634] text-gold"><Swords size={18}/></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">vs. {other ?? 'Waiting for opponent'}</span><span className="mt-1 block text-xs text-muted">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span></span>
                    <span className={cn('hidden rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide sm:block', item.status === 'ACTIVE' ? 'bg-emerald-900/30 text-emerald-300' : item.status === 'FINISHED' ? 'bg-gold/10 text-gold' : 'bg-white/5 text-muted')}>{item.status === 'FINISHED' ? (item.winnerId === user.id ? 'Won' : 'Lost') : item.status}</span><ChevronRight size={17} className="text-muted"/>
                  </button>;
                })}</div>}
            </Card>
          </div>
        </>}
      </>}
    </main>
    <footer className="border-t border-line/70 py-8 text-center text-xs text-muted"><div className="flex items-center justify-center gap-2"><Crown size={14} className="text-gold"/> CROWN CHECKERS <span className="text-[#626c67]">·</span> Play smart. Play fair.</div></footer>
  </div>;
}
