let tempsInici = null;
let cronometreInterval = null;
let sessionId = null; // guardamos el id de la sesión actual en el cliente

// Iteració 3: objecte que guarda l'estat de la partida
let estatDeLaPartida = {
  contadorPreguntes: 0,
  respostesUsuari: [],
  total: 0
};

function iniciarCronometre() {
  tempsInici = Date.now();
  cronometreInterval = setInterval(actualitzarCronometre, 1000);
}

function aturarCronometre() {
  clearInterval(cronometreInterval);
}

function actualitzarCronometre() {
  const segonsTotals = Math.floor((Date.now() - tempsInici) / 1000);
  const minuts = String(Math.floor(segonsTotals / 60)).padStart(2, '0');
  const segons = String(segonsTotals % 60).padStart(2, '0');
  document.getElementById('cronometre').textContent = `${minuts}:${segons}`;
}

function actualitzarBarraProgres() {
  const percentatge = Math.round((estatDeLaPartida.contadorPreguntes / estatDeLaPartida.total) * 100);
  const barra = document.getElementById('barra-progres');
  barra.style.width = percentatge + '%';
  barra.textContent = percentatge + '%';
}

// Iteració 3: llegeix estatDeLaPartida i mostra un resum
function renderitzarMarcador() {
  document.getElementById('marcador').textContent =
    `Preguntes respostes: ${estatDeLaPartida.contadorPreguntes} de ${estatDeLaPartida.total}`;
}

// Una única llamada: el servidor crea la sesión Y devuelve ya las
// preguntas listas para pintar (sin respuesta correcta)
fetch('/nova-partida')
  .then(response => response.json())
  .then(data => {
    sessionId = data.sessionId;
    console.log("Sessió creada:", sessionId);
    console.log("Preguntes rebudes:", data.questions);

    iniciarPartida(data.questions);
    iniciarCronometre();
  });

function iniciarPartida(preguntas) {
  estatDeLaPartida.total = preguntas.length;

  let htmlstr = "";
  for (i = 0; i < preguntas.length; i++) {
    htmlstr += `

    <div class="container text-center mb-5">

      <div class="row">
        <div class="col-12">
          <img width="300px" src="${preguntas[i].imatge}">
        </div>
        <div class="col-12">
          <p class="fs-4 mt-2">${preguntas[i].pregunta}</p>
        </div>
      </div>

      <div class="row g-2">
        <div class="col-6">
          <div class="p-3"><button type="button" data-id-preg="${i}" data-id-resp="0" class="btnRespuesta btn btn-primary btn-lg w-100">${preguntas[i].respostes[0].etiqueta}</button></div>
        </div>
        <div class="col-6">
          <div class="p-3"><button type="button" data-id-preg="${i}" data-id-resp="1" class="btnRespuesta btn btn-primary btn-lg w-100">${preguntas[i].respostes[1].etiqueta}</button></div>
        </div>
        <div class="col-6">
          <div class="p-3"><button type="button" data-id-preg="${i}" data-id-resp="2" class="btnRespuesta btn btn-primary btn-lg w-100">${preguntas[i].respostes[2].etiqueta}</button></div>
        </div>
        <div class="col-6">
          <div class="p-3"><button type="button" data-id-preg="${i}" data-id-resp="3" class="btnRespuesta btn btn-primary btn-lg w-100">${preguntas[i].respostes[3].etiqueta}</button></div>
        </div>
      </div>

    </div>
    <hr>`
  }
  console.log(htmlstr);
  document.getElementById("partida").innerHTML = htmlstr;
}

estatDeLaPartida.respostesUsuari = new Array(10).fill(null);

function marcar(preg, resp) {
  console.log(" En la pregunta " + preg + " has marcado " + resp)

  if (estatDeLaPartida.respostesUsuari[preg] === null) {
    estatDeLaPartida.contadorPreguntes++;
  }
  estatDeLaPartida.respostesUsuari[preg] = {
    pr: preg,
    resp: resp
  }
  console.log(estatDeLaPartida.contadorPreguntes);

  actualitzarBarraProgres();
  renderitzarMarcador();

  if (estatDeLaPartida.contadorPreguntes === estatDeLaPartida.total) {
    aturarCronometre();
    document.getElementById("btnEnviarResultats").classList.remove("hidden");
  }
}

// Iteració 5: un únic listener al pare (#partida) en lloc d'un per botó (delegació d'esdeveniments)
document.getElementById("partida").addEventListener("click", function (e) {
  if (e.target.classList.contains("btnRespuesta")) {
    const preg = parseInt(e.target.dataset.idPreg, 10);
    const resp = parseInt(e.target.dataset.idResp, 10);
    marcar(preg, resp);
  }
});

// Iteració (servidor): enviem les respostes de l'usuari i mostrem la puntuació que torna el servidor
document.getElementById("btnEnviarResultats").addEventListener("click", function () {
  fetch(`/respostes/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respostes: estatDeLaPartida.respostesUsuari })
  })
    .then(response => response.json())
    .then(data => {
      // Oculta el joc (barra, cronòmetre, preguntes) i deixa només la puntuació,
      // com una pantalla final separada
      document.getElementById('zonaJoc').classList.add('hidden');
      document.getElementById('partida').classList.add('hidden');
      document.getElementById('btnEnviarResultats').classList.add('hidden');

      const marcador = document.getElementById('marcador');
      marcador.textContent = `Puntuació final: ${data.text}`;
      marcador.classList.add('fs-1', 'fw-bold', 'my-5');
    });
});

// Add Event Listener to window
window.addEventListener("load", function () {

    // Miro LS a veure si hi ha alguna cosa
    let nomLS = localStorage.getItem("nom");

    // si hi ha informacio al localstorage, posa el missatge de benvinguda i oculta la capsa de text
    if (nomLS != null) {
        document.getElementById("divBenvinguda").innerHTML = "Hola " + nomLS + " benvingut";
        document.getElementById("inputNom").style.display = "none";
        document.getElementById("btnGuardar").style.display = "none";
        document.getElementById("btnEsborrar").style.display = "block";
    } else {
        // Si no hi ha informacio al local storage, oculta el boto de "esborrar"
        document.getElementById("btnEsborrar").style.display = "none";
    }

    // posem un listener al boto guardar per guardar la informacio al localstorage i mostrar el missatge
    document.getElementById("btnGuardar").addEventListener("click", function () {
        let contingutCapsaText = document.getElementById("inputNom").value;

        localStorage.setItem("nom", contingutCapsaText);
        document.getElementById("divBenvinguda").innerHTML = "Hola " + contingutCapsaText + " benvingut";
        document.getElementById("inputNom").style.display = "none";
        document.getElementById("btnGuardar").style.display = "none";
        document.getElementById("btnEsborrar").style.display = "block";
    });

    // posem un listener al boto esborrar per esborrar la info al local storage, mostrar la capsa de text...
    document.getElementById("btnEsborrar").addEventListener("click", function () {
        localStorage.removeItem("nom");
        document.getElementById("divBenvinguda").innerHTML = "";
        document.getElementById("inputNom").style.display = "block";
        document.getElementById("btnGuardar").style.display = "block";
        document.getElementById("btnEsborrar").style.display = "none";
    });

});