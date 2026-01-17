import { describe, it, expect } from 'vitest';
import { normalizeBookingType, normalizeBookingStatus } from '../trip-summary';

describe('normalizeBookingType', () => {
  it('identifies flight bookings', () => {
    expect(normalizeBookingType('flight')).toBe('flight');
    expect(normalizeBookingType('FLIGHT')).toBe('flight');
    expect(normalizeBookingType('air ticket')).toBe('flight');
    expect(normalizeBookingType('Airline')).toBe('flight');
  });

  it('identifies lodging bookings', () => {
    expect(normalizeBookingType('hotel')).toBe('lodging');
    expect(normalizeBookingType('HOTEL')).toBe('lodging');
    expect(normalizeBookingType('lodging')).toBe('lodging');
  });

  it('identifies car rentals', () => {
    expect(normalizeBookingType('car')).toBe('car');
    expect(normalizeBookingType('Car Rental')).toBe('car');
  });

  it('identifies tours and activities', () => {
    expect(normalizeBookingType('tour')).toBe('tour');
    expect(normalizeBookingType('activity')).toBe('tour');
    expect(normalizeBookingType('excursion')).toBe('tour');
    expect(normalizeBookingType('Day Excursion')).toBe('tour');
  });

  it('identifies cruises', () => {
    expect(normalizeBookingType('cruise')).toBe('cruise');
    expect(normalizeBookingType('CRUISE')).toBe('cruise');
  });

  it('identifies packages', () => {
    expect(normalizeBookingType('package')).toBe('package');
    expect(normalizeBookingType('Package Deal')).toBe('package');
  });

  it('returns other for unknown types', () => {
    expect(normalizeBookingType('unknown')).toBe('other');
    expect(normalizeBookingType('transfer')).toBe('other');
    expect(normalizeBookingType('')).toBe('other');
  });

  it('handles non-string values', () => {
    expect(normalizeBookingType(null)).toBe('other');
    expect(normalizeBookingType(undefined)).toBe('other');
    expect(normalizeBookingType(123)).toBe('other');
    expect(normalizeBookingType({})).toBe('other');
  });
});

describe('normalizeBookingStatus', () => {
  it('identifies confirmed statuses', () => {
    expect(normalizeBookingStatus('confirmed')).toBe('confirmed');
    expect(normalizeBookingStatus('CONFIRMED')).toBe('confirmed');
    expect(normalizeBookingStatus('booked')).toBe('confirmed');
    expect(normalizeBookingStatus('paid')).toBe('confirmed');
    expect(normalizeBookingStatus('ticketed')).toBe('confirmed');
  });

  it('identifies pending statuses', () => {
    expect(normalizeBookingStatus('pending')).toBe('pending');
    expect(normalizeBookingStatus('PENDING')).toBe('pending');
    expect(normalizeBookingStatus('hold')).toBe('pending');
    expect(normalizeBookingStatus('reserved')).toBe('pending');
    expect(normalizeBookingStatus('proposed')).toBe('pending');
  });

  it('identifies canceled statuses', () => {
    expect(normalizeBookingStatus('canceled')).toBe('canceled');
    expect(normalizeBookingStatus('cancelled')).toBe('canceled');
    expect(normalizeBookingStatus('void')).toBe('canceled');
  });

  it('returns null for unknown statuses', () => {
    expect(normalizeBookingStatus('unknown')).toBe(null);
    expect(normalizeBookingStatus('draft')).toBe(null);
    expect(normalizeBookingStatus('')).toBe(null);
  });

  it('handles non-string values', () => {
    expect(normalizeBookingStatus(null)).toBe(null);
    expect(normalizeBookingStatus(undefined)).toBe(null);
    expect(normalizeBookingStatus(123)).toBe(null);
    expect(normalizeBookingStatus({})).toBe(null);
  });
});
