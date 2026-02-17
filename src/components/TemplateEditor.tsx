'use client';

import { useState, useEffect } from 'react';
import { X, Save, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import type { WorkflowTemplate, TemplateCategory } from '@/lib/types';

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: 'development', label: 'Development' },
  { value: 'research', label: 'Research' },
  { value: 'content', label: 'Content' },
  { value: 'operations', label: 'Operations' },
  { value: 'custom', label: 'Custom' },
];

const TOOL_PROFILES = [
  { value: 'coding', label: 'Coding' },
  { value: 'research', label: 'Research' },
  { value: 'default', label: 'Default' },
];

const EMOJI_OPTIONS = ['🤖', '🧠', '💻', '🔍', '✍️', '🎨', '📊', '⚡', '🚀', '🎯', '🔧', '📝', '🛡️', '🧪'];

interface TemplateEditorProps {
  template?: WorkflowTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Derive a URL-safe slug from a display name */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface RoleFormState {
  id?: string;
  role_slug: string;
  display_name: string;
  emoji: string;
  identity_text: string;
  soul_text: string;
  model_primary: string;
  tool_profile: string;
  _isNew?: boolean;
  _isDeleted?: boolean;
  _isDirty?: boolean;
}

export function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const isEditing = !!template;

  // Template metadata form state
  const [name, setName] = useState(template?.name || '');
  const [slug, setSlug] = useState(template?.slug || '');
  const [description, setDescription] = useState(template?.description || '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category || 'custom');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Roles state
  const [roles, setRoles] = useState<RoleFormState[]>([]);
  const [expandedRole, setExpandedRole] = useState<number | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleErrors, setRoleErrors] = useState<Record<number, string>>({});

  // Initialize roles from template
  useEffect(() => {
    if (template?.roles) {
      const sortedRoles = [...template.roles].sort((a, b) => a.stage_order - b.stage_order);
      setRoles(
        sortedRoles.map((r) => ({
          id: r.id,
          role_slug: r.role_slug,
          display_name: r.display_name,
          emoji: r.emoji,
          identity_text: r.identity_text,
          soul_text: r.soul_text,
          model_primary: r.model_primary,
          tool_profile: r.tool_profile,
        }))
      );
    }
  }, [template]);

  // Auto-derive slug from name (only if not manually edited)
  useEffect(() => {
    if (!slugManuallyEdited && !isEditing) {
      setSlug(slugify(name));
    }
  }, [name, slugManuallyEdited, isEditing]);

  const handleAddRole = () => {
    const newRole: RoleFormState = {
      role_slug: '',
      display_name: '',
      emoji: '🤖',
      identity_text: '',
      soul_text: '',
      model_primary: 'z.ai/glm-4.7',
      tool_profile: 'coding',
      _isNew: true,
    };
    setRoles([...roles, newRole]);
    setExpandedRole(roles.length);
  };

