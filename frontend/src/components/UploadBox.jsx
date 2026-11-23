import { useRef, useState } from 'react';
import { api } from '../api';

export default function UploadBox({ workspaceId, onUploaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function upload(fileList) {
    const files = [...fileList].filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!files.length) return setError('Please choose PDF files.');
    setError('');
    setUploading(true);
    const form = new FormData();
    files.slice(0, 10).forEach((f) => form.append('files', f));
    try {
      const { papers } = await api(`/workspaces/${workspaceId}/papers`, { method: 'POST', form });
      onUploaded(papers);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="card" style={{padding:12}}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        disabled={uploading}
        style={{
          width:'100%', minHeight:112, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          border:'1px dashed', borderColor:dragging?'#8b5cf6':'#34343a', borderRadius:9,
          background:dragging?'rgba(139,92,246,.08)':'#0d0d10', color:'#a1a1aa', textAlign:'center'
        }}
      >
        <svg width="28" height="28" style={{color:'#a78bfa'}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3m0 0L7.5 7.5M12 3l4.5 4.5M3 15v4.5A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5V15" />
        </svg>
        <span style={{marginTop:8,fontSize:12,fontWeight:700,color:'#e4e4e7'}}>{uploading ? 'Uploading…' : 'Upload research papers'}</span>
        <span style={{marginTop:4,fontSize:10,color:'#71717a'}}>Drop PDFs or browse · 10 files maximum</span>
      </button>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
