import React from 'react';
import { X, ExternalLink, Plus, Circle, ArrowRight, Shield, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { getControlParams } from '../../lib/api';
import { substituteParams } from '../../lib/params';

interface ControlDetailProps {
  node: any;
  rootControl: any;
  allMappings: any[];
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const STATUS_INFO: Record<string, { dot: string; label: string; bg: string; desc: string }> = {
  'implemented':            { dot: 'text-green-500', label: 'Implemented', bg: 'bg-green-50 border-green-200', desc: 'This control has been fully implemented.' },
  'partially-implemented':  { dot: 'text-amber-500', label: 'Partial', bg: 'bg-amber-50 border-amber-200', desc: 'This control has been partially implemented.' },
  'planned':                { dot: 'text-blue-500', label: 'Planned', bg: 'bg-blue-50 border-blue-200', desc: 'Implementation is planned but not yet started.' },
  'not-applicable':         { dot: 'text-gray-400', label: 'N/A', bg: 'bg-gray-50 border-gray-200', desc: 'This control is not applicable to the organization.' },
};
const DEFAULT_STATUS = { dot: 'text-red-400', label: 'Not Implemented', bg: 'bg-red-50 border-red-200', desc: 'This control has not been implemented yet.' };

const RELATIONSHIP_EXPLAIN: Record<string, { label: string; icon: string; plain: (source: string, target: string) => string }> = {
  equivalent: {
    label: 'Equivalent',
    icon: '\u2261',
    plain: (s, t) => `${s} and ${t} address the same requirement. Satisfying one effectively satisfies the other.`,
  },
  subset: {
    label: 'Subset',
    icon: '\u2282',
    plain: (s, t) => `${t} is a subset of ${s} \u2014 it covers part of what ${s} requires, but not all of it. You\u2019d need additional controls to fully satisfy ${s}.`,
  },
  superset: {
    label: 'Superset',
    icon: '\u2283',
    plain: (s, t) => `${t} is broader than ${s} \u2014 satisfying ${t} should also cover the requirements of ${s}.`,
  },
  related: {
    label: 'Related',
    icon: '~',
    plain: (s, t) => `${s} and ${t} cover related topics but aren\u2019t directly interchangeable. Review both to understand the overlap.`,
  },
  intersects: {
    label: 'Intersects',
    icon: '\u2229',
    plain: (s, t) => `${s} and ${t} partially overlap \u2014 some requirements are shared, but each also has unique elements the other doesn\u2019t cover.`,
  },
};

const CONFIDENCE_EXPLAIN: Record<string, string> = {
  high: 'This mapping is well-established \u2014 sourced from official publications or verified by a subject matter expert.',
  medium: 'This mapping is reasonable but may need review. It could be AI-suggested or inferred from similar controls.',
  low: 'This mapping is tentative \u2014 it may be a transitive inference or a weak match. Verify before relying on it for compliance.',
};

export default function ControlDetail({ node, rootControl, allMappings, onClose, onNavigate }: ControlDetailProps) {
  const navigate = useNavigate();

  const isRoot = node.isRoot || (node.control_id === rootControl.control_id && node.catalog_short_name === rootControl.catalog_short_name);
  const controlId = node.controlNativeId ?? node.control_id;
  const catalog = node.catalogShortName ?? node.catalog_short_name;
  const catalogName = node.catalogName ?? catalog;
  const title = node.title ?? controlId;

  // Fetch params for live substitution
  const { data: paramData } = useApi(
    () => catalog && controlId ? getControlParams(catalog, controlId).catch(() => []) : Promise.resolve([]),
    [catalog, controlId]
  );
  const description = substituteParams(node.description ?? '', paramData);
  const relationship = node.relationship ?? '';
  const confidence = node.confidence ?? '';
  const implStatus = node.implStatus ?? null;
  const implStatement = node.implStatement ?? null;
  const implId = node.implId ?? null;
  const via = node.via ?? null;
  const isTransitive = node.isTransitive ?? false;
  const status = STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS;

  const rootId = `${rootControl.catalog_short_name}:${rootControl.control_id}`;
  const thisId = `${catalog}:${controlId}`;

  const relInfo = RELATIONSHIP_EXPLAIN[relationship] ?? null;
  const confInfo = CONFIDENCE_EXPLAIN[confidence] ?? null;

  // For root: show all mappings. For non-root: show only contextually relevant ones.
  const contextMappings = isRoot
    ? allMappings
    : allMappings.filter((m: any) => {
        const mId = `${m.catalogShortName}:${m.controlNativeId}`;
        if (mId === thisId) return false;
        // Children of this node (transitive mappings through this control)
        if (m.via === thisId) return true;
        // Siblings: same parent (direct mappings that share the root)
        if (!isTransitive && !m.isTransitive) return true;
        // Sibling transitive nodes with same via
        if (isTransitive && m.isTransitive && m.via === via) return true;
        return false;
      });

  const contextLabel = isRoot
    ? `Direct & Transitive Mappings (${contextMappings.length})`
    : isTransitive
      ? `Sibling Mappings via ${via ?? 'parent'} (${contextMappings.length})`
      : `Co-mapped Controls (${contextMappings.length})`;

  return (
    <aside
      key={thisId}
      className="w-96 glass-panel flex flex-col shrink-0 animate-slide-right"
      style={{ borderRadius: 0, borderLeft: '1px solid var(--border-glass)' }}
      role="complementary"
      aria-label={`Details for ${catalog}:${controlId}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <h3 className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Control Detail</h3>
        <button
          onClick={onClose}
          className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          style={{ color: 'var(--text-dim)' }}
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Control identity */}
        <div>
          <p className="font-mono text-[13px] font-semibold text-indigo-400">{catalog}:{controlId}</p>
          <h4 className="text-[13px] font-medium leading-snug mt-1" style={{ color: 'var(--text-primary)' }}>{title}</h4>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{catalogName}</p>
        </div>

        {/* Description */}
        {description && (
          <div>
            <h5 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              <Shield className="h-3 w-3" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
              Control Requirement
            </h5>
            <p className="text-[12px] leading-relaxed rounded-lg p-3" style={{ color: 'var(--text-secondary)', background: 'var(--bg-glass-strong)', border: '1px solid var(--border-subtle)' }}>
              {description}
            </p>
          </div>
        )}

        {/* Relationship to root */}
        {!isRoot && (
          <div>
            <h5 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              <Link2 className="h-3 w-3" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
              Relationship to {rootId}
            </h5>
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              {/* Visual chain */}
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                <span className="font-mono font-medium text-indigo-400">{rootId}</span>
                <ArrowRight className="h-3 w-3 text-indigo-400/60 shrink-0" aria-hidden="true" />
                {isTransitive && via && (
                  <>
                    <span className="font-mono" style={{ color: 'var(--text-tertiary)' }}>{via}</span>
                    <ArrowRight className="h-3 w-3 text-indigo-400/60 shrink-0" aria-hidden="true" />
                  </>
                )}
                <span className="font-mono font-medium text-indigo-400">{thisId}</span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {relInfo && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full text-indigo-400" style={{ background: 'var(--bg-glass-strong)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <span aria-hidden="true">{relInfo.icon}</span> {relInfo.label}
                  </span>
                )}
                {isTransitive && (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full italic" style={{ color: 'var(--text-dim)', background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
                    transitive
                  </span>
                )}
                {confidence && (
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${
                    confidence === 'high' ? 'text-indigo-400' :
                    confidence === 'medium' ? 'text-amber-400' : ''
                  }`} style={{
                    background: 'var(--bg-glass-strong)',
                    border: `1px solid ${confidence === 'high' ? 'rgba(99,102,241,0.2)' : confidence === 'medium' ? 'rgba(245,158,11,0.2)' : 'var(--border-glass)'}`,
                    color: confidence === 'low' ? 'var(--text-dim)' : undefined,
                  }}>
                    {confidence} confidence
                  </span>
                )}
              </div>

              {/* Plain English */}
              {relInfo && (
                <p className="text-[12px] leading-relaxed mt-1" style={{ color: '#c7d2fe' }}>
                  {relInfo.plain(rootId, thisId)}
                </p>
              )}
              {confInfo && (
                <p className="text-[11px] leading-relaxed italic" style={{ color: '#a5b4fc' }}>
                  {confInfo}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Root explanation */}
        {isRoot && (
          <div className="rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This is the root control you're exploring. All other nodes on the graph are controls from other frameworks that map to this one &mdash; either directly or through transitive relationships.
            </p>
          </div>
        )}

        {/* Implementation status */}
        <div>
          <h5 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Implementation</h5>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-glass-strong)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="status-dot" style={{
                backgroundColor: (STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS).dot === 'text-green-500' ? '#4ade80' :
                  (STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS).dot === 'text-amber-500' ? '#fbbf24' :
                  (STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS).dot === 'text-blue-500' ? '#60a5fa' :
                  (STATUS_INFO[implStatus ?? ''] ?? DEFAULT_STATUS).dot === 'text-gray-400' ? '#9ca3af' : '#fb7185',
                boxShadow: `0 0 6px ${
                  implStatus === 'implemented' ? 'rgba(74,222,128,0.4)' :
                  implStatus === 'partially-implemented' ? 'rgba(251,191,36,0.4)' :
                  implStatus === 'planned' ? 'rgba(96,165,250,0.4)' : 'rgba(251,113,133,0.3)'
                }`,
              }} />
              <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{status.label}</span>
            </div>
            {implStatement && (
              <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{implStatement}</p>
            )}
            {!implStatement && (
              <p className="text-[11px] italic" style={{ color: 'var(--text-dim)' }}>{status.desc}</p>
            )}
          </div>

          {!implId && (
            <button
              onClick={() => navigate(`/implementations?catalog=${catalog}&control=${controlId}`)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-indigo-400 rounded-lg transition-colors"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add Implementation
            </button>
          )}
        </div>

        {/* Other mappings */}
        {contextMappings.length > 0 && (
          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
              {contextLabel}
            </h5>
            <ul className="space-y-0.5" role="list">
              {contextMappings.map((m: any, i: number) => {
                const mId = `${m.catalogShortName}:${m.controlNativeId}`;
                const mRel = RELATIONSHIP_EXPLAIN[m.relationship];
                return (
                  <li key={i}>
                    <button
                      onClick={() => onNavigate(mId)}
                      className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] transition-colors group"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--row-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="status-dot" style={{
                        width: 6, height: 6,
                        backgroundColor: m.implStatus === 'implemented' ? '#4ade80' : m.implStatus ? '#fbbf24' : '#fb7185',
                      }} />
                      <span className="font-mono truncate">{mId}</span>
                      {mRel && <span className="text-[9px] shrink-0" style={{ color: 'var(--text-dim)' }} title={m.relationship}>{mRel.icon}</span>}
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {contextMappings.length === 0 && !isRoot && (
          <div className="text-[12px] italic py-2" style={{ color: 'var(--text-dim)' }}>
            No other controls share a direct relationship with this node in the current resolve.
          </div>
        )}
      </div>
    </aside>
  );
}
