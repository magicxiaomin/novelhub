import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateEpisodeDto } from './drama.dto';

describe('UpdateEpisodeDto', () => {
  it('rejects dramaId on episode update validation', async () => {
    const dto = plainToInstance(UpdateEpisodeDto, {
      dramaId: '11111111-1111-4111-8111-111111111111',
      title: 'Updated episode',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'dramaId',
          constraints: expect.objectContaining({
            whitelistValidation: 'property dramaId should not exist',
          }),
        }),
      ]),
    );
  });
});
