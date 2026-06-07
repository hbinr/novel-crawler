import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.ts";
import { ws } from "../lib/ws.ts";
import { EmptyState, PageHeader } from "../components/AppShell.tsx";
import { IconLog } from "../components/Icons.tsx";
import { LogStream } from "../components/LogStream.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { t } from "../lib/i18n.ts";
import type { LogLine } from "@shared/types.ts";

type LevelFilter = "all" | "info" | "warn" | "error";

export function Logs() {
  const [initial, setInitial] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<LevelFilter>("all");

  useEffect(() => {
    ws.connect();
    api.listLogs({ limit: 300 }).then(setInitial).catch(() => {});
  }, []);

  const shown = useMemo(
    () => (filter === "all" ? initial : initial.filter((l) => l.level === filter)),
    [filter, initial],
  );

  return (
    <>
      <PageHeader
        title={t.pages.logs.title}
        subtitle={t.pages.logs.subtitle}
        icon={<IconLog size={18} />}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "运行" },
              { label: t.pages.logs.title, icon: <IconLog size={11} /> },
            ]}
          />
        }
        actions={
          <select
            className="select select-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as LevelFilter)}
          >
            <option value="all">{t.pages.logs.filterAll}</option>
            <option value="info">{t.pages.logs.filterInfo}</option>
            <option value="warn">{t.pages.logs.filterWarn}</option>
            <option value="error">{t.pages.logs.filterError}</option>
          </select>
        }
      />
      {shown.length === 0 && initial.length === 0 ? (
        <EmptyState
          icon={<IconLog size={26} />}
          title={t.pages.logs.emptyTitle}
          desc={t.pages.logs.emptyDesc}
          hint={t.pages.logs.emptyHint}
        />
      ) : (
        <LogStream initial={shown} />
      )}
    </>
  );
}
