import { useParams, Link, Navigate } from 'react-router-dom';
import { games } from '../data/games';

export default function GamePlayer() {
  const { id } = useParams();
  const game = games.find(g => g.id === id);

  if (!game) {
    return <Navigate to="/" />;
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <Link to="/" className="back-btn">
          <span>← Back to Games</span>
        </Link>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{game.title}</h2>
      </div>
      
      <div className="iframe-wrapper">
        <iframe 
          src={game.path} 
          title={game.title}
          allow="fullscreen; autoplay"
        ></iframe>
      </div>
    </div>
  );
}
