export function getApiUrl(): string {
  // If a valid remote URL was baked in at build time, use it
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Dynamic fallback for the browser
  if (typeof window !== 'undefined') {
    // If the user is actually on localhost (local development)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5001';
    }
    
    // Self-healing for production: If the environment variable was accidentally left as 'localhost',
    // but we are running on a remote server (e.g. 192.168.0.100), automatically assume the backend 
    // is on port 5001 of that same remote server.
    return `${window.location.protocol}//${window.location.hostname}:5001`;
  }
  
  return 'http://localhost:5001';
}
