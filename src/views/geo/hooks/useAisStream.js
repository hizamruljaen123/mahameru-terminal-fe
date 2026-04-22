import { createSignal, onCleanup } from 'solid-js';

export function useAisStream() {
  const [liveShips, setLiveShips] = createSignal({});
  const [isConnected, setIsConnected] = createSignal(false);
  let socket = null;

  const connect = (bbox) => {
    if (socket) socket.close();

    const wsUrl = import.meta.env.VITE_AIS_API.replace('http', 'ws') + '/ws/ships';
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      setIsConnected(true);
      socket.send(JSON.stringify({
        type: 'subscribe',
        bbox: bbox
      }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'initial') {
        const ships = {};
        msg.data.forEach(s => ships[s.mmsi] = s);
        setLiveShips(ships);
      } else if (msg.type === 'update') {
        setLiveShips(prev => ({ ...prev, [msg.data.mmsi]: msg.data }));
      }
    };

    socket.onclose = () => setIsConnected(false);
    socket.onerror = (err) => console.error("AIS WebSocket error", err);
  };

  const disconnect = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
    setIsConnected(false);
  };

  onCleanup(() => disconnect());

  return { liveShips, isConnected, connect, disconnect, setLiveShips };
}
