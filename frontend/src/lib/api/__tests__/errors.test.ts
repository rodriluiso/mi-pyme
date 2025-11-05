import type { AxiosError } from 'axios';
import { normalizeApiError } from '@/lib/api/errors';

describe('normalizeApiError', () => {
  it('normalizes axios response errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 400,
        data: { message: 'Bad request', details: ['invalid payload'] }
      }
    } as AxiosError;

    const normalized = normalizeApiError(error);

    expect(normalized).toMatchObject({
      message: 'Bad request',
      status: 400,
      data: { message: 'Bad request', details: ['invalid payload'] }
    });
  });

  it('normalizes unknown errors', () => {
    const normalized = normalizeApiError(new Error('boom'));

    expect(normalized).toEqual({
      message: 'boom',
      status: undefined,
      data: undefined,
      isNetworkError: false
    });
  });
});
