// Script de migració: llegeix preguntes.json + respostes.json
// i insereix tota la informació a MySQL (taules preguntes i opcions).
// Només cal executar-lo un cop (o cada vegada que vulguis reimportar el JSON inicial):
//   node db/migrate.js

const mysql = require('mysql2/promise');
const preguntes = require('./preguntes.json');
const respostes = require('./respostes.json');

async function migrar() {
  const con = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'a25josguapat_apidaw',
    password: process.env.DB_PASSWORD || 'Y0992759_r07',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'a25josguapat_Proyecto0'
  });

  console.log('Connectat a MySQL. Començant migració...');

  const correctes = new Map(
    respostes.respostes.map(r => [r.id, r.resposta_correcta])
  );

  await con.query('SET FOREIGN_KEY_CHECKS = 0');
  await con.query('TRUNCATE TABLE opcions');
  await con.query('TRUNCATE TABLE preguntes');
  await con.query('SET FOREIGN_KEY_CHECKS = 1');

  for (const pregunta of preguntes.preguntas) {
    await con.query(
      'INSERT INTO preguntes (id, pregunta, imatge) VALUES (?, ?, ?)',
      [pregunta.id, pregunta.pregunta, pregunta.imatge]
    );

    const indexCorrecta = correctes.get(pregunta.id);

    for (let i = 0; i < pregunta.respostes.length; i++) {
      const opcio = pregunta.respostes[i];
      const esCorrecta = (i + 1) === indexCorrecta;

      await con.query(
        'INSERT INTO opcions (pregunta_id, etiqueta, ordre, es_correcta) VALUES (?, ?, ?, ?)',
        [pregunta.id, opcio.etiqueta, i, esCorrecta]
      );
    }

    console.log(`Migrada pregunta ${pregunta.id}: ${pregunta.pregunta}`);
  }

  console.log(`Migració completa: ${preguntes.preguntas.length} preguntes importades.`);
  await con.end();
}

migrar().catch(err => {
  console.error('Error durant la migració:', err);
  process.exit(1);
});