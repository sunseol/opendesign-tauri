import { describe, expect, it } from 'vitest';

import { deriveUploadCohort } from '../../src/analytics/upload-tracking';

type UploadFixture = {
  readonly name: string;
  readonly type: string;
  readonly size: number;
};

function makeFile(name: string, type: string, size: number): UploadFixture {
  return { name, type, size };
}

describe('deriveUploadCohort', () => {
  it('classifies a homogeneous image batch as image', () => {
    const cohort = deriveUploadCohort([
      makeFile('a.png', 'image/png', 1024),
      makeFile('b.jpg', 'image/jpeg', 2048),
    ]);
    expect(cohort).toEqual({
      file_count: 2,
      file_type: 'image',
      file_size_bucket: '0_1mb',
    });
  });

  it('detects zip by MIME or extension', () => {
    expect(
      deriveUploadCohort([makeFile('bundle.zip', 'application/zip', 500)])
        .file_type,
    ).toBe('zip');
    expect(
      deriveUploadCohort([
        makeFile('bundle.ZIP', '', 500),
        makeFile('also.zip', 'application/octet-stream', 500),
      ]).file_type,
    ).toBe('zip');
  });

  it('collapses mixed-type batches to other', () => {
    const cohort = deriveUploadCohort([
      makeFile('a.png', 'image/png', 100),
      makeFile('b.pdf', 'application/pdf', 100),
    ]);
    expect(cohort.file_type).toBe('other');
  });

  it('buckets total bytes across upload thresholds', () => {
    const mb = 1024 * 1024;
    const cases = [
      { total: mb - 1, bucket: '0_1mb' },
      { total: mb, bucket: '1_10mb' },
      { total: 10 * mb - 1, bucket: '1_10mb' },
      { total: 10 * mb, bucket: '10_100mb' },
      { total: 100 * mb - 1, bucket: '10_100mb' },
      { total: 100 * mb, bucket: '100mb_plus' },
    ] as const;
    for (const { total, bucket } of cases) {
      const cohort = deriveUploadCohort([
        makeFile('blob.bin', 'application/octet-stream', total),
      ]);
      expect(cohort.file_size_bucket, `total=${total}`).toBe(bucket);
    }
  });

  it('handles empty or zero-metadata batches defensively', () => {
    expect(deriveUploadCohort([])).toEqual({
      file_count: 0,
      file_type: 'other',
      file_size_bucket: '0_1mb',
    });
    expect(deriveUploadCohort([makeFile('x', '', 0)])).toEqual({
      file_count: 1,
      file_type: 'other',
      file_size_bucket: '0_1mb',
    });
  });
});
