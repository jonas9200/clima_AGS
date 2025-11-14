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

// ✅ NOVA ROTA: Lista de equipamentos (agora baseado em sensor_id)
app.get("/api/equipamentos", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT sensor_id 
      FROM iot.registros_2 
      WHERE sensor_id IS NOT NULL 
      ORDER BY sensor_id
    `;

    const { rows } = await pool.query(query);
    
    const equipamentos = rows.map(row => row.sensor_id);
    
    console.log("📋 Sensores encontrados:", equipamentos);
    
    res.json({
      equipamentos: equipamentos
    });
  } catch (err) {
    console.error("Erro ao buscar sensores:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// ✅ Rota principal de dados para registros_2
app.get("/api/series", async (req, res) => {
  const { equipamento, data_inicial, data_final } = req.query;

  try {
    // Primeiro, buscamos todos os registros filtrados
    let query = `
      SELECT registro, sensor_id, valor
      FROM iot.registros_2
      WHERE 1=1
    `;
    const params = [];

    if (equipamento) {
      params.push(equipamento);
      query += ` AND sensor_id = $${params.length}`;
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

    // Transformamos os dados para o formato esperado pelo frontend
    const dadosTransformados = transformarDados(rows);

    // ✅ Soma total da chuva (apenas sensor_id = 1)
    const somaChuva = rows
      .filter(row => row.sensor_id === 1)
      .reduce((acc, row) => acc + (Number(row.valor) || 0), 0);

    console.log("✅ Dados retornados:", rows.length, "registros brutos,", dadosTransformados.length, "registros transformados");

    res.json({
      total_chuva: somaChuva,
      dados: dadosTransformados
    });
  } catch (err) {
    console.error("Erro ao consultar o banco:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// Função para transformar dados de registros_2 para o formato esperado
function transformarDados(rows) {
  const registrosAgrupados = {};
  
  // Agrupa os registros por timestamp
  rows.forEach(row => {
    const timestamp = row.registro;
    
    if (!registrosAgrupados[timestamp]) {
      registrosAgrupados[timestamp] = {
        registro: timestamp,
        equipamento: row.sensor_id, // Mantemos o sensor_id como equipamento para compatibilidade
        chuva: null,
        temperatura: null,
        umidade: null
      };
    }
    
    // Atribui os valores conforme o sensor_id
    switch (row.sensor_id) {
      case 1: // Chuva
        registrosAgrupados[timestamp].chuva = Number(row.valor);
        break;
      case 2: // Temperatura
        registrosAgrupados[timestamp].temperatura = Number(row.valor);
        break;
      case 3: // Umidade
        registrosAgrupados[timestamp].umidade = Number(row.valor);
        break;
    }
  });
  
  // Converte o objeto de volta para array e ordena por timestamp
  return Object.values(registrosAgrupados).sort((a, b) => 
    new Date(a.registro) - new Date(b.registro)
  );
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`));
