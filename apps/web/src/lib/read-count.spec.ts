import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CHAPTERS_READ_COUNT_EVENT,
  CHAPTERS_READ_COUNT_KEY,
  getChaptersReadCount,
  incrementChaptersReadCount,
} from './read-count';

class TestCustomEvent<T> extends Event {
  readonly detail: T;

  constructor(type: string, eventInitDict: CustomEventInit<T>) {
    super(type);
    this.detail = eventInitDict.detail as T;
  }
}

const stubWindow = (initialValue: string | null, setItem?: Storage['setItem']) => {
  const getItem = vi.fn<Storage['getItem']>().mockReturnValue(initialValue);
  const setItemMock = vi.fn<Storage['setItem']>(setItem ?? (() => undefined));
  const dispatchEvent = vi.fn<Window['dispatchEvent']>().mockReturnValue(true);

  vi.stubGlobal('window', {
    localStorage: {
      getItem,
      setItem: setItemMock,
    },
    dispatchEvent,
  });
  vi.stubGlobal('CustomEvent', TestCustomEvent);

  return { dispatchEvent, getItem, setItem: setItemMock };
};

describe('read-count', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns 0 when window is unavailable', () => {
    vi.stubGlobal('window', undefined);

    expect(getChaptersReadCount()).toBe(0);
  });

  it.each([
    ['missing value', null],
    ['non-numeric value', 'chapters'],
    ['NaN-like value', 'NaN'],
    ['zero value', '0'],
    ['negative value', '-3'],
  ])('returns 0 for %s', (_label, rawValue) => {
    const { getItem } = stubWindow(rawValue);

    expect(getChaptersReadCount()).toBe(0);
    expect(getItem).toHaveBeenCalledWith(CHAPTERS_READ_COUNT_KEY);
  });

  it.each([
    ['1', 1],
    ['7', 7],
    ['12 chapters', 12],
  ])('parses a positive persisted count from %s', (rawValue, expected) => {
    stubWindow(rawValue);

    expect(getChaptersReadCount()).toBe(expected);
  });

  it('increments the persisted count, dispatches the next count, and returns it', () => {
    const { dispatchEvent, setItem } = stubWindow('2');

    expect(incrementChaptersReadCount()).toBe(3);
    expect(setItem).toHaveBeenCalledWith(CHAPTERS_READ_COUNT_KEY, '3');
    expect(dispatchEvent).toHaveBeenCalledOnce();

    const event = dispatchEvent.mock.calls[0]?.[0];
    expect(event).toBeInstanceOf(TestCustomEvent);
    expect(event?.type).toBe(CHAPTERS_READ_COUNT_EVENT);
    expect((event as CustomEvent<number>).detail).toBe(3);
  });

  it('propagates write failures without dispatching a read-count event', () => {
    const writeError = new Error('localStorage write failed');
    const { dispatchEvent, setItem } = stubWindow('4', () => {
      throw writeError;
    });

    expect(() => incrementChaptersReadCount()).toThrow(writeError);
    expect(setItem).toHaveBeenCalledWith(CHAPTERS_READ_COUNT_KEY, '5');
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
