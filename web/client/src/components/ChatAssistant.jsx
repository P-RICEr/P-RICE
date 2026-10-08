import { useEffect, useRef, useState } from "react";
import { ArrowUp, MessageCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { api } from "../api";

const MAX_CHARS = 500;

// Renders the bot's reply safely: plain text, with only "- " bullets and
// **bold** turned into elements. Nothing is injected as HTML.
function RichText({ text }) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let list = null;
  const inline = (line, k) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${k}-${i}`} className="font-semibold text-rice-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      ) : (
        part
      )
    );
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push({ type: "ul", items: list });
      }
      list.push(inline(bullet[1], i));
    } else {
      list = null;
      if (line) blocks.push({ type: "p", content: inline(line, i) });
    }
  });
  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) =>
        b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-0.5 pl-4 marker:text-rice-400">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.content}</p>
        )
      )}
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5" aria-label="P-RICE Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-rice-500 dark:bg-rice-300"
          style={{ animation: `chatDot 1.2s ${i * 0.15}s infinite ease-in-out` }}
        />
      ))}
    </div>
  );
}

export default function ChatAssistant({ series, seriesLabel }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // {role: "user"|"assistant", text}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); // waiting for the first words
  const [streaming, setStreaming] = useState(false); // until the answer is complete
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    api
      .explainStatus()
      .then((s) => setEnabled(Boolean(s.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled) return null;

  const label = seriesLabel || "Local Special";
  const suggestions = [
    `What is the ${label} rice forecast for next month?`,
    "Bakit tataas o bababa ang presyo?",
    "How accurate is P-RICE compared to ARIMA?",
    "Which factor affects rice prices the most?",
    "Paano gamitin ang dashboard?",
  ];

  function close() {
    setOpen(false);
    setTimeout(() => launcherRef.current?.focus(), 0);
  }

  async function send(text) {
    const q = text.trim();
    if (!q || busy || streaming || q.length > MAX_CHARS) return;
    const next = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    setStreaming(true);
    try {
      let shown = false;
      await api.chat(next, { series }, (soFar) => {
        // Replace the typing dots with the answer as soon as words arrive.
        shown = true;
        setBusy(false);
        setMessages([...next, { role: "assistant", text: soFar }]);
      });
      if (!shown) setMessages(next);
    } catch (e) {
      // Drop a half-written answer; keep the question so Retry works.
      setMessages(next);
      setError(e.message);
    } finally {
      setBusy(false);
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const over = input.length > MAX_CHARS;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          onClick={() => setOpen(true)}
          aria-label="Open P-RICE Assistant"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-rice-700 py-3 pl-3.5 pr-4 text-sm font-semibold text-white shadow-lg shadow-rice-900/20 transition hover:-translate-y-0.5 hover:bg-rice-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rice-300 dark:bg-rice-500 dark:text-rice-950 dark:hover:bg-rice-400"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Ask P-RICE</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="P-RICE Assistant"
          className="fixed inset-x-3 bottom-3 top-20 z-50 flex animate-[fadeIn_.2s_ease-out] flex-col overflow-hidden rounded-2xl border border-rice-100 bg-white shadow-2xl shadow-rice-900/20 sm:inset-x-auto sm:right-5 sm:top-auto sm:bottom-5 sm:h-[600px] sm:max-h-[calc(100vh-6rem)] sm:w-[400px] dark:border-white/10 dark:bg-rice-950"
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-rice-100 bg-rice-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <img src="/brand/logo-mark.png" alt="" className="h-8 w-8 dark:hidden" />
            <img src="/brand/logo-mark-dark.png" alt="" className="hidden h-8 w-8 dark:block" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-rice-900 dark:text-white">P-RICE Assistant</p>
              <p className="flex items-center gap-1 text-[11px] text-rice-700/80 dark:text-white">
                <ShieldCheck className="h-3 w-3" />
                Answers only from this dashboard's data
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => {
                  setMessages([]);
                  setError(null);
                }}
                title="New chat"
                aria-label="Start a new chat"
                className="rounded-lg p-1.5 text-rice-700 hover:bg-rice-100 dark:text-white dark:hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={close}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 text-rice-700 hover:bg-rice-100 dark:text-white dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Messages */}
          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-rice-50 px-3.5 py-2.5 text-rice-900/90 dark:bg-white/5 dark:text-white">
              <p>
                Hi! I can answer questions about P-RICE: rice price forecasts, past prices, the factors
                behind them, and how accurate the model is. English, Filipino or Taglish is fine.
              </p>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-rice-200 px-3 py-1.5 text-left text-xs text-rice-800 transition hover:border-rice-400 hover:bg-rice-50 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-rice-700 px-3.5 py-2.5 text-white dark:bg-rice-500 dark:text-rice-950">
                    {m.text}
                  </p>
                </div>
              ) : (
                <div
                  key={i}
                  className="max-w-[90%] animate-[fadeIn_.25s_ease-out] break-words rounded-2xl rounded-tl-sm bg-rice-50 px-3.5 py-2.5 text-rice-900/90 dark:bg-white/5 dark:text-white"
                >
                  <RichText text={m.text} />
                </div>
              )
            )}

            {busy && (
              <div className="w-fit rounded-2xl rounded-tl-sm bg-rice-50 px-3 py-1.5 dark:bg-white/5">
                <Typing />
              </div>
            )}

            {error && (
              <div className="flex items-start justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                <span>{error}</span>
                {messages.at(-1)?.role === "user" && (
                  <button
                    onClick={() => {
                      const last = messages.at(-1).text;
                      setMessages(messages.slice(0, -1));
                      send(last);
                    }}
                    className="shrink-0 font-semibold underline underline-offset-2"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-rice-100 px-3 pb-2 pt-3 dark:border-white/10"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-rice-200 bg-white px-3 py-2 focus-within:border-rice-500 focus-within:ring-2 focus-within:ring-rice-200 dark:border-white/15 dark:bg-white/5 dark:focus-within:ring-rice-400/30">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about rice prices or the model…"
                aria-label="Your question"
                className="max-h-28 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-rice-900 placeholder:text-rice-900/40 focus:outline-none dark:text-white dark:placeholder:text-white/50"
              />
              <button
                type="submit"
                disabled={busy || streaming || !input.trim() || over}
                aria-label="Send"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rice-700 text-white transition hover:bg-rice-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-rice-500 dark:text-rice-950"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-rice-900/45 dark:text-white/70">
              <span>AI can make mistakes. Numbers come from the P-RICE model. Not financial advice.</span>
              <span className={over ? "font-semibold text-red-600 dark:text-red-400" : ""}>
                {input.length}/{MAX_CHARS}
              </span>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
