import { describe, expect, it } from 'vitest';
import { authError, authErrorText, normalizeUsername, profileError, USERNAME_PATTERN } from './authErrors';

describe('authErrorText', () => {
  it('explains known error codes in plain words', () => {
    expect(authErrorText({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Wrong email or password.');
    expect(authErrorText(authError('user_already_exists'))).toMatch(/already exists/);
    expect(authErrorText({ code: 'weak_password', message: 'Password should be at least 6 characters.' })).toMatch(/at least 8/);
  });

  it('reads older errors without a code from their message', () => {
    expect(authErrorText(new Error('Invalid login credentials'))).toBe('Wrong email or password.');
    expect(authErrorText(new Error('Email not confirmed'))).toMatch(/Confirm your email/);
  });

  it('turns network failures into a connection hint', () => {
    expect(authErrorText(new TypeError('Failed to fetch'))).toMatch(/Could not reach the server/);
  });

  it('keeps unknown messages and never returns nothing', () => {
    expect(authErrorText(new Error('Something odd'))).toBe('Something odd');
    expect(authErrorText(null)).toBe('Something went wrong. Try again.');
    expect(authErrorText({ code: 'not_a_code' })).toBe('Something went wrong. Try again.');
  });
});

describe('usernames', () => {
  it('are stored trimmed and in lower case, and follow the database rule', () => {
    expect(normalizeUsername('  Hariom-Admin ')).toBe('hariom-admin');
    expect(USERNAME_PATTERN.test('hariom-admin')).toBe(true);
    expect(USERNAME_PATTERN.test('ab')).toBe(false);
    expect(USERNAME_PATTERN.test('has space')).toBe(false);
    expect(USERNAME_PATTERN.test('a'.repeat(21))).toBe(false);
  });

  it('explain database errors in plain words', () => {
    expect(authErrorText(profileError({ code: '23505', message: 'duplicate key' }))).toMatch(/taken/);
    expect(authErrorText(profileError({ code: 'P0001', message: 'too_many_attempts' }))).toMatch(/15 minutes/);
    expect(authErrorText(profileError({ code: 'PGRST202', message: 'Could not find the function' }))).toMatch(/not set up/);
    expect(authErrorText(profileError({ code: 'XX000', message: 'odd' }))).toBe('odd');
  });
});
