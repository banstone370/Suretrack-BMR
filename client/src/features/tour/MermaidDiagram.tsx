import { useEffect, useId, useRef, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/** Renders Mermaid (MIT open-source) diagrams client-side. */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const reactId = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function render() {
      setError('');
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            primaryColor: '#ecfdf5',
            primaryTextColor: '#0f172a',
            primaryBorderColor: '#0f766e',
            lineColor: '#64748b',
            secondaryColor: '#f8fafc',
            tertiaryColor: '#f1f5f9',
            fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
          },
          flowchart: {
            curve: 'basis',
            htmlLabels: true,
            nodeSpacing: 28,
            rankSpacing: 36,
            padding: 12,
          },
        });
        const id = `mermaid-${reactId}-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart.trim());
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Diagram failed to render');
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <p className="rounded-md border border-line bg-brand-50 px-3 py-2 text-sm text-muted">
        Diagram unavailable: {error}
      </p>
    );
  }

  return (
    <div
      ref={ref}
      className={className ?? 'overflow-x-auto rounded-lg border border-line bg-white p-3 [&_svg]:mx-auto [&_svg]:max-w-full'}
      aria-label="Workflow diagram"
    />
  );
}
