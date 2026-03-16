import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPeople, upsertPerson, deletePerson } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const EMPTY_PERSON = { name: '', email: '', role: '', phone: '', team: 'Client' };

export default function PeopleTab({ project, canEdit }) {
  const { isAdmin, isDM } = useAuth();
  const [clientPeople, setClientPeople]  = useState([]);
  const [leucinePeople, setLeucinePeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingClient, setAddingClient]   = useState(false);
  const [addingLeuine, setAddingLeuine]   = useState(false);
  const [newPerson, setNewPerson] = useState({ ...EMPTY_PERSON });

  const canManage = isAdmin() || (isDM() && canEdit);

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
      const saved = await upsertPerson(updated);
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
    if (!window.confirm(`Remove ${person.name}?`)) return;
    try {
      await deletePerson(person.id);
      if (person.team === 'Client') setClientPeople(prev => prev.filter(p => p.id !== person.id));
      else setLeucinePeople(prev => prev.filter(p => p.id !== person.id));
      toast.success('Removed');
    } catch (e) {
      toast.error('Failed to remove');
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="p-6 space-y-8">
      <PeopleGroup
        title="Client Team"
        people={clientPeople}
        team="Client"
        canManage={canManage}
        adding={addingClient}
        newPerson={newPerson}
        setNewPerson={setNewPerson}
        onAdd={() => setAddingClient(true)}
        onSave={() => addPerson('Client')}
        onCancel={() => { setAddingClient(false); setNewPerson({ ...EMPTY_PERSON }); }}
        onFieldChange={savePersonField}
        onDelete={removePerson}
      />
      <PeopleGroup
        title="Leucine Team"
        people={leucinePeople}
        team="Leucine"
        canManage={canManage}
        adding={addingLeuine}
        newPerson={{ ...newPerson, team: 'Leucine' }}
        setNewPerson={setNewPerson}
        onAdd={() => setAddingLeuine(true)}
        onSave={() => addPerson('Leucine')}
        onCancel={() => { setAddingLeuine(false); setNewPerson({ ...EMPTY_PERSON }); }}
        onFieldChange={savePersonField}
        onDelete={removePerson}
      />
    </div>
  );
}

function PeopleGroup({ title, people, team, canManage, adding, newPerson, setNewPerson, onAdd, onSave, onCancel, onFieldChange, onDelete }) {
  return (
    <div>
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

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-52">Name</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-64">Email</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-48">Role / Title</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-600 w-36">Phone</th>
              {canManage && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {people.map((person, i) => (
              <tr key={person.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-2">
                  <EditableCell value={person.name} onSave={v => onFieldChange(person, 'name', v)} canEdit={canManage} />
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={person.email} onSave={v => onFieldChange(person, 'email', v)} canEdit={canManage} type="email" />
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={person.role} onSave={v => onFieldChange(person, 'role', v)} canEdit={canManage} />
                </td>
                <td className="px-4 py-2">
                  <EditableCell value={person.phone} onSave={v => onFieldChange(person, 'phone', v)} canEdit={canManage} type="tel" />
                </td>
                {canManage && (
                  <td className="px-2 py-2">
                    <button onClick={() => onDelete(person)} className="text-gray-400 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {/* Add new person row */}
            {adding && (
              <tr className="bg-blue-50/30 border-t border-blue-100">
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Name *"
                    value={newPerson.name}
                    onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={newPerson.email}
                    onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Role"
                    value={newPerson.role}
                    onChange={e => setNewPerson(p => ({ ...p, role: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={newPerson.phone}
                    onChange={e => setNewPerson(p => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No {title.toLowerCase()} added yet.
                  {canManage && ' Click "Add Person" to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({ value, onSave, canEdit, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');

  useEffect(() => { setVal(value || ''); }, [value]);

  function commit() {
    setEditing(false);
    if (val !== (value || '')) onSave(val);
  }

  if (!canEdit) return <span className="text-gray-700">{value || '—'}</span>;

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value || ''); setEditing(false); } }}
        className="w-full border border-blue-400 rounded px-2 py-0.5 text-sm focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="block w-full cursor-text text-gray-700 min-h-[1.5rem] hover:bg-blue-50 rounded px-1 py-0.5 transition"
    >
      {value || <span className="text-gray-300 italic">—</span>}
    </span>
  );
}
