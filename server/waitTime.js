import { ApiError } from './validators.js';

// Estimated wait = number of people ahead × the service's expected duration
export function estimateWait(position, expectedDuration) {
  if (typeof position !== 'number' || Number.isNaN(position) || position < 0) {
    throw new ApiError(400, 'position must be a non-negative number');
  }
  if (typeof expectedDuration !== 'number' || Number.isNaN(expectedDuration) || expectedDuration <= 0) {
    throw new ApiError(400, 'expectedDuration must be a positive number');
  }

  return position * expectedDuration;
}
