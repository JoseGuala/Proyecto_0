let editId = null; // null = creant una pregunta nova; si no, id de la que s'està editant

const form = document.getElementById('formPregunta');
const errorDiv = document.getElementById('errorFormulari');
const btnCancelar = document.getElementById('btnCancelarEdicio');
const titolFormulari = document.getElementById('titolFormulari');
const btnEnviar = document.getElementById('btnEnviarFormulari');

function carregarPreguntes() {
  fetch('/preguntes')
    .then(res => res.json())
    .then(renderLlista)
    .catch(err => console.error('Error carregant preguntes:', err));
}

function renderLlista(preguntes) {
  const contenidor = document.getElementById('llistaPreguntes');

  if (preguntes.length === 0) {
    contenidor.innerHTML = '<p class="text-muted">Encara no hi ha cap pregunta.</p>';
    return;
  }

  contenidor.innerHTML = preguntes.map(p => `
    <div class="col-md-6">
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex gap-3">
            ${p.imatge ? `<img src="${p.imatge}" class="imatge-preview">` : ''}
            <div class="flex-grow-1">
              <p class="fw-bold mb-2">${escapeHtml(p.pregunta)}</p>
              <ul class="list-unstyled mb-0 small">
                ${p.respostes.map(r => `
                  <li class="${r.correcta ? 'resposta-correcta' : ''} px-1 rounded">
                    ${escapeHtml(r.etiqueta)} ${r.correcta ? '✓' : ''}
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
        <div class="card-footer d-flex gap-2">
          <button class="btn btn-sm btn-primary btn-editar" data-id="${p.id}">Editar</button>
          <button class="btn btn-sm btn-danger btn-eliminar" data-id="${p.id}">Eliminar</button>
        </div>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Delegació d'esdeveniments: un sol listener per a tots els botons Editar/Eliminar
document.getElementById('llistaPreguntes').addEventListener('click', e => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains('btn-eliminar')) {
    eliminarPregunta(id);
  } else if (e.target.classList.contains('btn-editar')) {
    carregarPreguntaAlFormulari(id);
  }
});

function eliminarPregunta(id) {
  if (!confirm('Segur que vols eliminar aquesta pregunta?')) return;

  fetch(`/preguntes/${id}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw new Error('No s\'ha pogut eliminar');
      if (editId === id) cancelarEdicio();
      carregarPreguntes();
    })
    .catch(err => alert(err.message));
}

function carregarPreguntaAlFormulari(id) {
  fetch(`/preguntes/${id}`)
    .then(res => res.json())
    .then(p => {
      editId = String(p.id);
      document.getElementById('preguntaId').value = p.id;
      document.getElementById('campPregunta').value = p.pregunta;

      const etiquetes = document.querySelectorAll('.camp-etiqueta');
      const radios = document.querySelectorAll('input[name="correcta"]');
      p.respostes.forEach((r, i) => {
        etiquetes[i].value = r.etiqueta;
        radios[i].checked = r.correcta;
      });

      const preview = document.getElementById('previewImatgeActual');
      if (p.imatge) {
        preview.src = p.imatge;
        preview.classList.remove('d-none');
      } else {
        preview.classList.add('d-none');
      }

      titolFormulari.textContent = `Editant pregunta #${p.id}`;
      btnEnviar.textContent = 'Guardar canvis';
      btnCancelar.classList.remove('d-none');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function cancelarEdicio() {
  editId = null;
  form.reset();
  document.getElementById('preguntaId').value = '';
  document.getElementById('previewImatgeActual').classList.add('d-none');
  titolFormulari.textContent = 'Nova pregunta';
  btnEnviar.textContent = 'Crear pregunta';
  btnCancelar.classList.add('d-none');
  errorDiv.textContent = '';
}

btnCancelar.addEventListener('click', cancelarEdicio);

form.addEventListener('submit', e => {
  e.preventDefault();
  errorDiv.textContent = '';

  const etiquetes = [...document.querySelectorAll('.camp-etiqueta')].map(i => i.value);
  const correctaSeleccionada = document.querySelector('input[name="correcta"]:checked').value;
  const respostes = etiquetes.map((etiqueta, i) => ({
    etiqueta,
    correcta: String(i) === correctaSeleccionada
  }));

  const dades = new FormData();
  dades.append('pregunta', document.getElementById('campPregunta').value);
  dades.append('respostes', JSON.stringify(respostes));

  const fitxer = document.getElementById('campImatge').files[0];
  if (fitxer) dades.append('imatge', fitxer);

  const url = editId ? `/preguntes/${editId}` : '/preguntes';
  const method = editId ? 'PUT' : 'POST';

  // No cal (ni s'ha de) posar Content-Type a mà: el navegador afegeix el
  // 'multipart/form-data; boundary=...' correcte quan el body és un FormData.
  fetch(url, { method, body: dades })
    .then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error desant la pregunta');
      }
      return res.json();
    })
    .then(() => {
      cancelarEdicio();
      carregarPreguntes();
    })
    .catch(err => { errorDiv.textContent = err.message; });
});

carregarPreguntes();
