// EJEMPLO: Integración del servidor backend en script.js
// Este código muestra cómo modificar las funciones principales para usar el servidor

// ========================================
// 1. INICIALIZACIÓN
// ========================================

// Al inicio del widget, después de las constantes:
const SERVER_URL = 'http://localhost:3000'; // Cambiar en producción
let serverAPI = null;

// En this.callbacks.init:
this.callbacks.init = function () {
  // Inicializar API del servidor
  serverAPI = new CalendarServerAPI(SERVER_URL);
  
  // Obtener ID del usuario de Kommo desde el widget
  const currentUser = self.system().area;
  const userId = currentUser.id || 'default-user';
  serverAPI.setUserId(userId);
  
  // Verificar si ya está autenticado
  self.checkExistingSession();
  
  self.loadCSS();
  return true;
};

// ========================================
// 2. VERIFICAR SESIÓN EXISTENTE
// ========================================

this.checkExistingSession = async function() {
  try {
    const status = await serverAPI.checkAuthStatus();
    
    if (status.authenticated) {
      // Usuario ya está autenticado
      document.getElementById("formulario").style.display = "block";
      $('#authorize_button').hide();
      $('#signout_button').show();
      
      // Cargar calendarios
      await self.loadCalendarsFromServer();
      
      self.showSnackbar('Sesión restaurada', 'success', 2000);
    } else {
      // No hay sesión activa
      document.getElementById("formulario").style.display = "none";
      $('#authorize_button').show();
      $('#signout_button').hide();
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
  }
};

// ========================================
// 3. AUTORIZACIÓN CON GOOGLE (SERVIDOR)
// ========================================

this.authorizeGoogle = async function() {
  try {
    // Obtener URL de autorización del servidor
    const authUrl = await serverAPI.getAuthUrl();
    
    // Abrir ventana emergente
    const width = 600;
    const height = 700;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    
    const authWindow = window.open(
      authUrl,
      'Google Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    // Polling para detectar cuando se cierra la ventana
    const checkWindowClosed = setInterval(async () => {
      if (authWindow.closed) {
        clearInterval(checkWindowClosed);
        
        // Verificar si la autorización fue exitosa
        const status = await serverAPI.checkAuthStatus();
        
        if (status.authenticated) {
          document.getElementById("formulario").style.display = "block";
          $('#authorize_button').hide();
          $('#signout_button').show();
          
          // Cargar calendarios
          await self.loadCalendarsFromServer();
          
          self.showSnackbar('Autorización exitosa', 'success');
        } else {
          self.showSnackbar('Error en la autorización', 'error');
        }
      }
    }, 500);
    
  } catch (error) {
    console.error('Error en autorización:', error);
    self.showSnackbar('Error conectando con el servidor', 'error');
  }
};

// ========================================
// 4. CARGAR CALENDARIOS DESDE SERVIDOR
// ========================================

this.loadCalendarsFromServer = async function() {
  try {
    const calendars = await serverAPI.getCalendars();
    
    if (!calendars || calendars.length === 0) {
      self.showSnackbar('No se encontraron calendarios', 'warning');
      return;
    }
    
    // Poblar dropdown
    const dropdown = document.getElementById("calendar_dropdown");
    dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
    
    calendars.forEach((calendar) => {
      const option = document.createElement("option");
      option.value = calendar.id;
      option.textContent = calendar.summary;
      
      if (calendar.primary || calendar.id === 'primary') {
        option.selected = true;
      }
      
      dropdown.appendChild(option);
    });
    
    console.log(`${calendars.length} calendarios cargados desde el servidor`);
    self.showSnackbar('Calendarios cargados', 'success', 2000);
    
  } catch (error) {
    console.error('Error cargando calendarios:', error);
    self.showSnackbar('Error cargando calendarios', 'error');
    
    // Fallback a lista estática
    self.loadStaticCalendars();
  }
};

// ========================================
// 5. CREAR EVENTO CON VERIFICACIÓN DE DISPONIBILIDAD
// ========================================

this.createEvent = async function(e) {
  e.preventDefault();
  
  const calendarId = document.getElementById("calendar_dropdown").value;
  const fecha = document.getElementById("fecha").value;
  const horaInicio = document.getElementById("hora_inicio").value;
  const horaFin = document.getElementById("hora_fin").value;
  const titulo = document.getElementById("titulo").value;
  const descripcion = document.getElementById("descripcion").value;
  const ubicacion = document.getElementById("ubicacion").value;
  
  if (!calendarId || !fecha || !horaInicio || !horaFin || !titulo) {
    self.showSnackbar('Por favor completa todos los campos obligatorios', 'warning');
    return;
  }
  
  try {
    // Crear objetos Date
    const startDateTime = new Date(`${fecha}T${horaInicio}`);
    const endDateTime = new Date(`${fecha}T${horaFin}`);
    
    // VERIFICAR DISPONIBILIDAD
    self.showSnackbar('Verificando disponibilidad...', 'info', 2000);
    
    const isAvailable = await serverAPI.isTimeSlotAvailable(
      calendarId,
      startDateTime,
      endDateTime
    );
    
    if (!isAvailable) {
      const confirmed = confirm(
        '⚠️ Ya existe un evento en este horario. ¿Deseas crear el evento de todas formas?'
      );
      
      if (!confirmed) {
        self.showSnackbar('Evento cancelado', 'info');
        return;
      }
    }
    
    // Preparar evento
    const event = {
      summary: titulo,
      description: descripcion,
      location: ubicacion,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: "hangoutsMeet" }
        }
      }
    };
    
    // Crear evento en el servidor
    self.showSnackbar('Creando evento...', 'info', 2000);
    
    const createdEvent = await serverAPI.createEvent(calendarId, event);
    
    console.log('Evento creado:', createdEvent);
    self.showSnackbar('✅ Evento creado exitosamente', 'success');
    
    // Limpiar formulario
    document.getElementById("reunionForm").reset();
    
    // Ejecutar salesbot si es necesario
    const leadId = self.system().lead.id;
    if (leadId) {
      launchSalesbot(12345, leadId); // Reemplaza 12345 con tu ID de bot
    }
    
  } catch (error) {
    console.error('Error creando evento:', error);
    self.showSnackbar('Error al crear el evento', 'error');
  }
};

