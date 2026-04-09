import { describe, it, expect } from 'vitest';

describe('base-adapter', () => {
  it('module loads without error', async () => {
    const mod = await import('../../../src/services/connectors/base-adapter.js');
    expect(mod.BaseAdapter).toBeDefined();
  });
});
