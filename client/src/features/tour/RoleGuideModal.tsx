import { BookOpen, ListOrdered, Network, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Role, User } from '../../types';
import { ABBREVIATIONS, ABBREVIATION_LIST } from './abbreviations';
import { MermaidDiagram } from './MermaidDiagram';
import { getRoleGuide } from './roleGuides';
import { markRoleTourComplete } from './tourStorage';
import { startUiTour } from './startUiTour';

type Tab = 'overview' | 'workflow' | 'abbreviations';

interface RoleGuideModalProps {
  user: User;
  open: boolean;
  firstTime?: boolean;
  onClose: () => void;
}

export function RoleGuideModal({ user, open, firstTime = false, onClose }: RoleGuideModalProps) {
  const guide = useMemo(() => getRoleGuide(user.role as Role), [user.role]);
  const [tab, setTab] = useState<Tab>('overview');

  if (!open) return null;

  function finish(andTour: boolean) {
    markRoleTourComplete(user.id);
    onClose();
    if (andTour) {
      // Let modal unmount before highlighting sidebar.
      window.setTimeout(() => startUiTour(guide), 200);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
    { id: 'overview', label: 'Your role', icon: BookOpen },
    { id: 'workflow', label: 'Workflow', icon: Network },
    { id: 'abbreviations', label: 'Abbreviations', icon: ListOrdered },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-950/50 backdrop-blur-[2px]"
        aria-label="Close guide"
        onClick={() => finish(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-guide-title"
        className="relative z-[61] flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-line bg-white shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            {firstTime && (
              <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                Welcome · First-time guide
              </p>
            )}
            <h2 id="role-guide-title" className="font-display text-xl font-semibold text-brand-950">
              {guide.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {guide.department} · {user.name} ({user.employeeId})
            </p>
          </div>
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-md p-2 text-muted hover:bg-brand-50 hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2 sm:px-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium ${
                tab === t.id
                  ? 'border border-b-white border-line bg-white text-brand-900'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              <p className="text-sm leading-relaxed text-ink">{guide.summary}</p>

              <section>
                <h3 className="text-sm font-semibold text-brand-950">Your responsibilities</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink">
                  {guide.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-950">How to operate (simple steps)</h3>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink">
                  {guide.howToOperate.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-brand-950">Modules you will use most</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {guide.focusAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-900"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'workflow' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Diagram powered by{' '}
                <a
                  className="font-medium text-brand-800 underline-offset-2 hover:underline"
                  href="https://mermaid.js.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Mermaid
                </a>{' '}
                (open source). Highlighted boxes are your stages.
              </p>
              <MermaidDiagram chart={guide.workflowMermaid} />
              <p className="text-xs text-muted">
                Full plant path: Create Batch → RM QC → Issue Material → Manufacture → IPQC /
                Visual → Pack / Seal → ETO → Label → Sterility / BET → QA Release → Finished Goods
                → Dispatch.
              </p>
            </div>
          )}

          {tab === 'abbreviations' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Abbreviations used in this system. Items marked for your role appear first.
              </p>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-50 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Abbreviation</th>
                      <th className="px-3 py-2 font-semibold">Full form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...guide.relatedAbbr.map((a) => ({
                        abbr: a,
                        fullForm: ABBREVIATIONS[a] ?? a,
                        highlight: true,
                      })),
                      ...ABBREVIATION_LIST.filter((a) => !guide.relatedAbbr.includes(a.abbr)).map(
                        (a) => ({ ...a, highlight: false }),
                      ),
                    ].map((row) => (
                      <tr
                        key={row.abbr}
                        className={`border-t border-line ${row.highlight ? 'bg-emerald-50/60' : ''}`}
                      >
                        <td className="px-3 py-2 font-semibold text-brand-950">{row.abbr}</td>
                        <td className="px-3 py-2 text-ink">{row.fullForm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-brand-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={() => finish(false)}
            className="rounded-md px-3 py-2 text-sm text-muted hover:text-ink"
          >
            {firstTime ? 'Skip for now' : 'Close'}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => finish(false)}
              className="rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-brand-900 hover:bg-white"
            >
              I understand
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              className="rounded-md bg-brand-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              Start UI tour
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
