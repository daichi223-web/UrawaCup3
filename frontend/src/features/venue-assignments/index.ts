// src/features/venue-assignments/index.ts
export { venueAssignmentApi } from './api';
export {
  useVenueAssignments,
  useVenueAssignment,
  useCreateVenueAssignment,
  useUpdateVenueAssignment,
  useDeleteVenueAssignment,
  useDeleteVenueAssignmentsByMatchDay,
  useAutoGenerateVenueAssignments,
} from './hooks';
export type {
  VenueAssignment,
  CreateVenueAssignmentInput,
  UpdateVenueAssignmentInput,
  AutoGenerateVenueAssignmentsInput,
  AutoGenerateResult,
} from './types';
