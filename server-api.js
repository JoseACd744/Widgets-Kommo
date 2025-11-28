// Widget Helper - Funciones auxiliares para integración con servidor backend

/**
 * Clase para manejar la comunicación con el servidor backend
 */
class CalendarServerAPI {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.userId = null;
  }

  /**
   * Establece el ID del usuario de Kommo
   */
  setUserId(userId) {
    this.userId = userId;
  }

  /**
   * Verifica el estado de autenticación
   */
  async checkAuthStatus() {
    try {
      const response = await fetch(`${this.serverUrl}/auth/status`, {
        credentials: 'include' // Importante para enviar cookies de sesión
      });
      return await response.json();
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      return { authenticated: false };
    }
  }

  /**
   * Obtiene URL de autorización de Google
   */
  async getAuthUrl() {
    try {
      const response = await fetch(
        `${this.serverUrl}/auth/google/url?userId=${this.userId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      return data.authUrl;
    } catch (error) {
      console.error('Error obteniendo URL de autorización:', error);
      throw error;
    }
  }

  /**
   * Cierra sesión en el servidor
   */
  async logout() {
    try {
      await fetch(`${this.serverUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    }
  }

  /**
   * Obtiene lista de calendarios
   */
  async getCalendars() {
    try {
      const response = await fetch(`${this.serverUrl}/api/calendars`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error obteniendo calendarios');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo calendarios:', error);
      throw error;
    }
  }

  /**
   * Obtiene disponibilidad de un calendario
   * @param {string} calendarId - ID del calendario
   * @param {Date} startDate - Fecha inicio
   * @param {Date} endDate - Fecha fin
   */
  async getAvailability(calendarId, startDate, endDate) {
    try {
      const response = await fetch(`${this.serverUrl}/api/calendar/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          calendarId: calendarId,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Error obteniendo disponibilidad');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo disponibilidad:', error);
      throw error;
    }
  }

  /**
   * Crea un evento en el calendario
   */
  async createEvent(calendarId, eventData) {
    try {
      const response = await fetch(`${this.serverUrl}/api/calendar/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          calendarId: calendarId,
          event: eventData
        })
      });
      
      if (!response.ok) {
        throw new Error('Error creando evento');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creando evento:', error);
      throw error;
    }
  }

  /**
   * Verifica si una fecha/hora está disponible
   * @param {string} calendarId - ID del calendario
   * @param {Date} startTime - Hora de inicio propuesta
   * @param {Date} endTime - Hora de fin propuesta
   * @returns {Promise<boolean>} - true si está disponible, false si hay conflicto
   */
  async isTimeSlotAvailable(calendarId, startTime, endTime) {
    try {
      const availability = await this.getAvailability(calendarId, startTime, endTime);
      
      // Verificar si hay eventos que se solapen
      const hasConflict = availability.busySlots.some(slot => {
        const slotStart = new Date(slot.start);
        const slotEnd = new Date(slot.end);
        
        // Verificar solapamiento
        return (startTime < slotEnd && endTime > slotStart);
      });
      
      return !hasConflict;
    } catch (error) {
      console.error('Error verificando disponibilidad:', error);
      return true; // Por defecto asumir disponible si hay error
    }
  }
}

// Exportar para uso en el widget
if (typeof define === 'function' && define.amd) {
  define([], function() {
    return CalendarServerAPI;
  });
} else if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarServerAPI;
} else {
  window.CalendarServerAPI = CalendarServerAPI;
}
