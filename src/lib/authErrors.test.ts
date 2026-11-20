import { describe, expect, it } from 'vitest';
import { authError, authErrorText } from './authErrors';

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
