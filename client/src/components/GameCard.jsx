import { Link } from 'react-router-dom';

export default function GameCard({ game }) {
  return (
    <Link to={`/play/${game.id}`} className="game-card glass">
      <div className="game-thumb" style={{ color: game.color }}>
        {game.icon}
        <div className="play-overlay">
          <button className="play-button">▶</button>
        </div>
      </div>
      <div className="game-info">
        <h3 className="game-title">{game.title}</h3>
        <p className="game-desc">{game.description}</p>
      </div>
    </Link>
  );
}
