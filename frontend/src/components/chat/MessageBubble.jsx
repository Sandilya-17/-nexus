import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCheck, Reply, Smile, MoreHorizontal, Star, Trash2, Edit2, Copy, Forward } from 'lucide-react';
import Avatar from '../ui/Avatar';
import api from '../../services/api';
import useChatStore from '../../context/chatStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({ message: msg, isOwn, showAvatar }) {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { updateMessage, deleteMessage, activeChat } = useChatStore();

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs px-3 py-1 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-2)' }}>
          {msg.content}
        </span>
      </div>
    );
  }

  const readStatus = () => {
    if (!isOwn) return null;
    const readCount = msg.readBy?.length || 0;
    return readCount > 0
      ? <CheckCheck size={15} style={{ color: '#53bdeb' }} />
      : <Check size={15} style={{ color: 'var(--text-2)' }} />;
  };

  const handleReact = async (emoji) => {
    try {
      const { data } = await api.post(`/messages/${msg._id}/react`, { emoji });
      updateMessage(activeChat._id, msg._id, { reactions: data.reactions });
    } catch (e) { toast.error('Failed to react'); }
    setShowEmojiPicker(false);
    setShowActions(false);
  };

  const handleDelete = async (forEveryone) => {
    try {
      await api.delete(`/messages/${msg._id}?deleteFor=${forEveryone ? 'everyone' : 'me'}`);
      if (forEveryone) deleteMessage(activeChat._id, msg._id);
      else updateMessage(activeChat._id, msg._id, { deletedForMe: true });
    } catch (e) { toast.error('Failed to delete'); }
  };

  const handleStar = async () => {
    try {
      await api.post(`/messages/${msg._id}/star`);
      toast.success(msg.starredBy?.includes('me') ? 'Unstarred' : 'Starred');
    } catch (e) { toast.error('Failed to star'); }
  };

  const handleCopy = () => {
    if (msg.content) navigator.clipboard.writeText(msg.content);
    toast.success('Copied');
  };

  if (msg.isDeletedForEveryone) {
    return (
      <div className={clsx('flex items-end gap-2 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
        {!isOwn && showAvatar && <div className="w-8" />}
        <div className="px-3 py-2 rounded-lg text-xs italic flex items-center gap-1.5" style={{ background: 'var(--bg-card)', color: 'var(--text-2)' }}>
          🚫 This message was deleted
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (msg.type) {
      case 'image':
        return (
          <div className="rounded-xl overflow-hidden max-w-[280px]">
            <img src={msg.mediaUrl} alt="Image" className="w-full cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(msg.mediaUrl, '_blank')} />
            {msg.content && <p className="px-3 py-2 text-sm">{msg.content}</p>}
          </div>
        );
      case 'video':
        return (
          <div className="rounded-xl overflow-hidden max-w-[280px]">
            <video src={msg.mediaUrl} controls className="w-full" poster={msg.mediaThumbnail} />
            {msg.content && <p className="px-3 py-2 text-sm">{msg.content}</p>}
          </div>
        );
      case 'voice':
      case 'audio':
        return (
          <div className="flex items-center gap-3 px-3 py-2 min-w-[200px]">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>🎤</div>
            <audio src={msg.mediaUrl} controls className="flex-1 h-8" style={{ filter: 'invert(0.7)' }} />
            {msg.mediaDuration && <span className="text-xs" style={{ color: 'var(--text-2)' }}>{Math.round(msg.mediaDuration)}s</span>}
          </div>
        );
      case 'file':
        return (
          <a href={msg.mediaUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors min-w-[180px]">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'var(--accent-dim)' }}>📎</div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{msg.mediaName || 'File'}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>{msg.mediaMimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
            </div>
          </a>
        );
      case 'location':
        return (
          <a href={`https://maps.google.com/?q=${msg.location?.lat},${msg.location?.lng}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2">
            📍 <span className="text-sm">{msg.location?.address || 'View Location'}</span>
          </a>
        );
      case 'poll':
        return <PollBubble poll={msg.poll} messageId={msg._id} chatId={activeChat?._id} />;
      default:
        return msg.content ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        ) : null;
    }
  };

  return (
    <div
      className={clsx('flex items-end gap-2 mb-1 group', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      {!isOwn && (
        showAvatar
          ? <Avatar src={msg.sender?.avatar} name={msg.sender?.name} size={28} className="mb-1 flex-shrink-0" />
          : <div className="w-7 flex-shrink-0" />
      )}

      <div className={clsx('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name for groups */}
        {!isOwn && showAvatar && activeChat?.type !== 'direct' && (
          <span className="text-xs font-medium mb-1 ml-1" style={{ color: 'var(--accent-bright)' }}>{msg.sender?.name}</span>
        )}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className="flex flex-col mb-1 px-3 py-1.5 rounded-lg border-l-2 max-w-[200px]"
            style={{ borderColor: 'var(--accent)', background: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-bright)' }}>{msg.replyTo.sender?.name}</span>
            <span className="text-xs truncate" style={{ color: 'var(--text-2)' }}>{msg.replyTo.content || '📎 Media'}</span>
          </div>
        )}

        {/* Bubble */}
        <div className={clsx(
          'relative',
          isOwn ? 'message-bubble-out msg-out' : 'message-bubble-in msg-in',
          msg.type === 'text' ? '' : 'overflow-hidden'
        )}>
          {renderContent()}

          {/* Timestamp + read receipt */}
          <div className={clsx('flex items-center gap-1 mt-0.5', isOwn ? 'justify-end' : 'justify-start')}>
            <span className="text-[11px]" style={{ color: isOwn ? 'rgba(255,255,255,0.6)' : 'var(--text-2)' }}>
              {format(new Date(msg.createdAt), 'HH:mm')}
              {msg.isEdited && ' · edited'}
            </span>
            {readStatus()}
          </div>
        </div>

        {/* Reactions */}
        {msg.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {msg.reactions.map(r => (
              <button key={r.emoji} onClick={() => handleReact(r.emoji)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs transition-colors"
                style={{ background: 'var(--bg-card)' }}>
                {r.emoji} <span style={{ color: 'var(--text-2)' }}>{r.users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      {showActions && (
        <div className={clsx(
          'flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isOwn ? 'order-first' : ''
        )}>
          {/* Quick emoji */}
          {showEmojiPicker && (
            <div className="flex gap-1 rounded-xl px-2 py-1.5 shadow-xl" style={{ background: 'var(--bg-card)' }}>
              {EMOJI_QUICK.map(e => (
                <button key={e} onClick={() => handleReact(e)} className="text-lg hover:scale-125 transition-transform">
                  {e}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-2)' }}>
            <Smile size={14} />
          </button>
          <button onClick={handleCopy}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] transition-colors" style={{ color: 'var(--text-2)' }}>
            <Copy size={14} />
          </button>
          {isOwn && (
            <button onClick={() => handleDelete(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors" style={{ color: 'var(--text-2)' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PollBubble({ poll, messageId, chatId }) {
  const [voting, setVoting] = useState(false);
  const { updateMessage } = useChatStore();

  const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);

  const vote = async (idx) => {
    if (voting) return;
    setVoting(true);
    try {
      const { data } = await api.post(`/messages/${messageId}/poll-vote`, { optionIndex: idx });
      updateMessage(chatId, messageId, { poll: data.poll });
    } catch (e) { toast.error('Vote failed'); }
    setVoting(false);
  };

  return (
    <div className="px-3 py-3 min-w-[220px]">
      <p className="font-medium text-sm mb-3">📊 {poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((opt, idx) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes?.length || 0) / totalVotes * 100) : 0;
          return (
            <button key={idx} onClick={() => vote(idx)}
              className="w-full text-left relative overflow-hidden rounded-lg transition-colors"
              style={{ border: '1px solid var(--border)' }}>
              <div className="absolute inset-0" style={{ background: 'var(--accent-dim)', width: `${pct}%` }} />
              <div className="relative flex items-center justify-between px-3 py-2">
                <span className="text-sm">{opt.text}</span>
                <span className="text-xs" style={{ color: 'var(--text-2)' }}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-2)' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  );
}
