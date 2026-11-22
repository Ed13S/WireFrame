/* Parts library, ICs, MCUs, modules, sensors. Box generator: pins listed as "num:name" strings. */
(function () {
  const P = window.PARTS;
  const CW = 0.68; // approx text width per char in grid units
  function box(id, name, cat, ref, value, sides, opts) {
    opts = opts || {};
    const parse = s => { const i = s.indexOf(':'); return { n: s.slice(0, i), name: s.slice(i + 1) }; };
    const Ls = (sides.l || []).map(parse), Rs = (sides.r || []).map(parse), Ts = (sides.t || []).map(parse), Bs = (sides.b || []).map(parse);
    const ml = Math.max(0, ...Ls.map(p => p.name.length)), mr = Math.max(0, ...Rs.map(p => p.name.length));
    let w = Math.ceil((ml + mr) * CW + 4); w = Math.max(w, Math.max(Ts.length, Bs.length) * 2 + 2, 8); if (w % 2) w++;
    const rows = Math.max(Ls.length, Rs.length), h = Math.max(rows * 2 + 2, (Ts.length || Bs.length) ? 8 : 4);
    const x0 = -w / 2, y0 = -h / 2, pins = [], draw = [{ t: 'r', p: [x0, y0, w, h] }];
    const sp = 2;
    Ls.forEach((p, i) => { const y = y0 + 2 + i * sp; if (p.name) { pins.push({ n: p.n, name: p.name, x: x0 - 3, y }); draw.push({ t: 'l', p: [x0 - 3, y, x0, y] }, { t: 'x', p: [x0 + .6, y], s: p.name, a: 's', z: 1 }); } });
    Rs.forEach((p, i) => { const y = y0 + 2 + i * sp; if (p.name) { pins.push({ n: p.n, name: p.name, x: -x0 + 3, y }); draw.push({ t: 'l', p: [-x0 + 3, y, -x0, y] }, { t: 'x', p: [-x0 - .6, y], s: p.name, a: 'e', z: 1 }); } });
    const topx = (k, i) => -((k - 1) * 2) / 2 + i * 2;
    Ts.forEach((p, i) => { const x = topx(Ts.length, i); pins.push({ n: p.n, name: p.name, x, y: y0 - 3 }); draw.push({ t: 'l', p: [x, y0 - 3, x, y0] }, { t: 'x', p: [x, y0 + .8], s: p.name, a: 'm', z: .85 }); });
    Bs.forEach((p, i) => { const x = topx(Bs.length, i); pins.push({ n: p.n, name: p.name, x, y: -y0 + 3 }); draw.push({ t: 'l', p: [x, -y0 + 3, x, -y0] }, { t: 'x', p: [x, -y0 - .8], s: p.name, a: 'm', z: .85 }); });
    if (opts.title) draw.push({ t: 'x', p: [0, y0 - .9], s: opts.title, a: 'm', z: 1 });
    const def = { id, name, cat, ref, value, pins, draw, kw: opts.kw || '' };
    if (!opts.noPush) { def.builtin = true; P.push(def); }
    return def;
  }
  window.buildBox = (id, name, cat, ref, value, sides, opts) => box(id, name, cat, ref, value, sides, Object.assign({}, opts, { noPush: true }));
  const seq = (a, b, f) => { const o = []; for (let i = a; i <= b; i++) o.push(f(i)); return o; };

  /* ---- Timers / analog ICs ---- */
  box('NE555', '555 timer', 'Analog IC', 'U', 'NE555', { l: ['2:TRIG', '6:THR', '5:CV', '4:RST'], r: ['3:OUT', '7:DIS'], t: ['8:VCC'], b: ['1:GND'] }, { kw: 'timer astable monostable' });
  box('LM358', 'LM358 dual op-amp (DIP-8)', 'Analog IC', 'U', 'LM358', { l: ['2:1IN-', '3:1IN+', '6:2IN-', '5:2IN+'], r: ['1:1OUT', '7:2OUT'], t: ['8:V+'], b: ['4:V-'] }, { kw: 'opamp' });
  box('LM741', '741 op-amp (DIP-8)', 'Analog IC', 'U', 'LM741', { l: ['2:IN-', '3:IN+', '1:OFS1', '5:OFS2'], r: ['6:OUT'], t: ['7:V+'], b: ['4:V-'] }, { kw: 'opamp' });
  box('LM393', 'LM393 dual comparator', 'Analog IC', 'U', 'LM393', { l: ['2:1IN-', '3:1IN+', '6:2IN-', '5:2IN+'], r: ['1:1OUT', '7:2OUT'], t: ['8:V+'], b: ['4:GND'] });
  box('LM386', 'LM386 audio amplifier', 'Analog IC', 'U', 'LM386', { l: ['2:IN-', '3:IN+', '1:GAIN', '8:GAIN'], r: ['5:OUT', '7:BYP'], t: ['6:V+'], b: ['4:GND'] });
  box('LM35', 'LM35 temperature sensor', 'Sensor', 'U', 'LM35', { l: ['1:+VS'], r: ['2:VOUT'], b: ['3:GND'] });
  box('ULN2003', 'ULN2003 Darlington array', 'Analog IC', 'U', 'ULN2003', { l: seq(1, 7, i => i + ':IN' + i), r: seq(1, 7, i => (17 - i) + ':OUT' + i), b: ['8:GND', '9:COM'] });
  box('L293D', 'L293D motor driver', 'Analog IC', 'U', 'L293D', { l: ['1:EN12', '2:1A', '7:2A', '9:EN34', '10:3A', '15:4A'], r: ['3:1Y', '6:2Y', '11:3Y', '14:4Y'], t: ['16:VCC1', '8:VCC2'], b: ['4:GND', '5:GND'] }, { kw: 'h-bridge dc motor' });
  box('L298N', 'L298N dual H-bridge', 'Analog IC', 'U', 'L298N', { l: ['5:IN1', '7:IN2', '10:IN3', '12:IN4', '6:ENA', '11:ENB'], r: ['2:OUT1', '3:OUT2', '13:OUT3', '14:OUT4'], t: ['4:VS', '9:VSS'], b: ['8:GND', '1:SENSA', '15:SENSB'] });
  box('MCP3008', 'MCP3008 8-ch ADC (SPI)', 'Analog IC', 'U', 'MCP3008', { l: seq(0, 7, i => (i + 1) + ':CH' + i), r: ['10:CS', '11:DIN', '12:DOUT', '13:CLK'], t: ['16:VDD', '15:VREF'], b: ['9:DGND', '14:AGND'] });
  box('DAC_MCP4725', 'MCP4725 12-bit DAC (I2C)', 'Analog IC', 'U', 'MCP4725', { l: ['5:SCL', '4:SDA'], r: ['1:VOUT', '6:A0'], t: ['3:VDD'], b: ['2:GND'] });
  box('AD9833', 'AD9833 waveform generator', 'Analog IC', 'U', 'AD9833', { l: ['2:MCLK', '5:FSYNC', '6:SCLK', '7:SDATA'], r: ['10:VOUT', '9:COMP'], t: ['1:VDD', '3:DGND'], b: ['8:AGND', '4:CAP'] }, { kw: 'frequency signal generator dds' });
  box('PCF8574', 'PCF8574 I/O expander (I2C)', 'Analog IC', 'U', 'PCF8574', { l: ['1:A0', '2:A1', '3:A2', '14:SCL', '15:SDA', '13:INT'], r: seq(0, 7, i => [4, 5, 6, 7, 9, 10, 11, 12][i] + ':P' + i), t: ['16:VDD'], b: ['8:VSS'] });
  box('REG_AMS1117', 'AMS1117-3.3 regulator', 'Analog IC', 'U', 'AMS1117-3.3', { l: ['3:VIN'], r: ['2:VOUT'], b: ['1:GND'] });

  /* ---- 74-series / CMOS logic ---- */
  const quadGate = (id, nm, fn) => box(id, nm, 'Digital IC', 'U', id, { l: ['1:1A', '2:1B', '4:2A', '5:2B', '9:3A', '10:3B', '12:4A', '13:4B'], r: ['3:1Y', '6:2Y', '8:3Y', '11:4Y'], t: ['14:VCC'], b: ['7:GND'] }, { kw: fn });
  quadGate('74HC00', '74HC00 quad NAND', 'nand'); quadGate('74HC02', '74HC02 quad NOR', 'nor'); quadGate('74HC08', '74HC08 quad AND', 'and');
  quadGate('74HC32', '74HC32 quad OR', 'or'); quadGate('74HC86', '74HC86 quad XOR', 'xor');
  box('74HC04', '74HC04 hex inverter', 'Digital IC', 'U', '74HC04', { l: ['1:1A', '3:2A', '5:3A', '9:4A', '11:5A', '13:6A'], r: ['2:1Y', '4:2Y', '6:3Y', '8:4Y', '10:5Y', '12:6Y'], t: ['14:VCC'], b: ['7:GND'] }, { kw: 'not inverter' });
  box('74HC74', '74HC74 dual D flip-flop', 'Digital IC', 'U', '74HC74', { l: ['2:1D', '3:1CLK', '4:1SD', '1:1RD', '12:2D', '11:2CLK', '10:2SD', '13:2RD'], r: ['5:1Q', '6:1Q̅', '9:2Q', '8:2Q̅'], t: ['14:VCC'], b: ['7:GND'] }, { kw: 'flipflop latch' });
  box('74HC138', '74HC138 3-to-8 decoder', 'Digital IC', 'U', '74HC138', { l: ['1:A0', '2:A1', '3:A2', '4:E1', '5:E2', '6:E3'], r: seq(0, 7, i => [15, 14, 13, 12, 11, 10, 9, 7][i] + ':Y' + i), t: ['16:VCC'], b: ['8:GND'] });
  box('74HC595', '74HC595 shift register', 'Digital IC', 'U', '74HC595', { l: ['14:SER', '11:SRCLK', '12:RCLK', '13:OE', '10:SRCLR'], r: ['15:QA', '1:QB', '2:QC', '3:QD', '4:QE', '5:QF', '6:QG', '7:QH', '9:QH\''], t: ['16:VCC'], b: ['8:GND'] }, { kw: 'shift register serial' });
  box('74HC165', '74HC165 PISO shift register', 'Digital IC', 'U', '74HC165', { l: ['11:A', '12:B', '13:C', '14:D', '3:E', '4:F', '5:G', '6:H', '2:CLK', '1:PL'], r: ['9:QH', '7:QH̅', '10:SER', '15:CE'], t: ['16:VCC'], b: ['8:GND'] });
  box('74HC161', '74HC161 4-bit counter', 'Digital IC', 'U', '74HC161', { l: ['2:CLK', '1:MR', '9:PE', '7:CEP', '10:CET', '3:P0', '4:P1', '5:P2', '6:P3'], r: ['14:Q0', '13:Q1', '12:Q2', '11:Q3', '15:TC'], t: ['16:VCC'], b: ['8:GND'] });
  box('CD4017', 'CD4017 decade counter', 'Digital IC', 'U', 'CD4017', { l: ['14:CLK', '13:CKEN', '15:RST'], r: seq(0, 9, i => [3, 2, 4, 7, 10, 1, 5, 6, 9, 11][i] + ':Q' + i).concat(['12:CO']), t: ['16:VDD'], b: ['8:VSS'] }, { kw: 'decade counter led chaser' });
  box('CD4511', 'CD4511 BCD to 7-seg', 'Digital IC', 'U', 'CD4511', { l: ['7:A', '1:B', '2:C', '6:D', '3:LT', '4:BI', '5:LE'], r: ['13:a', '12:b', '11:c', '10:d', '9:e', '15:f', '14:g'], t: ['16:VDD'], b: ['8:VSS'] });
  box('SEG7', '7-segment display (common cathode)', 'Display', 'DS', 'SEG7', { l: ['7:a', '6:b', '4:c', '2:d', '1:e', '9:f', '10:g', '5:DP'], b: ['3:COM', '8:COM'] });
  box('74HC14', '74HC14 hex Schmitt inverter', 'Digital IC', 'U', '74HC14', { l: ['1:1A', '3:2A', '5:3A', '9:4A', '11:5A', '13:6A'], r: ['2:1Y', '4:2Y', '6:3Y', '8:4Y', '10:5Y', '12:6Y'], t: ['14:VCC'], b: ['7:GND'] });
  box('74HC245', '74HC245 bus transceiver', 'Digital IC', 'U', '74HC245', { l: ['1:DIR', '19:OE'].concat(seq(1, 8, i => (i + 1) + ':A' + i)), r: seq(1, 8, i => (20 - i) + ':B' + i), t: ['20:VCC'], b: ['10:GND'] });

  /* ---- Microcontrollers & boards ---- */
  box('ATMEGA328P', 'ATmega328P (DIP-28)', 'MCU', 'U', 'ATmega328P', { l: ['1:PC6/RESET', '2:PD0/RXD', '3:PD1/TXD', '4:PD2/INT0', '5:PD3', '6:PD4', '11:PD5', '12:PD6', '13:PD7', '14:PB0'], r: ['15:PB1', '16:PB2/SS', '17:PB3/MOSI', '18:PB4/MISO', '19:PB5/SCK', '23:PC0/A0', '24:PC1/A1', '25:PC2/A2', '26:PC3/A3', '27:PC4/SDA', '28:PC5/SCL'], t: ['7:VCC', '20:AVCC', '21:AREF'], b: ['8:GND', '22:GND'] }, { kw: 'arduino uno avr' });
  box('ATTINY85', 'ATtiny85', 'MCU', 'U', 'ATtiny85', { l: ['1:PB5/RST', '2:PB3', '3:PB4'], r: ['5:PB0/MOSI', '6:PB1/MISO', '7:PB2/SCK'], t: ['8:VCC'], b: ['4:GND'] });
  box('ARDUINO_UNO', 'Arduino Uno', 'MCU', 'A', 'Uno', { l: ['1:RESET', '2:3V3', '3:5V', '4:GND', '5:GND', '6:VIN', '7:A0', '8:A1', '9:A2', '10:A3', '11:A4/SDA', '12:A5/SCL'], r: seq(0, 13, i => (20 + i) + ':D' + i).reverse().concat(['34:AREF']), b: [] }, { kw: 'arduino board' });
  box('ARDUINO_NANO', 'Arduino Nano', 'MCU', 'A', 'Nano', { l: ['1:VIN', '2:5V', '3:3V3', '4:GND', '5:RST', '6:A0', '7:A1', '8:A2', '9:A3', '10:A4/SDA', '11:A5/SCL', '12:A6', '13:A7'], r: seq(2, 13, i => (20 + i) + ':D' + i).reverse().concat(['40:D1/TX', '41:D0/RX']), b: [] });
  box('ESP32_DEVKIT', 'ESP32 DevKit (30-pin)', 'MCU', 'U', 'ESP32-DevKitC', { l: ['1:EN', '2:3V3', '3:GND', '4:VIN', '5:GPIO36', '6:GPIO39', '7:GPIO34', '8:GPIO35', '9:GPIO32', '10:GPIO33', '11:GPIO25', '12:GPIO26', '13:GPIO27', '14:GPIO14', '15:GPIO12'], r: ['16:GPIO13', '17:GPIO15', '18:GPIO2', '19:GPIO4', '20:GPIO16', '21:GPIO17', '22:GPIO5', '23:GPIO18', '24:GPIO19', '25:GPIO21/SDA', '26:GPIO22/SCL', '27:GPIO23', '28:GPIO1/TX', '29:GPIO3/RX', '30:GND'], b: [] }, { kw: 'esp32 wifi bluetooth' });
  box('ESP32_C3', 'ESP32-C3 SuperMini', 'MCU', 'U', 'ESP32-C3', { l: ['1:5V', '2:GND', '3:3V3', '4:GPIO4', '5:GPIO3', '6:GPIO2', '7:GPIO1', '8:GPIO0'], r: ['9:GPIO5', '10:GPIO6', '11:GPIO7', '12:GPIO8', '13:GPIO9', '14:GPIO10', '15:GPIO20/RX', '16:GPIO21/TX'], b: [] });
  box('PICO', 'Raspberry Pi Pico', 'MCU', 'U', 'RP2040', { l: seq(0, 14, i => (i + 1) + ':GP' + i), r: ['36:3V3', '37:3V3EN', '38:GND', '39:VSYS', '40:VBUS', '34:GP28', '32:GP27', '31:GP26', '30:RUN', '29:GP22', '27:GP21', '26:GP20', '25:GP19', '24:GP18', '22:GP17', '21:GP16'], b: [] });
  box('STM32_BLUEPILL', 'STM32 Blue Pill', 'MCU', 'U', 'STM32F103C8', { l: ['1:VBAT', '2:PC13', '3:PC14', '4:PC15', '5:PA0', '6:PA1', '7:PA2', '8:PA3', '9:PA4', '10:PA5', '11:PA6', '12:PA7', '13:PB0', '14:PB1'], r: ['40:3V3', '39:GND', '38:5V', '37:PB9', '36:PB8', '35:PB7/SDA', '34:PB6/SCL', '33:PB5', '32:PB4', '31:PB3', '30:PA15', '29:PA12', '28:PA11', '27:PA10', '26:PA9', '25:PA8'], b: [] });

  /* ---- Sensors & modules ---- */
  box('DHT11', 'DHT11 / DHT22 temp + humidity', 'Sensor', 'U', 'DHT11', { l: ['1:VCC', '2:DATA', '3:NC'], r: [], b: ['4:GND'] });
  box('HC_SR04', 'HC-SR04 ultrasonic sensor', 'Sensor', 'U', 'HC-SR04', { l: ['1:VCC', '2:TRIG', '3:ECHO', '4:GND'] });
  box('MPU6050', 'MPU-6050 accel + gyro (I2C)', 'Sensor', 'U', 'MPU6050', { l: ['1:VCC', '2:GND', '3:SCL', '4:SDA'], r: ['5:XDA', '6:XCL', '7:AD0', '8:INT'] });
  box('BME280', 'BME280 pressure/temp/humidity (I2C)', 'Sensor', 'U', 'BME280', { l: ['1:VIN', '2:GND', '3:SCL', '4:SDA'], r: ['5:CSB', '6:SDO'] });
  box('IR_RX', 'IR receiver (VS1838B)', 'Sensor', 'U', 'VS1838B', { l: ['1:OUT', '2:GND', '3:VCC'] });
  box('PIR', 'PIR motion sensor (HC-SR501)', 'Sensor', 'U', 'HC-SR501', { l: ['1:VCC', '2:OUT', '3:GND'] });
  box('LCD1602', '16x2 LCD (parallel)', 'Display', 'DS', 'LCD1602', { l: ['1:VSS', '2:VDD', '3:V0', '4:RS', '5:RW', '6:E', '15:A', '16:K'], r: seq(0, 7, i => (7 + i) + ':D' + i) });
  box('OLED_I2C', 'OLED 128x64 (I2C)', 'Display', 'DS', 'SSD1306', { l: ['1:GND', '2:VCC', '3:SCL', '4:SDA'] });
  box('SD_CARD', 'microSD module (SPI)', 'Module', 'U', 'SD', { l: ['1:VCC', '2:GND', '3:MISO', '4:MOSI', '5:SCK', '6:CS'] });
  box('NRF24', 'nRF24L01 radio', 'Module', 'U', 'nRF24L01', { l: ['1:GND', '2:VCC', '3:CE', '4:CSN', '5:SCK', '6:MOSI', '7:MISO', '8:IRQ'] });
  box('HX711', 'HX711 load cell amplifier', 'Module', 'U', 'HX711', { l: ['1:VCC', '2:DT', '3:SCK', '4:GND'], r: ['5:E+', '6:E-', '7:A-', '8:A+'] });
  box('RTC_DS3231', 'DS3231 real-time clock (I2C)', 'Module', 'U', 'DS3231', { l: ['1:VCC', '2:GND', '3:SCL', '4:SDA'], r: ['5:SQW', '6:32K'] });
  box('RELAY_MOD', 'Relay module (1-ch)', 'Module', 'U', 'Relay', { l: ['1:VCC', '2:GND', '3:IN'], r: ['4:COM', '5:NO', '6:NC'] });
  box('TP4056', 'TP4056 Li-ion charger', 'Module', 'U', 'TP4056', { l: ['1:IN+', '2:IN-'], r: ['3:B+', '4:B-', '5:OUT+', '6:OUT-'] });
  box('BUCK_LM2596', 'LM2596 buck converter', 'Module', 'U', 'LM2596', { l: ['1:IN+', '2:IN-'], r: ['3:OUT+', '4:OUT-'] });
  box('SOIL', 'Soil moisture sensor', 'Sensor', 'U', 'Soil', { l: ['1:VCC', '2:GND', '3:AO'] });
})();
