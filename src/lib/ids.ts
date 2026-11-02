import { randomUUID } from 'expo-crypto';

/** New random id for journal records and submission ids. */
export function newId() {
  return randomUUID();
}
