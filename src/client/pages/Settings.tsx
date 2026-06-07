import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.ts";
import { t } from "../lib/i18n.ts";
import { PageHeader } from "../components/AppShell.tsx";
import { Field, Input } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";
import { useToast } from "../components/Toast.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { SectionTitle } from "../components/Toolbar.tsx";
import { IconSettings, IconBolt, IconSparkle } from "../components/Icons.tsx";
import type { Settings } from "@shared/types.ts";

const NUMERIC_KEYS = new Set<keyof Settings>([
  "defaultIntervalLo",
  "defaultIntervalHi",
  "defaultRetries",
  "defaultMinCn",
  "defaultPad",
  "maxConcurrentTasks",
  "pollIntervalMs",
]);

export function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getSettings().then(setS).catch(() => {});
  }, []);

  const save = useCallback(async () => {
    if (!s) return;
    setSaving(true);
    try {
      const next = await api.updateSettings(s);
      setS(next);
      toast.push({ kind: "success", msg: t.pages.settings.saved });
    } catch (e) {
      toast.push({ kind: "error", msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }, [s, toast]);

  const update = useCallback(
    <K extends keyof Settings>(k: K) =>
      (e: { target: { value: string } }) => {
        const raw = e.target.value;
        setS((curr) => {
          if (!curr) return curr;
          return {
            ...curr,
            [k]: NUMERIC_KEYS.has(k) ? (parseFloat(raw) as Settings[K]) : (raw as Settings[K]),
          };
        });
      },
    [],
  );

  if (!s) return <PageHeader title={t.pages.settings.title} subtitle="loading…" />;

  return (
    <>
      <PageHeader
        title={t.pages.settings.title}
        subtitle={t.pages.settings.subtitle}
        icon={<IconSettings size={18} />}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "资源" },
              { label: t.pages.settings.title, icon: <IconSettings size={11} /> },
            ]}
          />
        }
        actions={
          <Button variant="primary" onClick={save} loading={saving}>
            {t.pages.settings.save}
          </Button>
        }
      />
      {/* 2-column card grid：与 Books / Tasks / Logs 共享同一容器格局 —
          所有非首页都填满 .main 区域（无 max-width 锁死） */}
      <div className="settings-grid">
        {/* 并发控制 */}
        <div className="card">
          <SectionTitle
            title={
              <span className="row" style={{ gap: 8 }}>
                <IconBolt size={13} />
                {t.pages.settings.concurrencyCard}
              </span>
            }
            hint={
              <span style={{ color: "var(--text-lo)", fontFamily: "var(--font-mono)" }}>
                调度行为
              </span>
            }
          />
          <div className="col" style={{ gap: 16 }}>
            <div className="settings-fields">
              <Field label={t.pages.settings.maxConcurrent} hint={t.pages.settings.maxConcurrentHint}>
                <Input
                  type="number"
                  min={1}
                  max={32}
                  value={s.maxConcurrentTasks}
                  onChange={update("maxConcurrentTasks")}
                />
              </Field>
              <Field label={t.pages.settings.pollInterval} hint={t.pages.settings.pollIntervalHint}>
                <Input
                  type="number"
                  min={250}
                  step={50}
                  value={s.pollIntervalMs}
                  onChange={update("pollIntervalMs")}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* 新书源默认值 */}
        <div className="card">
          <SectionTitle
            title={
              <span className="row" style={{ gap: 8 }}>
                <IconSparkle size={13} />
                {t.pages.settings.defaultsCard}
              </span>
            }
            hint={
              <span style={{ color: "var(--text-lo)", fontFamily: "var(--font-mono)" }}>
                新建时预填
              </span>
            }
          />
          <div className="col" style={{ gap: 16 }}>
            <div className="settings-fields settings-fields-3">
              <Field label={t.pages.settings.intervalLo}>
                <Input
                  type="number"
                  step="0.1"
                  value={s.defaultIntervalLo}
                  onChange={update("defaultIntervalLo")}
                />
              </Field>
              <Field label={t.pages.settings.intervalHi}>
                <Input
                  type="number"
                  step="0.1"
                  value={s.defaultIntervalHi}
                  onChange={update("defaultIntervalHi")}
                />
              </Field>
            </div>
            <div className="settings-fields settings-fields-3">
              <Field label={t.pages.settings.retries}>
                <Input
                  type="number"
                  value={s.defaultRetries}
                  onChange={update("defaultRetries")}
                />
              </Field>
              <Field label={t.pages.settings.minCn}>
                <Input
                  type="number"
                  value={s.defaultMinCn}
                  onChange={update("defaultMinCn")}
                />
              </Field>
              <Field label={t.pages.settings.pad}>
                <Input
                  type="number"
                  value={s.defaultPad}
                  onChange={update("defaultPad")}
                />
              </Field>
            </div>
            <Field label={t.pages.settings.outputRoot}>
              <Input
                value={s.defaultOutputRoot}
                onChange={update("defaultOutputRoot")}
              />
            </Field>
            <Field label={t.pages.settings.ua}>
              <Input value={s.defaultUa} onChange={update("defaultUa")} />
            </Field>
          </div>
        </div>
      </div>
    </>
  );
}
