import test from 'node:test';
import assert from 'node:assert/strict';
import { revealDelay } from '../lib/config';
import { isHandheldDevice } from '../lib/device';

test('задержка появления не копится дольше 250 мс', () => {
  assert.equal(revealDelay(0), 0);
  assert.equal(revealDelay(1), 0.06);
  assert.equal(revealDelay(4), 0.24);
  assert.equal(revealDelay(12), 0.25);
});

test('установка PWA предлагается только карманным устройствам, не узкому окну ПК', () => {
  assert.equal(isHandheldDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5), true);
  assert.equal(isHandheldDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), true);
  assert.equal(isHandheldDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l', 5), true);
  assert.equal(isHandheldDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), false);
  assert.equal(isHandheldDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 10), false);
});
