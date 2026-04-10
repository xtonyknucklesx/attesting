import type Database from 'better-sqlite3';

export interface OnboardingState {
  current_stage: number;
  completed_stages: number[];
  skipped_stages: number[];
  org_id?: string;
  selected_catalogs: string[];
  scope_ids: string[];
  asset_ids: string[];
  owner_ids: string[];
  risk_ids: string[];
  connector_ids: string[];
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { num: 1, name: 'Organization Setup' },
  { num: 2, name: 'Select Frameworks' },
  { num: 3, name: 'Define Scopes' },
  { num: 4, name: 'Register Assets' },
  { num: 5, name: 'Assign Owners' },
  { num: 6, name: 'Initial Risk Posture' },
  { num: 7, name: 'Connect Threat Feeds' },
  { num: 8, name: 'Review & Launch' },
];

export { STAGES };

/**
 * Ensure the onboarding_state table exists.
 */
function ensureTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS onboarding_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_stage INTEGER DEFAULT 1,
      completed_stages TEXT DEFAULT '[]',
      skipped_stages TEXT DEFAULT '[]',
      org_id TEXT,
      selected_catalogs TEXT DEFAULT '[]',
      scope_ids TEXT DEFAULT '[]',
      asset_ids TEXT DEFAULT '[]',
      owner_ids TEXT DEFAULT '[]',
      risk_ids TEXT DEFAULT '[]',
      connector_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

/** Get current onboarding state (creates if not exists). */
export function getState(db: Database.Database): OnboardingState {
  ensureTable(db);

  let row = db.prepare('SELECT * FROM onboarding_state WHERE id = 1').get() as any;

  if (!row) {
    db.prepare(
      'INSERT INTO onboarding_state (id) VALUES (1)'
    ).run();
    row = db.prepare('SELECT * FROM onboarding_state WHERE id = 1').get() as any;
  }

  return {
    current_stage: row.current_stage,
    completed_stages: JSON.parse(row.completed_stages ?? '[]'),
    skipped_stages: JSON.parse(row.skipped_stages ?? '[]'),
    org_id: row.org_id,
    selected_catalogs: JSON.parse(row.selected_catalogs ?? '[]'),
    scope_ids: JSON.parse(row.scope_ids ?? '[]'),
    asset_ids: JSON.parse(row.asset_ids ?? '[]'),
    owner_ids: JSON.parse(row.owner_ids ?? '[]'),
    risk_ids: JSON.parse(row.risk_ids ?? '[]'),
    connector_ids: JSON.parse(row.connector_ids ?? '[]'),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Mark a stage as completed and advance. */
export function completeStage(
  db: Database.Database,
  stage: number,
  data?: Partial<OnboardingState>,
): void {
  ensureTable(db);
  const state = getState(db);

  const completed = new Set(state.completed_stages);
  completed.add(stage);

  const updates: string[] = [
    'completed_stages = ?',
    'current_stage = ?',
    "updated_at = datetime('now')",
  ];
  const params: unknown[] = [
    JSON.stringify([...completed].sort()),
    Math.max(stage + 1, state.current_stage),
  ];

  if (data?.org_id) { updates.push('org_id = ?'); params.push(data.org_id); }
  if (data?.selected_catalogs) { updates.push('selected_catalogs = ?'); params.push(JSON.stringify(data.selected_catalogs)); }
  if (data?.scope_ids) { updates.push('scope_ids = ?'); params.push(JSON.stringify(data.scope_ids)); }
  if (data?.asset_ids) { updates.push('asset_ids = ?'); params.push(JSON.stringify(data.asset_ids)); }
  if (data?.owner_ids) { updates.push('owner_ids = ?'); params.push(JSON.stringify(data.owner_ids)); }
  if (data?.risk_ids) { updates.push('risk_ids = ?'); params.push(JSON.stringify(data.risk_ids)); }
  if (data?.connector_ids) { updates.push('connector_ids = ?'); params.push(JSON.stringify(data.connector_ids)); }

  db.prepare(`UPDATE onboarding_state SET ${updates.join(', ')} WHERE id = 1`).run(...params);
}

/** Mark a stage as skipped. */
export function skipStage(db: Database.Database, stage: number): void {
  ensureTable(db);
  const state = getState(db);
  const skipped = new Set(state.skipped_stages);
  skipped.add(stage);

  db.prepare(`
    UPDATE onboarding_state
    SET skipped_stages = ?, current_stage = ?, updated_at = datetime('now')
    WHERE id = 1
  `).run(JSON.stringify([...skipped].sort()), Math.max(stage + 1, state.current_stage));
}

/** Check if onboarding is complete (all stages completed or skipped except stage 1). */
export function isOnboardingComplete(db: Database.Database): boolean {
  const state = getState(db);
  const done = new Set([...state.completed_stages, ...state.skipped_stages]);
  // Stage 1 (org) is required; stages 2-7 can be completed or skipped; stage 8 is review
  return done.has(1) && state.current_stage > 8;
}

/** Reset onboarding state. */
export function resetOnboarding(db: Database.Database): void {
  ensureTable(db);
  db.prepare('DELETE FROM onboarding_state WHERE id = 1').run();
}
