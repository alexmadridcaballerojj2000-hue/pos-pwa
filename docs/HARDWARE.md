# Guía de Hardware: Impresoras Térmicas y Cajón Portamonedas

Esta guía documenta la compatibilidad de hardware, transporte de datos, páginas de códigos y periféricos para el punto de venta **pos-pwa**.

---

## 1. Arquitectura de Impresión y Hardware

El sistema de impresión está diseñado bajo la filosofía **offline-first**:

1. **Representación intermedia (`ReceiptDoc`)**: Modelo puro en TypeScript agnóstico al canal de salida.
2. **Controlador unificado (`PrinterService`)**: Orquesta los controladores disponibles y proporciona conmutación por error (_fallback_) transparente.
3. **Canales de comunicación**:
   - **Navegador Web (`BrowserPrinter`)**: Fallback universal que utiliza iframe aislado y estilos CSS `@media print` calibrados a 58 mm o 80 mm.
   - **WebUSB (`WebUsbTransport` + `EscPosPrinter`)**: Comunicación binaria directa a impresoras USB mediante transferencias masivas (_Bulk OUT_).
   - **WebSerial (`WebSerialTransport` + `EscPosPrinter`)**: Comunicación con puertos serie COM o adaptadores USB-to-UART.

```
                  ┌───────────────────────────────┐
                  │          ReceiptDoc           │
                  │ (Representación Intermedia)   │
                  └──────────────┬────────────────┘
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        renderReceiptToHtml()       renderReceiptToEscPos()
                   │                           │
                   ▼                           ▼
            BrowserPrinter               EscPosPrinter
                   │                     ┌─────┴─────┐
                   ▼                     ▼           ▼
          Diálogo de Sistema          WebUSB     WebSerial
          (Cualquier browser)         (Chrome/   (Chrome/
                                       Edge)      Edge)
```

---

## 2. Modelos de Impresoras Térmicas Compatibles

| Fabricante         | Familia / Modelo     | Ancho      | Transición Recomendada       | Notas de Compatibilidad                                                                  |
| :----------------- | :------------------- | :--------- | :--------------------------- | :--------------------------------------------------------------------------------------- |
| **Epson**          | TM-T20III / TM-T20II | 80 mm      | WebUSB / WebSerial / Browser | Estándar de la industria. Soporte nativo para ESC/POS y corte parcial.                   |
| **Epson**          | TM-T88V / TM-T88VI   | 80 mm      | WebUSB / WebSerial / Browser | Alta velocidad. Excelente soporte para códigos QR y barras CODE128.                      |
| **Epson**          | TM-m30 / TM-m30II    | 58 / 80 mm | WebUSB / Browser             | Diseño compacto tipo cubo para tabletas y mostradores pequeños.                          |
| **Star Micronics** | TSP143IIIU / TSP100  | 80 mm      | WebUSB / Browser             | Requiere modo de emulación ESC/POS o fallback Browser. Puerto cajón en Pin 5.            |
| **Star Micronics** | TSP650II             | 80 mm      | WebSerial / Browser          | Puerto serie o USB con emulación de puerto COM.                                          |
| **Xprinter**       | XP-58IIH / XP-58     | 58 mm      | WebUSB / WebSerial           | Económica, 32 columnas. Bobina estrecha de 58 mm.                                        |
| **Xprinter**       | XP-80C / XP-N160II   | 80 mm      | WebUSB / WebSerial           | Económica, 48 columnas, auto-corte parcial y puerto RJ11 para cajón.                     |
| **Genéricas POS**  | POS-58 / POS-80      | 58 / 80 mm | WebUSB / WebSerial / Browser | La gran mayoría de dispositivos del mercado chino cumplen el subconjunto básico ESC/POS. |

---

## 3. Matriz de Compatibilidad de Navegadores y Sistemas Operativos

| Sistema Operativo          | Navegador                         |   WebUSB (Directo)    | WebSerial (COM)  | Fallback Browser (Diálogo) |
| :------------------------- | :-------------------------------- | :-------------------: | :--------------: | :------------------------: |
| **Windows 10 / 11**        | Google Chrome, MS Edge, Brave     |         ✅ Sí         |      ✅ Sí       |       ✅ Sí (100 %)        |
| **macOS**                  | Google Chrome, MS Edge            |         ✅ Sí         |      ✅ Sí       |       ✅ Sí (100 %)        |
| **Android 8+**             | Google Chrome (con cable USB-OTG) |         ✅ Sí         |      ❌ No       |       ✅ Sí (100 %)        |
| **Linux (Ubuntu/Debian)**  | Google Chrome, Chromium           | ✅ Sí (requiere udev) |      ✅ Sí       |       ✅ Sí (100 %)        |
| **iOS / iPadOS**           | Safari, Chrome iOS (WebKit)       |   ❌ No disponible    | ❌ No disponible |       ✅ Sí (100 %)        |
| **Firefox (Cualquier OS)** | Mozilla Firefox                   |    ❌ Sin soporte     |  ❌ Sin soporte  |       ✅ Sí (100 %)        |

