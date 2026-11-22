import { api } from '../api';

const STATUS_LABEL = { queued: 'Queued', processing: 'Processing', ready: 'Ready', failed: 'Failed' };

export default function PaperList({ papers, selected, onToggle, onClearSelection, onChanged, onOpen }) {
  async function remove(paper) {
    if (!confirm(`Remove "${paper.title}" from this workspace?`)) return;
    await api(`/papers/${paper._id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    onChanged();
  }

  async function reprocess(paper) {
    await api(`/papers/${paper._id}/reprocess`, { method: 'POST' }).catch((e) => alert(e.message));
    onChanged();
  }

  return (
    <div className="card library-card">
      <div className="library-header">
        <h2>Papers <span style={{color:'#71717a',fontWeight:500}}>({papers.length})</span></h2>
        {selected.size > 0 && (
          <button className="btn-ghost" style={{minHeight:28,padding:'0 6px',fontSize:10}} onClick={onClearSelection}>
            Clear {selected.size}
          </button>
        )}
      </div>
      <div style={{overflowY:'auto',flex:1}}>
        {papers.length === 0 ? (
          <div style={{padding:'34px 18px',textAlign:'center',color:'#71717a',fontSize:12}}>No papers in this workspace.</div>
        ) : papers.map((paper) => (
          <div className="paper-row" key={paper._id}>
            <input
              type="checkbox"
              disabled={paper.status !== 'ready'}
              checked={selected.has(paper._id)}
              onChange={() => onToggle(paper._id)}
              aria-label={`Include ${paper.title} in questions`}
              style={{width:14,height:14,accentColor:'#8b5cf6'}}
            />
            <button className="pdf-icon" onClick={() => onOpen(paper)} title="Open PDF" style={{border:0}}>PDF</button>
            <div style={{minWidth:0}}>
              <button className="paper-title" onClick={() => onOpen(paper)}>{paper.title}</button>
              <div className="paper-details">
                <span className={`status status-${paper.status}`}><span className="status-dot" />{STATUS_LABEL[paper.status]}</span>
                {paper.status === 'ready' && <span style={{marginLeft:6}}>{paper.numPages || 0} pages</span>}
              </div>
              {paper.status === 'failed' && (
                <div style={{marginTop:5,color:'#f87171',fontSize:10}}>
                  {paper.error || 'Processing failed'}{' '}
                  <button onClick={() => reprocess(paper)} style={{border:0,background:'transparent',color:'#c4b5fd',padding:0,textDecoration:'underline'}}>Retry</button>
                </div>
              )}
            </div>
            <button
              className="btn-ghost"
              onClick={() => remove(paper)}
              title="Remove paper"
              style={{minHeight:28,width:28,padding:0,fontSize:16,color:'#71717a'}}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
