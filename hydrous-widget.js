// Esta función simplificada se concentra exclusivamente en la carga de archivos
// Reemplaza la función setupEvents en tu archivo

function setupEvents(config, state) {
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

  // ====== ACTIVAR/DESACTIVAR BOTÓN DE ENVÍO ======
  // Esta función actualiza el estado del botón según si hay contenido para enviar
  function updateSendButtonState() {
    const hasText = textarea.value.trim().length > 0;
    const hasFile = state.selectedFile !== null;
    const canSend = (hasText || hasFile) && !state.isTyping;

    // Dejar claro en la consola el estado actual
    console.log("[Debug] Estado del botón:", { hasText, hasFile, canSend, isTyping: state.isTyping });

    if (canSend) {
      sendButton.classList.add('active');
      sendButton.disabled = false;
    } else {
      sendButton.classList.remove('active');
      sendButton.disabled = true;
    }
  }

  // ====== ADJUNTAR ARCHIVO ======
  // Configuración del botón de adjuntar archivo
  if (fileButton && fileInput) {
    fileButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        console.log("[Debug] Archivo seleccionado:", file.name, file.type, file.size);

        // Verificar tamaño
        if (file.size > config.maxFileSize * 1024 * 1024) {
          alert(`Error: El archivo excede el límite de ${config.maxFileSize}MB`);
          fileInput.value = '';
          return;
        }

        // Guardar archivo en estado
        state.selectedFile = file;

        // Mostrar vista previa
        showFilePreview(file);

        // IMPORTANTE: Actualizar estado del botón
        updateSendButtonState();
      }
    });
  }

  // ====== MOSTRAR VISTA PREVIA DEL ARCHIVO ======
  function showFilePreview(file) {
    // Limpiar vista previa existente
    const existingPreview = inputContainer.querySelector('.hydrous-file-preview');
    if (existingPreview) {
      existingPreview.parentNode.removeChild(existingPreview);
    }

    // Crear contenedor
    const previewContainer = document.createElement('div');
    previewContainer.className = 'hydrous-file-preview';

    // Icono según tipo
    const iconSvg = getFileIcon(file.type);

    // Formatear tamaño
    const fileSize = formatFileSize(file.size);

    // Contenido
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

    // Botón para eliminar archivo
    previewContainer.querySelector('.hydrous-file-preview-remove').addEventListener('click', clearFilePreview);

    // Mostrar mensaje informativo
    const fileInfo = inputContainer.querySelector('.hydrous-file-info');
    if (fileInfo) {
      fileInfo.textContent = "Archivo listo para enviar";
    }
  }

  // ====== ELIMINAR ARCHIVO ======
  function clearFilePreview() {
    console.log("[Debug] Limpiando archivo");

    // Limpiar estado
    state.selectedFile = null;

    // Limpiar input
    if (fileInput) fileInput.value = '';

    // Quitar vista previa
    const preview = inputContainer.querySelector('.hydrous-file-preview');
    if (preview) preview.parentNode.removeChild(preview);

    // Limpiar mensaje
    const fileInfo = inputContainer.querySelector('.hydrous-file-info');
    if (fileInfo) fileInfo.textContent = '';

    // Actualizar botón
    updateSendButtonState();
  }

  // Exponer función para uso externo
  window.HydrousWidget.clearFilePreview = clearFilePreview;

  // ====== ENVIAR MENSAJE/ARCHIVO ======
  sendButton.addEventListener('click', handleSendButtonClick);

  // Función dedicada al envío
  async function handleSendButtonClick() {
    console.log("[Debug] Botón de envío clickeado");

    // Si está deshabilitado, no hacer nada
    if (sendButton.disabled) {
      console.log("[Debug] Botón deshabilitado, ignorando clic");
      return;
    }

    const messageText = textarea.value.trim();
    const hasFile = state.selectedFile !== null;

    console.log("[Debug] Estado al enviar:", {
      textoMensaje: messageText,
      tieneArchivo: hasFile,
      estadoEscribiendo: state.isTyping
    });

    // Verificar si hay algo para enviar
    if (!messageText && !hasFile) {
      console.log("[Debug] No hay nada que enviar");
      return;
    }

    try {
      // Deshabilitar interfaz
      sendButton.disabled = true;
      textarea.disabled = true;
      if (fileButton) fileButton.disabled = true;
      state.isTyping = true;

      // Mostrar indicador visual
      if (hasFile) {
        const fileInfo = inputContainer.querySelector('.hydrous-file-info');
        if (fileInfo) fileInfo.textContent = "Enviando archivo...";
      }

      // Añadir mensaje a la interfaz
      if (messageText) {
        addUserMessage(messagesContainer, messageText, state);
      } else if (hasFile) {
        addUserMessage(messagesContainer, "", state);
      }

      // Mostrar archivo en el mensaje
      if (hasFile) {
        addFileToMessage(messagesContainer, state.selectedFile);
      }

      // Resetear textarea
      textarea.value = '';
      textarea.style.height = '48px';

      // Mostrar indicador de escritura
      showTypingIndicator(messagesContainer);

      // Iniciar conversación si es necesario
      if (!state.conversationId || !state.conversationStarted) {
        console.log("[Debug] Iniciando conversación");
        await initializeConversation();
      }

      // Enviar mensaje o archivo
      if (hasFile) {
        console.log("[Debug] Enviando archivo");
        await sendFileToBackend(messageText);
      } else {
        console.log("[Debug] Enviando texto");
        await sendTextToBackend(messageText);
      }

      // Registro de éxito
      console.log("[Debug] Mensaje enviado correctamente");

    } catch (error) {
      console.error("[Error]", error);

      // Mostrar error al usuario
      clearTypingIndicator(messagesContainer);
      addBotMessage(
        messagesContainer,
        "Lo siento, ocurrió un error. Por favor, intenta de nuevo.",
        state
      );
    } finally {
      // Rehabilitar interfaz
      sendButton.disabled = false;
      textarea.disabled = false;
      if (fileButton) fileButton.disabled = false;
      state.isTyping = false;

      // Limpiar estado del archivo
      if (hasFile) {
        clearFilePreview();
      }

      // Actualizar estado del botón
      updateSendButtonState();

      // Devolver foco al textarea
      textarea.focus();
    }
  }

  // ====== INICIALIZAR CONVERSACIÓN ======
  async function initializeConversation() {
    try {
      console.log("[Debug] Solicitando ID de conversación");

      const response = await fetch(`${config.apiUrl}/chat/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Error al iniciar conversación: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Debug] Conversación iniciada:", data);

      state.conversationId = data.id;
      state.conversationStarted = true;

      // Guardar en localStorage
      localStorage.setItem('hydrous_conversation_id', data.id);

    } catch (error) {
      console.error("[Error] al iniciar conversación:", error);
      throw error;
    }
  }

  // ====== ENVIAR ARCHIVO AL BACKEND ======
  async function sendFileToBackend(messageText) {
    try {
      console.log("[Debug] Preparando FormData para archivo");

      const formData = new FormData();
      formData.append('conversation_id', state.conversationId);
      formData.append('message', messageText || '');
      formData.append('file', state.selectedFile);

      console.log(`[Debug] Enviando archivo: ${state.selectedFile.name}`);

      const response = await fetch(`${config.apiUrl}/documents/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error al subir archivo: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Debug] Respuesta del servidor:", data);

      // Limpiar indicador de escritura
      clearTypingIndicator(messagesContainer);

      // Mostrar respuesta del bot
      addBotMessage(
        messagesContainer,
        data.message || "Archivo recibido. Estamos procesando su contenido.",
        state
      );

      // Actualizar caché
      updateCachedMessages(
        state.conversationId,
        messageText,
        data.message || "Archivo recibido. Estamos procesando su contenido."
      );

    } catch (error) {
      console.error("[Error] al enviar archivo:", error);
      throw error;
    }
  }

  // ====== ENVIAR TEXTO AL BACKEND ======
  async function sendTextToBackend(message) {
    try {
      console.log("[Debug] Enviando mensaje de texto");

      const response = await fetch(`${config.apiUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: state.conversationId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error(`Error al enviar mensaje: ${response.status}`);
      }

      const data = await response.json();
      console.log("[Debug] Respuesta del servidor:", data);

      // Limpiar indicador de escritura
      clearTypingIndicator(messagesContainer);

      // Mostrar respuesta del bot
      addBotMessage(messagesContainer, data.message, state);

      // Actualizar caché
      updateCachedMessages(state.conversationId, message, data.message);

    } catch (error) {
      console.error("[Error] al enviar mensaje:", error);
      throw error;
    }
  }

  // ====== EVENTOS ADICIONALES ======

  // Teclas en textarea
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendButton.disabled) {
        handleSendButtonClick();
      }
    }
  });

  // Eventos de textarea (ajuste de altura)
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = newHeight + 'px';

    updateSendButtonState();
  });

  // Botón de chat (abrir widget)
  chatButton.addEventListener('click', () => {
    state.isOpen = true;
    chatButton.style.display = 'none';
    chatWindow.style.display = 'flex';

    if (!messagesContainer.querySelector('.hydrous-message')) {
      startConversation(messagesContainer, config, state);
    }

    setTimeout(() => textarea.focus(), 300);
    trackEvent('chat_opened', config);
  });

  // Botón de cierre
  closeButton.addEventListener('click', () => {
    state.isOpen = false;
    chatWindow.style.display = 'none';
    chatButton.style.display = 'flex';
    trackEvent('chat_closed', config);
  });

  // Botón de reinicio
  resetButton.addEventListener('click', () => {
    if (confirm("¿Estás seguro que deseas reiniciar la conversación? Se perderá todo el historial.")) {
      resetConversation(messagesContainer, config, state);
      updateSendButtonState();
      trackEvent('conversation_reset', config);
    }
  });

  // Realizar comprobación inicial
  updateSendButtonState();
}

// Función auxiliar para formatear el tamaño del archivo
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}
