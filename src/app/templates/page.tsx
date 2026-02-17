'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutTemplate,
  Plus,
  Pencil,
  Rocket,
  Users,
  Shield,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { TemplateEditor } from '@/components/TemplateEditor';
import type { WorkflowTemplate, TemplateCategory } from '@/lib/types';

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  development: 'bg-mc-accent/20 text-mc-accent',
  research: 'bg-mc-accent-purple/20 text-mc-accent-purple',
  content: 'bg-mc-accent-pink/20 text-mc-accent-pink',
  operations: 'bg-mc-accent-yellow/20 text-mc-accent-yellow',
  custom: 'bg-mc-bg-tertiary text-mc-text-secondary',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);

  // Deploy state
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployMessage, setDeployMessage] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(
    null
  );

  const loadTemplates = async () => {
    try {
      setError(null);
      const res = await fetch('/api/templates');
      if (!res.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleDeploy = async (templateId: string) => {
    setDeployingId(templateId);
    setDeployMessage(null);

    try {
      const res = await fetch(`/api/templates/${templateId}/deploy`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setDeployMessage({
          id: templateId,
          type: 'error',
          text: data.error || 'Deployment failed',
        });
        return;
      }

      setDeployMessage({
        id: templateId,
        type: 'success',
        text: `Deployed ${data.deployed_roles} role(s) successfully`,
      });

      // Refresh templates to update deploy status
      loadTemplates();
    } catch {
      setDeployMessage({
        id: templateId,
        type: 'error',
        text: 'Deployment request failed',
      });
    } finally {
      setDeployingId(null);
    }
  };

  const handleEdit = (template: WorkflowTemplate) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEditorSaved = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
    loadTemplates();
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto text-mc-accent animate-spin mb-3" />
          <p className="text-mc-text-secondary text-sm">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <header className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <LayoutTemplate className="w-6 h-6 text-mc-accent" />
              <h1 className="text-xl font-bold text-mc-text">Workflow Templates</h1>
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-16">
            <LayoutTemplate className="w-16 h-16 mx-auto text-mc-text-secondary mb-4" />
            <h3 className="text-lg font-medium text-mc-text mb-2">No templates yet</h3>
            <p className="text-mc-text-secondary mb-6 text-sm">
              Create your first workflow template to define reusable agent pipelines.
            </p>
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 transition-colors"
            >
              Create Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                isDeploying={deployingId === template.id}
                deployMessage={deployMessage?.id === template.id ? deployMessage : null}
                onEdit={() => handleEdit(template)}
                onDeploy={() => handleDeploy(template.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Template Editor Modal */}
      {editorOpen && (
        <TemplateEditor
          template={editingTemplate}
          onClose={handleEditorClose}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
}

// -- Template Card Component --

interface TemplateCardProps {
  template: WorkflowTemplate;
  isDeploying: boolean;
  deployMessage: { type: 'success' | 'error'; text: string } | null;
  onEdit: () => void;
  onDeploy: () => void;
}

function TemplateCard({ template, isDeploying, deployMessage, onEdit, onDeploy }: TemplateCardProps) {
  const roleCount = template.roles?.length || 0;
  const categoryClass = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom;

  return (
    <div className="bg-mc-bg-secondary border border-mc-border rounded-lg p-4 flex flex-col gap-3 hover:border-mc-accent/30 transition-colors">
      {/* Top row: name + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-mc-text truncate">{template.name}</h3>
          <p className="text-xs text-mc-text-secondary font-mono mt-0.5">/{template.slug}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {template.is_builtin && (
            <span className="px-2 py-0.5 bg-mc-accent-purple/20 text-mc-accent-purple text-xs font-medium rounded">
              Built-in
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-xs text-mc-text-secondary line-clamp-2">{template.description}</p>
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs">
        {/* Category badge */}
        <span className={`px-2 py-0.5 rounded font-medium ${categoryClass}`}>
          {template.category}
        </span>

        {/* Role count */}
        <span className="flex items-center gap-1 text-mc-text-secondary">
          <Users className="w-3.5 h-3.5" />
          {roleCount} role{roleCount !== 1 ? 's' : ''}
        </span>

        {/* Deployed status */}
        {template.is_deployed ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
            <Shield className="w-3 h-3" />
            Deployed
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
            Not deployed
          </span>
        )}
      </div>

      {/* Deploy message */}
      {deployMessage && (
        <div
          className={`p-2 rounded text-xs ${
            deployMessage.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {deployMessage.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-mc-border mt-auto">
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary hover:text-mc-text transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={onDeploy}
          disabled={isDeploying || roleCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isDeploying ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket className="w-3.5 h-3.5" />
              Deploy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
