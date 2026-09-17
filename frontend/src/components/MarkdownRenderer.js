import React from 'react';

export default function MarkdownRenderer({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  function renderInline(str, key) {
    const parts = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|`([^`]+)`|>!(.+?)!<|\^\((.+?)\)|\[([^\]]+)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\))/g;
    let last = 0, m, idx = 0;

    while ((m = re.exec(str)) !== null) {
      if (m.index > last) parts.push(<span key={`t${key}-${idx++}`}>{str.slice(last, m.index)}</span>);
      if      (m[2]  !== undefined) parts.push(<strong key={`b${key}-${idx++}`}>{m[2]}</strong>);
      else if (m[3]  !== undefined) parts.push(<em key={`i${key}-${idx++}`}>{m[3]}</em>);
      else if (m[4]  !== undefined) parts.push(<del key={`s${key}-${idx++}`}>{m[4]}</del>);
      else if (m[5]  !== undefined) parts.push(<code key={`c${key}-${idx++}`} style={{ background:'var(--bg-hover)', borderRadius:4, padding:'1px 5px', fontSize:'0.88em', fontFamily:'monospace', color:'var(--accent)' }}>{m[5]}</code>);
      else if (m[6]  !== undefined) parts.push(<span key={`sp${key}-${idx++}`} style={{ background:'var(--bg-hover)', color:'transparent', borderRadius:4, padding:'0 4px', cursor:'pointer', userSelect:'none', transition:'color 0.2s' }} onMouseEnter={e=>e.currentTarget.style.color='var(--text-primary)'} onMouseLeave={e=>e.currentTarget.style.color='transparent'}>{m[6]}</span>);
      else if (m[7]  !== undefined) parts.push(<sup key={`su${key}-${idx++}`} style={{ fontSize:'0.75em' }}>{m[7]}</sup>);
      else if (m[11] !== undefined) parts.push(<img key={`img${key}-${idx++}`} src={m[11]} alt={m[10]} style={{ maxWidth:'100%', borderRadius:8, display:'block', margin:'4px 0' }} />);
      else if (m[8]  !== undefined) parts.push(<a key={`a${key}-${idx++}`} href={m[9]} target="_blank" rel="noreferrer" style={{ color:'var(--accent)', textDecoration:'underline' }} onClick={e=>e.stopPropagation()}>{m[8]}</a>);
      last = m.index + m[0].length;
    }
    if (last < str.length) parts.push(<span key={`t${key}-end`}>{str.slice(last)}</span>);
    return parts.length ? parts : str;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(<pre key={`pre${i}`} style={{ background:'var(--bg-hover)', borderRadius:8, padding:'10px 14px', fontSize:13, fontFamily:'monospace', overflowX:'auto', margin:'6px 0', lineHeight:1.5, color:'var(--text-primary)', whiteSpace:'pre' }}><code>{codeLines.join('\n')}</code></pre>);
      i++; continue;
    }

    // Table
    if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i]); i++; }
      const rows = tableLines.filter(l => !l.match(/^\|[\s\-|:]+\|$/));
      elements.push(<div key={`tbl${i}`} style={{ overflowX:'auto', margin:'6px 0' }}><table style={{ borderCollapse:'collapse', width:'100%', fontSize:13 }}><tbody>{rows.map((row,ri) => { const cells = row.split('|').filter((_,ci)=>ci>0&&ci<row.split('|').length-1); const Tag=ri===0?'th':'td'; return <tr key={ri}>{cells.map((cell,ci)=><Tag key={ci} style={{ border:'1px solid var(--border)', padding:'6px 10px', textAlign:'left', fontWeight:ri===0?600:400, color:'var(--text-primary)' }}>{renderInline(cell.trim(),`tbl${i}-${ri}-${ci}`)}</Tag>)}</tr>; })}</tbody></table></div>);
      continue;
    }

    // Headings
    const h3=line.match(/^### (.+)/), h2=line.match(/^## (.+)/), h1=line.match(/^# (.+)/);
    if (h1) { elements.push(<h1 key={i} style={{ fontSize:20, fontWeight:700, margin:'8px 0 4px', color:'var(--text-primary)' }}>{renderInline(h1[1],i)}</h1>); i++; continue; }
    if (h2) { elements.push(<h2 key={i} style={{ fontSize:17, fontWeight:700, margin:'6px 0 4px', color:'var(--text-primary)' }}>{renderInline(h2[1],i)}</h2>); i++; continue; }
    if (h3) { elements.push(<h3 key={i} style={{ fontSize:15, fontWeight:700, margin:'4px 0 2px', color:'var(--text-primary)' }}>{renderInline(h3[1],i)}</h3>); i++; continue; }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith('> ')) { quoteLines.push(lines[i].slice(2)); i++; }
      elements.push(<blockquote key={`bq${i}`} style={{ borderLeft:'3px solid var(--accent)', paddingLeft:12, margin:'6px 0', color:'var(--text-secondary)', fontStyle:'italic' }}>{quoteLines.map((l,li)=><p key={li} style={{ margin:'2px 0' }}>{renderInline(l,`bq${i}-${li}`)}</p>)}</blockquote>);
      continue;
    }

    // Bullet list
    if (line.match(/^- .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^- .+/)) { items.push(lines[i].slice(2)); i++; }
      elements.push(<ul key={`ul${i}`} style={{ paddingLeft:20, margin:'4px 0' }}>{items.map((item,li)=><li key={li} style={{ marginBottom:2, color:'var(--text-primary)', fontSize:14, lineHeight:1.6 }}>{renderInline(item,`ul${i}-${li}`)}</li>)}</ul>);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. .+/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. .+/)) { items.push(lines[i].replace(/^\d+\. /,'')); i++; }
      elements.push(<ol key={`ol${i}`} style={{ paddingLeft:20, margin:'4px 0' }}>{items.map((item,li)=><li key={li} style={{ marginBottom:2, color:'var(--text-primary)', fontSize:14, lineHeight:1.6 }}>{renderInline(item,`ol${i}-${li}`)}</li>)}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') { elements.push(<div key={`br${i}`} style={{ height:6 }} />); i++; continue; }

    // Paragraph
    elements.push(<p key={i} style={{ margin:'2px 0', fontSize:14, lineHeight:1.65, color:'var(--text-primary)' }}>{renderInline(line, i)}</p>);
    i++;
  }

  return <>{elements}</>;
}
