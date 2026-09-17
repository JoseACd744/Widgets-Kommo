# Widget: Seguimiento con IA

Panel en la card de un lead individual (`lcard-1`, sin modo masivo). Lee todo
el historial de chat del lead a través de un proxy propio y usa IA (OpenAI)
para generar un mensaje de seguimiento final, editable y listo para copiar.

Es un widget independiente de "Exportar Conversación" (otra rama/integración
de este mismo repo): comparte el mismo proxy backend, pero se instala y
configura por separado en Kommo, y tiene su propio ícono (una chispa, en vez
de la flecha de descarga) para diferenciarlos en la lista de integraciones.

## Requisito previo

El proxy que expone `POST /followup?lead_id=N` (mismo backend que usa
"Exportar Conversación" para `/export`). El código del proxy vive en el repo
`server-widget-chats` (desplegado en Railway). Ahí necesita, además de las
variables de Kommo ya existentes, `OPENAI_API_KEY` cargada (y opcionalmente
`OPENAI_MODEL`) para que `/followup` funcione — sin esa clave responde
`503 ai_not_configured`.

## Empaquetado e instalación

El zip debe tener `manifest.json` **en la raíz**, no dentro de una carpeta:

```powershell
cd widget-ai-followup
Compress-Archive -Path * -DestinationPath ..\widget-ai-followup.zip -Force
```

En Kommo: **Ajustes → Integraciones → Crear integración → Subir widget**, y
cargar el zip. Pide dos valores:

| Ajuste | Valor |
|---|---|
| URL del proxy | `https://TU-DOMINIO.up.railway.app` (sin barra final) |
| Clave del widget | la misma `WIDGET_KEY` cargada en el proxy |

## Uso

Abrir un lead → panel → **Generar mensaje de seguimiento**. El widget envía
el id del lead al proxy, que trae el historial completo y genera el mensaje
con IA. El resultado aparece en un campo editable con botones **Copiar** y
**Regenerar**. Nada se envía ni se guarda automáticamente — el usuario decide
qué hacer con el texto.

## Detalle de implementación

`APP.data.current_card.id` da el id del lead actual. El widget llama a
`POST /followup?lead_id=N` en el proxy con el header `X-Widget-Key`; ese
endpoint arma la conversación completa y llama a la API de OpenAI
server-side — la clave de OpenAI nunca llega al navegador.

Todos los eventos del panel se delegan desde `#kai-root` (no desde
`document`) y cortan la propagación en `mousedown`/`click`, porque Kommo
cierra el panel de widgets con un listener de "clic afuera" en `document`
que también dispara con clics en contenido dinámico propio — el mismo
comportamiento ya verificado en vivo con "Exportar Conversación".

## Logos

Los PNG de `images/` se generan por código, no se editan a mano:

```bash
node tools/gen-logos.js images
```

Mismo motivo de dos globos de chat que "Exportar Conversación" (misma
identidad holos, ver paleta abajo), pero con un pictograma propio: una chispa
de cuatro puntas (símbolo de IA) en vez de la flecha de descarga, para que
ambos widgets se distingan de un vistazo en la lista de integraciones.

| Rol | Color |
|---|---|
| Fondo | `#302663` |
| Pictograma principal | `#FCFCFB` |
| Secundario | `#A9A5BC` |
| Acento (chispa chica) | `#F52655` |

El logotipo "holos" no se redibuja: se compone desde `tools/brand/`, los
mismos recortes que usa "Exportar Conversación" (`tools/png.js` es el mismo
códec PNG).
