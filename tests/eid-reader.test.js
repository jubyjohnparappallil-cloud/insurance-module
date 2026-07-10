const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEidCardData } = require('../eid-reader');

test('parses a sample Emirates ID MRZ payload', () => {
  const sample = {
    mrz: ['P<AREALHASSAN<<MOHAMMED<<<<<<<<<<<<<<<<<<', '78412345678902ARE9501011M2501016<<<<<<<<<']
  };

  const result = parseEidCardData(sample);
  assert.equal(result.emiratesId, '784-1234-567890-2');
  assert.equal(result.firstName, 'MOHAMMED');
  assert.equal(result.lastName, 'AL HASSAN');
  assert.equal(result.dob, '01/Jan/1995');
  assert.equal(result.gender, 'Male');
  assert.equal(result.nationality, 'ARE');
});

test('normalizes a plain numeric ID into the expected format', () => {
  const result = parseEidCardData({ emiratesId: '784199912345678' });
  assert.equal(result.emiratesId, '784-1999-1234567-8');
});
