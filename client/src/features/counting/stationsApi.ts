import { useQuery } from '@tanstack/react-query';
import { isCountableKind, type StationDto, type StationsResponse } from '@spoh/shared';
import { api } from '../../lib/api';

/** Active stations that have a counting screen (registration, counting, counselling). */
export function useCountableStations() {
  return useQuery({
    queryKey: ['stations'],
    queryFn: () => api<StationsResponse>('/stations'),
    select: (r): StationDto[] => r.stations.filter((s) => isCountableKind(s.kind)),
    staleTime: 60_000,
  });
}
