import { useState, useEffect } from 'react';
import { Shield, Users, Tag, Trash2, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS = { admin: 'Admin', dm: 'Delivery Manager', leadership: 'Leadership' };
const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700',
  dm: 'bg-blue-100 text-blue-700',
  leadership: 'bg-purple-100 text-purple-700',
};

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (!isAdmin()) { navigate('/'); return; }
    loadUsers();
    loadCategories();
  }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (error) throw error;
      setUsers(data || []);
    } catch { toast.error('Failed to load users'); }
    setLoadingUsers(false);
  }

  async function loadCategories() {
    setLoadingCats(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      if (error) throw error;
      setCategories(data || []);
    } catch { toast.error('Failed to load categories'); }
    setLoadingCats(false);
  }

  async function updateRole(userId, newRole) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch { toast.error('Failed to update role'); }
  }

  async function deleteUser(userId) {
    if (!window.confirm('Remove this user from the system?')) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User removed');
    } catch { toast.error('Failed to remove user'); }
  }

  async function addCategory() {
    if (!newCatName.trim()) { toast.error('Category name required'); return; }
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: newCatName.trim() })
        .select()
        .single();
      if (error) throw error;
      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCatName('');
      toast.success('Category added');
    } catch (e) {
      if (e.code === '23505') toast.error('Category already exists');
      else toast.error('Failed to add category');
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm('Delete this application category? This may affect existing projects.')) return;
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Category deleted');
    } catch { toast.error('Failed to delete category'); }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin Panel</h1>
          <p className="text-xs text-gray-500">Manage users, roles, and application categories</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { key: 'users', label: 'Users & Roles', icon: Users },
          { key: 'categories', label: 'Applications', icon: Tag },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
            <button onClick={loadUsers} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Email</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Change Role</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No users found.</td></tr>
                ) : users.map((user, i) => (
                  <tr key={user.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{user.full_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={user.role || 'dm'}
                        onChange={e => updateRole(user.id, e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="admin">Admin</option>
                        <option value="dm">Delivery Manager</option>
                        <option value="leadership">Leadership</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => deleteUser(user.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">Users sign up via the login page. Only @leucinetech.com emails are allowed. Role defaults to Delivery Manager.</p>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">{categories.length} application{categories.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <table className="text-sm w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Application Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Created</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {loadingCats ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">Loading...</td></tr>
                ) : categories.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">No categories.</td></tr>
                ) : categories.map((cat, i) => (
                  <tr key={cat.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{cat.name}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {cat.created_at ? new Date(cat.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => deleteCategory(cat.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add category */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New application name (e.g. AI Agents)"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={addCategory}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Default applications (MES, Logbooks, CLEEN, DMS, LMS, AI Agents) are seeded on first deploy.
          </p>
        </div>
      )}
    </div>
  );
}
