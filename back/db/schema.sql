-- Importa aquest fitxer DINS de la base de dades a25josguapat_Proyecto0
-- (per phpMyAdmin: entra a la base -> pestanya "Importar" -> selecciona aquest fitxer)

CREATE TABLE IF NOT EXISTS preguntes (
  id INT PRIMARY KEY,
  pregunta TEXT NOT NULL,
  imatge LONGTEXT
);

CREATE TABLE IF NOT EXISTS opcions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  pregunta_id INT NOT NULL,
  etiqueta VARCHAR(255) NOT NULL,
  ordre TINYINT NOT NULL,
  es_correcta BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (pregunta_id) REFERENCES preguntes(id) ON DELETE CASCADE
);