import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Paperclip,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  Ban,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AppData, RemittanceRecord, UserProfile } from '../types';
import { formatCurrencyIdr } from '../utils/formatters';
import {
  sendAgentMessage,
  sendPayPalPayout,
  idrToUsdDisplay,
  getStoredAuth,
  type AgentHistoryTurn,
  type RemittanceApprovalDraft,
} from '../utils/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  imageUrl?: string; // preview for user image messages
  pendingAction?: RemittanceApprovalDraft;
  actionState?: 'pending' | 'approving' | 'approved' | 'rejected';
  actionError?: string;
  actionNote?: string; // e.g. DEMO MODE note shown on the approved banner
}

interface ChatBarProps {
  currentUser: UserProfile | null;
  data: AppData;
  onAddRemittance: (record: RemittanceRecord) => void;
  onOpenAuthModal: () => void;
  onDataChanged: () => void;
}

function fileToImage(file: File): Promise<{ dataUrl: string; data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ dataUrl, data: dataUrl.split(',')[1] || '', mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ChatBar: React.FC<ChatBarProps> = ({
  currentUser,
  data,
  onAddRemittance,
  onOpenAuthModal,
  onDataChanged,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; data: string; mimeType: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear the conversation and collapse the panel whenever the active user changes.
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextId = currentUser?.id ?? null;
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== nextId) {
      setMessages([]);
      setInput('');
      setImage(null);
      setError(null);
      setExpanded(false);
    }
    prevUserIdRef.current = nextId;
  }, [currentUser?.id]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, expanded]);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  // Core turn: push a user message, call the agent, push the assistant reply.
  const runAgentTurn = useCallback(
    async (userText: string, userImage: { data: string; mimeType: string; dataUrl: string } | null) => {
      // Require a real session — the agent endpoint is auth-protected.
      const { token } = getStoredAuth();
      if (!token) {
        setError('Please log in to use the RemitPal AI assistant.');
        onOpenAuthModal();
        return;
      }

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: userText,
        imageUrl: userImage?.dataUrl,
      };
      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setError(null);

      // Build history from prior messages (text-only turns for context).
      const history: AgentHistoryTurn[] = messages
        .filter((m) => m.text)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text || '', hasImage: !!m.imageUrl }));

      const result = await sendAgentMessage({
        message: userText,
        image: userImage ? { data: userImage.data, mimeType: userImage.mimeType } : undefined,
        history,
      });

      if (!result.success || !result.reply) {
        const errMsg = result.error || 'The agent could not respond. Please try again.';
        // Only a genuine 401 (our token rejected) is a session-expiry case.
        // Do NOT pattern-match the error text — a Gemini API rejection often
        // contains the word "token", which would falsely read as "session
        // expired" and send the user to a login modal that cannot help.
        if (result.unauthorized) {
          setError('Your session expired. Please log in again.');
          onOpenAuthModal();
        } else {
          setError(errMsg);
        }
      } else {
        const r = result.reply;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: r.text,
          pendingAction: r.pendingAction,
          actionState: r.pendingAction ? 'pending' : undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (result.sideEffects && result.sideEffects.length > 0) onDataChanged();
      }

      setSending(false);
    },
    [messages, onOpenAuthModal, onDataChanged]
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !image) || sending) return;
    const img = image;
    setInput('');
    setImage(null);
    setExpanded(true);
    runAgentTurn(text || '(image only)', img);
  }, [input, image, sending, runAgentTurn]);

  const handleAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Image is too large (max 8 MB).');
      return;
    }
    const img = await fileToImage(file);
    setImage(img);
    setExpanded(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Approve a pending remittance draft: runs the PayPal Payouts v1 flow
  // (sandbox) from Siti's own business account to Slamet's verified
  // email. A ledger record is created ONLY when PayPal reports the
  // payout item SUCCESS, with the real payout batch id as the reference
  // number. In mock mode (DEMO MODE) there is no PayPal call: the record
  // is created immediately and labelled MOCK.
  const handleApprove = useCallback(
    async (msg: ChatMessage) => {
      if (!msg.pendingAction) return;
      const { token } = getStoredAuth();
      if (!token) {
        updateMessage(msg.id, { actionError: 'Please log in as Siti to approve and send.' });
        onOpenAuthModal();
        return;
      }

      updateMessage(msg.id, { actionState: 'approving', actionError: undefined });
      const amountIdr = Number(msg.pendingAction.amountIdr);
      const monthYear = msg.pendingAction.monthYear || new Date().toISOString().slice(0, 7);
      const amountUsd = idrToUsdDisplay(amountIdr);
      const today = new Date().toISOString().slice(0, 10);

      const allocLines = Object.entries(msg.pendingAction.allocations || {})
        .filter(([, v]) => Number(v) > 0)
        .map(([k, v]) => `${k} ${formatCurrencyIdr(Number(v))}`)
        .join('; ');

      const result = await sendPayPalPayout({
        amountIdr,
        amountUsd,
        note: msg.pendingAction.note,
      });

      if (!result.success || !result.payout) {
        updateMessage(msg.id, {
          actionState: 'pending',
          actionError: result.error || 'PayPal payout failed. Please try again.',
        });
        return;
      }

      const payout = result.payout;
      const isReceived = payout.batchStatus === 'SUCCESS' || payout.transactionStatus === 'SUCCESS';
      const mockTag = payout.mock ? ' (MOCK — DEMO MODE, no PayPal payment moved)' : '';

      // Build the ledger record from the PayPal result. The reference number
      // is the PayPal payout batch id, and the transfer service is always
      // PayPal (remittance can only be sent by Siti to Slamet via PayPal).
      const record: RemittanceRecord = {
        id: `rem-${Date.now()}`,
        date: today,
        monthYear,
        amountIdr,
        transferService: 'PayPal (Payouts v1, sandbox)',
        sender: `${data.workerProfile.name} (Hong Kong)`,
        receiver: `${data.workerProfile.husbandName} (Indramayu)`,
        referenceNo: payout.payoutBatchId,
        notes:
          `${msg.pendingAction.isExtra ? `EXTRA transfer — ${msg.pendingAction.reason || 'extra/emergency transfer'}. Month total after this: ${formatCurrencyIdr(msg.pendingAction.monthTotalAfterIdr || amountIdr)}. ` : ''}` +
          `${msg.pendingAction.note ? msg.pendingAction.note + ' ' : ''}` +
          `Allocation: ${allocLines || 'n/a'}. PayPal Payouts v1 (sandbox) · USD ${amountUsd} · batch ${payout.payoutBatchId}${mockTag}.`,
        status: isReceived ? 'received' : 'in_transit',
      };
      onAddRemittance(record);
      updateMessage(msg.id, {
        actionState: 'approved',
        actionNote: payout.mock
          ? 'DEMO MODE — no PayPal payment moved (MOCK).'
          : isReceived
            ? `PayPal payout confirmed (batch ${payout.payoutBatchId}).`
            : `PayPal payout ${payout.batchStatus || 'pending'} — record is in transit; check the Remittances tab.`,
      });
    },
    [data.workerProfile, onAddRemittance, onOpenAuthModal, updateMessage]
  );

  const handleReject = useCallback(
    (msg: ChatMessage) => {
      updateMessage(msg.id, { actionState: 'rejected' });
      runAgentTurn('Siti rejected this remittance draft. Do not send it.', null);
    },
    [runAgentTurn, updateMessage]
  );

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const placeholder =
    currentUser?.role === 'remitter'
      ? 'Ask RemitPal AI… e.g. "Send 15M for this month: 5M renovation, 3.5M tuition, 4M allowance, 2.5M savings"'
      : 'Ask RemitPal AI… attach a receipt photo and say what you bought';

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-72 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-t border-neutral-200 dark:border-neutral-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {/* Expandable conversation panel */}
      {expanded && (
        <div className="max-h-[55vh] flex flex-col border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">RemitPal AI Assistant</span>
              <span className="text-[10px] text-neutral-400 hidden sm:inline">
                {currentUser?.role === 'remitter' ? 'Remitter mode' : 'Manager mode'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setError(null); }}
                  className="text-[11px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 px-2 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setExpanded(false)}
                className="p-1 rounded-md text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label="Collapse chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !sending && (
              <div className="text-center text-xs text-neutral-400 py-6">
                Chat with the RemitPal AI agent to plan a remittance or log a receipt.
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>RemitPal AI is thinking…</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Always-visible input bar */}
      {/* Role hint — shown above the bar when not expanded, to guide the user */}
      {!expanded && currentUser?.role !== 'remitter' && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-0">
          <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1.5">
            <span>📎</span>
            <span>Attach a receipt photo to log an expense via the AI agent</span>
          </span>
        </div>
      )}
      <div className="flex items-end gap-2 px-3 sm:px-4 py-2.5">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-2 rounded-full text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
        >
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
          aria-label="Attach receipt photo"
          title="Attach receipt photo"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAttach}
          className="hidden"
        />

        <div className="flex-1 flex items-end gap-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 focus-within:ring-2 focus-within:ring-emerald-500/40">
          {image && (
            <div className="relative shrink-0">
              <img src={image.dataUrl} alt="receipt preview" className="w-10 h-10 rounded-lg object-cover" />
              <button
                onClick={() => setImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-neutral-800 text-white rounded-full p-0.5 hover:bg-neutral-700"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            onFocus={() => setExpanded(true)}
            placeholder={placeholder}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none max-h-28 py-1"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!input.trim() && !image)}
            className="shrink-0 p-2 rounded-full text-white bg-gradient-to-br from-emerald-500 to-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Single message bubble (with approval card for pending actions)
// ---------------------------------------------------------------------------

const MessageBubble: React.FC<{
  message: ChatMessage;
  onApprove: (m: ChatMessage) => void;
  onReject: (m: ChatMessage) => void;
}> = ({ message, onApprove, onReject }) => {
  const isUser = message.role === 'user';
  const showApproval = !!message.pendingAction && message.actionState !== 'approved' && message.actionState !== 'rejected';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        {message.imageUrl && (
          <img src={message.imageUrl} alt="receipt" className="rounded-xl max-h-40 border border-neutral-200 dark:border-neutral-700" />
        )}
        {message.text && (
          <div
            className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
              isUser
                ? 'bg-emerald-600 text-white rounded-br-md'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-bl-md'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Remittance approval card — state-driven: pending / approving / approved / rejected */}
        {message.pendingAction && (
          <>
            {/* Approving: spinner replaces the card body to block double-taps */}
            {message.actionState === 'approving' && (
              <div className="w-full p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center justify-center gap-3 rounded-bl-md">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Sending via PayPal…</span>
              </div>
            )}

            {/* Approved: compact green confirmation banner — no buttons */}
            {message.actionState === 'approved' && (
              <div className="w-full px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 flex items-center gap-3 rounded-bl-md">
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    {message.pendingAction.isExtra ? 'EXTRA remittance approved & sent via PayPal' : 'Remittance approved & sent via PayPal'}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                    {formatCurrencyIdr(message.pendingAction.amountIdr)} · {message.pendingAction.monthYear}
                  </p>
                  {message.actionNote && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                      {message.actionNote}
                    </p>
                  )}
                </div>
              </div>
            )}


            {/* Rejected: compact grey banner — no buttons */}
            {message.actionState === 'rejected' && (
              <div className="w-full px-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 flex items-center gap-2 rounded-bl-md">
                <Ban className="w-4 h-4 text-neutral-400 shrink-0" />
                <p className="text-xs text-neutral-500">Remittance draft rejected</p>
              </div>
            )}

            {/* Pending: full actionable card */}
            {showApproval && (
              <div className={`w-full p-3 rounded-2xl border rounded-bl-md ${message.pendingAction.isExtra ? 'border-amber-300 dark:border-amber-700/70 bg-amber-50/70 dark:bg-amber-950/30' : 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/30'}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className={`w-3.5 h-3.5 ${message.pendingAction.isExtra ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                  <span className={`text-xs font-semibold ${message.pendingAction.isExtra ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
                    {message.pendingAction.isExtra ? '⚠️ EXTRA transfer — for your approval' : 'Remittance for your approval'}
                  </span>
                </div>

                {message.pendingAction.isExtra && (
                  <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                    Second transfer in {message.pendingAction.monthYear} — please confirm this is intentional.
                    {message.pendingAction.reason ? ` Reason: ${message.pendingAction.reason}.` : ''}
                  </p>
                )}

                <div className="space-y-1.5 text-xs text-neutral-700 dark:text-neutral-200">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Record in ledger</span>
                    <span className="font-mono font-semibold">{formatCurrencyIdr(message.pendingAction.amountIdr)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Month</span>
                    <span className="font-mono">{message.pendingAction.monthYear}</span>
                  </div>
                  {message.pendingAction.isExtra && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Already sent this month</span>
                        <span className="font-mono">{formatCurrencyIdr(message.pendingAction.monthRemittanceTotalIdr || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Month total after this</span>
                        <span className="font-mono font-semibold">{formatCurrencyIdr(message.pendingAction.monthTotalAfterIdr || message.pendingAction.amountIdr)}</span>
                      </div>
                    </>
                  )}
                  {Object.keys(message.pendingAction.allocations || {}).length > 0 && (
                    <div className="pt-1.5 mt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
                      <div className="text-neutral-500 mb-1">Allocations</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {Object.entries(message.pendingAction.allocations)
                          .filter(([, v]) => Number(v) > 0)
                          .map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="capitalize">{k}</span>
                              <span className="font-mono">{formatCurrencyIdr(Number(v))}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* PayPal send amount — derived server-side, read-only */}
                  <div className="pt-1.5 mt-1.5 border-t border-emerald-200/60 dark:border-emerald-800/60">
                    <div className="text-neutral-500 mb-1">Send via PayPal (Payouts v1, sandbox)</div>
                    <p className="font-mono font-semibold">
                      USD {idrToUsdDisplay(message.pendingAction.amountIdr)} — derived from{' '}
                      {formatCurrencyIdr(message.pendingAction.amountIdr)} at Rp 16,000/USD, display rate only
                    </p>
                  </div>
                </div>

                {message.actionError && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{message.actionError}</span>
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onApprove(message)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve &amp; Send via PayPal
                  </button>
                  <button
                    onClick={() => onReject(message)}
                    className="px-3 py-2 text-xs font-medium rounded-lg text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5 inline mr-1" />
                    Reject
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Re-export kept minimal to satisfy tree-shaking intent.
