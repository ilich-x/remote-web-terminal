import React, { useEffect } from 'react';
import './App.css';
// import { WebSocketDemo } from './components/ws';
import { WebSocketDemo } from './components/cmdWithInputController';

function App() {
  let socket;
  // useEffect(() => {
  //   socket = new WebSocket('ws://localhost:8080');

  //   return () => {
  //     socket.close();
  //   };
  // }, []);

  return (
    <div className="App">
      {/* <input type="text" onChange={() => {}} /> */}
      <WebSocketDemo />
    </div>
  );
}

export default App;
