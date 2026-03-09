import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import bigbAvatar from '@/assets/bigb-avatar.png';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutorial-chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 429) throw new Error('Muitas requisições. Tente novamente em alguns segundos.');
    if (resp.status === 402) throw new Error('Créditos insuficientes.');
    throw new Error('Erro ao conectar com o assistente.');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const json = line.slice(6).trim();
      if (json === '[DONE]') { done = true; break; }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  onDone();
}

export function BigBAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Draggable state
  const [pos, setPos] = useState({ x: window.innerWidth - 80, y: 72 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Keep avatar in bounds on resize
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - 60),
        y: Math.min(p.y, window.innerHeight - 60),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    hasMoved.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    hasMoved.current = true;
    const nx = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffset.current.x));
    const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  const handleClick = () => {
    if (!hasMoved.current) setOpen(!open);
  };

  // Chat panel position: try to place near the avatar
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 50,
    top: Math.min(pos.y + 56, window.innerHeight - 530),
    left: pos.x > window.innerWidth / 2 ? pos.x - 360 + 48 : pos.x,
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    const userMsg: Msg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = '';
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        onDelta: (chunk) => upsertAssistant(chunk),
        onDone: () => setIsLoading(false),
      });
    } catch (e: any) {
      setIsLoading(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ ${e.message}` }]);
    }
  };

  return (
    <>
      {/* Draggable floating avatar */}
      <div
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50, touchAction: 'none' }}
        className="group cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={handleClick}
        title="Big B — Arraste para mover"
      >
        <div className="relative">
          <div className="w-12 h-12 rounded-full overflow-hidden shadow-lg ring-2 ring-primary/30 transition-all group-hover:scale-110 group-hover:ring-primary/60">
            <img src={bigbAvatar} alt="Big B" className="w-full h-full object-cover pointer-events-none" draggable={false} />
          </div>

          {/* Speech bubble "Ajuda?" */}
          {!open && (
            <div className="absolute -left-[70px] top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="relative bg-card border border-border rounded-xl px-3 py-1.5 shadow-md">
                <span className="text-xs font-medium text-foreground whitespace-nowrap">Ajuda?</span>
                {/* Arrow pointing right */}
                <div className="absolute top-1/2 -translate-y-1/2 -right-[6px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-border"></div>
                <div className="absolute top-1/2 -translate-y-1/2 -right-[5px] w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[5px] border-l-card"></div>
              </div>
            </div>
          )}

          {/* Pulse when closed */}
          {!open && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--success))]"></span>
            </span>
          )}
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={panelStyle} className="w-[360px] max-h-[520px] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-foreground/20">
              <img src={bigbAvatar} alt="Big B" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Big B</p>
              <p className="text-xs opacity-80">Assistente Contábil</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-primary-foreground/20 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[340px]">
            {messages.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <div className="w-14 h-14 rounded-full overflow-hidden mx-auto">
                  <img src={bigbAvatar} alt="Big B" className="w-full h-full object-cover" />
                </div>
                <p className="text-sm font-medium text-foreground">Olá! Eu sou o Big B 🤖</p>
                <p className="text-xs text-muted-foreground">
                  Seu assistente contábil pessoal. Pergunte sobre conceitos financeiros ou funcionalidades do app!
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte ao Big B..."
                className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="rounded-full h-9 w-9 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
