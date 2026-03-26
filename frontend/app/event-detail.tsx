import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import EventDetail from '@/components/explore/EventDetail';
import { useContextStore } from '@/store/context';

export default function EventDetailRoute() {
  const router = useRouter();
  const active_event = useContextStore((s) => s.active_event);

  useEffect(() => {
    if (!active_event) {
      router.replace('/(tabs)/explore');
    }
  }, [active_event]);

  if (!active_event) return null;

  return (
    <EventDetail
      event={{
        name: active_event.name,
        date: active_event.date,
        type: active_event.type,
        description: active_event.description,
      }}
    />
  );
}
