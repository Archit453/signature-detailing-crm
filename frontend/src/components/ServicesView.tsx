import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Sparkles, Layers } from 'lucide-react';
import type { StudioService } from '../types';
import { api } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

export const ServicesView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [services, setServices] = useState<StudioService[]>([]);
  const [nameInput, setNameInput] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const data = await api.getServices();
      setServices(data || []);
    } catch (err: any) {
      console.warn('Failed to load services:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;

    try {
      setIsSaving(true);
      const shortCode = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const newPkg = {
        name: trimmed,
        short_code: shortCode,
        is_active: true,
      };

      const saved = await api.saveService(newPkg);
      if (saved) {
        setServices((prev) => {
          const exists = prev.some((s) => s.id === saved.id || s.name.toLowerCase() === saved.name.toLowerCase());
          return exists
            ? prev.map((s) => (s.id === saved.id || s.name.toLowerCase() === saved.name.toLowerCase() ? saved : s))
            : [...prev, saved];
        });
      } else {
        await fetchServices();
      }
      setNameInput('');
    } catch (err: any) {
      console.error('Failed to add package:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (service: StudioService) => {
    setEditingId(service.id);
    setEditingName(service.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    try {
      const existing = services.find((s) => s.id === id);
      const updated = {
        ...existing,
        id,
        name: trimmed,
        short_code: existing?.short_code || trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20),
        is_active: true,
      };

      await api.saveService(updated);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
      setEditingId(null);
      setEditingName('');
    } catch (err: any) {
      console.error('Failed to update package:', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete package "${name}"?`)) return;

    try {
      await api.deleteService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error('Failed to delete package:', err);
    }
  };

  return (
    <div className={`p-6 max-w-4xl mx-auto min-h-screen transition-colors duration-200 ${isLight ? 'text-slate-900' : 'text-white'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">Studio Packages</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Write the packages offered by your studio. Kept in code and synced with the bot.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            {services.length} {services.length === 1 ? 'Package' : 'Packages'}
          </span>
        </div>
      </div>

      <form onSubmit={handleAddPackage} className="mt-6">
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Write package name (e.g. Matte PPF, Ceramic Pro, Deep Interior)..."
            className={`flex-1 px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 shadow-sm'
                : 'bg-slate-900/90 border-slate-800 text-white placeholder-slate-500'
            }`}
          />
          <button
            type="submit"
            disabled={!nameInput.trim() || isSaving}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Package</span>
          </button>
        </div>
      </form>

      <div className="mt-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">
          Active Detailing Packages
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading packages...</div>
        ) : services.length === 0 ? (
          <div
            className={`p-10 text-center rounded-2xl border border-dashed ${
              isLight ? 'border-slate-300 bg-slate-50/50' : 'border-slate-800 bg-slate-900/30'
            }`}
          >
            <Sparkles className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No packages written yet</p>
            <p className="text-xs text-slate-400 mt-1">Type a package name above to add your first studio package.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {services.map((pkg, index) => {
              const isEditing = editingId === pkg.id;

              return (
                <div
                  key={pkg.id || index}
                  className={`group flex items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
                    isLight
                      ? 'bg-white border-slate-200/90 shadow-sm hover:border-slate-300'
                      : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(pkg.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        autoFocus
                        className={`flex-1 px-3 py-1.5 rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                          isLight
                            ? 'bg-slate-50 border-slate-300 text-slate-900'
                            : 'bg-slate-800 border-slate-700 text-white'
                        }`}
                      />
                      <button
                        onClick={() => handleSaveEdit(pkg.id)}
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-2 rounded-lg bg-slate-500/10 text-slate-400 hover:bg-slate-500/20 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-base truncate tracking-tight">
                          {pkg.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(pkg)}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          title="Edit package name"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.id, pkg.name)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete package"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