> [!NOTE]
> Cuando un navegador no implementa la API WebUSB/WebSerial, el sistema lo detecta dinámicamente y conmuta automáticamente a `BrowserPrinter`, garantizando que ninguna venta quede sin emitir comprobante.

---

## 4. Páginas de Códigos (Codepages) y Caracteres en Español

Las impresoras térmicas ESC/POS utilizan una memoria ROM interna de tablas de caracteres de 8 bits. Para imprimir correctamente la letra **ñ**, **Ñ**, vocales con tilde (**á, é, í, ó, ú, Á, É, Í, Ó, Ú**), signos de apertura (**¿, ¡**) y el símbolo del **Euro (€)**, el controlador envía el comando `ESC t <n>`:

| Código     | Identificador ESC/POS       |  Valor Byte   | Cobertura                                          | Recomendación                                    |
| :--------- | :-------------------------- | :-----------: | :------------------------------------------------- | :----------------------------------------------- |
| **CP858**  | Multilingual Latin I + Euro | `19` (`0x13`) | Alfabeto español completo + `€`.                   | **Recomendada** para España y Europa Occidental. |
| **CP1252** | Windows Latin 1             | `16` (`0x10`) | Estándar de Windows para español e inglés.         | Ampliamente compatible en impresoras modernas.   |
| **CP437**  | OEM USA / Original PC       | `0` (`0x00`)  | Letras básicas acentuadas en minúsculas y `ñ`/`Ñ`. | Fallback para impresoras muy antiguas sin CP858. |

---

## 5. Cajón Portamonedas (Conexión RJ11 / RJ12)

El cajón portamonedas se conecta a la parte posterior de la impresora térmica mediante un conector estándar telefónico RJ11/RJ12 (cable 6P6C o 6P4C).

### Comando de Pulso Solenoide

La impresora genera una descarga eléctrica momentánea de 24V para liberar el pestillo magnético del cajón:

- Comando: `ESC p m t1 t2` (`0x1B, 0x70, m, t1, t2`)
- Duración del pulso de activación: `t1 × 2 ms` (valor por defecto: 60 ms).
- Duración del pulso de reposo: `t2 × 2 ms` (valor por defecto: 100 ms).

### Asignación de Pines (_Pinouts_)

- **Pin 2 (`m = 0`)**: Estándar universal empleado por **Epson**, **Samsung/Bixolon**, **Xprinter** y la gran mayoría de fabricantes OEM.
- **Pin 5 (`m = 1`)**: Estándar alternativo empleado por **Star Micronics** y modelos específicos de terminales bancarias.

En **Ajustes > Ticket / Recibo**, el usuario puede configurar tanto el pin (`Pin 2` o `Pin 5`) como la apertura automática tras completar cobros en efectivo.

---

## 6. Configuración Paso a Paso y Solución de Problemas

### 6.1. Configuración de Impresora WebUSB en Windows

1. Conecte la impresora térmica al puerto USB de la computadora y enciéndala.
2. Abra la aplicación en Google Chrome o Microsoft Edge y vaya a **Ajustes > Ticket / Recibo**.
3. Seleccione el controlador **WebUSB (Directo)**.
4. Haga clic en **Vincular Impresora USB**.
5. En la ventana emergente del navegador, seleccione su impresora térmica y presione **Conectar**.
6. Haga clic en **Imprimir Ticket de Prueba** para verificar alineación y caracteres.

> [!TIP]
> **Windows y Controladores WinUSB**: Si Windows asignó a la impresora un controlador propietario de cola de impresión exclusiva y el navegador no puede reclamar la interfaz USB (_claimInterface failed_), puede utilizar la herramienta abierta **Zadig** para sustituir el controlador del puerto USB por **WinUSB**.

### 6.2. Configuración en Android con Cable OTG

1. Conecte el cable adaptador USB-OTG al teléfono o tableta Android y enchufe el cable USB de la impresora.
2. Abra Chrome para Android e inicie sesión en la PWA.
3. Vaya a **Ajustes > Ticket / Recibo**, seleccione **WebUSB** y pulse **Vincular Impresora USB**.
4. Conceda permiso al diálogo del sistema operativo Android para acceder al dispositivo USB.

### 6.3. Configuración de Puerto Serial (WebSerial)

1. Conecte el cable serie o conversor USB-Serial a la máquina.
2. Vaya a **Ajustes > Ticket / Recibo**, elija **WebSerial (COM / RS232)**.
3. Seleccione la velocidad en baudios configurada en los interruptores DIP de la impresora (típicamente **9600** o **19200** bps).
4. Pulse **Vincular Puerto Serial** y seleccione el puerto `COMx` correspondiente.
