import { useState, useEffect } from 'react';
import { ResizableLayout } from '../components/layout';
import {
  Button,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui';
import { cn } from '@/lib/utils';
import { gateway } from '../lib/gateway';

const navItems = [
  { id: 'preferences', label: 'Preferences' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'keybindings', label: 'Keybindings' },
  { id: 'models', label: 'Models' },
  { id: 'skills', label: 'Skills' },
  { id: 'usage', label: 'Usage' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'git', label: 'Git' },
  { id: 'plugins', label: 'Plugins' },
];

interface DashboardSettings {
  autoSave: boolean;
  confirmCommands: boolean;
  defaultModel: string;
  maxWorkers: number;
}

const defaultSettings: DashboardSettings = {
  autoSave: true,
  confirmCommands: true,
  defaultModel: 'claude-3-opus',
  maxWorkers: 4,
};

export function SettingsView() {
  const [activeSection, setActiveSection] = useState('preferences');
  const [autoSave, setAutoSave] = useState(true);
  const [confirmCommands, setConfirmCommands] = useState(true);
  const [defaultModel, setDefaultModel] = useState('claude-3-opus');
  const [maxWorkers, setMaxWorkers] = useState(4);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    gateway.callMethod('dashboard.settings.get', {}).then(
      (data) => {
        const s = data as DashboardSettings;
        if (s.autoSave != null) setAutoSave(s.autoSave);
        if (s.confirmCommands != null) setConfirmCommands(s.confirmCommands);
        if (s.defaultModel) setDefaultModel(s.defaultModel);
        if (s.maxWorkers != null) setMaxWorkers(s.maxWorkers);
      },
      (err) => {
        console.warn('[Settings] Failed to load:', err);
      },
    );
  }, []);

  const handleSave = () => {
    setSaving(true);
    gateway.callMethod('dashboard.settings.set', {
      settings: { autoSave, confirmCommands, defaultModel, maxWorkers },
    }).then(
      () => setSaving(false),
      (err) => {
        console.error('[Settings] Save failed:', err);
        setSaving(false);
      },
    );
  };

  const handleReset = () => {
    setAutoSave(defaultSettings.autoSave);
    setConfirmCommands(defaultSettings.confirmCommands);
    setDefaultModel(defaultSettings.defaultModel);
    setMaxWorkers(defaultSettings.maxWorkers);
  };

  return (
    <ResizableLayout
      sidebar={
        <nav className="flex flex-col py-4">
          <div className="text-base font-semibold px-4 pb-4 border-b border-[var(--color-border)] mb-2 text-[var(--color-text-primary)]">
            Settings
          </div>
          {navItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'px-4 py-2.5 text-[13px] cursor-pointer text-[var(--color-text-secondary)] border-l-2 border-transparent transition-all hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
                activeSection === item.id &&
                  'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-l-[var(--color-accent)]',
              )}
              onClick={() => setActiveSection(item.id)}
            >
              {item.label}
            </div>
          ))}
        </nav>
      }
      main={
        <div className="flex-1 p-8 overflow-y-auto bg-[var(--color-bg-primary)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">
            Preferences
          </h2>

          <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Auto-save
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Automatically save changes as you work
                </div>
              </div>
              <Switch checked={autoSave} onCheckedChange={setAutoSave} />
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Confirm before running commands
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Show confirmation dialog before executing shell commands
                </div>
              </div>
              <Switch
                checked={confirmCommands}
                onCheckedChange={setConfirmCommands}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Default model
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Model used for new conversations
                </div>
              </div>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-opus">claude-3-opus</SelectItem>
                  <SelectItem value="claude-3-sonnet">
                    claude-3-sonnet
                  </SelectItem>
                  <SelectItem value="claude-3-haiku">
                    claude-3-haiku
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Max workers
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Maximum concurrent worker agents
                </div>
              </div>
              <Input
                type="number"
                value={maxWorkers}
                onChange={(e) => setMaxWorkers(Number(e.target.value) || 1)}
                className="w-20 text-center"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={handleReset}>Reset to defaults</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      }
    />
  );
}
