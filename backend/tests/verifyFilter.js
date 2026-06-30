import { isInteriorPhoto, filterInteriorPhotos } from '../src/utils/interiorImageFilter.js';
import assert from 'assert';

try {
  // Test blocklist
  assert.strictEqual(isInteriorPhoto({ alt: 'woman drinking coffee in cafe' }), false, 'Should block coffee');
  assert.strictEqual(isInteriorPhoto({ alt: 'fashion model posing with wallet' }), false, 'Should block fashion');
  assert.strictEqual(isInteriorPhoto({ alt: 'beautiful sunset over mountain' }), false, 'Should block mountain/sunset');

  // Test allowlist
  assert.strictEqual(isInteriorPhoto({ alt: 'modern minimalist living room interior with a sofa' }), true, 'Should allow living room');
  assert.strictEqual(isInteriorPhoto({ alt: 'cozy bedroom design with a bed and lamp' }), true, 'Should allow bedroom');

  // Test filter
  const photos = [
    { id: 1, alt: 'minimalist living room interior design', width: 800, height: 600 },
    { id: 2, alt: 'delicious breakfast food eggs coffee', width: 800, height: 600 },
    { id: 3, alt: 'modern bedroom cozy bed design', width: 800, height: 600 },
  ];
  const filtered = filterInteriorPhotos(photos);
  assert.strictEqual(filtered.length, 2, 'Should keep exactly 2 photos');
  assert.strictEqual(filtered[0].id, 1, 'First photo should be living room');
  assert.strictEqual(filtered[1].id, 3, 'Second photo should be bedroom');

  console.log('✅ All verification tests passed successfully!');
} catch (err) {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
}