  const handleUpdateRole = (index: number, updates: Partial<RoleFormState>) => {
    setRoles((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const updated = { ...r, ...updates, _isDirty: true };
        // Auto-derive role_slug from display_name if role_slug is empty or matches old auto-derived slug
        if (updates.display_name !== undefined && (!r.role_slug || r.role_slug === slugify(r.display_name))) {
          updated.role_slug = slugify(updates.display_name);
        }
        return updated;
      })
    );
    // Clear error for this role
    setRoleErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleDeleteRole = async (index: number) => {
    const role = roles[index];

    if (role.id && template) {
      // Existing role — delete from server
      try {
        const res = await fetch(`/api/templates/${template.id}/roles/${role.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = await res.json();
          setRoleErrors((prev) => ({ ...prev, [index]: data.error || 'Failed to delete role' }));
          return;
        }
      } catch {
        setRoleErrors((prev) => ({ ...prev, [index]: 'Failed to delete role' }));
        return;
      }
    }

    // Remove from local state
    setRoles((prev) => prev.filter((_, i) => i !== index));
    setExpandedRole(null);
  };

  const handleMoveRole = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= roles.length) return;

    setRoles((prev) => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });

    // Track expanded role
    if (expandedRole === index) setExpandedRole(newIndex);
    else if (expandedRole === newIndex) setExpandedRole(index);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Validate template fields
      if (!name.trim()) {
        setError('Template name is required');
        setIsSaving(false);
        return;
      }
      if (!slug.trim()) {
        setError('Template slug is required');
        setIsSaving(false);
        return;
      }

      let templateId = template?.id;

      if (isEditing && templateId) {
        // Update existing template metadata
        const res = await fetch(`/api/templates/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description, category }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to update template');
          setIsSaving(false);
          return;
        }
      } else {
        // Create new template
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, slug, description, category }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Failed to create template');
          setIsSaving(false);
          return;
        }
        const created = await res.json();
        templateId = created.id;
      }

      // Save roles
      for (let i = 0; i < roles.length; i++) {
        const role = roles[i];

        if (!role.role_slug || !role.display_name) {
          setRoleErrors((prev) => ({ ...prev, [i]: 'Role slug and display name are required' }));
          continue;
        }

        if (role._isNew) {
          // Create new role
          const res = await fetch(`/api/templates/${templateId}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role_slug: role.role_slug,
              display_name: role.display_name,
              emoji: role.emoji,
              identity_text: role.identity_text,
              soul_text: role.soul_text,
              model_primary: role.model_primary,
              tool_profile: role.tool_profile,
              stage_order: i + 1,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            setRoleErrors((prev) => ({ ...prev, [i]: data.error || 'Failed to create role' }));
          }
        } else if (role._isDirty && role.id) {
          // Update existing role
          const res = await fetch(`/api/templates/${templateId}/roles/${role.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role_slug: role.role_slug,
              display_name: role.display_name,
              emoji: role.emoji,
              identity_text: role.identity_text,
              soul_text: role.soul_text,
              model_primary: role.model_primary,
              tool_profile: role.tool_profile,
              stage_order: i + 1,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            setRoleErrors((prev) => ({ ...prev, [i]: data.error || 'Failed to update role' }));
          }
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!template || !confirm(`Delete template "${template.name}"? This will also delete all its roles.`)) return;

    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete template');
        return;
      }
      onSaved();
    } catch {
      setError('Failed to delete template');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-mc-bg-secondary border border-mc-border rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border shrink-0">
          <h2 className="text-lg font-semibold text-mc-text">
            {isEditing ? `Edit Template: ${template.name}` : 'Create New Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Error banner */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Template Metadata */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-mc-text-secondary uppercase tracking-wider">
              Template Details
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-mc-text mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Full-Stack Dev Pipeline"
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-mc-text mb-1">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                  }}
                  placeholder="full-stack-dev"
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm text-mc-text focus:outline-none focus:border-mc-accent font-mono"
                />
                <p className="text-xs text-mc-text-secondary mt-1">
                  URL-safe identifier. Auto-derived from name.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-mc-text mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info badge for built-in */}
              {template?.is_builtin && (
                <div className="flex items-end pb-2">
                  <span className="px-3 py-1 bg-mc-accent-purple/20 text-mc-accent-purple text-xs font-medium rounded">
                    Built-in Template
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-mc-text mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what this template does..."
                className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm text-mc-text focus:outline-none focus:border-mc-accent resize-none"
              />
            </div>
          </section>

          {/* Divider */}
          <div className="border-t border-mc-border" />

          {/* Roles Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-mc-text-secondary uppercase tracking-wider">
                Pipeline Roles ({roles.length})
              </h3>
              <button
                type="button"
                onClick={handleAddRole}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mc-bg-tertiary border border-mc-border rounded hover:border-mc-accent/50 text-mc-text transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Role
              </button>
            </div>

            {roles.length === 0 && (
              <div className="text-center py-8 text-mc-text-secondary text-sm">
                No roles defined yet. Add a role to build your pipeline.
              </div>
            )}

            <div className="space-y-2">
              {roles.map((role, index) => {
                const isExpanded = expandedRole === index;
                return (
                  <div
                    key={role.id || `new-${index}`}
                    className="bg-mc-bg border border-mc-border rounded-lg overflow-hidden"
                  >
                    {/* Role header (always visible) */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-mc-bg-tertiary/50 transition-colors"
                      onClick={() => setExpandedRole(isExpanded ? null : index)}
                    >
                      <div className="flex flex-col gap-0.5 text-mc-text-secondary">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRole(index, 'up');
                          }}
                          disabled={index === 0}
                          className="p-0.5 hover:text-mc-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveRole(index, 'down');
                          }}
                          disabled={index === roles.length - 1}
                          className="p-0.5 hover:text-mc-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-lg">{role.emoji}</span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-mc-text truncate">
                            {role.display_name || 'Untitled Role'}
                          </span>
                          {role.role_slug && (
                            <span className="text-xs text-mc-text-secondary font-mono">
                              ({role.role_slug})
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-xs text-mc-text-secondary px-2 py-0.5 bg-mc-bg-tertiary rounded">
                        Stage {index + 1}
                      </span>

                      <span className="text-xs text-mc-text-secondary px-2 py-0.5 bg-mc-bg-tertiary rounded">
                        {role.tool_profile}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-mc-text-secondary" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-mc-text-secondary" />
                      )}
                    </div>

                    {/* Expanded role editor */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-mc-border space-y-4">
                        {roleErrors[index] && (
                          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs">
                            {roleErrors[index]}
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                          {/* Display Name */}
                          <div>
                            <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                              Display Name
                            </label>
                            <input
                              type="text"
                              value={role.display_name}
                              onChange={(e) =>
                                handleUpdateRole(index, { display_name: e.target.value })
                              }
                              placeholder="e.g., Lead Developer"
                              className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                            />
                          </div>

                          {/* Role Slug */}
                          <div>
                            <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                              Role Slug
                            </label>
                            <input
                              type="text"
                              value={role.role_slug}
                              onChange={(e) =>
                                handleUpdateRole(index, { role_slug: e.target.value })
                              }
                              placeholder="lead-dev"
                              className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent font-mono"
                            />
                          </div>

                          {/* Emoji */}
                          <div>
                            <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                              Emoji
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {EMOJI_OPTIONS.map((em) => (
                                <button
                                  key={em}
                                  type="button"
                                  onClick={() => handleUpdateRole(index, { emoji: em })}
                                  className={`text-base p-1 rounded hover:bg-mc-bg-tertiary ${
                                    role.emoji === em
                                      ? 'bg-mc-accent/20 ring-1 ring-mc-accent'
                                      : ''
                                  }`}
                                >
                                  {em}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Identity Text */}
                        <div>
                          <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                            Identity Text
                          </label>
                          <textarea
                            value={role.identity_text}
                            onChange={(e) =>
                              handleUpdateRole(index, { identity_text: e.target.value })
                            }
                            rows={3}
                            placeholder="You are a senior full-stack developer..."
                            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text font-mono focus:outline-none focus:border-mc-accent resize-none"
                          />
                        </div>

                        {/* Soul Text */}
                        <div>
                          <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                            Soul Text
                          </label>
                          <textarea
                            value={role.soul_text}
                            onChange={(e) =>
                              handleUpdateRole(index, { soul_text: e.target.value })
                            }
                            rows={3}
                            placeholder="SOUL.md content — personality, values, communication style..."
                            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text font-mono focus:outline-none focus:border-mc-accent resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Model */}
                          <div>
                            <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                              Model
                            </label>
                            <input
                              type="text"
                              value={role.model_primary}
                              onChange={(e) =>
                                handleUpdateRole(index, { model_primary: e.target.value })
                              }
                              placeholder="z.ai/glm-4.7"
                              className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent font-mono"
                            />
                          </div>

                          {/* Tool Profile */}
                          <div>
                            <label className="block text-xs font-medium text-mc-text-secondary mb-1">
                              Tool Profile
                            </label>
                            <select
                              value={role.tool_profile}
                              onChange={(e) =>
                                handleUpdateRole(index, { tool_profile: e.target.value })
                              }
                              className="w-full bg-mc-bg-secondary border border-mc-border rounded px-2.5 py-1.5 text-sm text-mc-text focus:outline-none focus:border-mc-accent"
                            >
                              {TOOL_PROFILES.map((tp) => (
                                <option key={tp.value} value={tp.value}>
                                  {tp.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Delete Role */}
                        {!template?.is_builtin && (
                          <div className="pt-2 border-t border-mc-border">
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(index)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Role
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-mc-border shrink-0">
          <div>
            {isEditing && !template?.is_builtin && (
              <button
                type="button"
                onClick={handleDeleteTemplate}
                className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Template
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-mc-text-secondary hover:text-mc-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
