import { AppService } from './app.service';

describe('AppService', () => {
  it('reports the API health status', () => {
    expect(new AppService().getHealth()).toEqual({
      app: 'NovelHub',
      status: 'ok',
    });
  });
});
