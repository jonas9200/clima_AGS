import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Corrigir ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícone customizado para equipamentos
const equipamentoIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente para adicionar marcador clicando no mapa
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function App() {
  const [equipamentos, setEquipamentos] = useState([]);
  const [equipamentoSelecionado, setEquipamentoSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mostrarMapa, setMostrarMapa] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Estados para cadastro
  const [novoEquipamento, setNovoEquipamento] = useState({
    nome: "",
    latitude: -23.5505,
    longitude: -46.6333,
    descricao: ""
  });
  const [marcadorTemporario, setMarcadorTemporario] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:10000";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    carregarEquipamentos();
  }, []);

  async function carregarEquipamentos() {
    setLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/api/equipamentos`);
      if (!resp.ok) throw new Error("Erro ao buscar equipamentos");
      const json = await resp.json();
      
      const lista = json.equipamentos || [];
      setEquipamentos(lista);
      
      if (lista.length > 0 && !equipamentoSelecionado) {
        setEquipamentoSelecionado(lista[0]);
      }
    } catch (e) {
      console.error("Erro ao carregar equipamentos:", e);
      setErro("Erro ao carregar lista de equipamentos");
    } finally {
      setLoading(false);
    }
  }

  async function cadastrarEquipamento(e) {
    e.preventDefault();
    setErro("");
    setMensagemSucesso("");
    setLoading(true);
    
    try {
      const resp = await fetch(`${baseUrl}/api/equipamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novoEquipamento)
      });
      
      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.erro || "Erro ao cadastrar equipamento");
      }
      
      const equipamentoCriado = await resp.json();
      setMensagemSucesso(`✅ Equipamento "${equipamentoCriado.nome}" cadastrado com sucesso!`);
      
      // Resetar formulário
      setNovoEquipamento({
        nome: "",
        latitude: -23.5505,
        longitude: -46.6333,
        descricao: ""
      });
      setMarcadorTemporario(null);
      
      // Recarregar lista
      await carregarEquipamentos();
      
      // Fechar formulário após 2 segundos
      setTimeout(() => {
        setMostrarFormulario(false);
        setMensagemSucesso("");
      }, 2000);
      
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deletarEquipamento(id) {
    if (!confirm("Tem certeza que deseja excluir este equipamento?")) return;
    
    setLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/api/equipamentos/${id}`, {
        method: 'DELETE'
      });
      
      if (!resp.ok) throw new Error("Erro ao deletar equipamento");
      
      setMensagemSucesso("✅ Equipamento removido com sucesso!");
      await carregarEquipamentos();
      
      setTimeout(() => setMensagemSucesso(""), 2000);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleMapClick(latlng) {
    if (mostrarFormulario) {
      setMarcadorTemporario(latlng);
      setNovoEquipamento(prev => ({
        ...prev,
        latitude: latlng.lat.toFixed(8),
        longitude: latlng.lng.toFixed(8)
      }));
    }
  }

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      padding: isMobile ? "15px" : "30px",
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      color: "#e2e8f0"
    },
    header: {
      background: "rgba(30, 41, 59, 0.8)",
      borderRadius: "20px",
      padding: isMobile ? "20px" : "30px",
      marginBottom: isMobile ? "20px" : "30px",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(100, 116, 139, 0.2)"
    },
    title: {
      fontSize: isMobile ? "1.5rem" : "2rem",
      fontWeight: "700",
      margin: 0,
      background: "linear-gradient(135deg, #60a5fa, #3b82f6)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent"
    },
    card: {
      background: "rgba(30, 41, 59, 0.8)",
      borderRadius: "15px",
      padding: isMobile ? "15px" : "20px",
      marginBottom: isMobile ? "15px" : "20px",
      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)",
      border: "1px solid rgba(100, 116, 139, 0.2)"
    },
    button: {
      padding: "12px 24px",
      background: "linear-gradient(135deg, #3b82f6, #2563eb)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontSize: isMobile ? "0.85rem" : "0.95rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.3s ease",
      boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)"
    },
    mapContainer: {
      height: isMobile ? "400px" : "600px",
      borderRadius: "10px",
      overflow: "hidden",
      marginTop: "15px",
      border: "1px solid rgba(100, 116, 139, 0.3)"
    },
    formGroup: {
      marginBottom: "15px"
    },
    label: {
      display: "block",
      marginBottom: "8px",
      fontSize: "0.9rem",
      fontWeight: "600",
      color: "#cbd5e1"
    },
    input: {
      width: "100%",
      padding: "12px",
      background: "rgba(15, 23, 42, 0.6)",
      border: "1px solid #475569",
      borderRadius: "8px",
      color: "#e2e8f0",
      fontSize: "0.95rem",
      transition: "all 0.3s ease"
    },
    equipamentoCard: {
      background: "rgba(59, 130, 246, 0.1)",
      border: "1px solid rgba(59, 130, 246, 0.3)",
      borderRadius: "10px",
      padding: "15px",
      marginBottom: "10px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    deleteButton: {
      padding: "8px 16px",
      background: "linear-gradient(135deg, #ef4444, #dc2626)",
      color: "white",
      border: "none",
      borderRadius: "6px",
      fontSize: "0.85rem",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.3s ease"
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🗺️ Sistema de Gerenciamento de Equipamentos</h1>
        <p style={{ margin: "10px 0 0 0", color: "#94a3b8" }}>
          Cadastro e Visualização de Equipamentos no Mapa
        </p>
      </header>

      {/* Botões de Controle */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button 
          style={styles.button}
          onClick={() => {
            setMostrarMapa(!mostrarMapa);
            setMostrarFormulario(false);
          }}
        >
          {mostrarMapa ? "📋 Ver Lista" : "🗺️ Ver Mapa"}
        </button>
        <button 
          style={{...styles.button, background: "linear-gradient(135deg, #10b981, #059669)"}}
          onClick={() => {
            setMostrarFormulario(!mostrarFormulario);
            setMostrarMapa(true);
            setErro("");
            setMensagemSucesso("");
          }}
        >
          {mostrarFormulario ? "❌ Cancelar" : "➕ Novo Equipamento"}
        </button>
        <button 
          style={{...styles.button, background: "linear-gradient(135deg, #8b5cf6, #7c3aed)"}}
          onClick={carregarEquipamentos}
          disabled={loading}
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Mensagens */}
      {erro && (
        <div style={{...styles.card, background: "rgba(239, 68, 68, 0.2)", border: "1px solid #ef4444"}}>
          ⚠️ {erro}
        </div>
      )}
      
      {mensagemSucesso && (
        <div style={{...styles.card, background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981"}}>
          {mensagemSucesso}
        </div>
      )}

      {loading && (
        <div style={{...styles.card, textAlign: "center"}}>
          <div style={{ fontSize: "2rem" }}>⏳</div>
          <p>Carregando...</p>
        </div>
      )}

      {/* Mapa */}
      {mostrarMapa && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>🗺️ Mapa de Equipamentos ({equipamentos.length})</h3>
          
          {mostrarFormulario && (
            <div style={{...styles.card, background: "rgba(59, 130, 246, 0.1)", marginBottom: "15px"}}>
              <p style={{ margin: "0 0 10px 0", color: "#60a5fa", fontWeight: "600" }}>
                📍 Clique no mapa para selecionar a localização do equipamento
              </p>
            </div>
          )}
          
          <div style={styles.mapContainer}>
            <MapContainer 
              center={[-15.7801, -47.9292]} 
              zoom={5} 
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapClickHandler onMapClick={handleMapClick} />
              
              {/* Marcadores dos equipamentos cadastrados */}
              {equipamentos.map((eq) => (
                <Marker 
                  key={eq.id} 
                  position={[parseFloat(eq.latitude), parseFloat(eq.longitude)]}
                  icon={equipamentoIcon}
                >
                  <Popup>
                    <div style={{ color: '#000', minWidth: '200px' }}>
                      <strong style={{ fontSize: '1.1em' }}>{eq.nome}</strong><br />
                      {eq.descricao && <><em>{eq.descricao}</em><br /></>}
                      <hr style={{ margin: '8px 0' }} />
                      <strong>Coordenadas:</strong><br />
                      Lat: {parseFloat(eq.latitude).toFixed(6)}<br />
                      Lng: {parseFloat(eq.longitude).toFixed(6)}<br />
                      <small>Cadastrado em: {new Date(eq.criado_em).toLocaleDateString('pt-BR')}</small>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Marcador temporário */}
              {marcadorTemporario && (
                <Marker position={[marcadorTemporario.lat, marcadorTemporario.lng]} />
              )}
            </MapContainer>
          </div>

          {/* Estatísticas */}
          <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px', fontSize: '0.9rem' }}>
              <div><strong>📊 Total:</strong> {equipamentos.length} equipamentos</div>
              <div><strong>✅ Ativos:</strong> {equipamentos.filter(e => e.ativo).length}</div>
              <div><strong>🌎 Centro:</strong> Brasil</div>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Cadastro */}
      {mostrarFormulario && mostrarMapa && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>➕ Cadastrar Novo Equipamento</h3>
          <form onSubmit={cadastrarEquipamento}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nome do Equipamento *</label>
              <input
                type="text"
                style={styles.input}
                value={novoEquipamento.nome}
                onChange={(e) => setNovoEquipamento({...novoEquipamento, nome: e.target.value})}
                required
                placeholder="Ex: Pluviometro_01"
              />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "15px" }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Latitude *</label>
                <input
                  type="number"
                  step="0.00000001"
                  style={styles.input}
                  value={novoEquipamento.latitude}
                  onChange={(e) => setNovoEquipamento({...novoEquipamento, latitude: e.target.value})}
                  required
                  min="-90"
                  max="90"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Longitude *</label>
                <input
                  type="number"
                  step="0.00000001"
                  style={styles.input}
                  value={novoEquipamento.longitude}
                  onChange={(e) => setNovoEquipamento({...novoEquipamento, longitude: e.target.value})}
                  required
                  min="-180"
                  max="180"
                />
              </div>
            </div>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Descrição</label>
              <input
                type="text"
                style={styles.input}
                value={novoEquipamento.descricao}
                onChange={(e) => setNovoEquipamento({...novoEquipamento, descricao: e.target.value})}
                placeholder="Ex: Estação localizada no centro da cidade"
              />
            </div>
            
            <button type="submit" style={{...styles.button, width: "100%"}} disabled={loading}>
              💾 Salvar Equipamento
            </button>
          </form>
        </div>
      )}

      {/* Lista de Equipamentos */}
      {!mostrarMapa && (
        <div style={styles.card}>
          <h3 style={{ marginTop: 0 }}>📋 Lista de Equipamentos ({equipamentos.length})</h3>
          
          {equipamentos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <div style={{ fontSize: '3rem' }}>📡</div>
              <p>Nenhum equipamento cadastrado ainda.</p>
              <p>Clique em "➕ Novo Equipamento" para começar.</p>
            </div>
          ) : (
            <div>
              {equipamentos.map((eq) => (
                <div key={eq.id} style={styles.equipamentoCard}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '5px' }}>
                      📡 {eq.nome}
                    </div>
                    {eq.descricao && (
                      <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '5px' }}>
                        {eq.descricao}
                      </div>
                    )}
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      📍 Lat: {parseFloat(eq.latitude).toFixed(6)}, Lng: {parseFloat(eq.longitude).toFixed(6)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '5px' }}>
                      📅 Cadastrado em: {new Date(eq.criado_em).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      style={{...styles.button, padding: '8px 16px', fontSize: '0.85rem'}}
                      onClick={() => {
                        setEquipamentoSelecionado(eq);
                        setMostrarMapa(true);
                      }}
                    >
                      🗺️ Ver
                    </button>
                    <button
                      style={styles.deleteButton}
                      onClick={() => deletarEquipamento(eq.id)}
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
        }

        input:focus, select:focus, button:focus {
          outline: none;
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.1);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
          margin: 10px;
        }
        
        .leaflet-control-zoom a {
          background-color: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #475569 !important;
        }
        
        .leaflet-control-zoom a:hover {
          background-color: #374151 !important;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
