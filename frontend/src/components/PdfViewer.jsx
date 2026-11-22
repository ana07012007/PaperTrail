import { useEffect, useState } from 'react';
import { fetchPaperPdfUrl } from '../api';

// Opens the original PDF at the cited page, next to the exact passage the answer used.
export default function PdfViewer({ paperId, title, page = 1, excerpt, section, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl;
    fetchPaperPdfUrl(paperId)
      .then((u) => setUrl((objectUrl = u)))
      .catch((e) => setError(e.message));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [paperId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',background:'rgba(0,0,0,.72)',padding:16}} onClick={onClose}>
      <div style={{margin:'auto',display:'flex',flexDirection:'column',width:'min(1180px,100%)',height:'100%',overflow:'hidden',border:'1px solid #27272a',borderRadius:12,background:'#111114',boxShadow:'0 24px 80px rgba(0,0,0,.55)'}} onClick={(e) => e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,borderBottom:'1px solid #27272a',padding:'10px 14px'}}>
          <div className="min-w-0">
            <p style={{margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:13,fontWeight:700}}>{title}</p>
            <p style={{margin:'3px 0 0',color:'#71717a',fontSize:10}}>{section ? `${section} · ` : ''}page {page}</p>
          </div>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        {excerpt && (
          <div style={{maxHeight:160,overflowY:'auto',borderBottom:'1px solid #27272a',background:'#1b1810',padding:'10px 14px',color:'#d4d4d8',fontSize:12}}>
            <span style={{marginRight:8,color:'#fbbf24',fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em'}}>Passage used</span>
            {excerpt}
          </div>
        )}
        <div style={{flex:1,background:'#18181b'}}>
          {error ? (
            <p style={{padding:24,color:'#fca5a5'}}>{error}</p>
          ) : url ? (
            <iframe key={page} title={title} src={`${url}#page=${page}`} style={{width:'100%',height:'100%',border:0}} />
          ) : (
            <p style={{padding:24,color:'#71717a'}}>Loading PDF…</p>
          )}
        </div>
      </div>
    </div>
  );
}
