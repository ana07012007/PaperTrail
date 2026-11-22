import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import AnswerText from './AnswerText';

const SUGGESTIONS = [
  'What problem does this paper try to solve?',
  'Which datasets are used?',
  'What evaluation metrics are reported?',
  'What limitations do the authors mention?',
];

function pageLabel(s) {
  return s.pageStart === s.pageEnd ? `p. ${s.pageStart}` : `pp. ${s.pageStart}–${s.pageEnd}`;
}

function SourceList({ sources, onOpen }) {
  const [showAll, setShowAll] = useState(false);
  const cited = sources.filter((s) => s.cited);
  const shown = showAll || cited.length === 0 ? sources : cited;
  if (!sources.length) return null;

  return (
    <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid #303036'}}>
      <div style={{marginBottom:6,display:'flex',justifyContent:'space-between',color:'#71717a',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em'}}>
        <span>{showAll || cited.length === 0 ? 'Retrieved passages' : 'Sources'}</span>
        {cited.length > 0 && cited.length < sources.length && (
          <button style={{border:0,background:'transparent',color:'#c4b5fd',fontSize:10}} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show cited only' : `Show all ${sources.length} retrieved`}
          </button>
        )}
      </div>
      <div>
        {shown.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s)}
            className="source-chip"
            title={s.text}
          >
            <span style={{color:'#c4b5fd',fontWeight:800}}>{s.id}</span>
            <span style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.paperTitle}</span>
            <span>· {s.section} · {pageLabel(s)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AskPanel({ workspaceId, readyPapers, selected, onOpenSource }) {
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const readyIds = new Set(readyPapers.map((p) => p._id));
  const scope = [...selected].filter((id) => readyIds.has(id));
  const scopeLabel = scope.length
    ? `${scope.length} selected paper${scope.length === 1 ? '' : 's'}`
    : `all ${readyPapers.length} ready paper${readyPapers.length === 1 ? '' : 's'}`;

  useEffect(() => {
    api(`/workspaces/${workspaceId}/questions`).then((d) => setHistory(d.questions)).catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, pending]);

  async function ask(text) {
    const q = (text ?? question).trim();
    if (!q || pending) return;
    setError('');
    setPending(q);
    setQuestion('');
    try {
      const { question: entry } = await api(`/workspaces/${workspaceId}/ask`, {
        method: 'POST',
        body: { question: q, paperIds: scope },
      });
      setHistory((h) => [...h, entry]);
    } catch (err) {
      setError(err.message);
      setQuestion(q);
    } finally {
      setPending(null);
    }
  }

  async function clearHistory() {
    if (!confirm('Clear all questions in this workspace?')) return;
    await api(`/workspaces/${workspaceId}/questions`, { method: 'DELETE' });
    setHistory([]);
  }

  return (
    <section className="card chat-card">
      <div className="chat-header">
        <div>
          <h2>AI research assistant</h2>
          <p>Grounded answers from {scopeLabel}</p>
        </div>
        {history.length > 0 && <button className="btn-ghost" style={{minHeight:30,fontSize:11}} onClick={clearHistory}>Clear history</button>}
      </div>

      <div className="chat-scroll">
        {history.length === 0 && !pending && (
          <div style={{minHeight:'55%',display:'grid',placeItems:'center',textAlign:'center'}}>
            <div>
            <div style={{width:42,height:42,margin:'0 auto 12px',display:'grid',placeItems:'center',border:'1px solid #303036',borderRadius:10,background:'#18181b',color:'#a78bfa'}}>AI</div>
            <p style={{margin:0,color:'#a1a1aa',fontSize:13}}>
              {readyPapers.length ? 'Ask anything about your papers. Try one of these:' : 'Upload a paper and wait until it shows Ready.'}
            </p>
            {readyPapers.length > 0 && (
              <div style={{marginTop:14,display:'flex',flexWrap:'wrap',justifyContent:'center',gap:7}}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="btn-secondary" style={{minHeight:32,fontSize:11,fontWeight:500}}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {history.map((h) => (
          <div key={h._id}>
            <div className="message-row user"><div className="message user"><div className="bubble">{h.question}</div></div></div>
            <div className="message-row">
            <div className="bubble" style={h.insufficientEvidence ? {borderColor:'#854d0e',background:'#211a10'} : undefined}>
              <div className="bubble-header">PaperTrail answer</div>
              {h.insufficientEvidence && (
                <p style={{margin:'0 0 8px',color:'#fbbf24',fontSize:11,fontWeight:700}}>Not enough evidence in the selected papers</p>
              )}
              <AnswerText text={h.answer} sources={h.sources} onCite={onOpenSource} />
              <SourceList sources={h.sources} onOpen={onOpenSource} />
            </div>
            </div>
          </div>
        ))}

        {pending && (
          <>
            <div className="message-row user"><div className="message user"><div className="bubble">{pending}</div></div></div>
            <div className="bubble" style={{width:'fit-content',color:'#71717a',animation:'pulse 1.5s infinite'}}>Searching papers and writing an answer…</div>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="composer">
        {error && <p style={{margin:'0 0 8px',color:'#fca5a5',fontSize:11}}>{error}</p>}
        <div className="composer-box">
          <textarea
            rows={1}
            placeholder={readyPapers.length ? 'e.g. Which datasets do these papers use?' : 'No ready papers yet'}
            value={question}
            disabled={!readyPapers.length}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          />
          <button className="send-button" disabled={!question.trim() || !!pending || !readyPapers.length} title="Ask">↑</button>
        </div>
        <p style={{margin:'7px 0 0',color:'#52525b',fontSize:10}}>Answers are limited to the selected papers. Verify important claims in the source PDF.</p>
      </form>
    </section>
  );
}
