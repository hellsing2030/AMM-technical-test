# Frontend — aprobación de compras AMM

Frontend React + TypeScript dividido con Webpack Module Federation:

- `shellApp` (`http://localhost:3000`): navegación y composición.
- `requesterApp` (`http://localhost:3001`): creación, listado, detalle, evidencia y correo simulado.
- `approverApp` (`http://localhost:3002`): solicitud/validación de OTP y decisión.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

## Ejecutar la demostración local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. El modo predeterminado es `mock`: guarda los datos en `localStorage` y permite demostrar el circuito sin AWS.

La aplicación comienza en `/login` con un selector de identidad demostrativo:

- **Solicitante Demo** entra a `/requests`, donde puede crear, listar y consultar sus compras.
- Cada **aprobador** entra a `/approvals`, donde ve solamente las invitaciones y OTP enviados a su correo.
- El shell protege las rutas por rol y muestra una navegación diferente para cada actor.

La selección por nombre demuestra separación de responsabilidades, pero no es autenticación productiva. Antes de producción debe reemplazarse por Cognito/SSO y autorización backend basada en claims verificados.

Flujo sugerido:

1. Crear una solicitud con tres aprobadores de roles diferentes.
2. Cerrar sesión e ingresar con el nombre de uno de los aprobadores seleccionados.
3. Abrir la invitación desde **Mis aprobaciones**.
4. Solicitar OTP y abrir **Ver OTP en mi bandeja** en una pestaña nueva.
5. Validar el OTP y aprobar o rechazar.
6. Repetir con las tres invitaciones. Con tres aprobaciones la solicitud pasa a `COMPLETED` y habilita la evidencia.

El mock implementa expiración OTP de tres minutos, reenvío, sesiones de decisión, protección del detalle antes del OTP, cancelación tras rechazo y descarga condicionada. La evidencia mock es solo un `Blob` demostrativo; el PDF definitivo será responsabilidad del backend.

## Conectar la API real

Las aplicaciones consumen un único contrato en `src/shared/api/types.ts`. Para usar el adaptador HTTP:

```powershell
$env:APP_API_MODE="remote"
$env:APP_API_URL="https://API_ID.execute-api.REGION.amazonaws.com/Prod"
npm run dev
```

Endpoints esperados:

| Método | Ruta |
| --- | --- |
| `GET` | `/users?role=APPROVER` |
| `POST` | `/requests` |
| `GET` | `/requests` |
| `GET` | `/requests/{id}` |
| `POST` | `/approvals/request-otp` |
| `POST` | `/approvals/validate-otp` |
| `POST` | `/approvals/decision` |
| `GET` | `/requests/{id}/evidence.pdf` |
| `GET` | `/mock-mail` |

Los cuerpos y respuestas deben usar las interfaces exportadas por `src/shared/api/types.ts`. Los errores JSON deben tener la forma `{ "message": "Descripción segura" }`.

## Compilar para producción

Las URLs de los remotes se fijan durante el build del shell:

```powershell
$env:APP_API_MODE="remote"
$env:APP_API_URL="https://api.example.com"
$env:REQUESTER_REMOTE_URL="https://requester.example.com/remoteEntry.js"
$env:APPROVER_REMOTE_URL="https://approver.example.com/remoteEntry.js"
npm run build
```

Se generan tres directorios independientes:

```text
dist/
├── shell/
├── requester/
└── approver/
```

Cada directorio puede publicarse por separado. El hosting debe redirigir rutas desconocidas a `index.html` para soportar React Router.

## Calidad

```bash
npm run typecheck
npm test
npm run coverage
npm run build
```

La configuración exige al menos 60% en statements, branches, functions y lines. El reporte HTML se genera en `coverage/index.html`.

## Decisiones de alcance

- No hay autenticación real de solicitante todavía; se usa una identidad de demostración hasta conectar el mecanismo definido por el backend.
- Los tokens, OTP y sesiones del modo mock sirven para probar UX, no como implementación de seguridad productiva.
- La generación del PDF, autorización definitiva y persistencia confiable pertenecen al backend/AWS.
- Los tres roles se validan como diferentes, siguiendo el texto del requisito original.
