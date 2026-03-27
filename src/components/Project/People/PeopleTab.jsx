import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, MoreVertical, Trash2, Users, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPeople, upsertPerson, deletePerson } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSpreadsheet } from '../../../lib/useSpreadsheet';
import { SCell } from '../../shared/SCell';

// ── People templates by category ──────────────────────────────────────────────
const CLEEN_TEMPLATE = {
  client:  ['Exec Sponsor', 'Validation Leader', 'IT Leader', 'Project Manager', 'UAT Approver', 'CV SME', 'IT SME', 'CSV SME'],
  leucine: ['Promise Owner', 'Delivery Manager', 'Solution Architect'],
};

const MES_TEMPLATE = {
  client: [
    'Exec Sponsor', 'Production Leader', 'Quality Leader', 'IT Leader', 'Project Manager',
    'UAT Coordinator', 'UAT Approver', 'UAT Approver', 'UAT Approver', 'UAT Approver',
    'Production SME', 'Quality SME', 'IT SME', 'CSV SME',
  ],
  leucine: ['Promise Owner', 'Delivery Manager', 'Solution Architect', 'Integration Team'],
};

function templatePlaceholder(team, role) {
  return `{${team} ${role}}`;
}

function getTemplateForCategory(categoryName) {
  if (!categoryName) return null;
  const n = categoryName.toLowerCase();
  if (n === 'cleen') return CLEEN_TEMPLATE;
  if (n.includes('mes') || n.includes('logbook') || n.includes('ai agent') || n.includes('lms') || n.includes('dms')) return MES_TEMPLATE;
  return MES_TEMPLATE;
}

const EMPTY_PERSON = { name: '', email: '', role: '', phone: '', team: 'Client' };

const EDIT_COLS = ['name', 'email', 'role', 'phone'];

