// Renders the LLM answer: paragraphs, "- " bullet lists, **bold**, and [S1] citations as clickable chips.

function Inline({ text, sourceById, onCite }) {
  const parts = text.split(/(\[S\d+\]|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const cite = part.match(/^\[(S\d+)\]$/);
    if (cite) {
      const source = sourceById[cite[1]];
      if (!source) return null;
      return (
        <button
          key={i}
          onClick={() => onCite(source)}
          title={`${source.paperTitle} · ${source.section} · page ${source.pageStart}`}
          style={{margin:'0 2px',border:'1px solid #4c3d73',borderRadius:5,background:'#211a32',color:'#ddd6fe',padding:'1px 5px',fontSize:10,fontWeight:800}}
        >
          {cite[1]}
        </button>
      );
    }
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <span key={i}>{part}</span>;
  });
}

export default function AnswerText({ text, sources, onCite }) {
  const sourceById = Object.fromEntries((sources || []).map((s) => [s.id, s]));
  const blocks = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'list') last.items.push(bullet[1]);
      else blocks.push({ type: 'list', items: [bullet[1]] });
    } else {
      blocks.push({ type: 'p', text: line.replace(/^#+\s*/, '') });
    }
  }

  return (
    <div style={{display:'grid',gap:7,fontSize:13,lineHeight:1.65,color:'#d4d4d8'}}>
      {blocks.map((b, i) =>
        b.type === 'list' ? (
          <ul key={i} style={{margin:0,paddingLeft:18}}>
            {b.items.map((item, j) => (
              <li key={j}><Inline text={item} sourceById={sourceById} onCite={onCite} /></li>
            ))}
          </ul>
        ) : (
          <p key={i}><Inline text={b.text} sourceById={sourceById} onCite={onCite} /></p>
        )
      )}
    </div>
  );
}
