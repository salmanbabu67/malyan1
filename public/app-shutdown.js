// Shutdown server when browser/app closes
function shutdownServer() {
  console.log(' Sending shutdown signal to server...');
  try {
    const sent = navigator.sendBeacon(`${API_BASE}/shutdown`);
    console.log('Beacon sent:', sent);
  } catch (error) {
    console.error('Error sending shutdown:', error);
  }
}

window.addEventListener('beforeunload', shutdownServer);
window.addEventListener('unload', shutdownServer);
