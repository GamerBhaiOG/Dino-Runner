import { games } from '../data/games';
import GameCard from '../components/GameCard';

export default function Home() {
  return (
    <div className="container">
      <h1>Game Universe</h1>
      <p>Select a game below to start playing instantly in your browser. No downloads, no data saved.</p>
      
      <div className="games-grid">
        {games.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
