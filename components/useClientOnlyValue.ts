// I am the web implementation: I return the client value directly since native does not use server rendering.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}
