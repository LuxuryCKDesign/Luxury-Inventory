# Servidor de avisos push (Luxury Inventory)

Los teléfonos con los avisos activados reciben una notificación cuando:

- se agrega un trabajo (orden) nuevo,
- una orden pasa a **completado**,
- todas las piezas de un trabajo quedan cortadas y con edgeband en el taller (`ld:done:<trabajo>`),
- todos los muebles de un trabajo quedan armados (`ld:armado:<trabajo>`).

Cada teléfono elige qué avisos quiere o los silencia todos (⚙ Ajustes → Notificaciones de este teléfono).

## Qué hay aquí

| Archivo | Qué hace |
|---|---|
| `ld_push.sql` | Crea las tablas privadas `ld_push_subs`, `ld_push_log` y `ld_push_config` y el disparador sobre `kardex_store`. No cambia `kardex_store` ni sus datos. Si algo del aviso falla, el guardado sigue igual. |
| `functions/ld-push/index.ts` | La función que suscribe los teléfonos y manda los avisos. |
| `functions/ld-push/webpush.ts` | Web Push (firma VAPID y cifrado) solo con Web Crypto, sin librerías. |

No hay llaves que copiar: la función crea sus llaves VAPID la primera vez y las guarda en `ld_push_config`
(una tabla que la app no puede leer; solo la función, con la llave de servicio, y el disparador).

## Instalar (una sola vez)

1. Supabase → **SQL Editor** → pegar `ld_push.sql` → **Run**. Se puede volver a correr sin problema.
2. Supabase → **Edge Functions** → **Deploy a new function** → nombre `ld-push`, con los dos archivos
   (`index.ts` y `webpush.ts`). En la configuración de la función, **desactivar "Verify JWT"**: la base de
   datos la llama sin sesión y la función revisa su propia clave para mandar avisos.
   Con la CLI: `supabase functions deploy ld-push --no-verify-jwt`.
3. En el teléfono: Luxury Inventory → ⚙ Ajustes → Notificaciones de este teléfono → **Activar notificaciones** →
   **Enviar una de prueba**.

En iPhone los avisos solo funcionan con la app agregada a la pantalla de inicio (Safari → Compartir →
Agregar a pantalla de inicio) y abierta desde ahí.

## Revisar

- `select * from ld_push_log order by at desc limit 20;` — los avisos enviados (cuántos teléfonos los recibieron).
- `select device, who, prefs, fails, updated_at from ld_push_subs;` — los teléfonos suscritos.
