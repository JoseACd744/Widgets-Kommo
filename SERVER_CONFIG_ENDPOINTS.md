# Endpoints para Configuración del Widget

## 1. Crear tabla en MySQL

```sql
CREATE TABLE IF NOT EXISTS widget_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  meet_link_field_id VARCHAR(50),
  date_field_id VARCHAR(50),
  calendar_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
);
```

## 2. Agregar endpoints en tu servidor Express (server.js en Railway)

```javascript
// ========================================
// ENDPOINTS DE CONFIGURACIÓN DEL WIDGET
// ========================================

// Guardar configuración del widget
app.post('/api/widget/config', async (req, res) => {
  try {
    const { userId, config } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }
    
    const { meet_link_field_id, date_field_id, calendar_id } = config || {};
    
    // Upsert: insertar o actualizar si ya existe
    const query = `
      INSERT INTO widget_config (user_id, meet_link_field_id, date_field_id, calendar_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        meet_link_field_id = VALUES(meet_link_field_id),
        date_field_id = VALUES(date_field_id),
        calendar_id = VALUES(calendar_id),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.execute(query, [userId, meet_link_field_id, date_field_id, calendar_id]);
    
    console.log('✅ Configuración guardada para usuario:', userId);
    res.json({ success: true, message: 'Configuración guardada' });
    
  } catch (error) {
    console.error('❌ Error guardando configuración:', error);
    res.status(500).json({ error: 'Error guardando configuración' });
  }
});

// Obtener configuración del widget
app.get('/api/widget/config', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId es requerido' });
    }
    
    const [rows] = await pool.execute(
      'SELECT meet_link_field_id, date_field_id, calendar_id FROM widget_config WHERE user_id = ?',
      [userId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    console.log('📋 Configuración obtenida para usuario:', userId);
    res.json(rows[0]);
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
});
```

## 3. Uso en el Widget

El widget ya tiene las funciones para guardar y cargar la configuración.
Solo necesitas modificar `saveFieldMapping` y `loadCustomFieldsForSettings` para usar el servidor.
