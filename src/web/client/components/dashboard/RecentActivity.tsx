import React from 'react';
import { Clock } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getRecentImplementations } from '../../lib/api';

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  'implemented': { text: 'Implemented', className: 'bg-green-100 text-green-700' },
  'partially-implemented': { text: 'Partial', className: 'bg-amber-100 text-amber-700' },
  'planned': { text: 'Planned', className: 'bg-blue-100 text-blue-700' },
  'not-applicable': { text: 'N/A', className: 'bg-gray-100 text-gray-600' },
  'not-implemented': { text: 'Not Impl.', className: 'bg-red-100 text-red-700' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RecentActivity() {
  const { data, loading } = useApi(() => getRecentImplementations(), []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">Loading...</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-gray-400">No recent activity</p>
      ) : (
        <ul className="space-y-2" role="list" aria-label="Recent implementation changes">
          {data.map((item: any) => {
            const statusInfo = STATUS_LABELS[item.status] ?? STATUS_LABELS['not-implemented'];
            return (
              <li key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${statusInfo.className}`}>
                    {statusInfo.text}
                  </span>
                  <span className="text-gray-700 truncate">
                    {item.catalog_short_name}:{item.control_id}
                  </span>
                </div>
                <time className="text-gray-400 shrink-0 ml-2" dateTime={item.updated_at}>
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
