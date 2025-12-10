import express from "express";
import cors from "cors";
import pg from "pg";

const app = express();
app.use(cors());
app.use(express.json());

// Conexão ao banco Neon
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Criar tabela de equipamentos se não existir
async function inicializarBanco() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS iot.equipamentos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) UNIQUE NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        descricao TEXT,
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Tabela de equipamentos verificada/criada");
  } catch (err) {
    console.error("❌ Erro ao criar tabela:", err);
  }
}

inicializarBanco();

app.get("/", (req, res) => {
  res.send("🚀 API do IoT Dashboard está funcionando!");
});

// ========== ROTAS DE EQUIPAMENTOS ==========

// GET: Listar todos os equipamentos
app.get("/api/equipamentos", async (req, res) => {
  try {
    const query = `
      SELECT id, nome, latitude, longitude, descricao, ativo, criado_em
      FROM iot.equipamentos 
      WHERE ativo = true
      ORDER BY nome
    `;
    const { rows } = await pool.query(query);
    
    console.log("📋 Equipamentos encontrados:", rows.length);
    res.json({ equipamentos: rows });
  } catch (err) {
    console.error("Erro ao buscar equipamentos:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// GET: Buscar equipamento por ID
app.get("/api/equipamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT id, nome, latitude, longitude, descricao, ativo, criado_em
      FROM iot.equipamentos 
      WHERE id = $1
    `;
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Equipamento não encontrado" });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar equipamento:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// POST: Criar novo equipamento
app.post("/api/equipamentos", async (req, res) => {
  try {
    const { nome, latitude, longitude, descricao } = req.body;
    
    // Validações
    if (!nome || !latitude || !longitude) {
      return res.status(400).json({ 
        erro: "Nome, latitude e longitude são obrigatórios" 
      });
    }
    
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        erro: "Latitude deve estar entre -90 e 90" 
      });
    }
    
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        erro: "Longitude deve estar entre -180 e 180" 
      });
    }
    
    const query = `
      INSERT INTO iot.equipamentos (nome, latitude, longitude, descricao)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nome, latitude, longitude, descricao, ativo, criado_em
    `;
    
    const { rows } = await pool.query(query, [
      nome, 
      parseFloat(latitude), 
      parseFloat(longitude), 
      descricao || null
    ]);
    
    console.log("✅ Equipamento criado:", rows[0]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erro ao criar equipamento:", err);
    
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ 
        erro: "Já existe um equipamento com este nome" 
      });
    }
    
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// PUT: Atualizar equipamento
app.put("/api/equipamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, latitude, longitude, descricao, ativo } = req.body;
    
    // Validações
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ 
        erro: "Latitude deve estar entre -90 e 90" 
      });
    }
    
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ 
        erro: "Longitude deve estar entre -180 e 180" 
      });
    }
    
    const query = `
      UPDATE iot.equipamentos 
      SET nome = COALESCE($1, nome),
          latitude = COALESCE($2, latitude),
          longitude = COALESCE($3, longitude),
          descricao = COALESCE($4, descricao),
          ativo = COALESCE($5, ativo)
      WHERE id = $6
      RETURNING id, nome, latitude, longitude, descricao, ativo, criado_em
    `;
    
    const { rows } = await pool.query(query, [
      nome || null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      descricao !== undefined ? descricao : null,
      ativo !== undefined ? ativo : null,
      id
    ]);
    
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Equipamento não encontrado" });
    }
    
    console.log("✅ Equipamento atualizado:", rows[0]);
    res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao atualizar equipamento:", err);
    
    if (err.code === '23505') {
      return res.status(409).json({ 
        erro: "Já existe um equipamento com este nome" 
      });
    }
    
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// DELETE: Desativar equipamento (soft delete)
app.delete("/api/equipamentos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE iot.equipamentos 
      SET ativo = false
      WHERE id = $1
      RETURNING id, nome
    `;
    
    const { rows } = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Equipamento não encontrado" });
    }
    
    console.log("✅ Equipamento desativado:", rows[0]);
    res.json({ 
      mensagem: "Equipamento desativado com sucesso",
      equipamento: rows[0]
    });
  } catch (err) {
    console.error("Erro ao desativar equipamento:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ========== ROTAS DE DADOS (mantidas do original) ==========

app.get("/api/series", async (req, res) => {
  const { equipamento, data_inicial, data_final } = req.query;

  try {
    let query = `
      SELECT registro, equipamento, chuva, temperatura, umidade
      FROM iot.registros
      WHERE 1=1
    `;
    const params = [];

    if (equipamento) {
      params.push(equipamento);
      query += ` AND equipamento = $${params.length}`;
    }

    if (data_inicial) {
      params.push(data_inicial);
      query += ` AND registro >= $${params.length}`;
    }

    if (data_final) {
      params.push(data_final);
      query += ` AND registro <= $${params.length}`;
    }

    query += " ORDER BY registro ASC";

    console.log("📡 Query executada:", query);
    console.log("📊 Parâmetros:", params);

    const { rows } = await pool.query(query, params);

    const somaChuva = rows.reduce(
      (acc, row) => acc + (Number(row.chuva) || 0),
      0
    );

    console.log("✅ Dados retornados:", rows.length, "registros");

    res.json({
      total_chuva: somaChuva,
      dados: rows
    });
  } catch (err) {
    console.error("Erro ao consultar o banco:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`));
