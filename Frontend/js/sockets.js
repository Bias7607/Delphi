let socket;
let trainSocket;

if (ioLoaded) {
    socket = io('https://aktier.ddns.net/data', {
        path: "/socket.io/data",
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 240000,
        pingTimeout: 120000,
        pingInterval: 25000,
        withCredentials: true
    });

    trainSocket = io('https://aktier.ddns.net/train', {
        path: "/socket.io/train",
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 240000,
        pingTimeout: 120000,
        pingInterval: 25000,
        withCredentials: true
    });

    miscSocket = io('https://aktier.ddns.net/misc', {
        path: "/socket.io/misc",
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 240000,
        pingTimeout: 120000,
        pingInterval: 25000,
        withCredentials: true
	});

} else {
    console.error(getTimestamp(), 'Socket.IO library failed to load from CDN and local fallback.');
    $('#errorMessage').text('Socket.IO library failed to load').show();
}