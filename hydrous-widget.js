// hydrous-widget.js
(function () {
  // Espacio de nombres global
  window.HydrousWidget = {};

  // Configuración por defecto
  const DEFAULT_CONFIG = {
    apiUrl: 'https://backend-chatbot-owzs.onrender.com/api',
    primaryColor: '#0891b2',
    secondaryColor: '#e0f2fe',
    position: 'right',
    title: 'Asistente Técnico',
    subtitle: 'Consultas sobre reciclaje de agua',
    maxFileSize: 5, // en MB
    allowedFileTypes: ['image/*', 'application/pdf', '.xls', '.xlsx', '.csv', '.doc', '.docx'],
    showBranding: true,
    autoOpen: false,
    autoOpenDelay: 5,
    language: 'es',
    enableFileUploads: true,
    mobile: {
      fullscreen: true,
      breakpoint: 768
    }
  };

  // Variables compartidas para acceder a elementos de la UI
  let uiElements = {};

  // Método de inicialización
  window.HydrousWidget.init = function (customConfig = {}) {
    // Combinar configuración
    const config = { ...DEFAULT_CONFIG, ...customConfig };

    // Guardar config gloabal para acceder desde funciones de PDF
    window.HydrousWidget.config = config;

    // Evitar duplicación
    if (document.getElementById('hydrous-chatbot-container')) {
      console.warn('Hydrous Widget ya está inicializado');
      return;
    }

    // Mostrar indicador de carga
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'hydrous-loading-indicator';
    loadingIndicator.innerHTML = `
      <div style="position: fixed; bottom: 20px; right: 20px; width: 64px; height: 64px; border-radius: 50%; 
                  background-color: #f1f5f9; display: flex; align-items: center; justify-content: center; z-index: 9998;">
        <div style="width: 30px; height: 30px; border: 3px solid #e2e8f0; 
                    border-top-color: #0891b2; border-radius: 50%; animation: hydrous-spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes hydrous-spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingIndicator);

    // Crear contenedor
    const container = document.createElement('div');
    container.id = 'hydrous-chatbot-container';
    document.body.appendChild(container);

    // Cargar librería para Markdown si no existe
    loadMarkdownLibrary();

    // Cargar estilos
    loadStyles(config);

    // cargar estilos específicos de para PDFs
    addPdfStyles(config);

    // Estado del widget
    const state = {
      isOpen: false,
      messages: [],
      conversationId: null,
      isTyping: false,
      selectedFile: null
    };

    // Crear interfaz
    createChatInterface(container, config, state);

    // Registrar inicio
    trackEvent('widget_initialized', config);

    // Quitar indicador de carga
    if (document.getElementById('hydrous-loading-indicator')) {
      document.getElementById('hydrous-loading-indicator').remove();
    }

    // Asignar la funcion de descarga al espacio global
    window.HydrousWidget.handlePdfDownload = handlePdfDownload;

  };

  // Cargar librería de Markdown
  function loadMarkdownLibrary() {
    if (window.marked) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked@4.0.0/marked.min.js';
    script.async = true;

    script.onload = function () {
      if (window.marked) {
        window.marked.setOptions({
          breaks: true,
          gfm: true,
          sanitize: false,
        });
      }
    };
    document.head.appendChild(script);

    const purifyScript = document.createElement('script');
    purifyScript.src = 'https://cdn.jsdelivr.net/npm/dompurify@2.3.1/dist/purify.min.js';
    purifyScript.async = true;
    document.head.appendChild(purifyScript);
  }

  // Función para trackear eventos
  function trackEvent(eventName, config, properties = {}) {
    if (window.location.hostname === 'localhost') return;

    const eventData = {
      event: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.origin,
      properties: {
        ...properties,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        userAgent: navigator.userAgent,
      }
    };

    try {
      fetch(`${config.apiUrl}/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        keepalive: true
      }).catch(() => { });
    } catch (e) {
      // Ignorar errores de analytics
    }
  }

  // Funciones para cache
  function saveToCache(key, data) {
    try {
      localStorage.setItem(`hydrous_${key}`, JSON.stringify(data));
    } catch (e) {
      console.log('Error al guardar en cache:', e);
    }
  }

  function getFromCache(key) {
    try {
      const data = localStorage.getItem(`hydrous_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.log('Error al leer de cache:', e);
      return null;
    }
  }

  // Cargar estilos necesarios
  function loadStyles(config) {
    const style = document.createElement('style');
    style.textContent = `
      #hydrous-chatbot-container {
        position: fixed;
        z-index: 9999;
        ${config.position === 'right' ? 'right: 20px;' : 'left: 20px;'}
        bottom: 20px;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      
      .hydrous-chat-button {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background-color: ${config.primaryColor};
        color: white;
        border: none;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .hydrous-chat-button:hover {
        transform: scale(1.05);
      }
      
      .hydrous-chat-window {
        width: 650px;
        height: 750px;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        background-color: white;
        border: 1px solid rgba(0, 0, 0, 0.1);
        animation: hydrous-slideUp 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      
      .hydrous-chat-header {
        padding: 18px 20px;
        background-color: ${config.primaryColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      
      .hydrous-header-title {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      
      .hydrous-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
      
      .hydrous-title-text {
        font-weight: 600;
        font-size: 17px;
        margin-bottom: 2px;
      }
      
      .hydrous-subtitle-text {
        font-size: 13px;
        opacity: 0.9;
      }
      
      .hydrous-header-actions {
        display: flex;
        gap: 10px;
      }
      
      .hydrous-btn {
        background-color: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        cursor: pointer;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s, transform 0.2s;
      }
      
      .hydrous-btn:hover {
        background-color: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }
      
      .hydrous-messages-container {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background-color: #f8fafc;
        background-image: radial-gradient(circle at center, rgba(8, 145, 178, 0.03) 0%, rgba(8, 145, 178, 0) 70%);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .hydrous-message {
        display: flex;
        flex-direction: column;
        max-width: 90%;
        animation: hydrous-fadeIn 0.3s ease;
      }
      
      .hydrous-message-user {
        align-self: flex-end;
      }
      
      .hydrous-message-bot {
        align-self: flex-start;
      }
      
      .hydrous-message-bubble {
        padding: 12px 16px;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        font-size: 14.5px;
        line-height: 1.6;
      }
      
      .hydrous-message-user .hydrous-message-bubble {
        background-color: ${config.primaryColor};
        color: white;
        border-radius: 16px 4px 16px 16px;
      }
      
      .hydrous-message-bot .hydrous-message-bubble {
        background-color: ${config.secondaryColor};
        color: #1e293b;
        border-radius: 4px 16px 16px 16px;
        border: 1px solid ${config.secondaryColor};
      }
      
      /* Estilos específicos para elementos Markdown */
      .hydrous-message-bot .hydrous-message-bubble code {
        background-color: rgba(0,0,0,0.05);
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 0.9em;
      }
      
      .hydrous-message-bot .hydrous-message-bubble pre {
        background-color: rgba(0,0,0,0.05);
        padding: 10px;
        border-radius: 4px;
        margin: 10px 0;
        overflow-x: auto;
      }
      
      .hydrous-message-bot .hydrous-message-bubble pre code {
        background-color: transparent;
        padding: 0;
        border-radius: 0;
        font-size: 13px;
        line-height: 1.5;
        color: #1e293b;
      }
      
      .hydrous-message-bot .hydrous-message-bubble ul, 
      .hydrous-message-bot .hydrous-message-bubble ol {
        margin-top: 8px;
        margin-bottom: 8px;
        padding-left: 24px;
      }
      
      .hydrous-message-bot .hydrous-message-bubble a {
        color: ${config.primaryColor};
        text-decoration: none;
      }
      
      .hydrous-message-bot .hydrous-message-bubble a:hover {
        text-decoration: underline;
      }
      
      .hydrous-message-bot .hydrous-message-bubble blockquote {
        border-left: 4px solid ${config.primaryColor}40;
        margin: 8px 0;
        padding-left: 12px;
        color: #475569;
      }
      
      .hydrous-message-bot .hydrous-message-bubble table {
        border-collapse: collapse;
        margin: 10px 0;
        width: 100%;
      }
      
      .hydrous-message-bot .hydrous-message-bubble table th,
      .hydrous-message-bot .hydrous-message-bubble table td {
        border: 1px solid #e2e8f0;
        padding: 6px 10px;
        text-align: left;
      }
      
      .hydrous-message-bot .hydrous-message-bubble table th {
        background-color: ${config.secondaryColor}80;
      }
      
      .hydrous-message-time {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 6px;
        padding: 0 4px;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .hydrous-bot-indicator {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: ${config.primaryColor};
        opacity: 0.4;
      }
      
      .hydrous-typing {
        display: flex;
        align-self: flex-start;
        background-color: ${config.secondaryColor};
        padding: 10px 16px;
        border-radius: 4px 16px 16px 16px;
        max-width: 85%;
        box-shadow: 0 2px 8px rgba(8, 145, 178, 0.08);
        border: 1px solid ${config.secondaryColor};
      }
      
      .hydrous-typing-dots {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .hydrous-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: ${config.primaryColor};
        animation: hydrous-pulse 1.2s infinite ease-in-out;
      }
      
      .hydrous-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .hydrous-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      .hydrous-typing-text {
        position: absolute;
        bottom: -18px;
        left: 10px;
        font-size: 10px;
        color: #94a3b8;
      }
      
      .hydrous-input-container {
        padding: 16px 20px;
        border-top: 1px solid #e2e8f0;
        background-color: white;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
      }
      
      .hydrous-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        position: relative;
        border-radius: 30px;
        background-color: #f8fafc;
        padding: 2px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        border: 1px solid #e2e8f0;
        overflow: hidden;
        min-height: 48px;
      }
      
      .hydrous-textarea-container {
        flex: 1;
        position: relative;
        overflow: hidden;
        transition: box-shadow 0.2s ease;
        min-height: 24px;
      }
      
      .hydrous-textarea {
        width: 100%;
        padding: 12px 16px;
        border: none;
        background: transparent;
        font-size: 15px;
        resize: none;
        min-height: 24px;
        max-height: 120px;
        outline: none;
        line-height: 1.5;
        transition: border-color 0.2s ease;
        font-family: inherit;
        overflow-y: auto;
        box-sizing: border-box;
        display: block;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      .hydrous-textarea:focus {
        border-color: ${config.primaryColor};
        box-shadow: 0 0 0 2px ${config.primaryColor}20, 0 2px 4px rgba(0,0,0,0.05);
      }
      
      .hydrous-textarea:disabled {
        background-color: #f8fafc;
        cursor: not-allowed;
      }
      
      .hydrous-file-btn {
        background-color: rgba(0, 0, 0, 0.05);
        border: none;
        color: #64748b;
        cursor: pointer;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        margin-right: 6px;
      }
      
      .hydrous-file-btn:hover {
        background-color: rgba(0, 0, 0, 0.1);
        transform: translateY(-2px);
      }
      
      .hydrous-file-info {
        display: block;
        font-size: 11px;
        color: ${config.primaryColor};
        margin-top: 4px;
      }
      
      .hydrous-file-preview {
        display: flex;
        align-items: center;
        background-color: #f1f5f9;
        border-radius: 8px;
        padding: 8px 12px;
        margin-top: 8px;
        gap: 10px;
      }
      
      .hydrous-file-preview-icon {
        color: ${config.primaryColor};
        flex-shrink: 0;
      }
      
      .hydrous-file-preview-name {
        font-size: 12px;
        flex-grow: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .hydrous-file-preview-remove {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
      }
      
      .hydrous-file-preview-remove:hover {
        background-color: rgba(0, 0, 0, 0.05);
        color: #64748b;
      }
      
      .hydrous-message-file {
        display: flex;
        align-items: center;
        background-color: #f1f5f9;
        border-radius: 8px;
        padding: 8px 12px;
        margin-top: 8px;
        gap: 10px;
        font-size: 13px;
      }
      
      .hydrous-message-file-icon {
        color: ${config.primaryColor};
      }
      
      .hydrous-message-file-name {
        flex-grow: 1;
      }
      
      .hydrous-send-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background-color: #e2e8f0;
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: not-allowed;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }
      
      .hydrous-send-btn.active {
        background-color: ${config.primaryColor};
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(8, 145, 178, 0.2);
      }
      
      .hydrous-send-btn.active:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(8, 145, 178, 0.25);
      }
      
      .hydrous-input-info {
        margin-top: 10px;
        font-size: 11px;
        color: #94a3b8;
        text-align: center;
      }
      
      .hydrous-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #64748b;
        text-align: center;
        padding: 20px;
      }
      
      .hydrous-empty-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background-color: #e0f2fe;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        box-shadow: 0 6px 16px rgba(8, 145, 178, 0.1);
      }
      
      .hydrous-empty-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #334155;
      }
      
      .hydrous-empty-text {
        font-size: 14px;
        max-width: 280px;
        line-height: 1.6;
        color: #64748b;
      }
      
      @keyframes hydrous-fadeIn {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes hydrous-slideUp {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes hydrous-pulse {
        0%, 100% {
          transform: scale(0.8);
          opacity: 0.6;
        }
        50% {
          transform: scale(1.2);
          opacity: 1;
        }
      }
      
      @media (max-width: 768px) {
        .hydrous-chat-window {
          width: 100vw;
          height: 100vh;
          border-radius: 0;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 10000;
        }
        
        .hydrous-messages-container {
          padding: 16px;
        }
        
        .hydrous-message {
          max-width: 95%;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Cargar estilos específicos para PDFs
  function addPdfStyles(config) {
    const style = document.createElement('style');
    style.textContent = `
    .hydrous-pdf-download-btn {
      display: inline-block;
      background-color: ${config.primaryColor};
      color: white;
      border: none;
      padding: 8px 16px;
      margin: 8px 0;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      box-shadow: 0 4px 10px rgba(8, 145, 178, 0.2);
    }
    
    .hydrous-pdf-download-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(8, 145, 178, 0.25);
    }
    
    .hydrous-pdf-download-btn:active {
      transform: translateY(0);
      box-shadow: 0 2px 5px rgba(8, 145, 178, 0.2);
    }
    
    .hydrous-download-info {
      position: fixed;
      bottom: 100px;
      right: 20px;
      background-color: ${config.primaryColor};
      color: white;
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: hydrous-fadeIn 0.3s ease;
    }
    
    #hydrous-download-frame {
      display: none;
      position: absolute;
      width: 0;
      height: 0;
      border: 0;
      pointer-events: none;
    }
    
    /* Estilo para iconos en botones */
    .hydrous-pdf-download-btn::before {
      content: "";
      display: inline-block;
      width: 16px;
      height: 16px;
      margin-right: 6px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'%3E%3C/path%3E%3Cpolyline points='7 10 12 15 17 10'%3E%3C/polyline%3E%3Cline x1='12' y1='15' x2='12' y2='3'%3E%3C/line%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      vertical-align: middle;
    }
  `;
    document.head.appendChild(style);
  }

  // Crear interfaz de chat
  function createChatInterface(container, config, state) {
    // Botón flotante
    const chatButton = document.createElement('button');
    chatButton.className = 'hydrous-chat-button';
    chatButton.setAttribute('aria-label', 'Abrir chat');
    chatButton.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="white" stroke-width="2"></path>
    </svg>
  `;
    container.appendChild(chatButton);

    // Ventana de chat (inicialmente oculta)
    const chatWindow = document.createElement('div');
    chatWindow.className = 'hydrous-chat-window';
    chatWindow.style.display = 'none';

    // Crear encabezado
    const header = createHeader(config, state);
    chatWindow.appendChild(header);

    // Crear contenedor de mensajes
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'hydrous-messages-container';

    // Estado vacío más neutral sin texto de bienvenida específico
    messagesContainer.innerHTML = `
    <div class="hydrous-empty-state">
      <div class="hydrous-empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="${config.primaryColor}" stroke-width="2"></path>
        </svg>
      </div>
      <h3 class="hydrous-empty-title">${config.title}</h3>
      <p class="hydrous-empty-text">
        Escriba su consulta para comenzar.
      </p>
    </div>
  `;
    chatWindow.appendChild(messagesContainer);

    // Crear área de entrada
    const inputContainer = document.createElement('div');
    inputContainer.className = 'hydrous-input-container';
    inputContainer.innerHTML = `
      <div class="hydrous-input-wrapper">
        <div class="hydrous-textarea-container">
          <textarea 
            class="hydrous-textarea" 
            placeholder="Escriba su consulta técnica..." 
            rows="1"
          ></textarea>
        </div>
        ${config.enableFileUploads ? `
        <button class="hydrous-file-btn" title="Adjuntar archivo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.44 11.05L12.25 20.24C11.1242 21.3658 9.59723 21.9983 8.005 21.9983C6.41277 21.9983 4.88584 21.3658 3.76 20.24C2.63416 19.1142 2.00166 17.5872 2.00166 15.995C2.00166 14.4028 2.63416 12.8758 3.76 11.75L12.33 3.18C13.0806 2.42949 14.0991 2.00052 15.16 2.00052C16.2209 2.00052 17.2394 2.42949 17.99 3.18C18.7406 3.93052 19.1695 4.94901 19.1695 6.01C19.1695 7.07099 18.7406 8.08948 17.99 8.84L9.41 17.41C9.03472 17.7853 8.5262 17.9961 7.995 17.9961C7.4638 17.9961 6.95528 17.7853 6.58 17.41C6.20472 17.0347 5.99389 16.5262 5.99389 15.995C5.99389 15.4638 6.20472 14.9553 6.58 14.58L15.07 6.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <input type="file" class="hydrous-file-input" style="display: none;" accept="${config.allowedFileTypes.join(',')}" />
        ` : ''}
        <button class="hydrous-send-btn" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" stroke-width="2"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" stroke-width="2"></polygon>
          </svg>
        </button>
      </div>
      <div class="hydrous-input-info">
        <span>Presione Enter para enviar, Shift+Enter para nueva línea</span>
        <span class="hydrous-file-info"></span>
      </div>
    `;
    chatWindow.appendChild(inputContainer);

    // Añadir ventana al contenedor
    container.appendChild(chatWindow);

    // Almacenar referencias a elementos clave
    uiElements = {
      container,
      chatButton,
      chatWindow,
      messagesContainer,
      inputContainer,
      textarea: inputContainer.querySelector('.hydrous-textarea'),
      sendButton: inputContainer.querySelector('.hydrous-send-btn'),
      fileButton: inputContainer.querySelector('.hydrous-file-btn'),
      fileInput: inputContainer.querySelector('.hydrous-file-input'),
      closeButton: chatWindow.querySelector('.hydrous-close-btn'),
      resetButton: chatWindow.querySelector('.hydrous-reset-btn')
    };

    // Configurar eventos
    setupEvents(config, state);
  }

  // Crear encabezado de chat
  function createHeader(config, state) {
    const header = document.createElement('div');
    header.className = 'hydrous-chat-header';

    header.innerHTML = `
      <div class="hydrous-header-title">
        <div class="hydrous-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="white" stroke-width="2"></path>
          </svg>
        </div>
        <div>
          <div class="hydrous-title-text">${config.title}</div>
          <div class="hydrous-subtitle-text">${config.subtitle}</div>
        </div>
      </div>
      <div class="hydrous-header-actions">
        <button class="hydrous-btn hydrous-reset-btn" title="Reiniciar conversación">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M23 20V14H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M20.49 9C19.9828 7.56678 19.1209 6.2854 17.9845 5.27542C16.8482 4.26543 15.4745 3.55976 13.9917 3.22426C12.5089 2.88875 10.9652 2.93434 9.50481 3.35677C8.04437 3.77921 6.71475 4.56471 5.64 5.64L1 10M23 14L18.36 18.36C17.2853 19.4353 15.9556 20.2208 14.4952 20.6432C13.0348 21.0657 11.4911 21.1112 10.0083 20.7757C8.52547 20.4402 7.1518 19.7346 6.01547 18.7246C4.87913 17.7146 4.01717 16.4332 3.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
        <button class="hydrous-btn hydrous-close-btn" title="Cerrar chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      </div>
    `;

    return header;
  }

  // Configurar eventos de la interfaz
  function setupEvents(config, state) {
    // Acceso directo a elementos clave
    const {
      chatButton,
      chatWindow,
      messagesContainer,
      inputContainer,
      textarea,
      sendButton,
      fileButton,
      fileInput,
      closeButton,
      resetButton
    } = uiElements;

    // Función central para actualizar estado del botón de envío
    function updateSendButton() {
      const hasText = textarea.value.trim().length > 0;
      const hasFile = state.selectedFile !== null;
      const canSend = (hasText || hasFile) && !state.isTyping;

      console.log("Estado del botón:", { hasText, hasFile, canSend });

      if (canSend) {
        sendButton.classList.add('active');
        sendButton.disabled = false;
      } else {
        sendButton.classList.remove('active');
        sendButton.disabled = true;
      }
    }

    // Función para enviar mensaje
    function sendMessage() {
      const messageText = textarea.value.trim();
      const hasFile = state.selectedFile !== null;

      // Verificar si hay contenido para enviar
      if (!(messageText || hasFile) || state.isTyping) {
        console.log("No hay contenido para enviar o el bot está escribiendo");
        return;
      }

      try {
        // Deshabilitar botón y textarea durante el envío
        sendButton.disabled = true;
        textarea.disabled = true;

        // Mostrar indicador visual de carga para archivos
        if (hasFile) {
          const fileInfo = inputContainer.querySelector('.hydrous-file-info');
          if (fileInfo) {
            fileInfo.textContent = "Enviando archivo...";
          }
        }

        // Añadir mensaje del usuario a la interfaz
        if (messageText) {
          addUserMessage(messagesContainer, messageText, state);
        } else if (hasFile) {
          // Si no hay texto pero hay archivo, añadir un mensaje "vacío"
          addUserMessage(messagesContainer, "", state);
        }

        // Si hay archivo adjunto, mostrarlo
        if (hasFile) {
          addFileToMessage(messagesContainer, state.selectedFile);
        }

        // Limpiar textarea
        textarea.value = '';
        textarea.style.height = '48px';

        // Crear una copia del archivo antes de enviar y limpiar
        const fileCopy = hasFile ? state.selectedFile : null;

        // Enviar mensaje y archivo al backend
        // IMPORTANTE: Pasar la copia del archivo, no la referencia en state
        sendMessageToAPI(messagesContainer, messageText, config, state, fileCopy);

        // Limpiar archivo adjunto DESPUÉS de enviarlo
        if (hasFile) {
          clearFilePreview(inputContainer, state);
        }

        // Registrar evento
        trackEvent('message_sent', config, { hasFile });

      } catch (error) {
        console.error("Error al enviar mensaje:", error);

        // Mostrar mensaje de error al usuario
        const fileInfo = inputContainer.querySelector('.hydrous-file-info');
        if (fileInfo) {
          fileInfo.textContent = "Error al enviar archivo. Intente de nuevo.";
        }
      } finally {
        // Rehabilitar controles
        textarea.disabled = false;
        textarea.focus();

        // Actualizar estado del botón
        updateSendButton();
      }
    }

    // Evento del botón flotante (abrir chat)
    chatButton.addEventListener('click', () => {
      state.isOpen = true;
      chatButton.style.display = 'none';
      chatWindow.style.display = 'flex';

      // Mostrar mensaje de bienvenida si el chat está vacío
      if (!messagesContainer.querySelector('.hydrous-message')) {
        startConversation(messagesContainer, config, state);
      }

      // Enfocar textarea
      setTimeout(() => textarea.focus(), 300);

      // Registrar evento
      trackEvent('chat_opened', config);
    });

    // Evento del botón de cierre
    closeButton.addEventListener('click', () => {
      state.isOpen = false;
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';

      // Registrar evento
      trackEvent('chat_closed', config);
    });

    // Evento del botón de reinicio
    resetButton.addEventListener('click', () => {
      if (confirm("¿Estás seguro que deseas reiniciar la conversación? Se perderá todo el historial.")) {
        resetConversation(messagesContainer, config, state);
        updateSendButton();
        // Registrar evento
        trackEvent('conversation_reset', config);
      }
    });

    // Eventos del textarea
    textarea.addEventListener('input', () => {
      // Ajustar altura automáticamente
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = newHeight + 'px';

      // Actualizar botón de envío
      updateSendButton();
    });

    // Evento de teclas en textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendButton.disabled) {
          sendMessage();
        }
      }
    });

    // Eventos de archivo (si está habilitado)
    if (fileButton && fileInput) {
      fileButton.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];

          // Verificar tamaño
          if (file.size > config.maxFileSize * 1024 * 1024) {
            const fileInfo = inputContainer.querySelector('.hydrous-file-info');
            fileInfo.textContent = `Error: El archivo excede el límite de ${config.maxFileSize}MB`;
            fileInput.value = '';
            return;
          }

          // Guardar archivo en estado
          state.selectedFile = file;

          // Mostrar vista previa
          showFilePreview(inputContainer, file, state);

          // Actualizar botón de envío
          updateSendButton();
        }
      });
    }

    // Evento del botón de envío
    sendButton.addEventListener('click', function () {
      console.log("Botón de envío clickeado, disabled:", sendButton.disabled);
      if (!sendButton.disabled) {
        sendMessage();
      }
    });

    // Definir la función clearFilePreview en espacio global
    window.HydrousWidget.clearFilePreview = function (container, state) {
      // Limpiar estado
      state.selectedFile = null;

      // Limpiar input de archivo
      if (fileInput) {
        fileInput.value = '';
      }

      // Eliminar vista previa
      const preview = container.querySelector('.hydrous-file-preview');
      if (preview) {
        preview.parentNode.removeChild(preview);
      }

      // Limpiar cualquier mensaje de estado sobre el archivo
      const fileInfo = container.querySelector('.hydrous-file-info');
      if (fileInfo) {
        fileInfo.textContent = '';
      }

      // Actualizar el estado del botón de envío
      updateSendButton();
    };
  }

  // Iniciar conversación
  async function startConversation(messagesContainer, config, state) {
    try {
      // Limpiar contenedor de mensajes
      messagesContainer.innerHTML = '';

      // Inicializar estado
      state.conversationStarted = false;
      state.conversationId = null;

      // Intentar recuperar de cache
      const cachedConversation = getFromCache('last_conversation');
      if (cachedConversation && cachedConversation.id) {
        state.conversationId = cachedConversation.id;

        // Mostrar mensajes de cache
        if (cachedConversation.messages && cachedConversation.messages.length > 0) {
          cachedConversation.messages.forEach(msg => {
            if (msg.role === 'assistant') {
              addBotMessage(messagesContainer, msg.content, state, false);
            } else if (msg.role === 'user') {
              addUserMessage(messagesContainer, msg.content, state, false);
            }
          });
        }

        // Verificar con el backend si la conversación sigue activa
        try {
          const response = await fetch(`${config.apiUrl}/chat/${state.conversationId}`);
          if (!response.ok) {
            throw new Error('Conversación no encontrada');
          }
        } catch (e) {
          // Si hay error, iniciar nueva conversación
          state.conversationId = null;
          messagesContainer.innerHTML = '';
        }
      }

      // Si no hay conversación en cache o no es válida, mostrar estado vacío
      if (!state.conversationId) {
        messagesContainer.innerHTML = `
          <div class="hydrous-empty-state">
            <div class="hydrous-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="${config.primaryColor}" stroke-width="2"></path>
              </svg>
            </div>
            <h3 class="hydrous-empty-title">${config.title}</h3>
            <p class="hydrous-empty-text">
              Escriba su consulta para comenzar.
            </p>
          </div>
        `;
      }

    } catch (err) {
      console.error('Error al preparar conversación:', err);
      // Mostrar mensaje de error
      addBotMessage(messagesContainer, "Error de conexión. Por favor, recarga la página.", state);
    } finally {
      state.isTyping = false;
    }
  }

  // Reiniciar conversación
  function resetConversation(messagesContainer, config, state) {
    // Limpiar localStorage
    localStorage.removeItem('hydrous_conversation_id');
    localStorage.removeItem('hydrous_last_conversation');

    // Limpiar estado
    state.conversationId = null;
    state.messages = [];
    state.isConversationStarted = false;
    state.selectedFile = null;

    // Limpiar UI
    messagesContainer.innerHTML = '';

    // Limpiar también cualquier archivo adjunto
    if (uiElements.fileInput) {
      uiElements.fileInput.value = '';
    }

    const filePreview = uiElements.inputContainer.querySelector('.hydrous-file-preview');
    if (filePreview) {
      filePreview.parentNode.removeChild(filePreview);
    }

    // Mostrar estado vacío
    messagesContainer.innerHTML = `
      <div class="hydrous-empty-state">
        <div class="hydrous-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="${config.primaryColor}" stroke-width="2"></path>
          </svg>
        </div>
        <h3 class="hydrous-empty-title">${config.title}</h3>
        <p class="hydrous-empty-text">
          Conversación reiniciada. Escriba su consulta para comenzar.
        </p>
      </div>
    `;

    // Registrar evento
    trackEvent('conversation_reset', config);
  }

  // Enviar mensaje a la API
  async function sendMessageToAPI(messagesContainer, message, config, state, fileToUpload) {
    try {
      // Verificar conexión
      if (!navigator.onLine) {
        throw new Error("Sin conexión a internet");
      }

      // Actualizar estado
      state.isTyping = true;

      // Mostrar indicador de escritura
      showTypingIndicator(messagesContainer);

      // Si es el primer mensaje, iniciar la conversación
      if (!state.conversationId || !state.conversationStarted) {
        try {
          const response = await fetch(`${config.apiUrl}/chat/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }

          const data = await response.json();
          state.conversationId = data.id;
          state.conversationStarted = true;

          // Guardar en localStorage
          localStorage.setItem('hydrous_conversation_id', data.id);

        } catch (err) {
          console.error('Error al iniciar conversación:', err);
          clearTypingIndicator(messagesContainer);
          addBotMessage(messagesContainer, "Lo siento, no puedo conectar con el asistente. Por favor, intenta de nuevo más tarde.", state);
          state.isTyping = false;
          return;
        }
      }

      // Si no hay ID de conversación, mostrar error
      if (!state.conversationId) {
        clearTypingIndicator(messagesContainer);
        addBotMessage(messagesContainer, "Lo siento, ha ocurrido un error al conectar con el asistente. Por favor, recarga la página e intenta de nuevo.", state);
        state.isTyping = false;
        return;
      }

      // Procesar mensaje con o sin archivo
      if (fileToUpload) {
        // Enviar mensaje con archivo
        console.log("Enviando archivo:", fileToUpload.name);

        const formData = new FormData();
        formData.append('conversation_id', state.conversationId);
        formData.append('message', message || '');
        formData.append('file', fileToUpload);

        try {
          const response = await fetch(`${config.apiUrl}/documents/upload`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
          }

          const data = await response.json();
          clearTypingIndicator(messagesContainer);
          addBotMessage(messagesContainer, data.message || "Archivo recibido. Estamos procesando su contenido.", state);
          updateCachedMessages(state.conversationId, message, data.message || "Archivo recibido. Estamos procesando su contenido.");
        } catch (error) {
          console.error("Error al subir archivo:", error);
          clearTypingIndicator(messagesContainer);
          addBotMessage(messagesContainer, "Lo siento, ha ocurrido un error al subir el archivo. Por favor, intenta de nuevo más tarde.", state);
        }
      } else {
        // Enviar solo mensaje
        const response = await fetch(`${config.apiUrl}/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            conversation_id: state.conversationId,
            message: message
          })
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        clearTypingIndicator(messagesContainer);
        addBotMessage(messagesContainer, data.message, state);
        updateCachedMessages(state.conversationId, message, data.message);
      }

    } catch (err) {
      console.error('Error al enviar mensaje:', err);

      // Mensaje de error adaptado
      let errorMessage = "Lo siento, ha ocurrido un error al procesar tu mensaje.";

      if (err.message === "Sin conexión a internet") {
        errorMessage = "No hay conexión a internet. Por favor, verifica tu conexión e intenta nuevamente.";
      } else if (err.message.includes("404")) {
        errorMessage = "No se pudo conectar con el servidor. Por favor, intenta más tarde.";
      } else if (err.message.includes("timeout")) {
        errorMessage = "La conexión tardó demasiado. Por favor, intenta nuevamente.";
      }

      clearTypingIndicator(messagesContainer);
      addBotMessage(messagesContainer, errorMessage, state);

    } finally {
      state.isTyping = false;
    }
  }

  // Actualizar mensajes en cache
  function updateCachedMessages(conversationId, userMessage, botMessage) {
    try {
      const cached = getFromCache('last_conversation');
      if (cached && cached.id === conversationId) {
        const messages = cached.messages || [];

        // Añadir nuevos mensajes
        messages.push(
          { role: 'user', content: userMessage, timestamp: new Date() },
          { role: 'assistant', content: botMessage, timestamp: new Date() }
        );

        // Limitar a los últimos 20 mensajes
        if (messages.length > 20) {
          messages.splice(0, messages.length - 20);
        }

        // Guardar
        saveToCache('last_conversation', {
          id: conversationId,
          messages: messages
        });
      }
    } catch (e) {
      console.log('Error al actualizar cache:', e);
    }
  }

  // Añadir mensaje del usuario a la interfaz
  function addUserMessage(messagesContainer, message, state, animate = true) {
    // Eliminar estado vacío si existe
    const emptyState = messagesContainer.querySelector('.hydrous-empty-state');
    if (emptyState) {
      messagesContainer.removeChild(emptyState);
    }

    // Crear elemento de mensaje
    const messageEl = document.createElement('div');
    messageEl.className = 'hydrous-message hydrous-message-user';
    if (!animate) {
      messageEl.style.animation = 'none';
    }

    // Formatear hora
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Contenido del mensaje (incluso si está vacío para adjuntar el archivo)
    messageEl.innerHTML = `
      <div class="hydrous-message-bubble">${message ? escapeHtml(message) : ''}</div>
      <div class="hydrous-message-time">${time}</div>
    `;

    // Añadir a contenedor
    messagesContainer.appendChild(messageEl);

    // Scroll al final
    scrollToBottom(messagesContainer);
  }

  // Funcion para procesar mensajes y detectar enlaces de PDF
  function processMessageContent(content, config) {
    if (!content) return content;

    // Detectar enlaces de descarga de PDF
    const pdfLinkRegex = /\[DESCARGAR PROPUESTA EN PDF\]\(([^)]+)\)/g;

    let modifiedContent = content;
    let match;

    while ((match = pdfLinkRegex.exec(content)) !== null) {
      // Extraer URL del enlace
      const originalUrl = match[1];

      // Extraer ID de conversación
      const conversationIdMatch = originalUrl.match(/\/api\/chat\/([^\/]+)\/download-pdf/);

      if (conversationIdMatch && conversationIdMatch[1]) {
        const conversationId = conversationIdMatch[1];

        // Crear botón personalizado para descargar
        const replacementButton = `<button class="hydrous-pdf-download-btn" data-conversation-id="${conversationId}">DESCARGAR PROPUESTA EN PDF</button>`;

        // Reemplazar en el mensaje
        modifiedContent = modifiedContent.replace(match[0], replacementButton);
      }
    }

    return modifiedContent;
  }


  // Función para manejar la descarga del PDF
  async function handlePdfDownload(conversationId, config) {
    // Mostrar indicador de carga
    const infoElement = document.createElement('div');
    infoElement.className = 'hydrous-download-info';
    infoElement.textContent = 'Preparando descarga...';
    infoElement.style = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    background-color: ${config.primaryColor};
    color: white;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
    document.body.appendChild(infoElement);

    try {
      // Intentar método 1: URL directa con data-URL fallback
      const downloadUrl = `${config.apiUrl}/pdf/${conversationId}/download`;

      // Crear iframe oculto
      let downloadFrame = document.getElementById('hydrous-download-frame');
      if (!downloadFrame) {
        downloadFrame = document.createElement('iframe');
        downloadFrame.id = 'hydrous-download-frame';
        downloadFrame.style.display = 'none';
        document.body.appendChild(downloadFrame);
      }

      // Primero intentar abrir en nueva ventana (esto puede ser bloqueado)
      const newWindow = window.open(downloadUrl, '_blank');

      // Si se bloqueó la ventana nueva o no se pudo abrir, intentar con iframe
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Actualizar mensaje
        infoElement.textContent = 'Iniciando descarga...';

        // Intentar usando iframe
        downloadFrame.src = downloadUrl;

        // Esperar un momento para ver si funciona
        setTimeout(async () => {
          try {
            // Si el iframe no funciona, intentar con data URL
            const response = await fetch(`${config.apiUrl}/pdf/${conversationId}/data-url`);

            if (!response.ok) {
              throw new Error('Error al obtener la URL de datos');
            }

            const data = await response.json();

            if (data && data.data_url) {
              // Crear un enlace para descarga directa
              const a = document.createElement('a');
              a.href = data.data_url;
              a.download = data.filename || 'propuesta-hydrous.pdf';
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();

              // Limpiar
              setTimeout(() => {
                document.body.removeChild(a);
                infoElement.textContent = 'Descarga completada.';

                // Eliminar mensaje después de 3 segundos
                setTimeout(() => {
                  if (document.body.contains(infoElement)) {
                    document.body.removeChild(infoElement);
                  }
                }, 3000);
              }, 1000);
            } else {
              throw new Error('Formato de respuesta inválido');
            }
          } catch (error) {
            console.error('Error al intentar métodos alternativos de descarga:', error);
            infoElement.textContent = 'Error al descargar. Intente de nuevo.';

            // Eliminar mensaje de error después de 3 segundos
            setTimeout(() => {
              if (document.body.contains(infoElement)) {
                document.body.removeChild(infoElement);
              }
            }, 3000);
          }
        }, 2000);
      } else {
        // Si se abrió la ventana correctamente
        infoElement.textContent = 'Descarga iniciada en nueva pestaña.';

        // Eliminar mensaje después de 3 segundos
        setTimeout(() => {
          if (document.body.contains(infoElement)) {
            document.body.removeChild(infoElement);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('Error al iniciar descarga:', error);
      infoElement.textContent = 'Error al descargar. Intente de nuevo.';

      // Eliminar mensaje de error después de 3 segundos
      setTimeout(() => {
        if (document.body.contains(infoElement)) {
          document.body.removeChild(infoElement);
        }
      }, 3000);
    }
  }

  // Añadir mensaje del bot a la interfaz
  function addBotMessage(messagesContainer, message, state, animate = true) {
    // Eliminar estado vacío si existe
    const emptyState = messagesContainer.querySelector('.hydrous-empty-state');
    if (emptyState) {
      messagesContainer.removeChild(emptyState);
    }

    // Crear elemento de mensaje
    const messageEl = document.createElement('div');
    messageEl.className = 'hydrous-message hydrous-message-bot';
    if (!animate) {
      messageEl.style.animation = 'none';
    }

    // Formatear hora
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Convertir Markdown a HTML
    let formattedMessage = '';

    try {
      if (window.marked && window.DOMPurify) {
        // Procesar primero los enlaces de PDF
        const processedMessage = processMessageContent(message, window.HydrousWidget.config || {});
        // Luego convertir a HTML
        formattedMessage = window.DOMPurify.sanitize(window.marked.parse(processedMessage));
      } else {
        formattedMessage = escapeHtml(message);
      }
    } catch (e) {
      console.error('Error al procesar Markdown:', e);
      formattedMessage = escapeHtml(message);
    }

    // Contenido del mensaje
    messageEl.innerHTML = `
    <div class="hydrous-message-bubble">${formattedMessage}</div>
    <div class="hydrous-message-time">
      <span class="hydrous-bot-indicator"></span>
      ${time}
    </div>
  `;

    // Añadir a contenedor
    messagesContainer.appendChild(messageEl);

    // Añadir evento click a botones de descarga
    const downloadButtons = messageEl.querySelectorAll('.hydrous-pdf-download-btn');
    downloadButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const conversationId = button.getAttribute('data-conversation-id');
        if (conversationId) {
          handlePdfDownload(conversationId, window.HydrousWidget.config || {});
        }
      });
    });

    // Scroll al final
    scrollToBottom(messagesContainer);
  }

  // Mostrar indicador de escritura
  function showTypingIndicator(messagesContainer) {
    // Eliminar indicador existente
    clearTypingIndicator(messagesContainer);

    // Crear indicador
    const typingEl = document.createElement('div');
    typingEl.className = 'hydrous-typing';
    typingEl.innerHTML = `
      <div class="hydrous-typing-dots">
        <span class="hydrous-dot"></span>
        <span class="hydrous-dot"></span>
        <span class="hydrous-dot"></span>
      </div>
      <div class="hydrous-typing-text">escribiendo...</div>
    `;

    // Añadir a contenedor
    messagesContainer.appendChild(typingEl);

    // Scroll al final
    scrollToBottom(messagesContainer);
  }

  // Limpiar indicador de escritura
  function clearTypingIndicator(messagesContainer) {
    const typingEl = messagesContainer.querySelector('.hydrous-typing');
    if (typingEl) {
      messagesContainer.removeChild(typingEl);
    }
  }

  // Función para mostrar vista previa del archivo
  function showFilePreview(inputContainer, file, state) {
    // Limpiar previa vista previa
    window.HydrousWidget.clearFilePreview(inputContainer, state);

    // Crear elemento de vista previa
    const previewContainer = document.createElement('div');
    previewContainer.className = 'hydrous-file-preview';

    // Icono según tipo de archivo
    const iconSvg = getFileIcon(file.type);

    // Formato del tamaño de archivo
    const fileSize = formatFileSize(file.size);

    previewContainer.innerHTML = `
      <div class="hydrous-file-preview-icon">${iconSvg}</div>
      <div class="hydrous-file-preview-name" title="${file.name}">${file.name} (${fileSize})</div>
      <button class="hydrous-file-preview-remove" title="Eliminar archivo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    // Añadir al contenedor
    inputContainer.querySelector('.hydrous-input-info').appendChild(previewContainer);

    // Configurar evento para eliminar archivo
    previewContainer.querySelector('.hydrous-file-preview-remove').addEventListener('click', () => {
      window.HydrousWidget.clearFilePreview(inputContainer, state);
    });

    // Mostrar mensaje indicando que puede enviarse
    const fileInfo = inputContainer.querySelector('.hydrous-file-info');
    if (fileInfo) {
      fileInfo.textContent = "Archivo listo para enviar";
    }
  }

  // Añadir archivo al mensaje
  function addFileToMessage(messagesContainer, file) {
    // Obtener último mensaje del usuario
    const lastMessage = messagesContainer.querySelector('.hydrous-message-user:last-child');

    if (lastMessage) {
      // Crear elemento de archivo
      const fileElement = document.createElement('div');
      fileElement.className = 'hydrous-message-file';

      // Icono según tipo de archivo
      const iconSvg = getFileIcon(file.type);

      // Formato del tamaño de archivo
      const fileSize = formatFileSize(file.size);

      fileElement.innerHTML = `
        <div class="hydrous-message-file-icon">${iconSvg}</div>
        <div class="hydrous-message-file-name">${file.name} (${fileSize})</div>
      `;

      // Añadir al mensaje
      lastMessage.querySelector('.hydrous-message-bubble').appendChild(fileElement);
    }
  }

  // Función auxiliar para formatear el tamaño del archivo
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // Limpiar vista previa de archivo
  function clearFilePreview(inputContainer, state) {
    // Limpiar estado
    state.selectedFile = null;

    // Limpiar input de archivo
    const fileInput = uiElements.fileInput;
    if (fileInput) {
      fileInput.value = '';
    }

    // Eliminar vista previa
    const preview = inputContainer.querySelector('.hydrous-file-preview');
    if (preview) {
      preview.parentNode.removeChild(preview);
    }

    // Limpiar cualquier mensaje de estado sobre el archivo
    const fileInfo = inputContainer.querySelector('.hydrous-file-info');
    if (fileInfo) {
      fileInfo.textContent = '';
    }

    // Si hay sendButton accesible, actualizar su estado
    if (uiElements.sendButton) {
      const hasText = uiElements.textarea && uiElements.textarea.value.trim().length > 0;

      if (hasText && !state.isTyping) {
        uiElements.sendButton.classList.add('active');
        uiElements.sendButton.disabled = false;
      } else {
        uiElements.sendButton.classList.remove('active');
        uiElements.sendButton.disabled = true;
      }
    }
  }

  // Obtener icono según tipo de archivo
  function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
        <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else if (mimeType.includes('pdf')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 12H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 12H8.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 16H8.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 13H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 17H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 9H9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else if (mimeType.includes('doc') || mimeType.includes('word')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    } else {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
  }

  // Hacer scroll al final de los mensajes
  function scrollToBottom(messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Escapar HTML para prevenir XSS
  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }
})();
