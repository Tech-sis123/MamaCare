import { useState, useEffect } from 'react';
import { getLessonComments, postLessonComment, deleteLessonComment } from '../lib/api';

const timeAgo = (iso) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Patient comments on a lesson, with doctors' replies underneath each. */
const LessonComments = ({ moduleId }) => {
  const [comments, setComments] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getLessonComments(moduleId)
      .then(({ data }) => {
        if (cancelled) return;
        setComments(data.comments || []);
        setIsPublic(!!data.public);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setError('');
    try {
      const { data } = await postLessonComment(moduleId, text.trim());
      setComments((prev) => [data.comment, ...prev]);
      setText('');
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'You are commenting very fast. Please wait a minute and try again.'
          : err.response?.data?.issues?.[0]?.message || 'Could not post your comment. Please try again.'
      );
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteLessonComment(moduleId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError('Could not delete that comment.');
    }
  };

  return (
    <section className="px-5 pb-6 space-y-4" aria-labelledby="lesson-comments-title">
      <div>
        <h3 id="lesson-comments-title" className="font-headline-md text-on-surface text-base flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">forum</span>
          Questions & comments
        </h3>
        <p className="text-xs text-on-surface-variant mt-1">
          {isPublic
            ? 'Ask a question about this video. Other mothers will see your first name and comment, and our doctors reply here.'
            : 'Ask a question about this video. Only you and our doctors can see what you write, and a doctor will reply here.'}
        </p>
      </div>

      <form onSubmit={handlePost} className="space-y-2">
        <textarea
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          maxLength={2000}
          placeholder="Type your question or comment…"
          className="w-full px-4 py-3 text-sm border border-outline-variant rounded-xl bg-white focus:ring-2 focus:ring-primary outline-none resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-on-surface-variant">
            For an emergency, don't wait for a reply. Go to the hospital or call your clinic.
          </p>
          <button
            type="submit"
            disabled={posting || !text.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold shrink-0 disabled:opacity-40"
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-on-surface-variant italic">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No questions yet. Be the first to ask.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-on-surface">
                    {c.author.name} <span className="font-normal text-on-surface-variant">· {timeAgo(c.created_at)}</span>
                  </p>
                  <p className="text-sm text-on-surface whitespace-pre-wrap mt-0.5">{c.body}</p>
                </div>
                {c.is_mine && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete my comment"
                    className="text-on-surface-variant hover:text-error shrink-0 p-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>

              {c.replies.length > 0 ? (
                <ul className="space-y-2 pl-3 border-l-2 border-primary/30">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <p className="text-xs font-semibold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          verified
                        </span>
                        {r.author.name} <span className="font-normal text-on-surface-variant">· Doctor · {timeAgo(r.created_at)}</span>
                      </p>
                      <p className="text-sm text-on-surface whitespace-pre-wrap mt-0.5">{r.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                c.is_mine && <p className="text-[11px] text-on-surface-variant italic">Waiting for a doctor to reply</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default LessonComments;
