import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { httpLogLevel } from '../src/http-logger.js';

describe('HTTP request logging', () => {
  test('selects a log level from the final HTTP status', () => {
    assert.equal(httpLogLevel(200), 'info');
    assert.equal(httpLogLevel(399), 'info');
    assert.equal(httpLogLevel(400), 'warn');
    assert.equal(httpLogLevel(499), 'warn');
    assert.equal(httpLogLevel(500), 'error');
  });
});
