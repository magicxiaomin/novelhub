'use client';

import React, { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReaderSettings } from '@/lib/reader-settings';
import { messages } from '@novelhub/shared';

type SettingsDrawerProps = {
  open: boolean;
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  onClose: () => void;
};

export function SettingsDrawer({
  open,
  settings,
  onChange,
  onClose,
}: SettingsDrawerProps): JSX.Element {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black/35 transition-opacity',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      <section
        ref={dialogRef}
        className={cn(
          'absolute inset-x-0 bottom-0 min-h-[50dvh] rounded-t-2xl bg-background px-4 pb-6 pt-4 text-foreground shadow-2xl transition-transform',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={messages.reader.settings}
        tabIndex={-1}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{messages.reader.settings}</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            aria-label={messages.reader.drawerClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 space-y-5">
          <SettingGroup label={messages.reader.fontSize}>
            <Segmented
              label={messages.reader.fontSize}
              value={settings.fontSize}
              options={[
                ['s', messages.reader.fontSmall],
                ['m', messages.reader.fontMedium],
                ['l', messages.reader.fontLarge],
                ['xl', messages.reader.fontExtraLarge],
              ]}
              onChange={(fontSize) => onChange({ ...settings, fontSize })}
            />
          </SettingGroup>

          <SettingGroup label={messages.reader.lineHeight}>
            <Segmented
              label={messages.reader.lineHeight}
              value={settings.lineHeight}
              options={[
                ['compact', messages.reader.lineCompact],
                ['default', messages.reader.lineDefault],
                ['loose', messages.reader.lineLoose],
              ]}
              onChange={(lineHeight) => onChange({ ...settings, lineHeight })}
            />
          </SettingGroup>

          <SettingGroup label={messages.reader.theme}>
            <Segmented
              label={messages.reader.theme}
              value={settings.theme}
              options={[
                ['white', messages.reader.themeWhite],
                ['sepia', messages.reader.themeSepia],
                ['dark', messages.reader.themeDark],
              ]}
              onChange={(theme) => onChange({ ...settings, theme })}
            />
          </SettingGroup>

          <SettingGroup label={messages.reader.fontFamily}>
            <Segmented
              label={messages.reader.fontFamily}
              value={settings.fontFamily}
              options={[
                ['sans', messages.reader.fontSans],
                ['serif', messages.reader.fontSerif],
              ]}
              onChange={(fontFamily) => onChange({ ...settings, fontFamily })}
            />
          </SettingGroup>

          <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3 text-sm font-medium">
            {messages.reader.autoAdvance}
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(event) => onChange({ ...settings, autoAdvance: event.target.checked })}
              className="h-5 w-5 accent-brand"
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function SettingGroup({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div
      className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-muted p-1"
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            'h-9 rounded-md px-2 text-sm font-medium transition-colors',
            value === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
