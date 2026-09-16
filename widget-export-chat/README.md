# Widget: Exportar Conversación

Panel derecho de la card de lead (`lcard-1`) **y** acción masiva en la lista de
leads (`llist`/`llist-0`). Carga el historial de chat de uno o varios leads a
través del proxy (`../server-kommo-chat`), junto con los campos del lead y de
sus contactos, y lo descarga como CSV/Excel con filtro de fechas y selección
de qué campos incluir (checklist con todos los campos de la cuenta).

## Requisito previo

El Worker debe estar desplegado y autorizado. Ver `../server-kommo-chat/README.md`.

## Empaquetado e instalación

El zip debe tener `manifest.json` **en la raíz**, no dentro de una carpeta:

```powershell
cd widget-export-chat
Compress-Archive -Path * -DestinationPath ..\widget-export-chat.zip -Force
```

En Kommo: **Ajustes → Integraciones → Crear integración → Subir widget**, y
cargar el zip.

Al instalarlo pide dos valores:

| Ajuste | Valor |
|---|---|
| URL del proxy | `https://TU-DOMINIO.up.railway.app` (sin barra final) |
| Clave del widget | la misma `WIDGET_KEY` cargada como secreto en el Worker |

## Uso

### Un lead (tarjeta)

Abrir un lead → panel derecho → opcionalmente elegir un rango de fechas
("Desde"/"Hasta", filtra los mensajes) → **Cargar conversación**. Aparece el
resumen (cantidad de mensajes, conversaciones y canales) y dos checklists de
campos — **Campos del lead** y **Campos del contacto** — con todos los campos
estándar y personalizados de la cuenta, tildados por defecto. El botón
"Marcar/Desmarcar todo" de cada grupo tilda o destilda todos los de esa lista.
La selección se recuerda entre leads (se guarda en `localStorage` del
navegador). Después se usa **Descargar CSV / Excel**.

### Varios leads (vista de lista)

En la lista de leads: marcar varios con el checkbox de cada fila → botón
**"···más"** de la barra de acciones (no aparece como ícono directo) → elegir
el widget por su nombre. Se abre el mismo panel, indicando cuántos leads
quedaron seleccionados; el resto del flujo (fechas, campos, descarga) es
igual, pero el CSV resultante es **un solo archivo combinado** con todos los
leads (columnas `lead_id`/`lead_name` agregadas a las filas de mensajes, y una
sección `campo,valor` por lead si hay campos elegidos). Por defecto se
procesan hasta 30 leads por exportación (`MAX_BULK_LEADS` en `script.js`); si
se seleccionan más, se avisa y se usan los primeros 30.

## Formato de descarga

Un solo botón, **CSV/Excel** — con BOM UTF-8 para que Excel no rompa los
acentos. Si hay campos seleccionados, agrega primero una tabla `campo,valor`;
luego los mensajes con columnas `talk_id, fecha, hora, direccion, autor,
canal, tipo, texto, adjunto_nombre, adjunto_url` (más `lead_id, lead_name` al
principio cuando hay más de un lead). Sin campos elegidos y con un solo lead,
el CSV es idéntico al de la primera versión del widget (antes de agregar
fechas/campos).

## Logos

Los PNG de `images/` se generan por código, no se editan a mano:

```bash
node tools/gen-logos.js images
```

Usan la identidad de **holos**, muestreada de los logos originales:

| Rol | Color |
|---|---|
| Fondo | `#302663` |
| Pictograma principal | `#FCFCFB` |
| Secundario | `#A9A5BC` |
| Acento | `#F52655` |

El pictograma son dos globos de chat —el trasero en lavanda, igual que el sobre
del icono anterior— con una flecha de descarga calada en violeta sobre el globo
blanco: conversación + exportar, en el mismo lenguaje plano de la marca.

**El logotipo "holos" no se redibuja.** Se compone desde `tools/brand/`, que
contiene recortes de los PNG originales hechos una sola vez con:

```bash
node tools/extract-brand.js ../images
```

Así la tipografía y el punto rojo quedan pixel a pixel como el original. Si
alguna vez cambia la marca, se vuelve a correr ese script y después
`gen-logos.js`. `tools/png.js` es el códec PNG que usan ambos.

Los seis tamaños que exige Kommo salen del mismo dibujo:

| Archivo | Tamaño | Uso |
|---|---|---|
| `logo_min.png` | 84×84 | listas y cards, estado minimizado |
| `logo_small.png` | 108×108 | página de ajustes |
| `logo.png` | 130×100 | página de ajustes |
| `logo_dp.png` | 174×109 | Digital Pipeline |
| `logo_medium.png` | 240×84 | listas y cards, estado expandido |
| `logo_main.png` | 400×272 | cabecera de la página de ajustes |

## Detalle de implementación

El nombre del lead, sus custom fields y sus contactos se leen con
`/api/v4/leads/{id}?with=contacts,tags` y `/api/v4/contacts/{id}` usando la
sesión del navegador — esos endpoints no están limitados por scope. Solo los
mensajes (`/talks/.../messages`) pasan por el proxy; el filtro de fechas se le
pasa como `from`/`to` (unix) y ya lo soporta (ver
`../server-kommo-chat/README.md`), no hizo falta tocar el servidor.

El responsable y el embudo/estado del lead se intentan resolver a nombre legible
vía `APP.constant('users')` / `APP.constant('pipelines')` (si esas constantes
no están disponibles en la versión de Kommo del cliente, se muestra el id
crudo como respaldo — no se pudo verificar contra una cuenta real durante el
desarrollo, revisar si aparece algún `#123` en vez de un nombre).

El modo masivo usa el location `llist` y el callback `leads.selected`, según la
documentación pública de Kommo (`developers.kommo.com/docs/lists-sdk` y
`/widget-locations`): al marcar filas en la lista y elegir el widget desde el
menú de acciones, `self.list_selected().selected` da los leads marcados. Cada
uno se carga con concurrencia limitada (3 a la vez, `BULK_CONCURRENCY` en
`script.js`) reusando la misma lógica que el modo de un solo lead.
