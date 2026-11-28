/* Parts library, discrete + sources + power.
   Geometry is in grid units (1 unit = 10px). Pins sit on integer or half-integer grid points.
   Primitives: l=line[x1,y1,x2,y2]  r=rect[x,y,w,h]  c=circle[cx,cy,r]  p=polygon[x1,y1,...] (f:1 fills)
               d=svg path (grid units)  x=text[x,y] (s=text, a=s|m|e anchor, z=size)
   Pin: {n:number, name, x, y}  */
window.PARTS = window.PARTS || [];
(function () {
  const P = window.PARTS;
  const add = (id, name, cat, ref, pins, draw, extra) =>
    P.push(Object.assign({ id, name, cat, ref, pins, draw, builtin: true }, extra || {}));
  const pin = (n, name, x, y) => ({ n: String(n), name, x, y });
  const L = (...p) => ({ t: 'l', p }), R = (...p) => ({ t: 'r', p }), C = (...p) => ({ t: 'c', p });
  const POLY = (f, ...p) => ({ t: 'p', p, f }), D = (d, f) => ({ t: 'd', d, f });
  const T = (x, y, s, a, z) => ({ t: 'x', p: [x, y], s, a: a || 'm', z: z || 1 });

  /* ---------- Passive ---------- */
  const res = [pin(1, '1', -4, 0), pin(2, '2', 4, 0)];
  add('R', 'Resistor', 'Passive', 'R', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6)], { value: '1k' });
  add('R_US', 'Resistor (zigzag)', 'Passive', 'R', res, [D('M-4 0H-2.5L-2 -1L-1 1L0 -1L1 1L2 -1L2.5 0H4')], { value: '1k' });
  add('POT', 'Potentiometer', 'Passive', 'RV', [pin(1, '1', -4, 0), pin(2, '2', 4, 0), pin(3, 'W', 0, 3)],
    [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6), L(0, 3, 0, 1.6), POLY(1, 0, .9, -.5, 1.8, .5, 1.8)], { value: '10k' });
  add('RTRIM', 'Trimmer resistor', 'Passive', 'RV', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6), L(-1.5, 1.8, 1.5, -1.8), POLY(1, 1.5, -1.8, .6, -1.5, 1.2, -.7)], { value: '10k' });
  add('LDR', 'LDR (photoresistor)', 'Passive', 'R', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6), L(-2.5, -3, -1, -1.5), POLY(1, -1, -1.5, -1.8, -1.6, -1.3, -2.2), L(-1.2, -3.2, .3, -1.7), POLY(1, .3, -1.7, -.5, -1.8, 0, -2.4)], { value: 'LDR' });
  add('NTC', 'Thermistor', 'Passive', 'RT', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6), L(-2.5, 2, -1.5, 2), L(-1.5, 2, 1.5, -2), T(2.5, -2, 't°', 'm', 1)], { value: '10k NTC' });
  add('C', 'Capacitor', 'Passive', 'C', [pin(1, '1', -3, 0), pin(2, '2', 3, 0)], [L(-3, 0, -.5, 0), L(.5, 0, 3, 0), L(-.5, -1.6, -.5, 1.6), L(.5, -1.6, .5, 1.6)], { value: '100n' });
  add('CP', 'Capacitor (polarised)', 'Passive', 'C', [pin(1, '+', -3, 0), pin(2, '-', 3, 0)], [L(-3, 0, -.5, 0), L(.5, 0, 3, 0), L(-.5, -1.6, -.5, 1.6), D('M1 -1.6Q-.2 0 1 1.6'), T(-1.6, -1.3, '+', 'm', 1)], { value: '100u' });
  add('CVAR', 'Variable capacitor', 'Passive', 'C', [pin(1, '1', -3, 0), pin(2, '2', 3, 0)], [L(-3, 0, -.5, 0), L(.5, 0, 3, 0), L(-.5, -1.6, -.5, 1.6), L(.5, -1.6, .5, 1.6), L(-2, 2, 2, -2), POLY(1, 2, -2, .9, -1.6, 1.6, -.9)], { value: '10-50p' });
  add('L', 'Inductor', 'Passive', 'L', res, [D('M-4 0H-3a1 1 0 0 1 2 0a1 1 0 0 1 2 0a1 1 0 0 1 2 0H4')], { value: '10u' });
  add('LCORE', 'Inductor (iron core)', 'Passive', 'L', res, [D('M-4 0H-3a1 1 0 0 1 2 0a1 1 0 0 1 2 0a1 1 0 0 1 2 0H4'), L(-3, -1.6, 3, -1.6), L(-3, -1.9, 3, -1.9)], { value: '100m' });
  add('XTAL', 'Crystal', 'Passive', 'Y', [pin(1, '1', -3, 0), pin(2, '2', 3, 0)], [L(-3, 0, -1.4, 0), L(1.4, 0, 3, 0), L(-1.4, -1.4, -1.4, 1.4), L(1.4, -1.4, 1.4, 1.4), R(-.7, -1.6, 1.4, 3.2)], { value: '16MHz' });
  add('FUSE', 'Fuse', 'Passive', 'F', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), R(-2, -.8, 4, 1.6), L(-2, 0, 2, 0)], { value: '1A' });
  add('TRANSFORMER', 'Transformer', 'Passive', 'T', [pin(1, 'P1', -4, -3), pin(2, 'P2', -4, 3), pin(3, 'S1', 4, -3), pin(4, 'S2', 4, 3)],
    [L(-4, -3, -2, -3), L(-4, 3, -2, 3), L(4, -3, 2, -3), L(4, 3, 2, 3),
     D('M-2 -3a1 1 0 0 1 0 2a1 1 0 0 1 0 2a1 1 0 0 1 0 2'), D('M2 -3a1 1 0 0 0 0 2a1 1 0 0 0 0 2a1 1 0 0 0 0 2'), L(-.3, -3, -.3, 3), L(.3, -3, .3, 3)], { value: '230:12' });

  /* ---------- Semiconductors ---------- */
  const dpins = [pin(1, 'A', -3, 0), pin(2, 'K', 3, 0)];
  const dbase = [L(-3, 0, -1, 0), L(1, 0, 3, 0), POLY(0, -1, -1.3, -1, 1.3, 1, 0), L(1, -1.3, 1, 1.3)];
  add('D', 'Diode', 'Semiconductor', 'D', dpins, dbase, { value: '1N4148' });
  add('D_SCHOTTKY', 'Schottky diode', 'Semiconductor', 'D', dpins, [L(-3, 0, -1, 0), L(1, 0, 3, 0), POLY(0, -1, -1.3, -1, 1.3, 1, 0), D('M.5 -1.8V-1.3H1V1.3H1.5V1.8')], { value: '1N5819' });
  add('D_ZENER', 'Zener diode', 'Semiconductor', 'D', dpins, [L(-3, 0, -1, 0), L(1, 0, 3, 0), POLY(0, -1, -1.3, -1, 1.3, 1, 0), D('M.4 -1.8L1 -1.3V1.3L1.6 1.8')], { value: '5V1' });
  add('LED', 'LED', 'Semiconductor', 'D', dpins, dbase.concat([L(-1.5, -2, -.2, -3.3), POLY(1, -.2, -3.3, -1, -3.2, -.5, -2.6), L(-.5, -1.5, .8, -2.8), POLY(1, .8, -2.8, 0, -2.7, .3, -2.1)]), { value: 'RED' });
  add('PHOTODIODE', 'Photodiode', 'Semiconductor', 'D', dpins, dbase.concat([L(-2.8, -3.3, -1.6, -2), POLY(1, -1.6, -2, -2.4, -2.1, -1.9, -2.7), L(-1.6, -3.5, -.4, -2.2), POLY(1, -.4, -2.2, -1.2, -2.3, -.7, -2.9)]), { value: 'BPW34' });
  add('BRIDGE', 'Bridge rectifier', 'Semiconductor', 'BR', [pin(1, '~', -4, 0), pin(2, '~', 4, 0), pin(3, '+', 0, -4), pin(4, '-', 0, 4)],
    (() => { /* KiCad style: a diamond made of four diodes (anode -> cathode along each side) */
      const out = [], d = (ax, ay, kx, ky) => { let mx = (ax + kx) / 2, my = (ay + ky) / 2, ln = Math.hypot(kx - ax, ky - ay), ux = (kx - ax) / ln, uy = (ky - ay) / ln, nx = -uy, ny = ux; const r = n => Math.round(n * 100) / 100;
        const bx = mx - .6 * ux, by = my - .6 * uy, tx = mx + .6 * ux, ty = my + .6 * uy, w = .65; nx *= w; ny *= w;
        out.push(L(ax, ay, bx, by), L(tx, ty, kx, ky), L(r(bx + nx), r(by + ny), r(bx - nx), r(by - ny)), L(r(bx + nx), r(by + ny), r(tx), r(ty)), L(r(bx - nx), r(by - ny), r(tx), r(ty)), L(r(tx + nx), r(ty + ny), r(tx - nx), r(ty - ny))); };
      d(-4, 0, 0, -4); d(4, 0, 0, -4); d(0, 4, -4, 0); d(0, 4, 4, 0);
      out.push(T(-2.4, 0, '~', 'm', .9), T(2.4, 0, '~', 'm', .9), T(0, -2.5, '+', 'm', .9), T(0, 2.6, '-', 'm', .9)); return out; })(), { value: 'DB107' });
  add('SCR', 'Thyristor (SCR)', 'Semiconductor', 'Q', [pin(1, 'A', 0, -3), pin(2, 'K', 0, 3), pin(3, 'G', 3, 2)],
    [L(0, -3, 0, -1.2), L(0, 1.2, 0, 3), POLY(0, -1.3, -1.2, 1.3, -1.2, 0, 1.2), L(-1.3, 1.2, 1.3, 1.2), L(0, 1.2, 1.2, 2), L(1.2, 2, 3, 2)], { value: 'TYN612' });

  const npn = (id, name, isN) => {
    const arrow = isN ? POLY(1, 1.7, 1.9, .55, 1.8, 1.2, .95) : POLY(1, -.4, .6, .8, .75, .2, 1.5);
    add(id, name, 'Semiconductor', 'Q', [pin(1, 'B', -3, 0), pin(2, 'C', 2, -3), pin(3, 'E', 2, 3)],
      [C(.5, 0, 3), L(-3, 0, -1, 0), L(-1, -1.5, -1, 1.5), L(-1, -.7, 2, -2), L(2, -2, 2, -3), L(-1, .7, 2, 2), L(2, 2, 2, 3), arrow], { value: isN ? '2N3904' : '2N3906' });
  };
  npn('Q_NPN', 'NPN transistor', true); npn('Q_PNP', 'PNP transistor', false);
  add('Q_DARL_NPN', 'NPN Darlington (TIP120)', 'Semiconductor', 'Q', [pin(1, 'B', -5, 0), pin(2, 'C', 2, -4), pin(3, 'E', 2, 4)],
    [L(-5, 0, -3.5, 0), L(-3.5, -1.2, -3.5, 1.2), L(-3.5, -.6, -1.2, -1.6), L(-1.2, -1.6, -1.2, -2.5), L(-1.2, -2.5, 2, -2.5), L(2, -4, 2, 1.2),
     L(-3.5, .6, -1.2, 1.6), L(-1.2, 1.6, -1.2, 2.4), L(-1.2, 2.4, .5, 2.4), L(.5, 1.4, .5, 3.4), L(.5, 2, 2, 1.2), L(.5, 2.8, 2, 3.6), L(2, 3.6, 2, 4),
     POLY(1, 1.7, 3.5, .6, 3.4, 1.2, 2.7), POLY(1, -1.5, 1.2, -2.6, 1.1, -2.1, .5), C(-.2, 0, 4.6)], { value: 'TIP120' });
  add('Q_DARL_PNP', 'PNP Darlington (TIP125)', 'Semiconductor', 'Q', [pin(1, 'B', -5, 0), pin(2, 'C', 2, 4), pin(3, 'E', 2, -4)],
    [L(-5, 0, -3.5, 0), L(-3.5, -1.2, -3.5, 1.2), L(-3.5, .6, -1.2, 1.6), L(-1.2, 1.6, -1.2, 2.5), L(-1.2, 2.5, 2, 2.5), L(2, 4, 2, -1.2),
     L(-3.5, -.6, -1.2, -1.6), L(-1.2, -1.6, -1.2, -2.4), L(-1.2, -2.4, .5, -2.4), L(.5, -3.4, .5, -1.4), L(.5, -2, 2, -1.2), L(.5, -2.8, 2, -3.6), L(2, -3.6, 2, -4),
     POLY(1, -3, -.7, -1.9, -.6, -2.4, .1), C(-.2, 0, 4.6)], { value: 'TIP125' });
  const mos = (id, name, isN) => add(id, name, 'Semiconductor', 'Q', [pin(1, 'G', -3, 0), pin(2, 'D', 2, -3), pin(3, 'S', 2, 3)],
    [L(-3, 0, -1.5, 0), L(-1.5, -1.6, -1.5, 1.6), L(-1, -1.8, -1, -.9), L(-1, -.5, -1, .5), L(-1, .9, -1, 1.8), L(-1, -1.35, 2, -1.35), L(2, -1.35, 2, -3), L(-1, 1.35, 2, 1.35), L(2, 1.35, 2, 3), L(-1, 0, 1, 0),
     isN ? POLY(1, -1, 0, 0, -.5, 0, .5) : POLY(1, 1, 0, 0, -.5, 0, .5)], { value: isN ? '2N7000' : 'IRF9540' });
  mos('Q_NMOS', 'N-MOSFET', true); mos('Q_PMOS', 'P-MOSFET', false);
  add('Q_JFET_N', 'N-JFET', 'Semiconductor', 'Q', [pin(1, 'G', -3, 0), pin(2, 'D', 1, -3), pin(3, 'S', 1, 3)],
    [L(-3, 0, -.5, 0), L(-.5, -1.8, -.5, 1.8), L(-.5, -1.2, 1, -1.2), L(1, -1.2, 1, -3), L(-.5, 1.2, 1, 1.2), L(1, 1.2, 1, 3), POLY(1, -2, -.5, -1, 0, -2, .5)], { value: '2N5457' });
  add('OPTO', 'Optocoupler', 'Semiconductor', 'U', [pin(1, 'A', -5, -2), pin(2, 'K', -5, 2), pin(3, 'C', 5, -2), pin(4, 'E', 5, 2)],
    [R(-3.5, -4, 7, 8), L(-5, -2, -2.5, -2), L(-5, 2, -2.5, 2), L(-2.5, -2, -2.5, -.7), POLY(0, -3.3, -.7, -1.7, -.7, -2.5, .5), L(-3.3, .5, -1.7, .5), L(-2.5, .5, -2.5, 2), L(0, -3, 0, 3),
     L(5, -2, 2.5, -2), L(5, 2, 2.5, 2), L(1.2, -1, 2.5, -2), L(1.2, 1, 2.5, 2), L(1.2, -1.5, 1.2, 1.5), POLY(1, 2.3, 1.9, 1.6, 1.4, 1.1, 1.2)], { value: '4N35' });

  /* ---------- Sources & electromechanical ---------- */
  add('BAT', 'Battery cell', 'Source', 'BT', [pin(1, '+', 0, -3), pin(2, '-', 0, 3)], [L(0, -3, 0, -.5), L(0, .5, 0, 3), L(-1.6, -.5, 1.6, -.5), L(-.9, .5, .9, .5), T(1.3, -2, '+', 'm', 1)], { value: '9V' });
  add('VDC', 'DC voltage source', 'Source', 'V', [pin(1, '+', 0, -3), pin(2, '-', 0, 3)], [C(0, 0, 2), L(0, -3, 0, -2), L(0, 2, 0, 3), T(0, -.9, '+', 'm', 1), T(0, 1, '-', 'm', 1)], { value: '5V' });
  add('VAC', 'AC voltage source', 'Source', 'V', [pin(1, '1', 0, -3), pin(2, '2', 0, 3)], [C(0, 0, 2), L(0, -3, 0, -2), L(0, 2, 0, 3), D('M-1.2 0Q-.6 -1.4 0 0T1.2 0')], { value: '12V 50Hz' });
  add('IDC', 'Current source', 'Source', 'I', [pin(1, '1', 0, -3), pin(2, '2', 0, 3)], [C(0, 0, 2), L(0, -3, 0, -2), L(0, 2, 0, 3), L(0, 1.2, 0, -1.2), POLY(1, 0, -1.4, -.6, -.4, .6, -.4)], { value: '1mA' });
  add('SW', 'Switch SPST', 'Electromechanical', 'SW', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), C(-2, 0, .3), C(2, 0, .3), L(-1.8, -.2, 1.8, -2)], { value: 'SPST' });
  add('SW_PUSH', 'Push button', 'Electromechanical', 'SW', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), L(-2, 0, -2, -1), L(2, 0, 2, -1), L(-2.5, -1.4, 2.5, -1.4), L(0, -1.4, 0, -2.8), L(-1, -2.8, 1, -2.8)], { value: 'PUSH' });
  add('SW_SPDT', 'Switch SPDT', 'Electromechanical', 'SW', [pin(1, 'COM', -4, 0), pin(2, 'NO', 4, -1), pin(3, 'NC', 4, 1)],
    [L(-4, 0, -2, 0), L(2, -1, 4, -1), L(2, 1, 4, 1), C(-2, 0, .3), C(2, -1, .3), C(2, 1, .3), L(-1.8, -.2, 1.7, -1.9)], { value: 'SPDT' });
  add('RELAY', 'Relay SPDT', 'Electromechanical', 'K', [pin(1, 'A1', -5, -2), pin(2, 'A2', -5, 2), pin(3, 'COM', 5, 0), pin(4, 'NO', 5, -3), pin(5, 'NC', 5, 3)],
    [R(-3.5, -3, 3, 6), L(-5, -2, -3.5, -2), L(-5, 2, -3.5, 2), L(-3.5, -1.6, -.5, 1.6), L(.5, 0, 1.5, 0), L(5, 0, 3.7, 0), L(3.7, 0, 1.5, -1.8), L(5, -3, 3, -3), L(5, 3, 3, 3), C(3, -3, .3), C(3, 3, .3), T(-2, 0, 'K', 'm', 1)], { value: '5V' });
  add('MOTOR', 'DC motor', 'Electromechanical', 'M', [pin(1, '+', 0, -4), pin(2, '-', 0, 4)], [C(0, 0, 2.6), L(0, -4, 0, -2.6), L(0, 2.6, 0, 4), T(0, .1, 'M', 'm', 1.6)], { value: '6V' });
  add('SERVO', 'Servo motor', 'Electromechanical', 'M', [pin(1, 'GND', -5, -2), pin(2, 'V+', -5, 0), pin(3, 'SIG', -5, 2)],
    [R(-3, -3.5, 6, 7), L(-5, -2, -3, -2), L(-5, 0, -3, 0), L(-5, 2, -3, 2), C(.5, 0, 2), T(.5, 0, 'M', 'm', 1.5), T(0, -2.5, 'SERVO', 'm', .9)], { value: 'SG90' });
  add('LAMP', 'Lamp', 'Electromechanical', 'LA', res, [L(-4, 0, -2, 0), L(2, 0, 4, 0), C(0, 0, 2), L(-1.4, -1.4, 1.4, 1.4), L(-1.4, 1.4, 1.4, -1.4)], { value: '6V' });
  add('SPEAKER', 'Speaker', 'Electromechanical', 'LS', [pin(1, '+', -4, -1), pin(2, '-', -4, 1)], [L(-4, -1, -2, -1), L(-4, 1, -2, 1), R(-2, -1.8, 1.5, 3.6), POLY(0, -.5, -1.8, 2.5, -3.5, 2.5, 3.5, -.5, 1.8)], { value: '8R' });
  add('BUZZER', 'Buzzer', 'Electromechanical', 'BZ', [pin(1, '+', -4, -1), pin(2, '-', -4, 1)], [L(-4, -1, -2, -1), L(-4, 1, -2, 1), D('M-2 -2.5H1.5a3 3 0 0 1 0 5H-2Z'), T(-1, -1, '+', 'm', 1)], { value: 'BUZZ' });
  add('VM', 'Voltmeter', 'Electromechanical', 'PV', [pin(1, '+', 0, -4), pin(2, '-', 0, 4)], [C(0, 0, 2.5), L(0, -4, 0, -2.5), L(0, 2.5, 0, 4), T(0, .1, 'V', 'm', 1.6)], { value: '' });
  add('AM', 'Ammeter', 'Electromechanical', 'PA', [pin(1, '+', 0, -4), pin(2, '-', 0, 4)], [C(0, 0, 2.5), L(0, -4, 0, -2.5), L(0, 2.5, 0, 4), T(0, .1, 'A', 'm', 1.6)], { value: '' });

  /* ---------- Power & ground symbols ---------- */
  const pw = (id, name, label, kind) => add(id, name, 'Power', '#PWR', [pin(1, label, 0, 0)],
    kind === 'gnd' ? [L(0, 0, 0, 1), L(-1.5, 1, 1.5, 1), L(-1, 1.5, 1, 1.5), L(-.5, 2, .5, 2)]
      : kind === 'neg' ? [L(0, 0, 0, 1), L(-1.2, 1, 1.2, 1)]
        : [L(0, 0, 0, -1), L(-1.2, -1, 1.2, -1)], { power: true, value: label });
  pw('GND', 'Ground', 'GND', 'gnd'); pw('VCC', 'VCC', 'VCC', 'pos'); pw('V5', '+5V', '+5V', 'pos'); pw('V33', '+3V3', '+3V3', 'pos');
  pw('V12', '+12V', '+12V', 'pos'); pw('V9', '+9V', '+9V', 'pos'); pw('VNEG12', '-12V', '-12V', 'neg'); pw('VEE', 'VEE', 'VEE', 'neg'); pw('VBAT', '+VBAT', '+VBAT', 'pos');

  /* ---------- Logic gates ---------- */
  const gate = (id, name, body, inv, nin, ex) => {
    const ys = nin === 1 ? [0] : [-1, 1];
    const pins = ys.map((y, i) => pin(i + 1, nin === 1 ? 'A' : 'AB'[i], -5, y)).concat(pin(nin + 1, 'Y', 5, 0));
    const draw = [body, L(2.5 + (inv ? 1 : 0), 0, 5, 0)];
    ys.forEach(y => draw.push(L(-5, y, ex ? -2.4 : -2.7, y)));
    if (inv) draw.push(C(3, 0, .5));
    if (ex) draw.push(D('M-3.8 -2.5Q-2.3 0 -3.8 2.5'));
    add(id, name, 'Logic', 'U', pins, draw, { value: id.replace('G_', '') });
  };
  const AND = D('M-3 -2.5H0a2.5 2.5 0 0 1 0 5H-3Z'), OR = D('M-3 -2.5Q0 -2.5 3 0Q0 2.5 -3 2.5Q-1.5 0 -3 -2.5Z');
  gate('G_AND', 'AND gate', AND, 0, 2); gate('G_NAND', 'NAND gate', AND, 1, 2); gate('G_OR', 'OR gate', OR, 0, 2);
  gate('G_NOR', 'NOR gate', OR, 1, 2); gate('G_XOR', 'XOR gate', OR, 0, 2, 1); gate('G_XNOR', 'XNOR gate', OR, 1, 2, 1);
  add('G_NOT', 'NOT gate (inverter)', 'Logic', 'U', [pin(1, 'A', -5, 0), pin(2, 'Y', 5, 0)], [L(-5, 0, -2, 0), POLY(0, -2, -2, -2, 2, 2, 0), C(2.5, 0, .5), L(3, 0, 5, 0)], { value: 'NOT' });
  add('G_BUF', 'Buffer', 'Logic', 'U', [pin(1, 'A', -5, 0), pin(2, 'Y', 5, 0)], [L(-5, 0, -2, 0), POLY(0, -2, -2, -2, 2, 2, 0), L(2, 0, 5, 0)], { value: 'BUF' });
  add('G_SCHMITT', 'Schmitt inverter', 'Logic', 'U', [pin(1, 'A', -5, 0), pin(2, 'Y', 5, 0)], [L(-5, 0, -2, 0), POLY(0, -2, -2, -2, 2, 2, 0), C(2.5, 0, .5), L(3, 0, 5, 0), D('M-1.2 .6H-.3V-.6H.5')], { value: 'SCHMITT' });

  /* ---------- Op-amps / comparators ---------- */
  const oa = (id, name, v) => add(id, name, 'Analog', 'U', [pin(1, '-', -5, -2), pin(2, '+', -5, 2), pin(3, 'OUT', 6, 0), pin(4, 'V+', 0, -4), pin(5, 'V-', 0, 4)],
    [POLY(0, -3, -4, -3, 4, 4, 0), L(-5, -2, -3, -2), L(-5, 2, -3, 2), L(4, 0, 6, 0), L(0, -4, 0, -2.3), L(0, 4, 0, 2.3), T(-2.2, -2, '-', 'm', 1.2), T(-2.2, 2, '+', 'm', 1.2)], { value: v });
  oa('OPAMP', 'Op-amp', 'LM358'); oa('COMP', 'Comparator', 'LM393');
  add('REG_LINEAR', 'Voltage regulator (3-pin)', 'Analog', 'U', [pin(1, 'IN', -5, -1), pin(2, 'GND', 0, 4), pin(3, 'OUT', 5, -1)],
    [R(-3.5, -3, 7, 5), L(-5, -1, -3.5, -1), L(5, -1, 3.5, -1), L(0, 2, 0, 4), T(-2.7, -1, 'IN', 's', .9), T(2.7, -1, 'OUT', 'e', .9), T(0, 1.4, 'GND', 'm', .9)], { value: 'LM7805' });
  add('REG_ADJ', 'Adjustable regulator (LM317)', 'Analog', 'U', [pin(1, 'IN', -5, -1), pin(2, 'ADJ', 0, 4), pin(3, 'OUT', 5, -1)],
    [R(-3.5, -3, 7, 5), L(-5, -1, -3.5, -1), L(5, -1, 3.5, -1), L(0, 2, 0, 4), T(-2.7, -1, 'IN', 's', .9), T(2.7, -1, 'OUT', 'e', .9), T(0, 1.4, 'ADJ', 'm', .9)], { value: 'LM317' });
  add('TL431', 'Shunt reference (TL431)', 'Analog', 'U', [pin(1, 'K', 0, -3), pin(2, 'A', 0, 3), pin(3, 'REF', -3, 2)],
    [L(0, -3, 0, -1.2), L(0, 1.2, 0, 3), POLY(0, -1.3, -1.2, 1.3, -1.2, 0, 1.2), D('M-1.4 1.2H1.4'), L(-3, 2, -.8, 2), L(-.8, 2, -.8, 1.2)], { value: 'TL431' });

  /* ---------- Connectors & misc ---------- */
  const header = (n, rows) => {
    const pins = [], draw = [];
    const h = n * 2;
    draw.push(R(-1.5, -1, 3, h));
    for (let i = 0; i < n; i++) {
      pins.push(pin(i + 1, String(i + 1), -4, i * 2)); draw.push(L(-4, i * 2, -1.5, i * 2)); draw.push(C(-.4, i * 2, .5)); 
    }
    return { pins, draw };
  };
  [1, 2, 3, 4, 5, 6, 8].forEach(n => { const h = header(n); add('CONN_' + n, 'Connector ' + n + '-pin', 'Connector', 'J', h.pins, h.draw, { value: 'Conn_01x' + String(n).padStart(2, '0') }); });
  add('TP', 'Test point', 'Connector', 'TP', [pin(1, 'TP', 0, 0)], [C(0, 0, .6)], { value: 'TP' });
  add('JACK_DC', 'DC barrel jack', 'Connector', 'J', [pin(1, '+', -4, -1), pin(2, '-', -4, 1)], [L(-4, -1, -1, -1), L(-4, 1, -1, 1), R(-1, -2.5, 4, 5), C(1.5, 0, .8)], { value: '5.5mm' });
  add('USB_C', 'USB power (VBUS/GND)', 'Connector', 'J', [pin(1, 'VBUS', -5, -1), pin(2, 'D-', -5, 1), pin(3, 'D+', -5, 3), pin(4, 'GND', -5, 5)],
    [R(-3, -2.5, 6, 9), L(-5, -1, -3, -1), L(-5, 1, -3, 1), L(-5, 3, -3, 3), L(-5, 5, -3, 5), T(-2.5, -1, 'VBUS', 's', .9), T(-2.5, 1, 'D-', 's', .9), T(-2.5, 3, 'D+', 's', .9), T(-2.5, 5, 'GND', 's', .9)], { value: 'USB' });
})();
