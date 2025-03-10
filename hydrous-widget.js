// hydrous-widget.js
(function () {
  // Espacio de nombres global
  window.HydrousWidget = {};

  // Configuración por defecto
  const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:8000/api',  // Esta URL se cambiará a tu backend desplegado
    primaryColor: '#0891b2',
    secondaryColor: '#e0f2fe',
    position: 'right',
    title: 'Asistente Técnico',
    subtitle: 'Consultas sobre reciclaje de agua',
    maxFileSize: 5, // en MB
    allowedFileTypes: ['image/*', 'application/pdf', '.xls', '.xlsx', '.csv', '.doc', '.docx'],
    showBranding: true,
    autoOpen: false, // abrir automáticamente después de X segundos
    autoOpenDelay: 5, // segundos para autoOpen
    language: 'es',
    enableFileUploads: true,
    mobile: {
      fullscreen: true, // pantalla completa en móviles
      breakpoint: 768 // tamaño para considerar móvil
    }
  };

  // Método de inicialización
  window.HydrousWidget.init = function (customConfig = {}) {
    // Combinar configuración
    const config = { ...DEFAULT_CONFIG, ...customConfig };

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

    // Cargar estilos
    loadStyles(config);

    // Estado del widget
    const state = {
      isOpen: false,
      messages: [],
      conversationId: null,
      isTyping: false
    };

    // Crear interfaz
    createChatInterface(container, config, state);

    // Registrar inicio
    trackEvent('widget_initialized', config);

    // Quitar indicador de carga
    if (document.getElementById('hydrous-loading-indicator')) {
      document.getElementById('hydrous-loading-indicator').remove();
    }
  };

  // Función para trackear eventos
  function trackEvent(eventName, config, properties = {}) {
    // No rastrear en modo desarrollo
    if (window.location.hostname === 'localhost') return;

    // Datos básicos
    const eventData = {
      event: eventName,
      timestamp: new Date().toISOString(),
      url: window.location.origin,
      // Evitar información sensible
      properties: {
        ...properties,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        userAgent: navigator.userAgent,
      }
    };

    // Enviar al backend
    try {
      fetch(`${config.apiUrl}/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        // No esperar respuesta
        keepalive: true
      }).catch(() => { });
    } catch (e) {
      // Ignorar errores de analytics
    }
  }

  // Función para cache
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
        width: 380px;
        height: 600px;
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
        max-width: 85%;
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
        overflow: hidden; /* iMPORTARNTE PARA EVITAR DESBORDAMIENTO */
      }
      
      .hydrous-textarea-container {
        flex: 1;
        position: relative;
        overflow: hidden;
        transition: box-shadow 0.2s ease;
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
      
      @media (max-width: 480px) {
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
    messagesContainer.innerHTML = `
      <div class="hydrous-empty-state">
        <div class="hydrous-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="${config.primaryColor}" stroke-width="2"></path>
          </svg>
        </div>
        <h3 class="hydrous-empty-title">Asistente de Reciclaje de Agua</h3>
        <p class="hydrous-empty-text">
          Inicie una consulta sobre nuestras soluciones tecnológicas para el tratamiento y reciclaje de agua.
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

    // Configurar eventos
    setupEvents(chatButton, chatWindow, messagesContainer, inputContainer, config, state);
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
  function setupEvents(chatButton, chatWindow, messagesContainer, inputContainer, config, state) {
    // Referencias a elementos
    const closeButton = chatWindow.querySelector('.hydrous-close-btn');
    const resetButton = chatWindow.querySelector('.hydrous-reset-btn');
    const textarea = inputContainer.querySelector('.hydrous-textarea');
    const sendButton = inputContainer.querySelector('.hydrous-send-btn');
    const fileButton = inputContainer.querySelector('.hydrous-file-btn');
    const fileInput = inputContainer.querySelector('.hydrous-file-input');

    // Estado para el archivo
    state.selectedFile = null;

    // Evento de botón flotante para abrir
    chatButton.addEventListener('click', () => {
      state.isOpen = true;
      chatButton.style.display = 'none';
      chatWindow.style.display = 'flex';

      // Mostar mensaje de bienvenida si el chat esta vacio
      if (messagesContainer.querySelector('.hydrous-message')) {
        startConversation(messagesContainer, config, state);
      }

      // Enfocar textarea
      setTimeout(() => textarea.focus(), 300);

      // Registrar evento
      trackEvent('chat_opened', config);
    });

    // Evento de botón de cierre
    closeButton.addEventListener('click', () => {
      state.isOpen = false;
      chatWindow.style.display = 'none';
      chatButton.style.display = 'flex';

      // Registrar evento
      trackEvent('chat_closed', config);
    });

    // Evento de botón de reinicio
    resetButton.addEventListener('click', () => {
      if (confirm("¿Estás seguro que deseas reiniciar la conversación? Se perderá todo el historial.")) {
        resetConversation(messagesContainer, config, state);

        // Registrar evento
        trackEvent('conversation_reset', config);
      }
    });

    // Eventos de textarea
    textarea.addEventListener('input', () => {
      // Auto-expandir altura
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';

      // Activar/desactivar botón de envío
      if (textarea.value.trim() && !state.isTyping) {
        sendButton.classList.add('active');
        sendButton.disabled = false;
      } else {
        sendButton.classList.remove('active');
        sendButton.disabled = true;
      }
    });

    // Configurar eventos de archivo si está habilitado
    if (fileButton && fileInput) {
      // Evento para botón de archivo
      fileButton.addEventListener('click', () => {
        fileInput.click();
      });

      // Evento para cambio en input de archivo
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];

          // Verificar tamaño (máximo configurado)
          if (file.size > config.maxFileSize * 1024 * 1024) {
            const fileInfo = inputContainer.querySelector('.hydrous-file-info');
            fileInfo.textContent = `Error: El archivo excede el límite de ${config.maxFileSize}MB`;
            fileInput.value = '';
            return;
          }

          // Guardar archivo seleccionado
          state.selectedFile = file;

          // Mostrar información del archivo
          showFilePreview(inputContainer, file, state);
        }
      });
    }

    // Evento de envío de mensajes
    const sendMessage = () => {
      const message = textarea.value.trim();
      if ((!message && !state.selectedFile) || state.isTyping) return;

      // Añadir mensaje a la interfaz
      addUserMessage(messagesContainer, message, state);

      // Si hay archivo, mostrarlo en el mensaje
      if (state.selectedFile) {
        addFileToMessage(messagesContainer, state.selectedFile);
      }

      // Limpiar y resetear textarea
      textarea.value = '';
      textarea.style.height = 'auto';
      sendButton.classList.remove('active');
      sendButton.disabled = true;

      // Enviar a la API (con archivo si existe)
      sendMessageToAPI(messagesContainer, message, config, state);

      // Limpiar archivo
      if (state.selectedFile) {
        clearFilePreview(inputContainer, state);
      }

      // Registrar evento
      trackEvent('message_sent', config, { hasFile: !!state.selectedFile });
    };

    // Enviar con botón
    sendButton.addEventListener('click', sendMessage);

    // Enviar con Enter (no Shift+Enter)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Iniciar conversación
  async function startConversation(messagesContainer, config, state) {
    try {
      // Limpiar contenedor de mensajes (por si hay mensajes de error)
      messagesContainer.innerHTML = '';

      // Mostrar mensaje de bienvenida directamente desde el frontend
      const welcomeMessage = config.welcomeMessage || "Bienvenido a HydrousAI. En que puedo ayudarte?";
      addBotMessage(messagesContainer, welcomeMessage, state);

      // No conectamos con el backend hasta que el usuario envie su primer mensaje
      state.conversationStarted = false;
      state.conversationId = null;

      //Hacer scroll al mensaje
      scrollToBottom(messagesContainer);


      // Intentar recuperar de cache primero
      const cachedConversation = getFromCache('last_conversation');
      if (cachedConversation && cachedConversation.id) {
        state.conversationId = cachedConversation.id;

        // Mostrar mensajes de cache mientras se valida
        if (cachedConversation.messages && cachedConversation.messages.length > 0) {
          cachedConversation.messages.forEach(msg => {
            if (msg.role === 'assistant') {
              addBotMessage(messagesContainer, msg.content, state, false);
            } else if (msg.role === 'user') {
              addUserMessage(messagesContainer, msg.content, state, false);
            }
          });
        }

        // Verificar si la conversación sigue activa en el servidor
        try {
          const response = await fetch(`${config.apiUrl}/chat/${state.conversationId}`);
          if (!response.ok) {
            throw new Error('Conversación no encontrada');
          }
        } catch (e) {
          // Si hay error, iniciar nueva conversación
          state.conversationId = null;
          // Limpiar mensajes mostrados de cache
          messagesContainer.innerHTML = '';
        }
      }

      // Si no hay conversación en cache o no es válida, crear nueva
      if (!state.conversationId) {
        state.isTyping = true;

        // Mostrar indicador de escritura
        showTypingIndicator(messagesContainer);

        // Llamar API para iniciar conversación
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

        // Guardar ID de conversación
        state.conversationId = data.id;
        localStorage.setItem('hydrous_conversation_id', data.id);

        // Limpiar indicador de escritura
        clearTypingIndicator(messagesContainer);

        // Mostrar mensajes iniciales
        const visibleMessages = data.messages
          .filter(msg => msg.role !== 'system')
          .forEach(msg => {
            if (msg.role === 'assistant') {
              addBotMessage(messagesContainer, msg.content, state);
            }
          });

        // Guardar en cache
        saveToCache('last_conversation', {
          id: state.conversationId,
          messages: data.messages
        });
      }

    } catch (err) {
      console.error('Error al iniciar conversación:', err);

      // Mensaje de error
      clearTypingIndicator(messagesContainer);
      addBotMessage(messagesContainer, "Lo siento, ha ocurrido un error al iniciar el chat. Por favor, intenta nuevamente.", state);

    } finally {
      state.isTyping = false;
    }
  }

  // Reiniciar conversación
  function resetConversation(messagesContainer, config, state) {
    // Limpiar localStorage
    localStorage.removeItem('hydrous_conversation_id');

    // Limpiar estado
    state.conversationId = null;
    state.messages = [];

    // Limpiar interfaz
    messagesContainer.innerHTML = `
      <div class="hydrous-message hydrous-message-bot">
        <div class="hydrous-message-bubble">
          Conversación reiniciada. Iniciando nuevo asistente...
        </div>
      </div>
    `;

    // Mostrar indicador de escritura
    showTypingIndicator(messagesContainer);

    // Iniciar nueva conversación
    setTimeout(() => {
      startConversation(messagesContainer, config, state);
    }, 1000);
  }

  // Enviar mensaje a la API
  async function sendMessageToAPI(messagesContainer, message, config, state) {
    try {
      // Validar estado de la conexión
      if (!navigator.onLine) {
        throw new Error("Sin conexión a internet");
      }

      state.isTyping = true;

      // Mostrar indicador de escritura
      showTypingIndicator(messagesContainer);

      // Si es el primer mensaje, iniciar la conversación en el backend
      if (!state.isConversationStarted) {
        try {
          // Iniciar conversación en el backend
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
          state.isConversationStarted = true;

          // Guardar en localStorage
          localStorage.setItem('hydrous_conversation_id', data.id);

        } catch (err) {
          console.error('Error al iniciar conversación en backend:', err);
          clearTypingIndicator(messagesContainer);
          addBotMessage(messagesContainer, "Lo siento, no puedo conectar con el asistente. Por favor, intenta de nuevo más tarde.", state);
          state.isTyping = false;
          return;
        }
      }

      // Si no hay ID de conversación, intentar iniciar una (solo como respaldo)
      if (!state.conversationId) {
        try {
          // En lugar de llamar a startConversation, que muestra un mensaje predefinido,
          // podemos simplemente generar un error para que se maneje abajo
          throw new Error("No se pudo obtener ID de conversación");
        } catch (err) {
          clearTypingIndicator(messagesContainer);
          addBotMessage(messagesContainer, "Lo siento, ha ocurrido un error al conectar con el asistente. Por favor, recarga la página e intenta de nuevo.", state);
          state.isTyping = false;
          return;
        }
      }

      // Una vez que tenemos ID de conversación, procesamos el mensaje
      if (state.selectedFile) {
        // Con archivo
        const formData = new FormData();
        formData.append('conversation_id', state.conversationId);
        formData.append('message', message || '');
        formData.append('file', state.selectedFile);

        // Enviar mensaje con archivo
        const response = await fetch(`${config.apiUrl}/documents/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        // Procesar respuesta
        const data = await response.json();

        // Limpiar indicador de escritura
        clearTypingIndicator(messagesContainer);

        // Añadir respuesta del bot
        addBotMessage(messagesContainer, data.message || "Archivo recibido. Estamos procesando su contenido.", state);

        // Actualizar cache
        updateCachedMessages(state.conversationId, message, data.message || "Archivo recibido. Estamos procesando su contenido.");
      } else {
        // Sin archivo
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

        // Limpiar indicador de escritura
        clearTypingIndicator(messagesContainer);

        // Añadir respuesta del bot
        addBotMessage(messagesContainer, data.message, state);

        // Actualizar cache
        updateCachedMessages(state.conversationId, message, data.message);
      }

    } catch (err) {
      console.error('Error al enviar mensaje:', err);

      // Mejorar mensajes de error según el tipo
      let errorMessage = "Lo siento, ha ocurrido un error al procesar tu mensaje.";

      if (err.message === "Sin conexión a internet") {
        errorMessage = "No hay conexión a internet. Por favor, verifica tu conexión e intenta nuevamente.";
      } else if (err.message.includes("404")) {
        errorMessage = "No se pudo conectar con el servidor. Por favor, intenta más tarde.";
      } else if (err.message.includes("timeout")) {
        errorMessage = "La conexión tardó demasiado. Por favor, intenta nuevamente.";
      }

      // Mensaje de error
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

        // Limitar a los últimos 20 mensajes para no sobrecargar localStorage
        if (messages.length > 20) {
          messages.splice(0, messages.length - 20);
        }

        // Guardar nuevamente
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

    // Contenido del mensaje
    messageEl.innerHTML = `
      <div class="hydrous-message-bubble">${escapeHtml(message)}</div>
      <div class="hydrous-message-time">${time}</div>
    `;

    // Añadir a contenedor
    messagesContainer.appendChild(messageEl);

    // Scroll al final
    scrollToBottom(messagesContainer);
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

    // Contenido del mensaje
    messageEl.innerHTML = `
      <div class="hydrous-message-bubble">${escapeHtml(message)}</div>
      <div class="hydrous-message-time">
        <span class="hydrous-bot-indicator"></span>
        ${time}
      </div>
    `;

    // Añadir a contenedor
    messagesContainer.appendChild(messageEl);

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
    clearFilePreview(inputContainer, state);

    // Crear elemento de vista previa
    const previewContainer = document.createElement('div');
    previewContainer.className = 'hydrous-file-preview';

    // Icono según tipo de archivo
    const iconSvg = getFileIcon(file.type);

    previewContainer.innerHTML = `
      <div class="hydrous-file-preview-icon">${iconSvg}</div>
      <div class="hydrous-file-preview-name">${file.name}</div>
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
      clearFilePreview(inputContainer, state);
    });
  }

  // Función para limpiar vista previa
  function clearFilePreview(inputContainer, state) {
    // Limpiar estado
    state.selectedFile = null;

    // Limpiar input de archivo
    const fileInput = inputContainer.querySelector('.hydrous-file-input');
    if (fileInput) fileInput.value = '';

    // Eliminar vista previa
    const preview = inputContainer.querySelector('.hydrous-file-preview');
    if (preview) {
      preview.parentNode.removeChild(preview);
    }
  }

  // Añadir archivo al mensaje
  function addFileToMessage(messagesContainer, file) {
    // Obtener último mensaje (que debería ser del usuario)
    const lastMessage = messagesContainer.querySelector('.hydrous-message-user:last-child');

    if (lastMessage) {
      // Crear elemento de archivo
      const fileElement = document.createElement('div');
      fileElement.className = 'hydrous-message-file';

      // Icono según tipo de archivo
      const iconSvg = getFileIcon(file.type);

      fileElement.innerHTML = `
        <div class="hydrous-message-file-icon">${iconSvg}</div>
        <div class="hydrous-message-file-name">${file.name}</div>
      `;

      // Añadir al mensaje
      lastMessage.querySelector('.hydrous-message-bubble').appendChild(fileElement);
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
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 13H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 17H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 9H9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
      .replace(/\n/g, "<br>"); // Convertir saltos de línea a <br>
  }
})();

