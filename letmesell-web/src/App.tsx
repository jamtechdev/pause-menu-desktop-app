import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { PageTransition } from './components/PageTransition';
import { Home } from './pages/Home';
import { Pricing } from './pages/Pricing';
import { Download } from './pages/Download';
import { Success } from './pages/Success';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import './App.css';
import './styles/animations.css';

function AppContent() {
  const location = useLocation();

  return (
    <div className="App">
      <Header />
      <main className="main-content">
        <PageTransition key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/download" element={<Download />} />
            <Route path="/success" element={<Success />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
