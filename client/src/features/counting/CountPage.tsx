import { useState } from 'react';
import type { StationDto } from '@spoh/shared';
import { Notice } from '../../components/ui';
import { CounsellingScreen } from './CounsellingScreen';
import { stationMemory } from './device';
import { FootfallScreen } from './FootfallScreen';
import { RegistrationScreen } from './RegistrationScreen';
import { StationPicker } from './StationPicker';
import { useCountableStations } from './stationsApi';

/**
 * /count: shows the right screen for the station this device counts for. Registration
 * and footfall are different screens with different endpoints (Rule 1).
 */
export function CountPage() {
  const stations = useCountableStations();
  const [stationId, setStationId] = useState(stationMemory.get);
  const [picking, setPicking] = useState(false);

  if (stations.isPending) return <p className="text-sm text-muted">Loading stations…</p>;
  if (stations.isError) {
    return <Notice tone="error">Couldn't load the stations. Check your connection.</Notice>;
  }

  const station = stations.data.find((s) => s.id === stationId);
  const choose = (s: StationDto) => {
    stationMemory.set(s.id);
    setStationId(s.id);
    setPicking(false);
  };

  // No choice yet, or the remembered station was closed or removed: ask again.
  if (!station || picking) {
    return (
      <StationPicker
        stations={stations.data}
        currentId={station?.id ?? null}
        onPick={choose}
        onCancel={station ? () => setPicking(false) : undefined}
      />
    );
  }

  const props = { station, onChangeStation: () => setPicking(true) };
  switch (station.kind) {
    case 'registration':
      return <RegistrationScreen key={station.id} {...props} />;
    case 'counselling':
      return <CounsellingScreen key={station.id} {...props} />;
    default:
      return <FootfallScreen key={station.id} {...props} />;
  }
}
