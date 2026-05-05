import { AppService } from './app.service';

describe('AppService', () => {
  it('uses the shared workspace package for the application name', () => {
    expect(new AppService().getApplicationName()).toBe('NovelHub');
  });

  it('reports the API health status', () => {
    expect(new AppService().getHealth()).toEqual({
      app: 'NovelHub',
      status: 'ok',
    });
  });
});
