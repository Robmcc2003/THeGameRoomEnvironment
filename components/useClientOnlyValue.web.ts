import React from 'react';

// I defer to the client value after mount so we can tell server from client (useEffect does not run on the server).
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  const [value, setValue] = React.useState<S | C>(server);
  React.useEffect(() => {
    setValue(client);
  }, [client]);

  return value;
}
