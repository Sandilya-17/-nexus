import { useEffect, useRef, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import useChatStore from '../../context/chatStore';
import useAuthStore from '../../context/authStore';
import MessageBubble from './MessageBubble';
import { useInView } from 'react-intersection-observer';

const DateSeparator = ({ date }) => {
  const d = new Date(date);
  const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy');
  return (
    <div className="flex justify-center my-3 px-4">
      <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-2)' }}>
        {label}
      </span>
    </div>
  );
};

export default function MessageList({ messages, loading, hasMore, onLoadMore }) {
  const { activeChat, typingUsers } = useChatStore();
  const { user } = useAuthStore();
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevScrollHeight = useRef(0);

  const typing = typingUsers[activeChat?._id] || [];

  // Load more trigger
  const { ref: topRef } = useInView({
    onChange: (inView) => { if (inView && hasMore && !loading) onLoadMore(); },
    threshold: 0,
  });

  // Preserve scroll position when prepending
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const diff = el.scrollHeight - prevScrollHeight.current;
    if (diff > 0 && prevScrollHeight.current > 0) {
      el.scrollTop += diff;
    }
    prevScrollHeight.current = el.scrollHeight;
  }, [messages.length]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typing]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distFromBottom < 100);
  };

  // Group messages by date and consecutive sender
  const grouped = [];
  let lastDate = null;
  let lastSenderId = null;

  messages.forEach((msg, idx) => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      grouped.push({ type: 'separator', date: msg.createdAt });
      lastDate = msgDate;
      lastSenderId = null;
    }
    const isSameSender = lastSenderId === (msg.sender?._id || msg.sender);
    grouped.push({ type: 'message', msg, showAvatar: !isSameSender || msg.type === 'system' });
    lastSenderId = msg.sender?._id || msg.sender;
  });

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2 wa-wallpaper"
    >
      {/* Load more trigger */}
      <div ref={topRef} className="h-1" />

      {loading && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--accent-dim)', borderTopColor: 'var(--accent)' }} />
        </div>
      )}

      {grouped.map((item, idx) => {
        if (item.type === 'separator') return <DateSeparator key={`sep-${item.date}`} date={item.date} />;
        const { msg, showAvatar } = item;
        const isOwn = (msg.sender?._id || msg.sender) === user?._id;
        return (
          <MessageBubble
            key={msg._id}
            message={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
          />
        );
      })}

      {/* Typing indicator */}
      {typing.length > 0 && (
        <div className="flex items-end gap-2 mb-2 animate-fade-in">
          <div className="flex items-center gap-1 px-4 py-3 rounded-lg rounded-tl-none message-bubble-in w-20">
            <span className="typing-dot" style={{ animationDelay: '0ms' }} />
            <span className="typing-dot" style={{ animationDelay: '150ms' }} />
            <span className="typing-dot" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <button
          onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setAutoScroll(true); }}
          className="fixed bottom-24 right-6 w-10 h-10 rounded-full text-white shadow-lg flex items-center justify-center transition-colors z-10"
          style={{ background: 'var(--bg-card)' }}
        >
          ↓
        </button>
      )}
    </div>
  );
}
