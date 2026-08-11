# Widget: Exportar Conversación

Panel derecho de la card de lead (`lcard-1`). Carga el historial de chat del
lead a través del proxy (`../server-kommo-chat`) y lo descarga en TXT, CSV, PDF
o JSON.

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

Abrir un lead → panel derecho → **Cargar conversación**. Aparece el resumen
(cantidad de mensajes, conversaciones y canales) y los cuatro botones de
descarga.

## Formatos

- **TXT** — transcripción tipo `[2025-07-10 09:14] Juan Pérez: Hola`.
- **CSV** — con BOM UTF-8 para que Excel no rompa los acentos. Columnas:
  `talk_id, fecha, hora, direccion, autor, canal, tipo, texto,
  adjunto_nombre, adjunto_url`.
- **PDF** — abre una ventana con la conversación maquetada en burbujas y lanza
  el diálogo de impresión (guardar como PDF).
- **JSON** — payload normalizado completo, incluye metadatos del lead.

Los mensajes que no son texto se marcan con su tipo (`[imagen]`, `[nota de
voz]`, `[archivo]`…) seguido del nombre y la URL del adjunto.

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

El nombre del lead y sus contactos se leen con `/api/v4/leads/{id}?with=contacts`
usando la sesión del navegador — ese endpoint no está limitado por scope. Solo
los mensajes pasan por el proxy.
