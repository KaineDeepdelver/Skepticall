import React, { useState, useEffect, useRef } from 'react';
import { api, API_BASE, replyApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRequireAccount } from '../hooks/useRequireAccount';
import UserAvatar from './UserAvatar';

const EMOJI_ROWS = [
  ['👍','❤️','😂','😮','😢','😡'],
  ['🔥','🎉','👀','💯','🤔','😍'],
  ['👏','🙏','💪','🥳','😭','🤣'],
  ['✨','💀','🫡','🤯','😤','🥹'],
];

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function EmojiPicker({ onPick, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div ref={ref} style={{position:'absolute',bottom:'110%',left:0,background:'var(--bg-menu)',border:'1px solid var(--border-input)',borderRadius:14,padding:'10px 12px',boxShadow:'0 8px 28px rgba(0,0,0,0.4)',zIndex:50,width:200}}>
      {EMOJI_ROWS.map((row,ri) => (
        <div key={ri} style={{display:'flex',gap:4,marginBottom:ri<EMOJI_ROWS.length-1?4:0}}>
          {row.map(e => (
            <button key={e} onClick={()=>{onPick(e);onClose();}} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',padding:'4px 5px',borderRadius:8,lineHeight:1}}
              onMouseEnter={ev=>ev.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={ev=>ev.currentTarget.style.background='none'}>{e}</button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReplyBox({ parentId, authorId, onAdded }) {
  const [text, setText] = useState('');
  const ref = useRef();
  async function submit() {
    if (!text.trim()) return;
    try {
      const r = await replyApi.addReply(parentId, text.trim());
      onAdded(r); setText('');
    } catch {}
  }
  return (
    <div style={{display:'flex',gap:6,alignItems:'flex-end',marginTop:6,paddingLeft:38}}>
      <textarea ref={ref} value={text} rows={1}
        onChange={e=>{setText(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,80)+'px';}}
        onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}}}
        placeholder="Write a reply…"
        style={{flex:1,background:'var(--bg-input)',border:'1px solid var(--border-input)',borderRadius:14,padding:'6px 12px',color:'var(--text-primary)',fontSize:12,outline:'none',resize:'none',fontFamily:'inherit',minHeight:30,maxHeight:80}}
        onFocus={e=>e.target.style.borderColor='var(--accent)'}
        onBlur={e=>e.target.style.borderColor='var(--border-input)'}
      />
      <button onClick={submit} style={{background:'var(--accent)',border:'none',color:'var(--accent-text)',width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  );
}

function CommentRow({ comment, onVote, onReact, viewerId, depth = 0 }) {
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [replyOpen,   setReplyOpen]   = useState(false);
  const [replies,     setReplies]     = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const pickerRef = useRef();
  const name = comment.authorDisplayName || comment.authorUsername;
  const sortedReactions = Object.entries(comment.reactions || {}).sort((a,b)=>b[1]-a[1]);

  useEffect(() => {
    if (!pickerOpen) return;
    const h = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen]);

  async function loadReplies() {
    if (repliesLoaded) return;
    try {
      const r = await replyApi.getReplies(comment.id, viewerId);
      setReplies(r); setRepliesLoaded(true);
    } catch {}
  }

  function handleReplyAdded(r) {
    setReplies(prev => [...prev, r]);
    setRepliesLoaded(true);
  }

  return (
    <div style={{marginLeft: depth > 0 ? 32 : 0}}>
      <div style={{display:'flex',gap:8,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
        <UserAvatar src={comment.authorAvatar} name={name} userId={comment.authorId} size={depth>0?26:30}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
            <span style={{fontSize:13,fontWeight:600,color:'var(--text-primary)'}}>{name}</span>
            <span style={{fontSize:11,color:'var(--text-muted)'}}>{fmtTime(comment.createdAt)}</span>
          </div>
          <div style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.5,marginBottom:6,wordBreak:'break-word'}}>{comment.content}</div>

          {/* Actions */}
          <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
            <button onClick={()=>onVote(comment.id,'LIKE')} style={{background:comment.userVote==='LIKE'?'rgba(79,172,254,0.15)':'none',border:`1px solid ${comment.userVote==='LIKE'?'var(--accent)':'var(--border-input)'}`,borderRadius:8,color:comment.userVote==='LIKE'?'var(--accent)':'var(--text-muted)',padding:'2px 8px',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
              <svg viewBox="0 0 24 24" fill={comment.userVote==='LIKE'?'var(--accent)':'none'} stroke={comment.userVote==='LIKE'?'var(--accent)':'currentColor'} strokeWidth="2" width="13" height="13"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> {comment.likeCount>0&&comment.likeCount}
            </button>
            <button onClick={()=>onVote(comment.id,'DISLIKE')} style={{background:comment.userVote==='DISLIKE'?'rgba(224,96,96,0.1)':'none',border:`1px solid ${comment.userVote==='DISLIKE'?'#e06060':'var(--border-input)'}`,borderRadius:8,color:comment.userVote==='DISLIKE'?'#e06060':'var(--text-muted)',padding:'2px 8px',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
              <svg viewBox="0 0 24 24" fill={comment.userVote==='DISLIKE'?'#e06060':'none'} stroke={comment.userVote==='DISLIKE'?'#e06060':'currentColor'} strokeWidth="2" width="13" height="13"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg> {comment.dislikeCount>0&&comment.dislikeCount}
            </button>
            {sortedReactions.map(([emoji,count])=>(
              <button key={emoji} onClick={()=>onReact(comment.id,emoji)} style={{background:comment.userReactions?.includes(emoji)?'rgba(79,172,254,0.15)':'var(--bg-hover)',border:`1px solid ${comment.userReactions?.includes(emoji)?'var(--accent)':'var(--border-input)'}`,borderRadius:8,padding:'2px 8px',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                {emoji}<span style={{fontSize:11,color:'var(--text-muted)'}}>{count}</span>
              </button>
            ))}
            <div ref={pickerRef} style={{position:'relative'}}>
              <button onClick={()=>setPickerOpen(o=>!o)} style={{background:pickerOpen?'rgba(79,172,254,0.12)':'none',border:`1px solid ${pickerOpen?'var(--accent)':'var(--border-input)'}`,borderRadius:8,padding:'2px 8px',fontSize:12,color:pickerOpen?'var(--accent)':'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:3}} title="Add reaction">
                <span style={{fontSize:14}}>😊</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {pickerOpen&&<EmojiPicker onPick={e=>{onReact(comment.id,e);setPickerOpen(false);}} onClose={()=>setPickerOpen(false)}/>}
            </div>
            {depth === 0 && (
              <button onClick={()=>{setReplyOpen(o=>!o);if(!repliesLoaded)loadReplies();}} style={{background:'none',border:'none',color:'var(--text-muted)',fontSize:12,cursor:'pointer',padding:'2px 6px'}}>
                Reply {comment.replyCount>0&&`(${comment.replyCount})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {depth === 0 && replyOpen && (
        <div>
          {replies.map(r => (
            <CommentRow key={r.id} comment={r} onVote={onVote} onReact={onReact} viewerId={viewerId} depth={1}/>
          ))}
          {viewerId && <ReplyBox parentId={comment.id} authorId={viewerId} onAdded={handleReplyAdded}/>}
        </div>
      )}
    </div>
  );
}

export default function CommentsSection({ type, targetId }) {
  const { user } = useAuth();
  const requireAccount = useRequireAccount();
  const [comments, setComments] = useState([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const bottomRef = useRef();

  useEffect(() => {
    setLoading(true);
    const fn = type==='post' ? api.getPostComments : api.getMediaComments;
    fn(targetId, user?.id).then(data=>setComments(data.filter(c=>!c.parentId))).catch(()=>{}).finally(()=>setLoading(false));
  }, [type, targetId, user?.id]);

  async function submit() {
    if (!text.trim()) return;
    if (!requireAccount('comment')) return;
    const fn = type==='post' ? api.addPostComment : api.addMediaComment;
    try {
      const c = await fn(targetId, {authorId:user.id,content:text.trim()});
      setComments(prev=>[...prev,c]); setText('');
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),50);
    } catch {}
  }
  async function handleVote(commentId, voteType) {
    if (!requireAccount('like or dislike comments')) return;
    try { const u=await api.voteComment(commentId,voteType); setComments(prev=>prev.map(c=>c.id===commentId?u:c)); } catch {}
  }
  async function handleReact(commentId, emoji) {
    if (!requireAccount('react to comments')) return;
    try { const u=await api.reactComment(commentId,emoji); setComments(prev=>prev.map(c=>c.id===commentId?u:c)); } catch {}
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <span style={{fontSize:14,fontWeight:700,color:'var(--text-primary)'}}>
          Comments {comments.length>0&&<span style={{fontSize:12,color:'var(--text-muted)',fontWeight:400}}>({comments.length})</span>}
        </span>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
        {loading ? <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading…</div>
          : comments.length===0 ? <div style={{padding:40,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No comments yet. Be the first!</div>
          : <>{comments.map(c=><CommentRow key={c.id} comment={c} onVote={handleVote} onReact={handleReact} viewerId={user?.id}/>)}<div ref={bottomRef}/></>
        }
      </div>
      <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
        <UserAvatar src={user?.profilePicture} name={user?.displayName||user?.username} size={30}/>
        <textarea value={text}
          onChange={e=>{setText(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,100)+'px';}}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}}}
          placeholder="Write a comment…" rows={1}
          style={{flex:1,background:'var(--bg-input)',border:'1px solid var(--border-input)',borderRadius:16,padding:'7px 12px',color:'var(--text-primary)',fontSize:13,outline:'none',resize:'none',fontFamily:'inherit',minHeight:34,maxHeight:100}}
          onFocus={e=>e.target.style.borderColor='var(--accent)'}
          onBlur={e=>e.target.style.borderColor='var(--border-input)'}
        />
        <button onClick={submit} style={{background:'var(--accent)',border:'none',color:'var(--accent-text)',width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}
