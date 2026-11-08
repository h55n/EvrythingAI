import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(t, original, email = 'new@example.invalid') {
  const dir = mkdtempSync(join(tmpdir(), 'newsletter-subs-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyFileSync(new URL('../addsubscriber.js', import.meta.url), join(dir, 'addsubscriber.mjs'));
  const file = join(dir, 'subscribers.json');
  if (original !== undefined) writeFileSync(file, original);
  const result = spawnSync(process.execPath, [join(dir, 'addsubscriber.mjs'), email], { encoding: 'utf8' });
  return { result, content: readFileSync(file, 'utf8') };
}
for (const [name, original] of [
  ['malformed JSON', '{broken'], ['non-array JSON', '{"email":"old@example.invalid"}'],
  ['invalid record', '[{"email":23}]'], ['missing email', '[{}]'],
]) {
  test(`refuses ${name} without overwriting the subscriber list`, t => {
    const { result, content } = run(t, original);
    assert.notEqual(result.status, 0);
    assert.equal(content, original);
  });
}
test('a missing file starts a new subscriber list', t => {
  const { result, content } = run(t);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(content), [{ email: 'new@example.invalid' }]);
});
test('mixed legacy and object records retain their email addresses', t => {
  const { result, content } = run(t, '["old@example.invalid",{"email":"other@example.invalid"}]');
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(content).map(x => x.email), ['old@example.invalid', 'other@example.invalid', 'new@example.invalid']);
});
test('case-insensitive duplicates do not rewrite the file', t => {
  const original = '[{"email":"NEW@example.invalid"}]';
  const { result, content } = run(t, original);
  assert.equal(result.status, 0);
  assert.equal(content, original);
});
