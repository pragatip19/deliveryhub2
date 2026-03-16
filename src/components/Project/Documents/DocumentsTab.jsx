import { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, FileText, Folder } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDocuments, insertDocument, deleteDocument } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDate } from '../../../lib/workdays';

const CATEGORIES = ['Delivery Plan', 'Change Control', 'Validation', 'SOPs', 'Reports', 'Training', 'Other'];

export default function DocumentsTab({ project, canEdit }) {
  const { profile } = useAuth();
  const [docs, setDocs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [form, setForm] = useState({ name: '', url: '', category: 'Other' });

  useEffect(() => { load(); }, [project.id]);

  async function load() {
    try {
      const data = await getDocuments(project.id);
      setDocs(data);
    } catch { toast.error('Failed to load documents'); }
    setLoading(false);
  }

  async function add() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.url.trim()) { toast.error('URL is required'); return; }
    try {
      const saved = await insertDocument({ ...form, project_id: project.id, uploaded_by: profile.id });
      setDocs(prev => [saved, ...prev]);
      setForm({ name: '', url: '', category: 'Other' });
      setAdding(false);
      toast.success('Document added');
    } catch { toast.error('Failed to add document'); }
  }

  async function remove(doc) {
    if (!window.confirm(`Remove "${doc.name}"?`)) return;
    try {
      await deleteDocument(doc.id);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch { toast.error('Failed to remove'); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catDocs = docs.filter(d => d.category === cat);
    if (catDocs.length > 0) acc[cat] = catDocs;
    return acc;
  }, {});
  const uncategorized = docs.filter(d => !CATEGORIES.includes(d.category));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">Documents</h2>
        {canEdit && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition">
            <Plus className="w-3.5 h-3.5" /> Add Document
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Document</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Document name"
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">URL / Link *</label>
              <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700">Add</button>
            <button onClick={() => { setAdding(false); setForm({ name: '', url: '', category: 'Other' }); }}
              className="text-sm text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      {docs.length === 0 && !adding ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No documents yet.</p>
          {canEdit && <p className="text-gray-400 text-xs mt-1">Click "Add Document" to link documents.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catDocs]) => (
            <DocGroup key={cat} title={cat} docs={catDocs} canEdit={canEdit} onDelete={remove} />
          ))}
          {uncategorized.length > 0 && (
            <DocGroup title="Other" docs={uncategorized} canEdit={canEdit} onDelete={remove} />
          )}
        </div>
      )}
    </div>
  );
}

function DocGroup({ title, docs, canEdit, onDelete }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left">
        <Folder className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-sm text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">({docs.length})</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition">
              <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline truncate block">
                  {doc.name}
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.url}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(doc.created_at)}</span>
              {canEdit && (
                <button onClick={() => onDelete(doc)} className="text-gray-300 hover:text-red-500 transition flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
