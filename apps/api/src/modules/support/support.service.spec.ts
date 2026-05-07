import type { CacheClient } from '../cache/cache.constants';

import { SupportService } from './support.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

const buildService = (
  overrides?: Partial<CacheClient>,
): { service: SupportService; cache: CacheClient } => {
  const cache: CacheClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { service: new SupportService(cache), cache };
};

describe('SupportService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns delivered=false when env is unset', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPPORT_EMAIL;
    delete process.env.SUPPORT_FROM_EMAIL;
    const { service } = buildService();
    await expect(
      service.contact({
        name: 'Reader',
        email: 'reader@example.com',
        subject: 'Help',
        body: 'Question',
      }),
    ).resolves.toEqual({ delivered: false });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends via Resend with the configured FROM/TO when env is set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.SUPPORT_FROM_EMAIL = 'NovelHub Support <noreply@example.com>';
    sendMock.mockResolvedValue({ id: 'msg_1' });
    const { service, cache } = buildService();

    await expect(
      service.contact({
        name: 'Reader',
        email: 'reader@example.com',
        subject: 'Help me',
        body: 'I have a question.',
      }),
    ).resolves.toEqual({ delivered: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'NovelHub Support <noreply@example.com>',
        to: 'support@example.com',
        replyTo: 'reader@example.com',
        subject: '[NovelHub] Help me',
      }),
    );
    expect(cache.set).toHaveBeenCalledWith('support:contact:reader@example.com', 1, 24 * 60 * 60);
  });

  it('strips CR/LF from header-bound fields to prevent injection', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.SUPPORT_FROM_EMAIL = 'NovelHub Support <noreply@example.com>';
    sendMock.mockResolvedValue({ id: 'msg_1' });
    const { service } = buildService();

    await service.contact({
      name: 'Bad\r\nName',
      email: 'reader@example.com',
      subject: 'Subject\r\nBcc: leak@example.com',
      body: 'Body — \\r\\n staying intact in the body is fine.',
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[NovelHub] Subject Bcc: leak@example.com',
      }),
    );
    const text = sendMock.mock.calls[0][0].text as string;
    expect(text).toContain('Name: Bad Name');
  });

  it('rejects with 429 once a single email has exceeded the daily cap', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.SUPPORT_FROM_EMAIL = 'NovelHub Support <noreply@example.com>';
    sendMock.mockResolvedValue({ id: 'msg_1' });
    const { service } = buildService({
      get: jest.fn().mockResolvedValue(3),
    });

    await expect(
      service.contact({
        name: 'Reader',
        email: 'noisy@example.com',
        subject: 'Spam attempt',
        body: 'spam',
      }),
    ).rejects.toMatchObject({ status: 429 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('keys the email cache by lowercased trimmed address so case variants share a budget', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.SUPPORT_EMAIL = 'support@example.com';
    process.env.SUPPORT_FROM_EMAIL = 'NovelHub Support <noreply@example.com>';
    sendMock.mockResolvedValue({ id: 'msg_1' });
    const cacheGet = jest.fn().mockResolvedValue(null);
    const cacheSet = jest.fn().mockResolvedValue(undefined);
    const { service } = buildService({ get: cacheGet, set: cacheSet });

    await service.contact({
      name: 'Reader',
      email: '  Reader@Example.COM  ',
      subject: 'Help',
      body: 'body',
    });

    expect(cacheGet).toHaveBeenCalledWith('support:contact:reader@example.com');
    expect(cacheSet).toHaveBeenCalledWith('support:contact:reader@example.com', 1, 24 * 60 * 60);
  });
});