// ========================================
// 6. CERRAR SESIÓN
// ========================================

this.signOutGoogle = async function() {
  try {
    await serverAPI.logout();
    
    document.getElementById("formulario").style.display = "none";
    $('#authorize_button').show();
    $('#signout_button').hide();
    
    // Limpiar dropdown
    const dropdown = document.getElementById("calendar_dropdown");
    if (dropdown) {
      dropdown.innerHTML = '<option value="" disabled selected>Seleccione un calendario</option>';
    }
    
    self.showSnackbar('Sesión cerrada', 'info');
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    self.showSnackbar('Error al cerrar sesión', 'error');
  }
};

// ========================================
// 7. MOSTRAR DISPONIBILIDAD EN EL CALENDARIO
// ========================================

this.showAvailability = async function() {
  const calendarId = document.getElementById("calendar_dropdown").value;
  const fecha = document.getElementById("fecha").value;
  
  if (!calendarId || !fecha) {
    return;
  }
  
  try {
    // Obtener eventos del día seleccionado
    const startOfDay = new Date(`${fecha}T00:00:00`);
    const endOfDay = new Date(`${fecha}T23:59:59`);
    
    const availability = await serverAPI.getAvailability(
      calendarId,
      startOfDay,
      endOfDay
    );
    
    // Mostrar horarios ocupados
    if (availability.busySlots.length > 0) {
      console.log('Horarios ocupados:', availability.busySlots);
      
      let busyMessage = `📅 Horarios ocupados en ${fecha}:\n\n`;
      availability.busySlots.forEach(slot => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);
        busyMessage += `• ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}: ${slot.summary}\n`;
      });
      
      // Opcional: mostrar en un elemento HTML
      const availabilityDiv = document.getElementById("availability_info");
      if (availabilityDiv) {
        availabilityDiv.innerHTML = busyMessage.replace(/\n/g, '<br>');
        availabilityDiv.style.display = 'block';
      }
    } else {
      console.log('No hay eventos en esta fecha');
    }
    
  } catch (error) {
    console.error('Error obteniendo disponibilidad:', error);
  }
};

// ========================================
// 8. AGREGAR EVENTO AL CAMBIAR FECHA
// ========================================

// En bind_actions, agregar:
$(document).off('change', '#fecha').on('change', '#fecha', function () {
  self.showAvailability();
});
