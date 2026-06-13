import type {
  TrackingFileSizeBucket,
  TrackingFileType,
} from '@open-design/contracts/analytics';
import {
  fileSizeBucketToTracking,
  fileTypeToTracking,
} from '@open-design/contracts/analytics';

export interface UploadCohortFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export interface UploadCohort {
  readonly file_count: number;
  readonly file_type: TrackingFileType;
  readonly file_size_bucket: TrackingFileSizeBucket;
}

export function deriveUploadCohort(
  files: readonly UploadCohortFile[],
): UploadCohort {
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const perFileTrackingTypes = files.map((file) => {
    const mime = file.type ?? '';
    const name = file.name ?? '';
    const isZip =
      mime === 'application/zip' || name.toLowerCase().endsWith('.zip');
    return fileTypeToTracking({ mime, isFolder: false, isZip });
  });
  const uniqueTrackingTypes = new Set(perFileTrackingTypes);
  const fileType: TrackingFileType =
    uniqueTrackingTypes.size <= 1
      ? perFileTrackingTypes[0] ?? 'other'
      : 'other';
  return {
    file_count: files.length,
    file_type: fileType,
    file_size_bucket: fileSizeBucketToTracking(totalBytes),
  };
}
