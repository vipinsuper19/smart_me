import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { UpdateLessonProgressDto } from './dto/update-lesson-progress.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

function constraintNames(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.keys(error.constraints ?? {}),
    ...constraintNames(error.children ?? []),
  ]);
}

describe('Content DTO validation', () => {
  it('applies pagination defaults and accepts explicit pages', async () => {
    const defaults = plainToInstance(PaginationQueryDto, {});
    await expect(validate(defaults)).resolves.toHaveLength(0);
    expect(defaults).toMatchObject({ page: 1, pageSize: 20 });

    const explicit = plainToInstance(ListCoursesQueryDto, {
      page: '2',
      pageSize: '50',
      learningPathId: 'path-id',
    });
    await expect(validate(explicit)).resolves.toHaveLength(0);
    expect(explicit).toMatchObject({ page: 2, pageSize: 50 });
  });

  it('rejects out-of-range pagination and blank path filters', async () => {
    for (const query of [{ page: 0 }, { pageSize: 0 }, { pageSize: 101 }, { page: 1.5 }]) {
      const dto = plainToInstance(PaginationQueryDto, query);
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    }

    const blankPath = plainToInstance(ListCoursesQueryDto, { learningPathId: '' });
    await expect(validate(blankPath)).resolves.not.toHaveLength(0);
  });

  it('accepts partial progress updates', async () => {
    const dto = plainToInstance(UpdateLessonProgressDto, {
      progressPercent: '75',
      lastBlockOrder: '4',
      timeSpentSeconds: '120',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      progressPercent: 75,
      lastBlockOrder: 4,
      timeSpentSeconds: 120,
    });
  });

  it('rejects invalid progress percentages, block indexes and time deltas', async () => {
    for (const body of [
      { progressPercent: -1 },
      { progressPercent: 101 },
      { progressPercent: 1.5 },
      { lastBlockOrder: -1 },
      { timeSpentSeconds: -1 },
      { timeSpentSeconds: 3_601 },
    ]) {
      const dto = plainToInstance(UpdateLessonProgressDto, body);
      const errors = await validate(dto);
      expect(constraintNames(errors).length).toBeGreaterThan(0);
    }
  });
});
