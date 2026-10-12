const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('../app.config.js');

test('staging APK has a separate identity and HTTPS backend', () => {
  const previous = { ...process.env };
  try {
    process.env.APP_VARIANT = 'staging';
    process.env.EAS_BUILD_PROFILE = 'staging';
    for (const value of ['', 'http://example.com', 'https://localhost', 'https://example.com/api', 'https://example.com/?token=bad']) {
      process.env.EXPO_PUBLIC_BACKEND_URL = value;
      assert.throws(config);
    }
    process.env.EXPO_PUBLIC_BACKEND_URL = 'https://staging.example.com';
    const result = config();
    assert.equal(result.name, 'DawaiSathi Staging');
    assert.ok(result.android.package.endsWith('.staging'));
    assert.equal(result.extra.backendUrl, 'https://staging.example.com');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
