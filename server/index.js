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

app.get("/", (req, res) => {
  res.send("🚀 API do IoT Dashboard está funcionando!");
});

// ✅ NOVA ROTA: Lista de equipamentos
app.get("/api/equipamentos", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT equipamento 
      FROM iot.registros 
      WHERE equipamento IS NOT NULL 
      ORDER BY equipamento
    `;

    const { rows } = await pool.query(query);
    
    const equipamentos = rows.map(row => row.equipamento);
    
    console.log("📋 Equipamentos encontrados:", equipamentos);
    
    res.json({
      equipamentos: equipamentos
    });
  } catch (err) {
    console.error("Erro ao buscar equipamentos:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ✅ Rota principal de dados
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

    // ✅ Soma total da chuva (null -> 0)
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
