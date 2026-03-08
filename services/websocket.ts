import { io, Socket } from "socket.io-client";
import { useEffect, useState } from "react";

// The socket connects to the same origin where the app is served
export const socket: Socket = io({
  autoConnect: false,
});

export function useSocket() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.connect();

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
      socket.disconnect();
    };
  }, []);

  return { isConnected, socket };
}
