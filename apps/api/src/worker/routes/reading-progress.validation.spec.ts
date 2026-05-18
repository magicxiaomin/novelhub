import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ListProgressDto } from '../../modules/reading-progress/dto/list-progress.dto';
import { SaveProgressDto } from '../../modules/reading-progress/dto/save-progress.dto';
import { listProgressQuerySchema, saveProgressBodySchema } from './user.schemas';

const uuidV4 = '123e4567-e89b-42d3-a456-426614174000';
const uuidV1 = '123e4567-e89b-12d3-a456-426614174000';

describe('Worker reading-progress validation parity', () => {
  it('rejects unknown save body keys while the current Nest DTO constraints still accept only documented fields', () => {
    const body = { chapterId: uuidV4, scrollPercent: 50, extra: 'reject-me' };

    expect(saveProgressBodySchema.safeParse(body).success).toBe(false);

    const nestErrors = validateSync(plainToInstance(SaveProgressDto, body));
    expect(nestErrors).toHaveLength(0);
    expect(Object.keys(new SaveProgressDto())).not.toContain('extra');
  });

  it('rejects unknown list query keys while the current Nest DTO constraints still accept only documented fields', () => {
    const query = { bookId: uuidV4, extra: 'reject-me' };

    expect(listProgressQuerySchema.safeParse(query).success).toBe(false);

    const nestErrors = validateSync(plainToInstance(ListProgressDto, query));
    expect(nestErrors).toHaveLength(0);
    expect(Object.keys(new ListProgressDto())).not.toContain('extra');
  });

  it('matches Nest DTO uuid-v4 requirements for reading-progress identifiers', () => {
    const body = { chapterId: uuidV1, scrollPercent: 50 };
    const query = { chapterId: uuidV1 };

    expect(saveProgressBodySchema.safeParse(body).success).toBe(false);
    expect(listProgressQuerySchema.safeParse(query).success).toBe(false);
    expect(validateSync(plainToInstance(SaveProgressDto, body))).not.toHaveLength(0);
    expect(validateSync(plainToInstance(ListProgressDto, query))).not.toHaveLength(0);
  });

  it.each([-1, 101])('matches Nest DTO scrollPercent range rejection for %s', (scrollPercent) => {
    const body = { chapterId: uuidV4, scrollPercent };

    expect(saveProgressBodySchema.safeParse(body).success).toBe(false);
    expect(validateSync(plainToInstance(SaveProgressDto, body))).not.toHaveLength(0);
  });
});
