import { useEffect, useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import "chart.js/auto";

// Importações do Leaflet
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrigir ícones do Leaflet (problema comum)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function App() {
  const [dados, setDados] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [equipamento, setEquipamento] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingEquipamentos, setLoadingEquipamentos] = useState(false);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState("24h");
  const [totalChuva, setTotalChuva] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeTab, setActiveTab] = useState("chuva");
  
  // Novos estados para o mapa
  const [mapaAtivo, setMapaAtivo] = useState(false);
  const [localizacoesEquipamentos, setLocalizacoesEquipamentos] = useState({});
  const [coordenadasAtuais, setCoordenadasAtuais] = useState([-23.5505, -46.6333]); // São Paulo como padrão

  const baseUrl = import.meta.env.VITE_API_URL || "";

  // Mapeamento de coordenadas por equipamento (você pode buscar isso da API)
  const coordenadasPorEquipamento = {
    "Pluviometro_01": [-23.5505, -46.6333], // São Paulo
    "Pluviometro_02": [-22.9068, -43.1729], // Rio de Janeiro
    "Estacao_01": [-15.7801, -47.9292],     // Brasília
    "Estacao_02": [-12.9714, -38.5014],     // Salvador
    // Adicione mais equipamentos e coordenadas aqui
  };

  // Função para redirecionar para a página do operador
  const redirecionarParaOperador = () => {
    window.location.href = "https://ags-irrigacao.onrender.com/operador";
  };

  // Detecta se é mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🔄 Carregar lista de equipamentos
  useEffect(() => {
    carregarEquipamentos();
  }, []);

  // Atualizar coordenadas quando mudar o equipamento
  useEffect(() => {
    if (equipamento && coordenadasPorEquipamento[equipamento]) {
      setCoordenadasAtuais(coordenadasPorEquipamento[equipamento]);
    }
  }, [equipamento]);

  async function carregarEquipamentos() {
    setLoadingEquipamentos(true);
    try {
      const url = `${baseUrl}/api/equipamentos`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Erro ao buscar equipamentos");
      const json = await resp.json();
      
      const listaEquipamentos = json.equipamentos || [];
      setEquipamentos(listaEquipamentos);
      
      // ✅ SEMPRE define o primeiro equipamento quando a lista estiver pronta
      if (listaEquipamentos.length > 0) {
        setEquipamento(listaEquipamentos[0]);
      }
    } catch (e) {
      console.error("Erro ao carregar equipamentos:", e);
      const listaPadrao = ["Pluviometro_01"];
      setEquipamentos(listaPadrao);
      setEquipamento(listaPadrao[0]);
    } finally {
      setLoadingEquipamentos(false);
    }
  }

  // 🔄 NOVO: Aplicar filtro das 24h automaticamente quando equipamento estiver disponível
  useEffect(() => {
    if (equipamento && equipamento !== "") {
      console.log("🎯 Aplicando filtro automático das 24h para:", equipamento);
      // Pequeno delay para garantir que tudo está carregado
      setTimeout(() => {
        calcularPeriodoRapido("24h");
      }, 100);
    }
  }, [equipamento]);

  // Função para converter data para formato do input (YYYY-MM-DDTHH:MM)
  function toLocalDatetimeString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Função para converter input para formato do banco (YYYY-MM-DD HH:MM:SS)
  function toDatabaseFormat(datetimeString) {
    if (!datetimeString) return '';
    const date = new Date(datetimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 📆 Filtros rápidos
  function calcularPeriodoRapido(p) {
    const agora = new Date();
    const inicio = new Date(agora);

    if (p === "24h") {
      inicio.setHours(inicio.getHours() - 24);
    } else if (p === "7d") {
      inicio.setDate(inicio.getDate() - 7);
    } else if (p === "30d") {
      inicio.setDate(inicio.getDate() - 30);
    }

    setDataInicial(toLocalDatetimeString(inicio));
    setDataFinal(toLocalDatetimeString(agora));
    setPeriodo(p);

    const inicioBanco = toDatabaseFormat(toLocalDatetimeString(inicio));
    const finalBanco = toDatabaseFormat(toLocalDatetimeString(agora));

    console.log(`📊 Aplicando filtro ${p}:`, { inicioBanco, finalBanco });
    carregarComDatas(inicioBanco, finalBanco);
  }

  // 🔄 Carregar da API com datas específicas
  async function carregarComDatas(inicial, final) {
    setLoading(true);
    setErro("");
    try {
      const params = new URLSearchParams({ equipamento });
      if (inicial) params.append("data_inicial", inicial);
      if (final) params.append("data_final", final);

      const url = `${baseUrl}/api/series?${params.toString()}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Erro ao buscar dados");
      const json = await resp.json();

      const lista = json.dados || [];
      setDados(lista);
      setTotalChuva(json.total_chuva || 0);
      
    } catch (e) {
      setErro("Falha ao carregar dados. Verifique a API.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // 🔄 Carregar da API usando os estados atuais
  async function carregar() {
    setLoading(true);
    setErro("");
    try {
      const params = new URLSearchParams({ equipamento });
      
      const dataInicialBanco = toDatabaseFormat(dataInicial);
      const dataFinalBanco = toDatabaseFormat(dataFinal);
      
      if (dataInicialBanco) params.append("data_inicial", dataInicialBanco);
      if (dataFinalBanco) params.append("data_final", dataFinalBanco);

      const url = `${baseUrl}/api/series?${params.toString()}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Erro ao buscar dados");
      const json = await resp.json();

      const lista = json.dados || [];
      setDados(lista);
      setTotalChuva(json.total_chuva || 0);
    } catch (e) {
      setErro("Falha ao carregar dados. Verifique a API.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function limparFiltro() {
    setDataInicial("");
    setDataFinal("");
    setPeriodo("");
    // Ao limpar, volta para as 24h
    setTimeout(() => {
      calcularPeriodoRapido("24h");
    }, 100);
  }

  // 🧮 Agrupar por hora - USA O HORÁRIO EXATO DO BANCO
  function agruparPorHora(lista) {
    const mapa = {};

    lista.forEach((d) => {
      const registro = d.registro;
      
      let horaStr;
      if (registro.includes('T')) {
        horaStr = registro.slice(0, 13) + ":00:00";
      } else {
        horaStr = registro.slice(0, 13) + ":00:00";
      }

      if (!mapa[horaStr]) {
        mapa[horaStr] = {
          count: 0,
          somaTemp: 0,
          somaUmid: 0,
          somaChuva: 0,
          timestamp: new Date(registro).getTime()
        };
      }

      mapa[horaStr].count++;
      mapa[horaStr].somaTemp += Number(d.temperatura) || 0;
      mapa[horaStr].somaUmid += Number(d.umidade) || 0;
      mapa[horaStr].somaChuva += Number(d.chuva) || 0;
    });

    const horasOrdenadas = Object.keys(mapa).sort((a, b) => 
      mapa[a].timestamp - mapa[b].timestamp
    );

    return horasOrdenadas.map((h) => ({
      hora: h,
      timestamp: mapa[h].timestamp,
      temperatura: Number((mapa[h].somaTemp / mapa[h].count).toFixed(2)),
      umidade: Number((mapa[h].somaUmid / mapa[h].count).toFixed(2)),
      chuva: Number(mapa[h].somaChuva.toFixed(2)),
    }));
  }

  const agrupados = agruparPorHora(dados);
  const labels = agrupados.map(() => "");
  const temperatura = agrupados.map((d) => d.temperatura);
  const umidade = agrupados.map((d) => d.umidade);
  const chuva = agrupados.map((d) => d.chuva);

  // Configurações dos gráficos para dark mode
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: {
          color: '#e2e8f0'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#e2e8f0',
        bodyColor: '#e2e8f0',
        titleFont: {
          size: isMobile ? 12 : 14
        },
        bodyFont: {
          size: isMobile ? 11 : 13
        },
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            const dataOriginal = agrupados[index];
            return new Date(dataOriginal.hora).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          label: (context) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.2)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: isMobile ? 10 : 12
          },
          callback: function(value) {
            return value.toFixed(2);
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.2)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: isMobile ? 10 : 12
          },
          callback: function(value) {
            return value.toFixed(2);
          }
        }
      }
    }
  };

  // Estilos DARK MODE com tema azul - OTIMIZADO
  const styles = {
    // ... (mantenha todos os estilos anteriores)

    // NOVO: Estilos para o card do mapa
    mapCard: {
      background: "rgba(30, 41, 59, 0.8)",
      borderRadius: "15px",
      padding: isMobile ? "15px" : "20px",
      marginBottom: isMobile ? "20px" : "25px",
      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)",
      border: "1px solid rgba(100, 116, 139, 0.2)",
      position: "relative",
      overflow: "hidden"
    },
    mapContainer: {
      height: isMobile ? "300px" : "400px",
      borderRadius: "10px",
      overflow: "hidden",
      marginTop: "15px",
      border: "1px solid rgba(100, 116, 139, 0.3)"
    },
    mapButton: {
      marginTop: "15px",
      padding: "10px 20px",
      background: "linear-gradient(135deg, #1e40af, #3b82f6)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontSize: isMobile ? "0.85rem" : "0.9rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.3s ease",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      justifyContent: "center",
      width: "100%"
    },
    locationInfo: {
      background: "linear-gradient(135deg, rgba(30, 64, 175, 0.1), rgba(59, 130, 246, 0.1))",
      padding: "15px",
      borderRadius: "10px",
      marginTop: "15px",
      border: "1px solid rgba(59, 130, 246, 0.2)",
      fontSize: isMobile ? "0.85rem" : "0.95rem",
      color: "#cbd5e1"
    }
  };

  // Função para renderizar o gráfico ativo com cores azuis
  const renderActiveChart = () => {
    switch (activeTab) {
      case "chuva":
        return (
          <Bar
            data={{
              labels,
              datasets: [
                {
                  label: "Chuva por hora (mm)",
                  data: chuva,
                  backgroundColor: "rgba(96, 165, 250, 0.8)",
                  borderColor: "#60a5fa",
                  borderWidth: 2,
                  borderRadius: 6,
                },
              ],
            }}
            options={barOptions}
          />
        );
      case "temperatura":
        return (
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: "Temperatura (°C)",
                  data: temperatura,
                  borderColor: "#f87171",
                  backgroundColor: "rgba(248, 113, 113, 0.1)",
                  borderWidth: 3,
                  tension: 0.4,
                  fill: true,
                },
              ],
            }}
            options={chartOptions}
          />
        );
      case "umidade":
        return (
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: "Umidade (%)",
                  data: umidade,
                  borderColor: "#60a5fa",
                  backgroundColor: "rgba(96, 165, 250, 0.1)",
                  borderWidth: 3,
                  tension: 0.4,
                  fill: true,
                },
              ],
            }}
            options={chartOptions}
          />
        );
      default:
        return null;
    }
  };

  // Estilo personalizado para o mapa dark mode
  const darkMapStyle = {
    height: '100%',
    width: '100%',
    borderRadius: '8px'
  };

  return (
    <div style={styles.container}>
      {/* BOTÃO ACIMA DO CABEÇALHO PRINCIPAL */}
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "15px",
        position: "sticky",
        top: "10px",
        zIndex: 100
      }}>
        <button 
          onClick={redirecionarParaOperador}
          style={{
            padding: "12px 24px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: isMobile ? "0.85rem" : "0.9rem",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(16, 185, 129, 0.3)"
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.4)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 15px rgba(16, 185, 129, 0.3)";
          }}
        >
          🚀 Lista
        </button>
      </div>

      {/* 🎯 HEADER ELEGANTE - DARK MODE */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <div style={styles.titleSection}>
              <div style={styles.logo}>🌦️</div>
              <div>
                <h1 style={styles.title}> AGS Clima</h1>
                <p style={styles.subtitle}>Monitoramento Meteorológico</p>
              </div>
            </div>
          </div>
          
          {/* ESTATÍSTICAS NO HEADER */}
          {!loading && !erro && agrupados.length > 0 && (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{totalChuva.toFixed(2)} mm</div>
                <div style={styles.statLabel}>Total de Chuva</div>
              </div>
              {!isMobile && (
                <div style={styles.statCard}>
                  <div style={styles.statValue}>{equipamento}</div>
                  <div style={styles.statLabel}>Equipamento</div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 🎛️ PAINEL DE CONTROLE - DARK MODE */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>⚙️ Configurações</h3>
        
        <div style={styles.formGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>📡 Equipamento</label>
            {loadingEquipamentos ? (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
                <span>Carregando equipamentos...</span>
              </div>
            ) : (
              <select
                style={styles.select}
                value={equipamento}
                onChange={(e) => setEquipamento(e.target.value)}
                onFocus={(e) => e.target.style.borderColor = "#60a5fa"}
                onBlur={(e) => e.target.style.borderColor = "#475569"}
              >
                <option value="">Selecione um equipamento</option>
                {equipamentos.map((eqp) => (
                  <option key={eqp} value={eqp}>
                    {eqp}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📅 Data Inicial</label>
            <input
              type="datetime-local"
              style={styles.input}
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              onFocus={(e) => e.target.style.borderColor = "#60a5fa"}
              onBlur={(e) => e.target.style.borderColor = "#475569"}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>📅 Data Final</label>
            <input
              type="datetime-local"
              style={styles.input}
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              onFocus={(e) => e.target.style.borderColor = "#60a5fa"}
              onBlur={(e) => e.target.style.borderColor = "#475569"}
            />
          </div>
        </div>

        <div style={styles.buttonGroup}>
          <button 
            style={styles.primaryButton} 
            onClick={() => carregar()}
            onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
            onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
            disabled={!equipamento}
          >
            🔍 Aplicar Filtros
          </button>
          <button 
            style={styles.secondaryButton} 
            onClick={limparFiltro}
            onMouseOver={(e) => e.target.style.backgroundColor = "#374151"}
            onMouseOut={(e) => e.target.style.backgroundColor = "transparent"}
          >
            🗑️ Limpar Filtros
          </button>
        </div>
      </div>

      {/* 🗺️ CARD DO MAPA - NOVO */}
      <div style={styles.mapCard}>
        <h3 style={styles.cardTitle}>🗺️ Localização do Equipamento</h3>
        
        <div style={styles.locationInfo}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "10px" }}>
            <div><strong>📡 Equipamento:</strong> {equipamento || "Não selecionado"}</div>
            <div><strong>📍 Coordenadas:</strong> {coordenadasAtuais[0].toFixed(4)}, {coordenadasAtuais[1].toFixed(4)}</div>
          </div>
        </div>

        <div style={styles.mapContainer}>
          <MapContainer 
            center={coordenadasAtuais} 
            zoom={13} 
            style={darkMapStyle}
            scrollWheelZoom={true}
          >
            {/* Tile layer para dark mode */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <Marker position={coordenadasAtuais}>
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>{equipamento}</strong><br />
                  Latitude: {coordenadasAtuais[0].toFixed(6)}<br />
                  Longitude: {coordenadasAtuais[1].toFixed(6)}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        <button 
          style={styles.mapButton}
          onClick={() => {
            // Abrir no Google Maps
            window.open(`https://www.google.com/maps?q=${coordenadasAtuais[0]},${coordenadasAtuais[1]}`, '_blank');
          }}
          onMouseOver={(e) => e.target.style.transform = "translateY(-2px)"}
          onMouseOut={(e) => e.target.style.transform = "translateY(0)"}
        >
          📍 Abrir no Google Maps
        </button>
      </div>

      {/* ⏱️ FILTROS RÁPIDOS - DARK MODE */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>⏱️ Período Rápido</h3>
        <div style={styles.quickFilters}>
          {["24h", "7d", "30d"].map((p) => (
            <button
              key={p}
              style={{
                ...styles.quickFilterButton,
                ...(periodo === p ? styles.quickFilterActive : {})
              }}
              onClick={() => calcularPeriodoRapido(p)}
              onMouseOver={(e) => !styles.quickFilterActive.backgroundColor && (e.target.style.backgroundColor = "#374151")}
              onMouseOut={(e) => !styles.quickFilterActive.backgroundColor && (e.target.style.backgroundColor = "transparent")}
              disabled={!equipamento}
            >
              {p === "24h" && "⏰ Últimas 24h"}
              {p === "7d" && "📅 Última Semana"}
              {p === "30d" && "📊 Último Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* 📊 STATUS E ERROS - DARK MODE */}
      <div>
        {loading && periodo === "24h" && (
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <span>Carregando dados das últimas 24h...</span>
          </div>
        )}
        
        {loading && periodo !== "24h" && (
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <span>Carregando dados meteorológicos...</span>
          </div>
        )}
        
        {erro && (
          <div style={styles.error}>
            ⚠️ {erro}
          </div>
        )}

        {!loading && !erro && agrupados.length === 0 && equipamento && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📈</div>
            <h3 style={{ marginBottom: "10px", color: "#e2e8f0" }}>Nenhum dado encontrado</h3>
            <p style={{ margin: 0 }}>Não há dados disponíveis para os filtros selecionados.</p>
          </div>
        )}

        {!equipamento && !loadingEquipamentos && (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "4rem", marginBottom: "15px" }}>📡</div>
            <h3 style={{ marginBottom: "10px", color: "#e2e8f0" }}>Selecione um equipamento</h3>
            <p style={{ margin: 0 }}>Escolha um equipamento da lista para visualizar os dados.</p>
          </div>
        )}
      </div>

      {/* 📈 GRÁFICOS COM ABAS - DARK MODE OTIMIZADO */}
      {agrupados.length > 0 && (
        <div style={styles.chartsSection}>
          {/* ABAS DE NAVEGAÇÃO */}
          <div style={styles.tabsContainer}>
            {[
              { id: "chuva", label: "🌧️ Chuva", emoji: "🌧️" },
              { id: "temperatura", label: "🌡️ Temperatura", emoji: "🌡️" },
              { id: "umidade", label: "💧 Umidade", emoji: "💧" }
            ].map((tab) => (
              <div
                key={tab.id}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab.id ? styles.activeTab : {})
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseOver={(e) => activeTab !== tab.id && (e.target.style.backgroundColor = "#374151")}
                onMouseOut={(e) => activeTab !== tab.id && (e.target.style.backgroundColor = "transparent")}
              >
                {isMobile ? tab.emoji : tab.label}
              </div>
            ))}
          </div>

          {/* GRÁFICO ATIVO - LAYOUT OTIMIZADO */}
          <div style={styles.chartCard}>
            <div style={styles.chartHeader}>
              <h3 style={styles.chartTitle}>
                {activeTab === "chuva" && "🌧️ Precipitação por Hora (mm)"}
                {activeTab === "temperatura" && "🌡️ Temperatura (°C)"}
                {activeTab === "umidade" && "💧 Umidade Relativa (%)"}
              </h3>
            </div>
            <div style={styles.chartContainer}>
              {renderActiveChart()}
            </div>
          </div>

          {/* 🗓️ INFORMAÇÕES DO PERÍODO - MODIFICADO */}
          <div style={styles.summaryCard}>
            <h3 style={styles.cardTitle}>📊 Resumo do Período</h3>
            <div style={{ 
              background: "linear-gradient(135deg, rgba(30, 64, 175, 0.1), rgba(59, 130, 246, 0.1))", 
              padding: "20px", 
              borderRadius: "12px",
              fontSize: isMobile ? "0.85rem" : "0.95rem",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              color: "#cbd5e1"
            }}>
              {agrupados.length > 0 && (
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", 
                  gap: "15px" 
                }}>
                  <div><strong>📡 Equipamento:</strong> {equipamento}</div>
                  <div><strong>🕐 Data Inicial:</strong> {new Date(agrupados[0].hora).toLocaleString('pt-BR')}</div>
                  <div><strong>🕐 Data Final:</strong> {new Date(agrupados[agrupados.length - 1].hora).toLocaleString('pt-BR')}</div>
                  <div><strong>🌧️ Chuva Total:</strong> {totalChuva.toFixed(2)} mm</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          input[type="datetime-local"] {
            font-size: 16px;
          }
        }

        * {
          box-sizing: border-box;
        }

        input:focus, select:focus, button:focus {
          outline: none;
        }

        button:hover {
          transform: translateY(-1px);
        }

        body {
          background: #0f172a;
          margin: 0;
          padding: 0;
        }

        /* Estilos para o Leaflet */
        .leaflet-container {
          font-family: inherit;
        }
        
        .leaflet-popup-content {
          font-size: 14px;
        }
        
        .leaflet-control-zoom a {
          background-color: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #475569 !important;
        }
        
        .leaflet-control-zoom a:hover {
          background-color: #374151 !important;
        }
      `}</style>
    </div>
  );
}
