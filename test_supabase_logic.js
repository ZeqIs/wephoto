const assert = require('assert');
const app = require('./app.js');

console.log('Testing App helper functions for Supabase migration...');

// 1. Test Name Sanitization
assert.strictEqual(app.sanitizeName('John Doe'), 'JohnDoe');
assert.strictEqual(app.sanitizeName('  Sarah @#& Connor 123  '), 'SarahConnor123');
assert.strictEqual(app.sanitizeName(''), 'Guest');
assert.strictEqual(app.sanitizeName(null), 'Guest');
console.log('✔ sanitizeName tests passed.');

// 2. Test Session Code Generation
for (let i = 0; i < 20; i++) {
  const code = app.generateSessionCode(8);
  assert.strictEqual(code.length, 8);
  assert.match(code, /^[A-Z0-9]{8}$/);
}
console.log('✔ generateSessionCode tests passed.');

// 3. Test File Extension Detection
assert.strictEqual(app.getFileExtension({ name: 'my_wedding_photo.jpg', type: 'image/jpeg' }), 'jpg');
assert.strictEqual(app.getFileExtension({ name: 'clip.MP4', type: 'video/mp4' }), 'mp4');
assert.strictEqual(app.getFileExtension({ name: '', type: 'image/png' }), 'png');
assert.strictEqual(app.getFileExtension({ name: '', type: 'video/quicktime' }), 'mov');
console.log('✔ getFileExtension tests passed.');

// 4. Test Final Supabase Naming Convention
const sanitized = app.sanitizeName('Is & Mimi Fan');
const session = app.generateSessionCode(8);
const counter = 3;
const ext = app.getFileExtension({ name: 'dance.mov', type: 'video/quicktime' });
const fileName = `${sanitized}_${session}_${counter}.${ext}`;

assert.match(fileName, /^[A-Za-z0-9]+_[A-Z0-9]{8}_[1-5]\.[a-z0-9]+$/);
console.log(`✔ Naming convention pattern verified: ${fileName}`);

console.log('All automated tests passed successfully!');
