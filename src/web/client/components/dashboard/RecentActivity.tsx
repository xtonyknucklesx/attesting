import React from 'react';
import { Clock } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getRecentImplementations } from '../../lib/api';

const STATUS_DOT_CLASS: Record<string, string> = {
  'implemented': 'status-dot-green',
  'partially-implemented': 'status-dot-amber',
  'planned': 'status-dot-blue',
  'not-applicable': 'status-dot-gray',
  'not-implemented': 'status-dot-rose',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RecentActivity() {
  const { data, loading } = useApi(() => getRecentImplementations(), []);

  return (
    <div className="glass-static rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4" style={{ color: 'var(--text-dim)' }} aria-hidden="true" />
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
      </div>
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-glass)' }} />)}</div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-6">
          <Clock className="h-6 w-6 mx-auto mb-2 text-indigo-400/20" aria-hidden="true" />
          <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>No recent activity</p>
        </div>
      ) : (
        <ul className="space-y-1" role="list" aria-label="Recent changes">
          {data.map((item: any) => (
            <li key={item.id} className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg transition-colors" style={{ ['--tw-bg-opacity' as string]: 1 }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`status-dot ${STATUS_DOT_CLASS[item.status] ?? 'status-dot-rose'}`} role="img" aria-label={item.status} />
                <span className="text-[12px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                  {item.catalog_short_name}:{item.control_id}
                </span>
              </div>
              <time className="text-[11px] shrink-0 ml-3" style={{ color: 'var(--text-dim)' }} dateTime={item.updated_at}>
                {timeAgo(item.updated_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
