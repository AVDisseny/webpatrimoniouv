import { useState, useEffect } from 'react'
import './App.css'
import logoUV from './assets/uv-completo.jpg'

function App() {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [expandedItems, setExpandedItems] = useState({})
  const [messagePages, setMessagePages] = useState({}) // Guarda la página actual de cada mensaje
  const itemsPerPage = 5

  const handleSend = () => {
    const message = text.trim();
    if (!message) return;

    const msgObj = { id: Date.now().toString(), text: message, isUser: true };
    setMessages([msgObj]);
    setText('');
  };

  const escapeHtml = (str) =>
      String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

  const decodeHtml = (html) => {
    if (!html) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(html), 'text/html');
      return doc.documentElement.textContent || '';
    } catch (e) {
      return String(html)
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage.isUser) return;

    async function fetchResponse() {
      try {
        const res = await fetch(
          `http://iacom.uv.es:50005/embeddings/retrieve?query=${encodeURIComponent(lastMessage.text)}`
        );

        if (!res.ok) {
          throw new Error('Error del servidor');
        }

        const data = await res.json();
        const results = data.results ?? data.resultados ?? [];
        const totalRegistros = results.length;
        const totalPages = Math.ceil(totalRegistros / itemsPerPage);

        if (results.length === 0) {
          const respuesta = data.respuesta ?? data.resultado ?? 'No se encontraron resultados.';
          setMessages([
            lastMessage,
            { id: Date.now().toString(), text: respuesta, isUser: false }
          ]);
        } else {
          

          const resultsData = results.map((r, idx) => {
            const titulo = decodeHtml(r.titulo ?? r.title ?? 'Sin título');
            const ubicacion = decodeHtml(r.ubicacion ?? r.location ?? '');
            const descripcion = decodeHtml(r.descripcion ?? r.description ?? '');
            const link = decodeHtml(r.link ?? r.url ?? '');
            const imagen = decodeHtml(r.imageURL ?? r.imagen ?? '');
            const coleccion = decodeHtml(r.coleccion ?? r.collection ?? '');

            let autor = '';
            const autorRaw = r.autor ?? r.author;
            if (autorRaw) {
              if (Array.isArray(autorRaw)) {
                autor = autorRaw.map((a) => decodeHtml(a)).join(', ');
              } else if (typeof autorRaw === 'string') {
                try {
                  const parsed = JSON.parse(autorRaw);
                  if (Array.isArray(parsed)) {
                    autor = parsed.map((a) => decodeHtml(a)).join(', ');
                  } else {
                    autor = decodeHtml(autorRaw);
                  }
                } catch {
                  autor = decodeHtml(autorRaw);
                }
              } else {
                autor = decodeHtml(String(autorRaw));
              }
            }

            return {
              id: `item-${idx}`,
              titulo,
              ubicacion,
              autor,
              descripcion,
              link,
              imagen,
              coleccion
            };
          });

          const messageId = Date.now().toString();
          setMessages([
            lastMessage,
            { 
              id: messageId, 
              results: resultsData, 
              totalRegistros,
              totalPages,
              isUser: false 
            }
          ]);
          // Inicializar la página en 1 para este mensaje
          setMessagePages(prev => ({
            ...prev,
            [messageId]: 1
          }));
        }

      } catch (err) {
        console.error('Error:', err);
        setMessages([
          lastMessage,
          { id: Date.now().toString() + '-err', text: '❌ Error al obtener respuesta del servidor.', isUser: false }
        ]);
      }
    }

    fetchResponse();
  }, [messages]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const formatTextWithLinks = (text) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const escaped = escapeHtml(text);
    return escaped.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="message-link">$1</a>');
  };

  return (
    <div className="app-container">
      <header className="site-header">
        <div className="header-content">
          <h1 className="header-title">Chat Patrimonio Universidad de Valencia</h1>
          <img src={logoUV} className="escudo" alt="Escudo Universidad de Valencia" />
        </div>
      </header>

      <main className="messages-area">
        <div className="messages-container">
          <div className="messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-wrapper ${msg.isUser ? 'user' : 'bot'}`}>
                <div className={`message-bubble ${msg.isUser ? 'user' : 'bot'} ${msg.results ? 'has-results' : ''}`}>
                  {msg.results ? (
                    <div className="results-container">
                      {/* Calcular qué items mostrar según la página actual */}
                      {(() => {
                        const currentPage = messagePages[msg.id] || 1;
                        const startIndex = (currentPage - 1) * itemsPerPage;
                        const endIndex = startIndex + itemsPerPage;
                        const currentResults = msg.results.slice(startIndex, endIndex);
                        
                        return currentResults.map((item, idx) => {
                        const isExpanded = expandedItems[item.id];
                        const truncatedDesc = item.descripcion.length > 100 
                          ? item.descripcion.substring(0, 100) + '...'
                          : item.descripcion;

                        return (
                          <div key={item.id} className="result-card">
                            <div className="card-image">
                              <img 
                                src={item.imagen} 
                                alt={item.titulo}
                                onError={(e) => e.target.style.display = 'none'}
                              />
                            </div>
                            
                            <div className="card-content">
                              <h3 className="card-title">{item.titulo}</h3>
                              
                              <div className="card-details">
                                {item.autor && (
                                  <p className="detail-item">
                                    <span className="detail-icon">✏️</span>
                                    <span className="detail-label">Autor:</span> {item.autor}
                                  </p>
                                )}

                                {item.coleccion && (
                                  <p className="detail-item">
                                    <span className="detail-icon">📂</span>
                                    <span className="detail-label">Coleccion:</span> {item.coleccion}
                                  </p>
                                )}
                                
                                {item.ubicacion && (
                                  <p className="detail-item">
                                    <span className="detail-icon">📍</span>
                                    <span className="detail-label">Ubicación:</span> {item.ubicacion}
                                  </p>
                                )}
                                
                                <p className="detail-item">
                                  <span className="detail-icon">🔗</span>
                                  <span className="detail-label">Ver más:</span>{' '}
                                  <a 
                                    href={item.link} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="card-category"
                                  >
                                    Pagina Coleccion
                                  </a>
                                </p>
                                
                                {item.descripcion && (
                                  <div className="detail-item description-container">
                                    <p className={`description-text ${isExpanded ? 'expanded' : ''}`}>
                                      {isExpanded ? item.descripcion : truncatedDesc}
                                      {item.descripcion.length > 100 && (
                                        <button 
                                          className="toggle-btn"
                                          onClick={() => toggleExpanded(item.id)}
                                        >
                                          {isExpanded ? ' menos' : ' más'}
                                        </button>
                                      )}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })})()}
                      
                      {/* Controles de paginación */}
                      {msg.totalPages > 1 && (
                        <div className="pagination-controls">
                          <button
                            className="pagination-btn"
                            onClick={() => {
                              const currentPage = messagePages[msg.id] || 1;
                              setMessagePages(prev => ({
                                ...prev,
                                [msg.id]: Math.max(1, currentPage - 1)
                              }));
                            }}
                            disabled={(messagePages[msg.id] || 1) === 1}
                          >
                            ← Anterior
                          </button>
                          
                          <div className="pagination-info">
                            Página {messagePages[msg.id] || 1} de {msg.totalPages}
                          </div>
                          
                          <button
                            className="pagination-btn"
                            onClick={() => {
                              const currentPage = messagePages[msg.id] || 1;
                              setMessagePages(prev => ({
                                ...prev,
                                [msg.id]: Math.min(msg.totalPages, currentPage + 1)
                              }));
                            }}
                            disabled={(messagePages[msg.id] || 1) === msg.totalPages}
                          >
                            Siguiente →
                          </button>
                        </div>
                      )}
                    </div>
                  ) : msg.text ? (
                    <p dangerouslySetInnerHTML={{ __html: formatTextWithLinks(msg.text) }}></p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="input-area">
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              className="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe tu pregunta aquí..."
              rows={1}
            />
            <button onClick={handleSend} disabled={!text.trim()} className="send-button">
              <svg className="send-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App