export default function PeopleTab({ project, canEdit }) {
  const { isAdmin, isDM } = useAuth();
  const [clientPeople, setClientPeople]   = useState([]);
  const [leucinePeople, setLeucinePeople] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [addingClient, setAddingClient]   = useState(false);
  const [addingLeuine, setAddingLeuine]   = useState(false);
  const [newPerson, setNewPerson] = useState({ ...EMPTY_PERSON });

  const canManage = isAdmin() || (isDM() && canEdit);
  const template  = getTemplateForCategory(project?.category_name);

  useEffect(() => { loadPeople(); }, [project.id]);

  async function loadPeople() {
    try {
      const all = await getPeople(project.id);
      setClientPeople(all.filter(p => p.team === 'Client'));
      setLeucinePeople(all.filter(p => p.team === 'Leucine'));
    } catch (e) {
      toast.error('Failed to load people');
    }
    setLoading(false);
  }

  async function savePersonField(person, field, value) {
    try {
      const updated = { ...person, [field]: value, project_id: project.id };
      const saved   = await upsertPerson(updated);
      if (person.team === 'Client') {
        setClientPeople(prev => prev.map(p => p.id === saved.id ? saved : p));
      } else {
        setLeucinePeople(prev => prev.map(p => p.id === saved.id ? saved : p));
      }
    } catch (e) {
      toast.error('Failed to save');
    }
  }

  async function addPerson(team) {
    if (!newPerson.name.trim()) { toast.error('Name is required'); return; }
    try {
      const saved = await upsertPerson({ ...newPerson, team, project_id: project.id });
      if (team === 'Client') setClientPeople(prev => [...prev, saved]);
      else setLeucinePeople(prev => [...prev, saved]);
      setNewPerson({ ...EMPTY_PERSON });
      setAddingClient(false);
      setAddingLeuine(false);
      toast.success('Person added');
    } catch (e) {
      toast.error('Failed to add person');
    }
  }

  async function removePerson(person) {
    try {
      await deletePerson(person.id);
      if (person.team === 'Client') setClientPeople(prev => prev.filter(p => p.id !== person.id));
      else setLeucinePeople(prev => prev.filter(p => p.id !== person.id));
      toast.success('Removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  }

  async function loadTemplate() {
    if (!template) return;

    const existingClientRoles = new Set(clientPeople.map(p => p.role));
    const existingLeuRoles    = new Set(leucinePeople.map(p => p.role));
    const newClientRoles  = template.client.filter(role => !existingClientRoles.has(role));
    const newLeuRoles     = template.leucine.filter(role => !existingLeuRoles.has(role));

    if (newClientRoles.length === 0 && newLeuRoles.length === 0) {
      toast('Template roles already loaded — no new roles to add.');
      return;
    }

    if (!window.confirm(
      `This will add ${newClientRoles.length} client + ${newLeuRoles.length} Leucine template roles. Continue?`
    )) return;

    setLoadingTemplate(true);
    try {
      const clientRows = newClientRoles.map(role => ({
        name: templatePlaceholder('Client', role), role, email: '', phone: '', team: 'Client', project_id: project.id,
      }));
      const leucineRows = newLeuRoles.map(role => ({
        name: templatePlaceholder('Leucine', role), role, email: '', phone: '', team: 'Leucine', project_id: project.id,
      }));
      const saved = await Promise.all([...clientRows, ...leucineRows].map(r => upsertPerson(r)));
      setClientPeople(prev => [...prev, ...saved.filter(p => p.team === 'Client')]);
      setLeucinePeople(prev => [...prev, ...saved.filter(p => p.team === 'Leucine')]);
      toast.success(`Template loaded`);
    } catch (e) {
      toast.error('Failed to load template: ' + (e?.message || 'Unknown error'));
    }
    setLoadingTemplate(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-6 space-y-8">
      {/* Template banner */}
      {canManage && template && (clientPeople.length === 0 && leucinePeople.length === 0) && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">Start with a template</p>
              <p className="text-xs text-blue-500 mt-0.5">
                Pre-populate with {project?.category_name || 'project'} team roles — {template.client.length} client + {template.leucine.length} Leucine
              </p>
            </div>
          </div>
          <button onClick={loadTemplate} disabled={loadingTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-50">
            {loadingTemplate ? 'Loading…' : 'Load Template'}
          </button>
        </div>
      )}

      {canManage && template && (clientPeople.length > 0 || leucinePeople.length > 0) && (
        <div className="flex justify-end">
          <button onClick={loadTemplate} disabled={loadingTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition disabled:opacity-50">
            <FileText className="w-3.5 h-3.5" />
            {loadingTemplate ? 'Loading…' : 'Load Template Roles'}
          </button>
        </div>
      )}

      <PeopleGroup
        title="Client Team" people={clientPeople} team="Client"
        canManage={canManage} adding={addingClient}
        newPerson={newPerson} setNewPerson={setNewPerson}
        onAdd={() => setAddingClient(true)}
        onSave={() => addPerson('Client')}
        onCancel={() => { setAddingClient(false); setNewPerson({ ...EMPTY_PERSON }); }}
        onFieldChange={savePersonField} onDelete={removePerson}
      />
      <PeopleGroup
        title="Leucine Team" people={leucinePeople} team="Leucine"
        canManage={canManage} adding={addingLeuine}
        newPerson={{ ...newPerson, team: 'Leucine' }} setNewPerson={setNewPerson}
        onAdd={() => setAddingLeuine(true)}
        onSave={() => addPerson('Leucine')}
        onCancel={() => { setAddingLeuine(false); setNewPerson({ ...EMPTY_PERSON }); }}
        onFieldChange={savePersonField} onDelete={removePerson}
      />
    </div>
  );
}

function PeopleGroup({ title, people, team, canManage, adding, newPerson, setNewPerson, onAdd, onSave, onCancel, onFieldChange, onDelete }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const ss = useSpreadsheet();

  // Debounced save per person — avoids firing an API call on every keystroke
  const saveTimers = useRef({});
  const debouncedFieldChange = useCallback((person, field, value) => {
    clearTimeout(saveTimers.current[`${person.id}_${field}`]);
    saveTimers.current[`${person.id}_${field}`] = setTimeout(() => {
      onFieldChange(person, field, value);
    }, 600);
  }, [onFieldChange]);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const h = () => setOpenMenuId(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [openMenuId]);

  return (
    <div onClick={() => ss.clearAll()}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{people.length}</span>
        </div>
        {canManage && (
          <button onClick={onAdd} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Add Person
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden select-none" onClick={e => e.stopPropagation()}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {canManage && <th className="w-8" />}
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-52">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-64">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-48">Role / Title</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-36">Phone</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, i) => (
              <tr key={person.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                {/* Three-dots menu */}
                {canManage && (
                  <td className="px-1 py-2 w-8">
                    <div className="relative flex items-center justify-center">
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === person.id ? null : person.id); }}
                        className="p-0.5 hover:bg-gray-200 rounded transition"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      {openMenuId === person.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute left-6 top-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 w-24">
                            <button
                              onClick={() => { setOpenMenuId(null); onDelete(person); }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                )}

                {/* Name */}
                <SCell ss={ss} rowId={person.id} colKey="name"
                  value={person.name || ''}
                  onChange={v => debouncedFieldChange(person, 'name', v)}
                  rows={people} cols={EDIT_COLS}
                  placeholder={person.role ? `{${team} ${person.role}}` : 'Fill in name…'}
                  disabled={!canManage}
                  readView={
                    person.name
                      ? <span className="text-gray-700 text-sm">{person.name}</span>
                      : <span className="text-gray-400 italic text-xs">{person.role ? `{${team} ${person.role}}` : 'Fill in name…'}</span>
                  } />

                {/* Email */}
                <SCell ss={ss} rowId={person.id} colKey="email"
                  value={person.email || ''}
                  onChange={v => debouncedFieldChange(person, 'email', v)}
                  rows={people} cols={EDIT_COLS}
                  type="text"
                  placeholder="email@example.com"
                  disabled={!canManage}
                  readView={
                    person.email
                      ? <span className="text-gray-700 text-sm">{person.email}</span>
                      : <span className="text-gray-400 italic text-xs">email@example.com</span>
                  } />

                {/* Role */}
                <SCell ss={ss} rowId={person.id} colKey="role"
                  value={person.role || ''}
                  onChange={v => debouncedFieldChange(person, 'role', v)}
                  rows={people} cols={EDIT_COLS}
                  placeholder="Role / Title"
                  disabled={!canManage}
                  readView={
                    person.role
                      ? <span className="text-gray-700 text-sm">{person.role}</span>
                      : <span className="text-gray-400 italic text-xs">Role / Title</span>
                  } />

                {/* Phone */}
                <SCell ss={ss} rowId={person.id} colKey="phone"
                  value={person.phone || ''}
                  onChange={v => debouncedFieldChange(person, 'phone', v)}
                  rows={people} cols={EDIT_COLS}
                  placeholder="+1 555 000 0000"
                  disabled={!canManage}
                  readView={
                    person.phone
                      ? <span className="text-gray-700 text-sm">{person.phone}</span>
                      : <span className="text-gray-400 italic text-xs">+1 555 000 0000</span>
                  } />
              </tr>
            ))}

            {/* Add new person row */}
            {adding && (
              <tr className="bg-blue-50/30 border-t border-blue-100">
                {canManage && <td className="w-8" />}
                <td className="px-4 py-2">
                  <input autoFocus type="text" placeholder="Name *" value={newPerson.name}
                    onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </td>
                <td className="px-4 py-2">
                  <input type="email" placeholder="Email" value={newPerson.email}
                    onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </td>
                <td className="px-4 py-2">
                  <input type="text" placeholder="Role" value={newPerson.role}
                    onChange={e => setNewPerson(p => ({ ...p, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </td>
                <td className="px-4 py-2">
                  <input type="tel" placeholder="Phone" value={newPerson.phone}
                    onChange={e => setNewPerson(p => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-1">
                    <button onClick={onSave} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Save</button>
                    <button onClick={onCancel} className="text-xs text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Cancel</button>
                  </div>
                </td>
              </tr>
            )}

            {people.length === 0 && !adding && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-sm text-gray-400">
                  No {title.toLowerCase()} added yet.
                  {canManage && ' Click "Add Person" or "Load Template" to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
