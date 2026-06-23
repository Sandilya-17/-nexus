import { useState, useEffect, useRef } from 'react';
import { Plus, Eye, X, Camera, Type, Film, Trash2 } from 'lucide-react';
import api from '../services/api';
import Avatar from '../components/ui/Avatar';
import useAuthStore from '../context/authStore';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const BG_COLORS = ['#1a1a2e','#16213e','#0f3460','#533483','#2d6a4f','#1b4332','#6b2737','#7c3626'];

export default function StatusPage() {
  const { user } = useAuthStore();
  const [statuses, setStatuses] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingStatus, setViewingStatus] = useState(null); // { userStatuses, index }
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState(null); // 'text' | 'image' | 'video'
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const [statusRes, myRes] = await Promise.all([api.get('/status'), api.get('/status/my')]);
      setStatuses(statusRes.data.statuses);
      setMyStatuses(myRes.data.statuses);
    } catch (e) {} finally { setLoading(false); }
  };

  const handleMediaSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const submitStatus = async () => {
    if (createType === 'text' && !textContent.trim()) return toast.error('Write something');
    if (createType !== 'text' && !mediaFile) return toast.error('Select a file');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('type', createType);
      if (createType === 'text') { fd.append('content', textContent); fd.append('backgroundColor', bgColor); }
      else { fd.append('media', mediaFile); if (captionText) fd.append('content', captionText); }
      await api.post('/status', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Status posted!');
      setCreating(false); setCreateType(null); setTextContent(''); setMediaFile(null); setMediaPreview(null);
      fetchStatuses();
    } catch (e) { toast.error('Failed to post status'); } finally { setUploading(false); }
  };

  const openStatus = async (group, startIdx = 0) => {
    setViewingStatus({ group, index: startIdx });
    await api.post(`/status/${group.statuses[startIdx]._id}/view`).catch(() => {});
  };

  const nextStatus = () => {
    if (!viewingStatus) return;
    const { group, index } = viewingStatus;
    if (index < group.statuses.length - 1) {
      const newIdx = index + 1;
      api.post(`/status/${group.statuses[newIdx]._id}/view`).catch(() => {});
      setViewingStatus({ group, index: newIdx });
    } else {
      setViewingStatus(null);
    }
  };

  const deleteMyStatus = async (statusId) => {
    try {
      await api.delete(`/status/${statusId}`);
      setMyStatuses(prev => prev.filter(s => s._id !== statusId));
      toast.success('Status deleted');
    } catch (e) { toast.error('Failed to delete'); }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 lg:w-96 border-r border-[var(--border)] flex flex-col">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-xl font-bold">Status</h1>
          <p className="text-sm text-[var(--text-2)] mt-0.5">Updates disappear after 24 hours</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* My status */}
          <div className="p-4 border-b border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-2)] uppercase mb-3">My Status</p>
            <div className="flex items-center gap-3">
              <div className="relative cursor-pointer" onClick={() => myStatuses.length ? openStatus({ user, statuses: myStatuses }, 0) : setCreating(true)}>
                <Avatar src={user?.avatar} name={user?.name} size={52} />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center border-2 border-[var(--bg-main)]">
                  <Plus size={12} className="text-white" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{myStatuses.length > 0 ? 'My Status' : 'Add Status'}</p>
                <p className="text-xs text-[var(--text-2)]">
                  {myStatuses.length > 0 ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}` : 'Tap to add'}
                </p>
              </div>
              {myStatuses.length > 0 && (
                <button onClick={() => deleteMyStatus(myStatuses[0]._id)} className="text-[var(--text-2)] hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Create buttons */}
            <div className="flex gap-2 mt-3">
              {[
                { type: 'text', icon: Type, label: 'Text' },
                { type: 'image', icon: Camera, label: 'Photo' },
                { type: 'video', icon: Film, label: 'Video' },
              ].map(({ type, icon: Icon, label }) => (
                <button key={type} onClick={() => { setCreateType(type); setCreating(true); }}
                  className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)]/5 transition-all">
                  <Icon size={16} className="text-[var(--accent-bright)]" />
                  <span className="text-[10px] text-[var(--text-2)]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Others' statuses */}
          <div className="p-4">
            <p className="text-xs font-medium text-[var(--text-2)] uppercase mb-3">Recent Updates</p>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)]" />
                  <div><div className="h-4 bg-[var(--bg-hover)] rounded w-24 mb-2" /><div className="h-3 bg-[var(--bg-hover)] rounded w-16" /></div>
                </div>
              ))
            ) : statuses.length === 0 ? (
              <p className="text-center text-[var(--text-2)] text-sm py-8">No status updates from your contacts</p>
            ) : (
              statuses.map(group => {
                const allViewed = group.statuses.every(s => s.viewedByMe);
                const latest = group.statuses[0];
                return (
                  <button key={group.user._id} onClick={() => openStatus(group)}
                    className="w-full flex items-center gap-3 mb-3 p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-left">
                    <div className={clsx('p-0.5 rounded-full', allViewed ? 'bg-[var(--border)]' : 'bg-gradient-to-tr from-primary-500 to-purple-500')}>
                      <Avatar src={group.user.avatar} name={group.user.name} size={44} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{group.user.name}</p>
                      <p className="text-xs text-[var(--text-2)]">
                        {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })} · {group.statuses.length} update{group.statuses.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Status viewer */}
      {viewingStatus ? (
        <StatusViewer status={viewingStatus.group.statuses[viewingStatus.index]} group={viewingStatus.group} onNext={nextStatus} onClose={() => setViewingStatus(null)} currentIndex={viewingStatus.index} total={viewingStatus.group.statuses.length} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-[var(--text-2)]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mx-auto mb-4">
              <Eye size={32} />
            </div>
            <p className="font-medium">Select a status to view</p>
          </div>
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h2 className="font-semibold">Create Status</h2>
              <button onClick={() => setCreating(false)} className="btn-ghost p-1.5"><X size={18} /></button>
            </div>
            <div className="p-4">
              {createType === 'text' ? (
                <>
                  <div className="rounded-xl mb-4 flex items-center justify-center p-8 min-h-[160px]" style={{ background: bgColor }}>
                    <textarea value={textContent} onChange={e => setTextContent(e.target.value)}
                      placeholder="What's on your mind?" className="bg-transparent text-white text-xl text-center resize-none outline-none w-full" rows={4} />
                  </div>
                  <div className="flex gap-2 mb-4">
                    {BG_COLORS.map(c => (
                      <button key={c} onClick={() => setBgColor(c)}
                        className={clsx('w-7 h-7 rounded-full transition-transform', bgColor === c && 'scale-125 ring-2 ring-white')}
                        style={{ background: c }} />
                    ))}
                  </div>
                </>
              ) : (
                <label className="block mb-4">
                  {mediaPreview ? (
                    createType === 'video'
                      ? <video src={mediaPreview} className="w-full rounded-xl max-h-48 object-cover" controls />
                      : <img src={mediaPreview} alt="" className="w-full rounded-xl max-h-48 object-cover" />
                  ) : (
                    <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--accent)]/40 transition-colors">
                      <Camera size={28} className="mx-auto mb-2 text-[var(--text-2)]" />
                      <p className="text-sm text-[var(--text-2)]">Click to select {createType}</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept={createType === 'video' ? 'video/*' : 'image/*'} onChange={handleMediaSelect} />
                </label>
              )}
              {createType !== 'text' && (
                <input value={captionText} onChange={e => setCaptionText(e.target.value)}
                  className="input-field mb-4 text-sm" placeholder="Add a caption..." />
              )}
              <button onClick={submitStatus} disabled={uploading} className="btn-primary w-full py-3">
                {uploading ? 'Posting...' : 'Post Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusViewer({ status, group, onNext, onClose, currentIndex, total }) {
  const progressTimer = useRef(null);
  const [progress, setProgress] = useState(0);
  const duration = status.type === 'video' ? (status.mediaDuration || 10) * 1000 : 5000;

  useEffect(() => {
    setProgress(0);
    const start = Date.now();
    progressTimer.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) { clearInterval(progressTimer.current); onNext(); }
    }, 50);
    return () => clearInterval(progressTimer.current);
  }, [status._id]);

  return (
    <div className="flex-1 relative bg-black flex flex-col">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-3 z-10">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-none"
              style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Avatar src={group.user.avatar} name={group.user.name} size={36} />
          <div>
            <p className="text-white font-medium text-sm">{group.user.name}</p>
            <p className="text-white/60 text-xs">{formatDistanceToNow(new Date(status.createdAt), { addSuffix: true })}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center" onClick={onNext}>
        {status.type === 'image' && <img src={status.mediaUrl} alt="Status" className="max-w-full max-h-full object-contain" />}
        {status.type === 'video' && <video src={status.mediaUrl} autoPlay className="max-w-full max-h-full" />}
        {status.type === 'text' && (
          <div className="w-full h-full flex items-center justify-center p-8" style={{ background: status.backgroundColor }}>
            <p className="text-white text-3xl font-bold text-center">{status.content}</p>
          </div>
        )}
      </div>

      {status.content && status.type !== 'text' && (
        <div className="absolute bottom-16 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/60">
          <p className="text-white text-sm">{status.content}</p>
        </div>
      )}

      {/* Views count */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 text-white/60 text-xs">
        <Eye size={12} /> {status.views?.length || 0}
      </div>
    </div>
  );
}
