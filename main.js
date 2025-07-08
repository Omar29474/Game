const firebaseConfig = {
  apiKey: "AIzaSyB5vpCFsbNCF7EJaCCiL6iNRIa8A35KLWA",
  authDomain: "dinomultiplayer.firebaseapp.com",
  databaseURL: "https://dinomultiplayer-default-rtdb.firebaseio.com",
  projectId: "dinomultiplayer",
  storageBucket: "dinomultiplayer.firebasestorage.app",
  messagingSenderId: "559047416015",
  appId: "1:559047416015:web:dfb781a4855185fd6c7fba"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerId = null;
let username = "";
let playerRef = null;
let gameOver = false;
let cactusSpeed = 5;

const gameStateRef = db.ref("gameState");

setInterval(() => {
  if (!gameOver) cactusSpeed += 0.5;
}, 10000);

function registerPlayer() {
  username = document.getElementById("username").value.trim();
  if (!username) return alert("Enter your name first");

  playerId = Math.random().toString(36).substr(2, 9);
  playerRef = db.ref("players/" + playerId);

  playerRef.set({
    name: username,
    x: 50 + Math.random() * 500,
    bottom: 20,
    score: 0
  });

  playerRef.onDisconnect().remove();

  document.getElementById("join-btn").disabled = true;
  document.getElementById("waiting-text").style.display = "block";

  db.ref("players").once("value", (snap) => {
    if (snap.numChildren() === 1) {
      document.getElementById("host-controls").style.display = "block";
    }
  });

  listenForGameStart();
}

function startGameForEveryone() {
  gameStateRef.set("started");
}

function listenForGameStart() {
  gameStateRef.on("value", (snap) => {
    const state = snap.val();
    
    if (state === "started") {
      document.getElementById("start-screen").style.display = "none";
      document.getElementById("game").style.display = "block";
      setupMovement();
      listenToPlayers();
      updateScore();
      spawnCactus();
    } else if (state && state.startsWith("winner:")) {
      const [, winnerName, winnerScore] = state.split(":");
      showWinner(winnerName, winnerScore);
    }
  });
}

function setupMovement() {
  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "ArrowUp") jump();
  });
  document.addEventListener("touchstart", () => jump());
}

function jump() {
  playerRef.get().then((snap) => {
    if (!snap.exists()) return;
    playerRef.update({ bottom: 100 });
    setTimeout(() => {
      playerRef.update({ bottom: 20 });
    }, 800);
  });
}

function updateScore() {
  setInterval(() => {
    if (!gameOver)
      playerRef.get().then((snap) => {
        if (snap.exists()) {
          playerRef.update({ score: snap.val().score + 1 });
        }
      });
  }, 1000);
}

function listenToPlayers() {
  const playersDiv = document.getElementById("players");
  const scoreboard = document.getElementById("scoreboard");

  db.ref("players").on("value", (snapshot) => {
    playersDiv.innerHTML = "";
    scoreboard.innerHTML = "<strong>Scores:</strong><br>";

    const data = snapshot.val();
    if (data) {
      for (let id in data) {
        const player = data[id];
        const el = document.createElement("div");
        el.className = "player";
        el.style.left = player.x + "px";
        el.style.bottom = player.bottom + "px";

        const nameTag = document.createElement("div");
        nameTag.className = "name-tag";
        nameTag.innerText = player.name;

        el.appendChild(nameTag);
        playersDiv.appendChild(el);

        scoreboard.innerHTML += `${player.name}: ${player.score}<br>`;
      }
    }
  });
}

function spawnCactus() {
  function spawn() {
    if (gameOver) return;

    const cactus = document.createElement("div");
    cactus.className = "cactus";
    cactus.style.left = "800px";
    document.getElementById("game").appendChild(cactus);
    moveCactus(cactus);

    const delay = Math.max(1500, 3000 - cactusSpeed * 150);
    setTimeout(spawn, delay); // ← كل مرة ينتظر زمن مختلف حسب السرعة
  }

  spawn(); // أول مرة
}


function moveCactus(cactus) {
  const interval = setInterval(() => {
    if (!cactus || gameOver) return clearInterval(interval);

    let currentLeft = parseInt(cactus.style.left);
    cactus.style.left = (currentLeft - cactusSpeed) + "px";

    playerRef.get().then((snap) => {
      if (!snap.exists()) return;

      let val = snap.val();
      let dinoLeft = val.x;
      let dinoBottom = val.bottom;
      let cactusLeft = parseInt(cactus.style.left);

      if (Math.abs(dinoLeft - cactusLeft) < 40 && dinoBottom <= 40) {
        gameOver = true;
        playerRef.remove().then(() => {
          checkWinner();
        });
      }
    });

    if (currentLeft < -30) {
      cactus.remove();
      clearInterval(interval);
    }
  }, 50);
}

function checkWinner() {
  db.ref("players").once("value", (snap) => {
    const players = snap.val();
    const alivePlayers = players ? Object.keys(players) : [];

    if (alivePlayers.length === 1) {
      const winnerId = alivePlayers[0];
      const winnerRef = db.ref("players/" + winnerId);
      winnerRef.once("value", (winnerSnap) => {
        const winner = winnerSnap.val();
        if (winner) {
          db.ref("gameState").set("winner:" + winner.name + ":" + winner.score);
        }
      });
    }
  });
}

function showWinner(name, score) {
  const scoreboard = document.getElementById("scoreboard");
  scoreboard.innerHTML = `
    🏆 <strong>${name} wins the game!</strong><br>
    Final Score: ${score}<br><br>
  `;

  const restartBtn = document.createElement("button");
  restartBtn.innerText = "Restart Game";
  restartBtn.style.marginTop = "10px";
  restartBtn.onclick = restartGame;
  scoreboard.appendChild(restartBtn);
}

function restartGame() {
  db.ref("players").remove();
  db.ref("gameState").set("waiting").then(() => {
    location.reload();
  });
}
