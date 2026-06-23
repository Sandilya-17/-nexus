import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, Mic, MicOff, Smile, X, Image,
  FileText, MapPin, BarChart2, StopCircle, Play
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useDropzone } from 'react-dropzone';
import api from '../../services/api';
import useChatStore from '../../context/chatStore';
import { emitTyping } from '../../services/socket';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function MessageInput({ chatId }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showPoll, setShowPoll] = useState(false);

  const textRef = useRef(null);
  const typingTimer = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const recordTimer = useRef(null);

  const { addMessage } = useChatStore();

  // Auto-resize textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [text]);

  // Typing indicator
  const handleTyping = (val) => {
    setText(val);
    emitTyping(chatId, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(chatId, false), 2000);
  };

  // File drop
  const onDrop = useCallback((files) => {
    const file = files[0];
    if (!file) return;
    setAttachedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreview(URL.createObjectURL(file));
    }
    setShowAttach(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, noClick: true, noKeyboard: true,
    accept: { 'image/*': [], 'video/*': [], 'audio/*': [], 'application/*': [], 'text/*': [] },
  });

  const clearAttachment = () => {
    setAttachedFile(null);
    setPreview(null);
    if (preview) URL.revokeObjectURL(preview);
  };

  const getMessageType = (file) => {
    if (!file) return 'text';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return file._isVoice ? 'voice' : 'audio';
    return 'file';
  };

  const sendMessage = async () => {
    if (sending || (!text.trim() && !attachedFile)) return;

    setSending(true);
    emitTyping(chatId, false);

    try {
      const fd = new FormData();
      fd.append('type', getMessageType(attachedFile));
      if (text.trim()) fd.append('content', text.trim());
      if (attachedFile) fd.append('file', attachedFile);

      const { data } = await api.post(`/messages/${chatId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      addMessage(chatId, data.message);
      setText('');
      clearAttachment();
      textRef.current?.focus();
    } catch (e) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.start();
      setRecording(true);
      setRecordDuration(0);
      recordTimer.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    } catch (e) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    mediaRecorder.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
      const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
      file._isVoice = true;
      setAttachedFile(file);
      mediaRecorder.current?.stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.current.stop();
    setRecording(false);
    clearInterval(recordTimer.current);
  };

  const cancelRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.ondataavailable = null;
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(t => t.stop());
    }
    setRecording(false);
    setRecordDuration(0);
    clearInterval(recordTimer.current);
  };

  const formatDuration = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'bg-[var(--bg-sidebar)] transition-all relative',
        isDragActive && 'bg-[var(--accent-dim)]'
      )}
    >
      <input {...getInputProps()} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed rounded-xl z-50"
          style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
          <p className="font-medium" style={{ color: 'var(--accent-bright)' }}>Drop file to attach</p>
        </div>
      )}

      {/* Attachment preview */}
      {attachedFile && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--bg-card)' }}>
            {preview ? (
              <img src={preview} alt="preview" className="w-16 h-16 rounded-lg object-cover" />
            ) : attachedFile._isVoice ? (
              <div className="w-16 h-12 flex items-center justify-center rounded-lg" style={{ background: 'var(--accent-dim)' }}>
                <Mic size={20} style={{ color: 'var(--accent-bright)' }} />
              </div>
            ) : (
              <div className="w-12 h-12 flex items-center justify-center rounded-lg" style={{ background: 'var(--accent-dim)' }}>
                <FileText size={20} style={{ color: 'var(--accent-bright)' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{attachedFile.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-2)' }}>
                {attachedFile._isVoice ? 'Voice message' : `${(attachedFile.size / 1024).toFixed(1)} KB`}
              </p>
            </div>
            <button onClick={clearAttachment} className="hover:text-red-400 transition-colors" style={{ color: 'var(--text-2)' }}>
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Poll creator */}
      {showPoll && <PollCreator chatId={chatId} onClose={() => setShowPoll(false)} />}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-20 left-4 z-50">
          <EmojiPicker
            onEmojiClick={(e) => { setText(t => t + e.emoji); setShowEmoji(false); textRef.current?.focus(); }}
            theme="dark"
            height={350}
            width={320}
            searchDisabled={false}
          />
        </div>
      )}

      {/* Recording UI */}
      {recording ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={cancelRecording} className="hover:text-red-400 transition-colors" style={{ color: 'var(--text-2)' }}>
            <X size={20} />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${(recordDuration % 60) / 60 * 100}%` }} />
            </div>
            <span className="text-sm font-mono text-red-400">{formatDuration(recordDuration)}</span>
          </div>
          <button onClick={stopRecording}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors">
            <StopCircle size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2 px-3 py-2.5">
          {/* Emoji */}
          <button onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }}
            className="btn-ghost p-2.5 flex-shrink-0"
            style={showEmoji ? { color: 'var(--accent-bright)' } : {}}>
            <Smile size={23} />
          </button>

          {/* Attach menu */}
          <div className="relative flex-shrink-0">
            <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }}
              className="btn-ghost p-2.5"
              style={showAttach ? { color: 'var(--accent-bright)' } : {}}>
              <Paperclip size={22} />
            </button>
            {showAttach && (
              <div className="absolute bottom-12 left-0 card shadow-xl p-2 grid grid-cols-3 gap-2 animate-fade-in w-44">
                {[
                  { icon: Image, label: 'Photo/Video', accept: 'image/*,video/*' },
                  { icon: FileText, label: 'Document', accept: '*' },
                  { icon: BarChart2, label: 'Poll', action: () => { setShowPoll(true); setShowAttach(false); } },
                ].map(({ icon: Icon, label, accept, action }) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (action) { action(); return; }
                      const el = document.createElement('input');
                      el.type = 'file';
                      el.accept = accept;
                      el.onchange = (e) => e.target.files[0] && onDrop([e.target.files[0]]);
                      el.click();
                      setShowAttach(false);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                    style={{ color: 'var(--text-2)' }}
                  >
                    <Icon size={20} />
                    <span className="text-[10px]">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textRef}
              value={text}
              onChange={e => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              rows={1}
              className="w-full rounded-3xl px-4 py-2.5 text-[15px] resize-none overflow-y-auto transition-all focus:outline-none"
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text-1)',
                maxHeight: 120,
              }}
            />
          </div>

          {/* Send / Voice */}
          {text.trim() || attachedFile ? (
            <button
              onClick={sendMessage}
              disabled={sending}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {sending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send size={18} />}
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className="w-10 h-10 flex items-center justify-center rounded-full text-white transition-all flex-shrink-0"
              style={{ background: 'var(--accent)' }}
              title="Hold to record voice message"
            >
              <Mic size={19} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PollCreator({ chatId, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [sending, setSending] = useState(false);
  const { addMessage } = useChatStore();

  const addOption = () => options.length < 10 && setOptions([...options, '']);
  const updateOption = (i, val) => setOptions(options.map((o, idx) => idx === i ? val : o));
  const removeOption = (i) => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!question.trim()) return toast.error('Add a question');
    const validOptions = options.filter(o => o.trim());
    if (validOptions.length < 2) return toast.error('Add at least 2 options');

    setSending(true);
    try {
      const fd = new FormData();
      fd.append('type', 'poll');
      fd.append('pollData', JSON.stringify({ question: question.trim(), options: validOptions, multipleChoice }));
      const { data } = await api.post(`/messages/${chatId}`, fd);
      addMessage(chatId, data.message);
      onClose();
    } catch (e) {
      toast.error('Failed to create poll');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-4 mb-3 card p-4 animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium flex items-center gap-2"><BarChart2 size={16} /> Create Poll</h3>
        <button onClick={onClose} style={{ color: 'var(--text-2)' }}><X size={16} /></button>
      </div>
      <input value={question} onChange={e => setQuestion(e.target.value)}
        className="input-field text-sm mb-3" placeholder="Ask a question..." />
      <div className="space-y-2 mb-3">
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input value={opt} onChange={e => updateOption(i, e.target.value)}
              className="input-field text-sm flex-1" placeholder={`Option ${i + 1}`} />
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="hover:text-red-400" style={{ color: 'var(--text-2)' }}><X size={14} /></button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={addOption} className="text-xs hover:underline" style={{ color: 'var(--accent-bright)' }}>+ Add option</button>
          <label className="flex items-center gap-1.5 text-xs ml-4 cursor-pointer" style={{ color: 'var(--text-2)' }}>
            <input type="checkbox" checked={multipleChoice} onChange={e => setMultipleChoice(e.target.checked)} className="rounded" />
            Multiple choice
          </label>
        </div>
        <button onClick={submit} disabled={sending} className="btn-primary text-sm px-4 py-1.5">
          {sending ? 'Sending...' : 'Create'}
        </button>
      </div>
    </div>
  );
}
