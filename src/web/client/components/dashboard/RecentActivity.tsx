import React from 'react';
import { Clock, Circle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getRecentImplementations } from '../../lib/api';

const STATUS_DOT: Record<string, string> = {
  'implemented': 'text-green-500',
  'partially-implemented': 'text-amber-500',
  'planned': 'text-blue-500',
  'not-applicable': 'text-gray-400',
  'not-implemented': 'text-rose-400',
};

const STATUS_LABEL: Record<string, string> = {
  'implemented': 'Implemented',
  'partially-implemented': 'Partial',
  'planned': 'Planned',
  'not-applicable': 'N/A',
  'not-implemented': 'Not Impl.',
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
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold text-gray-900">Recent Activity</h3>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-5 bg-gray-50 rounded animate-pulse" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-6">
          <Clock className="h-6 w-6 mx-auto mb-2 text-gray-200" aria-hidden="true" />
          <p className="text-[12px] text-gray-400">No recent activity</p>
        </div>
      ) : (
        <ul className="space-y-1" role="list" aria-label="Recent changes">
          {data.map((item: any) => {
            const dot = STATUS_DOT[item.status] ?? STATUS_DOT['not-implemented'];
            return (
              <li key={item.id} className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Circle className={`h-2 w-2 fill-current shrink-0 ${dot}`} aria-label={STATUS_LABEL[item.status] ?? 'Unknown'} />
                  <span className="text-[12px] font-mono text-gray-700 truncate">
                    {item.catalog_short_name}:{item.control_id}
                  </span>
                </div>
                <time className="text-[11px] text-gray-400 shrink-0 ml-3" dateTime={item.updated_at}>
                  {timeAgo(item.updated_at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
