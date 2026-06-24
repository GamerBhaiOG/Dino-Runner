import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import GamePlayer from './pages/GamePlayer';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play/:id" element={<GamePlayer />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
