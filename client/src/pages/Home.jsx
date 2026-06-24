import React from 'react';
import { games } from '../data/games';

export default function Home() {
  const game = games[0]; // Endless Runner

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 99999 }}>
      <iframe 
        src={game.path} 
        title={game.title}
        allow="fullscreen; autoplay"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      ></iframe>
    </div>
  );
}
