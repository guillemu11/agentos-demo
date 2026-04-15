import { describe, it, expect } from 'vitest';
import { addActivity, updateActivity, removeActivity, setEntrySource } from '../mutators.js';

const empty = () => ({ version: 1, name: 'T', entry: null, activities: [] });

describe('addActivity', () => {
  it('appends when after_id is null', () => {
    const dsl = addActivity(empty(), { activity: { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    expect(dsl.activities).toHaveLength(1);
    expect(dsl.activities[0].id).toBe('w1');
  });

  it('re-links the previous activity next to the new id', () => {
    let dsl = addActivity(empty(), { activity: { id: 'w1', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = addActivity(dsl, { activity: { id: 'w2', type: 'wait_duration', amount: 2, unit: 'days', next: null }, after_id: 'w1' });
    expect(dsl.activities.find((a) => a.id === 'w1').next).toBe('w2');
  });
});

describe('removeActivity', () => {
  it('removes and re-links neighbors', () => {
    let dsl = empty();
    dsl = addActivity(dsl, { activity: { id: 'a', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = addActivity(dsl, { activity: { id: 'b', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: 'a' });
    dsl = addActivity(dsl, { activity: { id: 'c', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: 'b' });
    dsl = removeActivity(dsl, { id: 'b' });
    expect(dsl.activities.find((a) => a.id === 'a').next).toBe('c');
    expect(dsl.activities.find((a) => a.id === 'b')).toBeUndefined();
  });
});

describe('updateActivity', () => {
  it('merges patch', () => {
    let dsl = empty();
    dsl = addActivity(dsl, { activity: { id: 'w', type: 'wait_duration', amount: 1, unit: 'days', next: null }, after_id: null });
    dsl = updateActivity(dsl, { id: 'w', patch: { amount: 5 } });
    expect(dsl.activities[0].amount).toBe(5);
  });
});

describe('setEntrySource', () => {
  it('writes entry.source', () => {
    const dsl = setEntrySource(empty(), { master_de: 'M', sql: 'SELECT 1 FROM M', target_de_name: 'T' });
    expect(dsl.entry.source.master_de_key).toBe('M');
    expect(dsl.entry.source.target_de_name).toBe('T');
  });
});
