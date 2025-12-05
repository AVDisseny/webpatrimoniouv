import { useState, useEffect } from 'react'
import './App.css'
import logoUV from './assets/uv-completo.jpg'

function App() {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])

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
                      // fallback: remove tags and common entities
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

        if (results.length === 0) {
          const respuesta = data.respuesta ?? data.resultado ?? 'No se encontraron resultados.';
          setMessages([
            lastMessage,
            { id: Date.now().toString(), text: respuesta, isUser: false }
          ]);
        } else {
          // Build a single combined bot message that contains all items (with plain URLs)
          const link = 'https://colecciones.uv.es/s/patrimonio-artistico-es/page/welcome';
          const ts = Date.now().toString();

          const imageFixed = 'https://colecciones.uv.es/files/original/ced7a5b304d827c31b4f31fab070763a43abf827.jpg';

          const combinedHtml = results
            .map((r, idx) => {
              const titulo = decodeHtml(r.titulo ?? r.title ?? 'Sin título');
              const ubicacion = decodeHtml(r.ubicacion ?? r.location ?? '');
              const descripcion = decodeHtml(r.descripcion ?? r.description ?? '');

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
              let textBlock = `${idx + 1}. ${titulo}`;
              if (ubicacion) textBlock += `\n📍Ubicación: ${ubicacion}`;
              if (autor) textBlock += `\n✍️Autor: ${autor}`;
              if (descripcion) textBlock += `\n📝Descripción: ${descripcion}`;

              const escaped = escapeHtml(textBlock).replace(/\n/g, '<br/>');
              const anchor = `<div class="result-link-html">🔗 Ver más: <a href="${link}" target="_blank" rel="noopener noreferrer" class="message-link">Colección</a></div>`;
              const imgTag = `<div class="item-image"> <img src="${imageFixed}" onerror="this.style.display='none'" alt="imagen"/> </div>`;

              return `<div class="result-item-html">${escaped}${anchor}${imgTag}</div>`;
            })
            .join('<hr class="item-sep"/>');

          setMessages([
            lastMessage,
            { id: `${ts}-combined`, html: combinedHtml, isUser: false }
          ]);
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

  // Convert plain URLs in text to anchors. It returns an HTML string.
  const formatTextWithLinks = (text) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    // Escape HTML to avoid accidental injection of markup except for URLs we convert.
  
    // First escape everything, then replace escaped URLs with anchor tags.
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
                <div className={`message-bubble ${msg.isUser ? 'user' : 'bot'}`}>
                  {msg.html ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.html }} />
                  ) : (
                    <p dangerouslySetInnerHTML={{ __html: formatTextWithLinks(msg.text) }}></p>
                  )}
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