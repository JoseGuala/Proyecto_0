const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('./db/db.js');
const app = express();
const sessions = new Map(); // sessionId -> { questions, puntuacio }

const PUBLIC_DIR = path.join(__dirname, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
fs.mkdirSync(IMAGES_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

/* ---------- Pujada d'imatges (punt 3) ---------- */
// express.json() només entén JSON; les imatges arriben com a
// multipart/form-data, que multer s'encarrega de processar i desar a disc.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `pregunta-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

// Si 'respostes' arriba com a text (multipart/form-data), cal fer-ne JSON.parse.
// Si arriba com a JSON normal (Thunder Client, sense imatge), ja és un array.
function parseRespostes(body) {
  if (typeof body.respostes === 'string') {
    try { return JSON.parse(body.respostes); } catch { return null; }
  }
  return body.respostes;
}

// Versió per al client del QUIZ: sense el camp 'correcta'
const senseResposta = q => ({
  imatge: q.imatge,
  pregunta: q.pregunta,
  respostes: q.respostes.map(r => ({ etiqueta: r.etiqueta }))
});

// Llegeix de la BD una pregunta (o totes) amb les seves opcions i les
// transforma al format { id, pregunta, imatge, respostes: [{id, etiqueta, correcta}] }.
async function obtePreguntes(id = null) {
  const [preguntesRows] = id
    ? await db.query('SELECT id, pregunta, imatge FROM preguntes WHERE id = ?', [id])
    : await db.query('SELECT id, pregunta, imatge FROM preguntes ORDER BY id');

  if (preguntesRows.length === 0) return [];

  const ids = preguntesRows.map(p => p.id);
  const [opcionsRows] = await db.query(
    'SELECT id, pregunta_id, etiqueta, es_correcta FROM opcions WHERE pregunta_id IN (?) ORDER BY pregunta_id, ordre',
    [ids]
  );

  return preguntesRows.map(p => ({
    id: p.id,
    pregunta: p.pregunta,
    imatge: p.imatge,
    respostes: opcionsRows
      .filter(o => o.pregunta_id === p.id)
      .map(o => ({ id: o.id, etiqueta: o.etiqueta, correcta: !!o.es_correcta }))
  }));
}

function validaPregunta(body) {
  if (typeof body.pregunta !== 'string' || body.pregunta.trim() === '') {
    return 'Falta el text de la pregunta';
  }
  if (!Array.isArray(body.respostes) || body.respostes.length !== 4) {
    return 'Calen exactament 4 respostes';
  }
  if (body.respostes.some(r => typeof r.etiqueta !== 'string' || r.etiqueta.trim() === '')) {
    return 'Totes les respostes necessiten una etiqueta';
  }
  const correctes = body.respostes.filter(r => r.correcta === true || r.correcta === 'true').length;
  if (correctes !== 1) {
    return 'Hi ha d\'haver exactament una resposta marcada com a correcta';
  }
  return null;
}

/* ---------- CRUD de preguntes (punt 1) ---------- */

app.get('/preguntes', async (req, res) => {
  try {
    res.json(await obtePreguntes());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultant la base de dades' });
  }
});

app.get('/preguntes/:id', async (req, res) => {
  try {
    const [pregunta] = await obtePreguntes(req.params.id);
    if (!pregunta) return res.status(404).json({ error: 'Pregunta no trobada' });
    res.json(pregunta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultant la base de dades' });
  }
});

// Body com a multipart/form-data: pregunta, respostes (JSON.stringify d'un array
// de 4 {etiqueta, correcta}), imatge (fitxer, opcional, camp 'imatge')
app.post('/preguntes', upload.single('imatge'), async (req, res) => {
  const respostes = parseRespostes(req.body);
  const errorValidacio = validaPregunta({ pregunta: req.body.pregunta, respostes });
  if (errorValidacio) return res.status(400).json({ error: errorValidacio });

  const imatgePath = req.file ? `/images/${req.file.filename}` : (req.body.imatge || null);

  try {
    const [resultat] = await db.query(
      'INSERT INTO preguntes (pregunta, imatge) VALUES (?, ?)',
      [req.body.pregunta, imatgePath]
    );
    const novaId = resultat.insertId;

    for (let i = 0; i < respostes.length; i++) {
      const r = respostes[i];
      await db.query(
        'INSERT INTO opcions (pregunta_id, etiqueta, ordre, es_correcta) VALUES (?, ?, ?, ?)',
        [novaId, r.etiqueta, i, r.correcta === true || r.correcta === 'true']
      );
    }

    const [pregunta] = await obtePreguntes(novaId);
    res.status(201).json(pregunta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error inserint a la base de dades' });
  }
});

// Mateix format que el POST. Si no s'envia 'imatge' (ni fitxer ni camp), es
// conserva la que ja hi havia. Si s'envia un fitxer nou, s'esborra el vell.
app.put('/preguntes/:id', upload.single('imatge'), async (req, res) => {
  try {
    const [existent] = await obtePreguntes(req.params.id);
    if (!existent) return res.status(404).json({ error: 'Pregunta no trobada' });

    let respostes;
    if (req.body.respostes !== undefined) {
      respostes = parseRespostes(req.body);
      const errorValidacio = validaPregunta({
        pregunta: req.body.pregunta ?? existent.pregunta,
        respostes
      });
      if (errorValidacio) return res.status(400).json({ error: errorValidacio });
    }

    let novaImatge = existent.imatge;
    if (req.file) {
      novaImatge = `/images/${req.file.filename}`;
      if (existent.imatge && existent.imatge.startsWith('/images/')) {
        fs.unlink(path.join(PUBLIC_DIR, existent.imatge), () => {});
      }
    } else if (req.body.imatge !== undefined) {
      novaImatge = req.body.imatge;
    }

    await db.query(
      'UPDATE preguntes SET pregunta = ?, imatge = ? WHERE id = ?',
      [req.body.pregunta ?? existent.pregunta, novaImatge, req.params.id]
    );

    if (respostes !== undefined) {
      await db.query('DELETE FROM opcions WHERE pregunta_id = ?', [req.params.id]);
      for (let i = 0; i < respostes.length; i++) {
        const r = respostes[i];
        await db.query(
          'INSERT INTO opcions (pregunta_id, etiqueta, ordre, es_correcta) VALUES (?, ?, ?, ?)',
          [req.params.id, r.etiqueta, i, r.correcta === true || r.correcta === 'true']
        );
      }
    }

    const [pregunta] = await obtePreguntes(req.params.id);
    res.json(pregunta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualitzant la base de dades' });
  }
});

app.delete('/preguntes/:id', async (req, res) => {
  try {
    const [existent] = await obtePreguntes(req.params.id);
    const [resultat] = await db.query('DELETE FROM preguntes WHERE id = ?', [req.params.id]);
    if (resultat.affectedRows === 0) return res.status(404).json({ error: 'Pregunta no trobada' });

    if (existent && existent.imatge && existent.imatge.startsWith('/images/')) {
      fs.unlink(path.join(PUBLIC_DIR, existent.imatge), () => {});
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminant de la base de dades' });
  }
});

/* ---------- QUIZ (iteracions anteriors) ---------- */

app.get('/nova-partida', async (req, res) => {
  try {
    const [preguntes] = await db.query(
      'SELECT id, pregunta, imatge FROM preguntes ORDER BY RAND() LIMIT 10'
    );
    const [opcions] = await db.query(
      'SELECT pregunta_id, etiqueta, es_correcta FROM opcions WHERE pregunta_id IN (?) ORDER BY ordre',
      [preguntes.map(p => p.id)]
    );

    const questions = preguntes.map(p => ({
      ...p,
      respostes: opcions
        .filter(o => o.pregunta_id === p.id)
        .map(o => ({ etiqueta: o.etiqueta, correcta: !!o.es_correcta }))
    }));

    const sessionId = uuidv4();
    sessions.set(sessionId, { questions, puntuacio: null });

    res.json({ sessionId, questions: questions.map(senseResposta) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultant la base de dades' });
  }
});

app.post('/respostes/:sessionId', (req, res) => {
  const partida = sessions.get(req.params.sessionId);
  if (!partida) return res.status(404).json({ error: 'Sessió no trobada' });

  if (partida.puntuacio === null) {
    const respostes = req.body.respostes;
    if (!Array.isArray(respostes)) return res.status(400).json({ error: 'Falten les respostes' });

    partida.puntuacio = partida.questions.filter(
      (q, i) => q.respostes[respostes[i]?.resp]?.correcta
    ).length;
  }

  res.json({
    puntuacio: partida.puntuacio,
    total: partida.questions.length,
    text: `${partida.puntuacio}/${partida.questions.length}`
  });
});

app.get('/puntuacio/:sessionId', (req, res) => {
  const partida = sessions.get(req.params.sessionId);
  if (!partida) return res.status(404).json({ error: 'Sessió no trobada' });
  if (partida.puntuacio === null) return res.status(400).json({ error: 'Encara no s\'han enviat les respostes' });

  res.json({
    puntuacio: partida.puntuacio,
    total: partida.questions.length,
    text: `${partida.puntuacio}/${partida.questions.length}`
  });
});

app.listen(10300, () => console.log('Servidor a http://a25josguapat.daw.inspedralbes.cat:10300'));