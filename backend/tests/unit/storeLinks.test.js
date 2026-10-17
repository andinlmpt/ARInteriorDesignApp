import { describe, test, expect } from '@jest/globals';
import {
  normalizeEmail,
  normalizePhone,
  normalizeSocial,
  normalizeWebsite,
  toPublicStore,
} from '../../src/services/storeLinks.js';

describe('store links for "Where to buy"', () => {
  test('websites get https and must look like a domain', () => {
    expect(normalizeWebsite('bluecoral.ph')).toBe('https://bluecoral.ph/');
    expect(normalizeWebsite('https://shopee.ph/bluecoral')).toBe('https://shopee.ph/bluecoral');
    expect(normalizeWebsite('  www.bluecoral.ph/shop ')).toBe('https://www.bluecoral.ph/shop');
    expect(normalizeWebsite('blue coral')).toBe('');
    expect(normalizeWebsite('localhost')).toBe('');
    expect(normalizeWebsite('')).toBe('');
  });

  test('only http(s) links come out, whatever was typed', () => {
    expect(normalizeWebsite('javascript:alert(1)')).toBe('');
    expect(normalizeSocial('javascript:alert(1)', 'facebook.com')).toBe('');
    expect(normalizeSocial('intent://scan#Intent;end', 'facebook.com')).toBe('');
    expect(normalizeWebsite('ftp://bluecoral.ph')).toBe('');
  });

  test('Facebook accepts a page URL, the address without https, or a handle', () => {
    expect(normalizeSocial('https://www.facebook.com/BlueCoralPH', 'facebook.com')).toBe('https://www.facebook.com/BlueCoralPH');
    expect(normalizeSocial('facebook.com/BlueCoralPH', 'facebook.com')).toBe('https://facebook.com/BlueCoralPH');
    expect(normalizeSocial('m.facebook.com/BlueCoralPH', 'facebook.com')).toBe('https://m.facebook.com/BlueCoralPH');
    expect(normalizeSocial('fb.com/BlueCoralPH', 'facebook.com')).toBe('https://fb.com/BlueCoralPH');
    expect(normalizeSocial('@BlueCoralPH', 'facebook.com')).toBe('https://www.facebook.com/BlueCoralPH');
    expect(normalizeSocial('BlueCoralPH', 'facebook.com')).toBe('https://www.facebook.com/BlueCoralPH');
    expect(normalizeSocial('Blue Coral Furniture', 'facebook.com')).toBe('');
  });

  test('Instagram handles become profile links', () => {
    expect(normalizeSocial('@bluecoral.ph', 'instagram.com')).toBe('https://www.instagram.com/bluecoral.ph');
    expect(normalizeSocial('instagram.com/bluecoral.ph/', 'instagram.com')).toBe('https://instagram.com/bluecoral.ph/');
  });

  test('phone numbers keep their digits (and a leading +)', () => {
    expect(normalizePhone('0961 375 1520')).toBe('09613751520');
    expect(normalizePhone('+63 961-375-1520')).toBe('+639613751520');
    expect(normalizePhone('call us')).toBe('');
    expect(normalizePhone('123')).toBe('');
  });

  test('emails need a name, an @ and a domain', () => {
    expect(normalizeEmail('shop@bluecoral.ph')).toBe('shop@bluecoral.ph');
    expect(normalizeEmail('shop@bluecoral')).toBe('');
  });

  test('a populated store becomes the public "Where to buy" block', () => {
    const req = { protocol: 'http', headers: { host: '192.168.18.59:3000' } };
    const store = {
      _id: { toString: () => 'abc123' },
      name: 'Blue coral',
      city: 'Malolos',
      logoUrl: '/uploads/stores/blue.png',
      website: 'bluecoral.ph',
      facebook: '@BlueCoralPH',
      instagram: '',
      phone: '0961 375 1520',
      email: 'not an email',
    };
    const result = toPublicStore(store, req);
    expect(result).toMatchObject({
      id: 'abc123',
      name: 'Blue coral',
      city: 'Malolos',
      website: 'https://bluecoral.ph/',
      facebook: 'https://www.facebook.com/BlueCoralPH',
      instagram: '',
      phone: '09613751520',
      email: '',
    });
    expect(result.logoUrl.endsWith('/uploads/stores/blue.png')).toBe(true);
  });

  test('no store, or a store id that was not populated, gives null', () => {
    expect(toPublicStore(null)).toBeNull();
    expect(toPublicStore({ toString: () => 'abc' })).toBeNull();
  });
});
