import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import DispatchWorkspace from '../../../../src/components/DispatchWorkspace';

export default function BatchDispatchPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DispatchWorkspace batchId={String(id ?? '')} />;
}
