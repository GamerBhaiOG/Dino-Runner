import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import GamePlayer from './pages/GamePlayer';

function App() {
  return (
    <BrowserRouter>
      <nav className="navbar">
        <Link to="/" className="logo">
          🎮 <span>Nexus</span>Play
        </Link>
      </nav>
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:id" element={<GamePlayer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
