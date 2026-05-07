import { SupportService } from './support.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

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
    const service = new SupportService();
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
    const service = new SupportService();

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
  });
});
