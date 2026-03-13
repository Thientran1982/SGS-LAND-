import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";

// Module-level singleton — shared across all components
export const socket: Socket = io({
  autoConnect: false,
});

// Reference counter: track how many components are using the socket
// Only connect on first mount (0→1), only disconnect on last unmount (1→0)
let _mountCount = 0;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    _mountCount += 1;
    if (_mountCount === 1) {
      socket.connect();
    }

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      _mountCount -= 1;
      if (_mountCount === 0) {
        socket.disconnect();
      }
    };
  }, []);

  return { isConnected, socket };
}
