import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Banknote, Brush, Calendar, Filter, Plus, Search } from 'lucide-react';
import './styles.css';

const iso = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const seedArtists = [
  { id: crypto.randomUUID(), name: '谢青岚', phone: '13600001111', style: '纸本水墨', note: '月结，佣金35%' },
  { id: crypto.randomUUID(), name: '赵以南', phone: '13700002222', style: '综合材料', note: '售后需确认装裱' }
];

const seedWorks = [
  { id: crypto.randomUUID(), artist: '谢青岚', title: '雨后天井', price: 12800, inDate: iso(-20), exhibit: '展出中', sale: '待售', settlement: '未结算' },
  { id: crypto.randomUUID(), artist: '赵以南', title: '旧墙采样03', price: 8600, inDate: iso(-12), exhibit: '库房', sale: '已售', settlement: '待结算' },
  { id: crypto.randomUUID(), artist: '谢青岚', title: '窄巷风声', price: 16600, inDate: iso(-5), exhibit: '借展', sale: '待售', settlement: '未结算' }
];

function useStorage(key, initial) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : initial;
  });
  const update = (next) => {
    const resolved = typeof next === 'function' ? next(value) : next;
    setValue(resolved);
    localStorage.setItem(key, JSON.stringify(resolved));
  };
  return [value, update];
}

function App() {
  const [artists, setArtists] = useStorage('zfl-5-artists', seedArtists);
  const [works, setWorks] = useStorage('zfl-5-works', seedWorks);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部展态');
  const [artistForm, setArtistForm] = useState({ name: '', phone: '', style: '', note: '' });
  const [workForm, setWorkForm] = useState({ artist: '谢青岚', title: '', price: '', inDate: iso(0), exhibit: '展出中', sale: '待售', settlement: '未结算' });

  const filteredWorks = works.filter((work) => {
    const text = `${work.artist}${work.title}${work.exhibit}${work.sale}${work.settlement}`;
    return text.includes(query.trim()) && (status === '全部展态' || work.exhibit === status);
  });
  const settlementWorks = works.filter((work) => work.settlement === '待结算');
  const totalValue = works.reduce((sum, work) => sum + Number(work.price || 0), 0);
  const artistStats = useMemo(() => artists.map((artist) => ({
    ...artist,
    works: works.filter((work) => work.artist === artist.name)
  })), [artists, works]);

  function addArtist(event) {
    event.preventDefault();
    if (!artistForm.name.trim()) return;
    setArtists([{ id: crypto.randomUUID(), ...artistForm }, ...artists]);
    setArtistForm({ name: '', phone: '', style: '', note: '' });
    setWorkForm({ ...workForm, artist: artistForm.name });
  }

  function addWork(event) {
    event.preventDefault();
    if (!workForm.title.trim() || !workForm.artist) return;
    setWorks([{ id: crypto.randomUUID(), ...workForm, price: Number(workForm.price || 0) }, ...works]);
    setWorkForm({ ...workForm, title: '', price: '', inDate: iso(0), exhibit: '展出中', sale: '待售', settlement: '未结算' });
  }

  function updateWork(id, patch) {
    setWorks(works.map((work) => work.id === id ? { ...work, ...patch } : work));
  }

  return (
    <main>
      <header className="hero">
        <div>
          <p>独立画廊</p>
          <h1>作品寄售管理</h1>
        </div>
        <div className="stats">
          <span><Brush size={18} />{works.length}件作品</span>
          <span><Banknote size={18} />¥{totalValue.toLocaleString()}</span>
          <span><Calendar size={18} />{settlementWorks.length}件待结算</span>
        </div>
      </header>

      <section className="forms">
        <form className="panel" onSubmit={addArtist}>
          <h2><Plus size={18} />录入艺术家</h2>
          <input placeholder="艺术家姓名" value={artistForm.name} onChange={(e) => setArtistForm({ ...artistForm, name: e.target.value })} />
          <input placeholder="联系方式" value={artistForm.phone} onChange={(e) => setArtistForm({ ...artistForm, phone: e.target.value })} />
          <input placeholder="创作方向" value={artistForm.style} onChange={(e) => setArtistForm({ ...artistForm, style: e.target.value })} />
          <input placeholder="结算备注" value={artistForm.note} onChange={(e) => setArtistForm({ ...artistForm, note: e.target.value })} />
          <button>保存艺术家</button>
        </form>

        <form className="panel" onSubmit={addWork}>
          <h2><Plus size={18} />录入作品</h2>
          <select value={workForm.artist} onChange={(e) => setWorkForm({ ...workForm, artist: e.target.value })}>
            {artists.map((artist) => <option key={artist.id}>{artist.name}</option>)}
          </select>
          <input placeholder="作品名称" value={workForm.title} onChange={(e) => setWorkForm({ ...workForm, title: e.target.value })} />
          <div className="split">
            <input type="number" placeholder="寄售价格" value={workForm.price} onChange={(e) => setWorkForm({ ...workForm, price: e.target.value })} />
            <input type="date" value={workForm.inDate} onChange={(e) => setWorkForm({ ...workForm, inDate: e.target.value })} />
          </div>
          <div className="split">
            <select value={workForm.exhibit} onChange={(e) => setWorkForm({ ...workForm, exhibit: e.target.value })}>
              <option>展出中</option><option>库房</option><option>借展</option><option>退回</option>
            </select>
            <select value={workForm.sale} onChange={(e) => setWorkForm({ ...workForm, sale: e.target.value })}>
              <option>待售</option><option>已预订</option><option>已售</option>
            </select>
          </div>
          <button>保存作品</button>
        </form>
      </section>

      <section className="panel">
        <div className="toolbar">
          <h2>作品列表</h2>
          <label><Search size={16} /><input placeholder="搜索艺术家/作品/状态" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <label><Filter size={16} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option>全部展态</option><option>展出中</option><option>库房</option><option>借展</option><option>退回</option></select></label>
        </div>
        <div className="works">
          {filteredWorks.map((work) => (
            <article key={work.id}>
              <strong>{work.title}</strong>
              <span>{work.artist} · ¥{Number(work.price).toLocaleString()}</span>
              <p>{work.inDate}入库 · {work.exhibit} · {work.sale} · {work.settlement}</p>
              <div className="actions">
                <button onClick={() => updateWork(work.id, { sale: work.sale === '已售' ? '待售' : '已售', settlement: work.sale === '已售' ? '未结算' : '待结算' })}>{work.sale === '已售' ? '撤回销售' : '标记已售'}</button>
                <button className="ghost" onClick={() => updateWork(work.id, { settlement: '已结算' })}>完成结算</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bottom">
        <div className="panel">
          <h2>艺术家详情</h2>
          {artistStats.map((artist) => <p className="artist" key={artist.id}><strong>{artist.name}</strong><span>{artist.style} · {artist.works.length}件 · {artist.note}</span></p>)}
        </div>
        <div className="panel">
          <h2>待结算列表</h2>
          {settlementWorks.map((work) => <p className="artist" key={work.id}><strong>{work.title}</strong><span>{work.artist} · ¥{Number(work.price).toLocaleString()}</span></p>)}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
