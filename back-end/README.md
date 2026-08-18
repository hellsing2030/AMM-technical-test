# Backend serverless — AMM Purchase Approval

API TypeScript sobre AWS Lambda, API Gateway, DynamoDB y S3. Implementa tres aprobadores con roles diferentes, invitaciones seguras, OTP de tres minutos, rechazo, evidencia PDF y consulta del solicitante.

## Arquitectura

- `src/domain`: entidades y reglas sin dependencias AWS.
- `src/application`: casos de uso y puertos.
- `src/infrastructure`: DynamoDB, S3, PDF, criptografía, logs y adaptadores en memoria.
- `src/interfaces/http`: validación Zod y enrutamiento Lambda.
- `template.yaml`: API Gateway, Lambda, tabla single-table con TTL/GSI y bucket privado.

Los tokens, OTP y sesiones se persisten únicamente como hashes SHA-256 con un pepper. DynamoDB usa TTL para limpiar tokens y sesiones. Las decisiones usan versión condicional para detectar concurrencia. El PDF se guarda en un bucket privado y se descarga mediante URL firmada de 60 segundos.

## Verificación local

```bash
npm ci
npm run typecheck
npm test
npm run coverage
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
```

La cobertura exige mínimo 60% en statements, branches, functions y lines. El contrato HTTP está en `openapi.yaml`.

## Identidad de demostración

Las operaciones del solicitante requieren:

```http
X-Requester-Id: requester-demo
```

Al crear una solicitud, el header debe coincidir con `requesterId`. Esta identidad simplificada mantiene aislamiento por solicitante durante la prueba; antes de producción debe sustituirse por Cognito/JWT y claims verificados en API Gateway.

## Despliegue guiado

No guardes el pepper en Git. Desde `back-end/` ejecuta:

```bash
sam build --template-file template.yaml
sam deploy --guided
```

Valores sugeridos durante la guía:

- Stack: `amm-purchase-approval`
- Región: la misma donde se alojará el frontend.
- `AllowedOrigin`: URL HTTPS del shell frontend.
- `ApproverAppUrl`: URL HTTPS del shell frontend.
- `TokenPepper`: valor aleatorio de al menos 32 caracteres.
- Confirm changeset: `Y`.
- Allow SAM CLI IAM role creation: `Y`.

El output `ApiUrl` es el valor que debe asignarse a `APP_API_URL` al compilar el frontend con `APP_API_MODE=remote`.

## Recursos y costos

- DynamoDB `PAY_PER_REQUEST`, cifrado, TTL y recuperación point-in-time.
- S3 privado, cifrado AES-256 y versionado.
- Una Lambda Node.js 24 con X-Ray.
- Una API REST. `/mock-mail` está habilitado para demostración mediante `ENABLE_MOCK_MAIL=true`.

El bucket tiene política de retención para evitar pérdida accidental de evidencias al borrar el stack. Debe vaciarse y eliminarse deliberadamente cuando ya no se necesite.

## Límites conocidos antes de producción

- `X-Requester-Id` no reemplaza autenticación real.
- `/mock-mail` expone OTPs deliberadamente y debe deshabilitarse fuera de la prueba.
- El correo es simulado; el puerto puede reemplazarse por SES sin cambiar el dominio.
- La tercera aprobación genera el PDF de forma síncrona para simplificar la prueba. En alto volumen conviene usar EventBridge/SQS/Step Functions.
