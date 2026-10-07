/* ===============================================
   ILO — 3D Hero: LGS frame assembles in real time
   Instanced three.js build, drag-to-orbit, auto loop
   Falls back to the video background if WebGL fails
   =============================================== */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(() => {
    const mount = document.getElementById('hero3d');
    if (!mount) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || new URLSearchParams(location.search).has('built'); // ?built=1 → skip straight to the finished frame

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
        return; // keep video fallback
    }

    // 3D is live — fade out the fallback video layer
    document.querySelector('.hero-bg-video-container')?.classList.add('video-dimmed');

    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0f172a, 18, 42);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    // --- Lighting: cool key, warm rim, soft fill ---
    scene.add(new THREE.AmbientLight(0x334155, 1.6));
    const key = new THREE.DirectionalLight(0xbfe7ff, 2.2); key.position.set(8, 14, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff9a5a, 0.7); rim.position.set(-10, 6, -8); scene.add(rim);
    const under = new THREE.PointLight(0x38bdf8, 0.6, 30); under.position.set(0, 0.3, 0); scene.add(under);

    // --- Ground: subtle glowing grid ---
    const grid = new THREE.GridHelper(60, 60, 0x1e3a5f, 0x16263d);
    grid.position.y = -0.02;
    scene.add(grid);

    // ============================================
    // Parametric LGS frame: every member is one
    // instance of a unit box, sized via its matrix
    // ============================================
    const W = 8, D = 6, STOREY = 2.7, SPACING = 0.6, PITCH = 24 * Math.PI / 180;
    const T = 0.06, F = 0.11; // steel thickness / flange (slightly fat for screen readability)
    const members = []; // {p:[x,y,z], s:[sx,sy,sz], e:[rx,ry,rz], o:order}
    let order = 0;

    const add = (p, s, e = [0, 0, 0]) => members.push({ p, s, e, o: order });

    // Slab — separate mesh: concrete, no steel emissive
    const slab = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.5, 0.15, D + 0.5),
        new THREE.MeshStandardMaterial({ color: 0x2a3950, metalness: 0.1, roughness: 0.9 })
    );
    slab.position.y = 0.075;
    scene.add(slab);

    const wallRuns = [
        { len: W, yaw: 0, cx: 0, cz: -D / 2 },          // back
        { len: W, yaw: 0, cx: 0, cz: D / 2 },           // front
        { len: D, yaw: Math.PI / 2, cx: -W / 2, cz: 0 }, // left
        { len: D, yaw: Math.PI / 2, cx: W / 2, cz: 0 },  // right
    ];

    for (let storey = 0; storey < 2; storey++) {
        const base = 0.15 + storey * (STOREY + 0.25);

        // bottom tracks
        order = 1 + storey * 5;
        wallRuns.forEach(w => add([w.cx, base + T / 2, w.cz], [w.len, T, F], [0, w.yaw, 0]));

        // studs
        order = 2 + storey * 5;
        wallRuns.forEach(w => {
            const n = Math.round(w.len / SPACING);
            for (let i = 0; i <= n; i++) {
                const t = -w.len / 2 + i * (w.len / n);
                const x = w.yaw === 0 ? w.cx + t : w.cx;
                const z = w.yaw === 0 ? w.cz : w.cz + t;
                add([x, base + STOREY / 2, z], [T, STOREY, F], [0, w.yaw, 0]);
            }
        });

        // noggings (mid-height blocking)
        order = 3 + storey * 5;
        wallRuns.forEach(w => {
            const n = Math.round(w.len / SPACING);
            for (let i = 0; i < n; i++) {
                const t = -w.len / 2 + (i + 0.5) * (w.len / n);
                const x = w.yaw === 0 ? w.cx + t : w.cx;
                const z = w.yaw === 0 ? w.cz : w.cz + t;
                add([x, base + STOREY / 2, z], [w.len / n - T, T, F * 0.8], [0, w.yaw, 0]);
            }
        });

        // top tracks
        order = 4 + storey * 5;
        wallRuns.forEach(w => add([w.cx, base + STOREY - T / 2, w.cz], [w.len, T, F], [0, w.yaw, 0]));

        // floor cassette joists above ground storey
        if (storey === 0) {
            order = 5;
            const nj = Math.round(W / 0.4);
            for (let i = 0; i <= nj; i++) {
                const x = -W / 2 + i * (W / nj);
                add([x, base + STOREY + 0.115, 0], [T, 0.2, D], [0, 0, 0]);
            }
            add([0, base + STOREY + 0.115, -D / 2], [W, 0.2, T]);
            add([0, base + STOREY + 0.115, D / 2], [W, 0.2, T]);
        }
    }

    // Roof trusses — gable: each top chord runs eave (low) → ridge (high).
    // Rotation about X: -PITCH lifts the +z end, +PITCH lifts the -z end.
    const roofBase = 0.15 + 2 * (STOREY + 0.25) - 0.25 + T;
    const half = D / 2, rise = half * Math.tan(PITCH);
    const chordLen = Math.sqrt(half * half + rise * rise);
    const nt = Math.round(W / SPACING);
    for (let i = 0; i <= nt; i++) {
        order = 11 + Math.floor(i / 3);
        const x = -W / 2 + i * (W / nt);
        // bottom chord
        add([x, roofBase + T / 2, 0], [T, T * 1.4, D]);
        // top chords: -z side rises toward ridge (+z end up) and vice versa
        add([x, roofBase + rise / 2 + T, -half / 2], [T, T * 1.4, chordLen], [-PITCH, 0, 0]);
        add([x, roofBase + rise / 2 + T, half / 2], [T, T * 1.4, chordLen], [PITCH, 0, 0]);
        // king post + diagonal webs leaning toward the king post
        add([x, roofBase + rise / 2, 0], [T, rise, T * 1.4]);
        add([x, roofBase + rise * 0.3, -half * 0.45], [T, rise * 0.55, T * 1.2], [-0.45, 0, 0]);
        add([x, roofBase + rise * 0.3, half * 0.45], [T, rise * 0.55, T * 1.2], [0.45, 0, 0]);
    }
    // Ridge member tying the trusses together
    order = 16;
    add([0, roofBase + rise + T * 1.5, 0], [W + 0.2, T * 1.6, F]);

    // Purlins
    order = 17;
    for (const side of [-1, 1]) {
        for (let i = 1; i <= 4; i++) {
            const f = i / 4.6;
            add([0, roofBase + rise * (1 - f) + T * 2, side * half * f], [W + 0.3, T, F], [0, 0, 0]);
        }
    }

    const MAX_ORDER = 18;
    const COUNT = members.length;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xb9e2fa, metalness: 0.8, roughness: 0.3,
        emissive: 0x38bdf8, emissiveIntensity: 0.22
    });
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    const dummy = new THREE.Object3D();
    const euler = new THREE.Euler();

    // Per-member animation: each order-group gets a slice of the timeline
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const setProgress = (globalT) => {
        const st = easeOut(Math.max(0, Math.min(1, globalT * MAX_ORDER / 1.6)));
        slab.scale.setScalar(Math.max(0.001, st));
        for (let i = 0; i < COUNT; i++) {
            const m = members[i];
            const g0 = m.o / MAX_ORDER, g1 = (m.o + 1.6) / MAX_ORDER;
            let t = (globalT - g0) / (g1 - g0);
            t = Math.max(0, Math.min(1, t));
            const e = easeOut(t);
            const drop = (1 - e) * (4 + m.o * 0.15);
            dummy.position.set(m.p[0], m.p[1] + drop, m.p[2]);
            euler.set(m.e[0], m.e[1], m.e[2]);
            dummy.quaternion.setFromEuler(euler);
            const s = 0.001 + e * 0.999;
            dummy.scale.set(m.s[0] * s, m.s[1] * s, m.s[2] * s);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    };

    // --- Build-phase caption (ties animation to the sales pitch) ---
    const hud = document.getElementById('hero3dHud');
    const hudBar = document.getElementById('hero3dHudBar');
    const PHASES = [
        [0.00, 'Foundations & slab — Week 1'],
        [0.08, 'Ground floor frame — Week 2'],
        [0.30, 'Floor cassettes — Week 3'],
        [0.42, 'Upper floor frame — Week 4'],
        [0.60, 'Roof trusses — Week 5'],
        [0.92, 'Frame complete — Week 6 ✓'],
    ];
    const setHud = (t) => {
        if (!hud) return;
        let label = PHASES[0][1];
        for (const [at, txt] of PHASES) if (t >= at) label = txt;
        if (hud.dataset.label !== label) { hud.dataset.label = label; hud.textContent = label; }
        if (hudBar) hudBar.style.width = (Math.min(t, 1) * 100).toFixed(1) + '%';
    };

    // --- Camera orbit: auto-rotate + drag ---
    let yaw = -0.7, pitch = 0.34, targetYaw = yaw, targetPitch = pitch;
    let autoRotate = !reducedMotion;
    let radius = 22;
    const lookAt = new THREE.Vector3(0, 3.1, 0);

    let dragging = false, px = 0, py = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; autoRotate = false; });
    window.addEventListener('pointermove', e => {
        if (!dragging) return;
        targetYaw += (e.clientX - px) * 0.005;
        targetPitch = Math.max(0.08, Math.min(0.9, targetPitch + (e.clientY - py) * 0.003));
        px = e.clientX; py = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; setTimeout(() => { autoRotate = !reducedMotion; }, 4000); });

    // --- Resize ---
    const resize = () => {
        const w = mount.clientWidth, h = mount.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        // Desktop: hero copy owns the left half — shift the house right of it
        // and keep it framed at any aspect ratio
        const aspect = w / h;
        radius = aspect > 1.4 ? 22 : aspect > 0.9 ? 25 : 30;
        if (w > 900) camera.setViewOffset(w, h, -w * 0.19, h * 0.02, w, h);
        else camera.clearViewOffset();
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    // --- Timeline: build → hold → dissolve → rebuild ---
    // Animation time is accumulated per frame (dt-clamped), not wall-clock:
    // background-tab pauses must not fast-forward the build cycle.
    const BUILD_S = reducedMotion ? 0.001 : 9, HOLD_S = 14, FADE_S = 1.2;
    const CYCLE = BUILD_S + HOLD_S + FADE_S;
    let elapsed = 0, lastNow = null;
    let visible = true;

    const io = new IntersectionObserver(en => { visible = en[0].isIntersecting; }, { threshold: 0.02 });
    io.observe(mount);

    let lastProgress = -1;
    const frame = (now) => {
        requestAnimationFrame(frame);
        if (!visible) { lastNow = now; return; }

        if (lastNow !== null) elapsed += Math.min(now - lastNow, 100);
        lastNow = now;
        const cyc = (elapsed / 1000) % CYCLE;
        let p;
        if (cyc < BUILD_S) p = cyc / BUILD_S;
        else if (cyc < BUILD_S + HOLD_S) p = 1;
        else p = 1 - (cyc - BUILD_S - HOLD_S) / FADE_S; // quick dissolve

        if (reducedMotion) p = 1;
        if (Math.abs(p - lastProgress) > 0.0004) { setProgress(p); setHud(p); lastProgress = p; }

        if (autoRotate) targetYaw += 0.0016;
        yaw += (targetYaw - yaw) * 0.06;
        pitch += (targetPitch - pitch) * 0.06;
        camera.position.set(
            Math.sin(yaw) * Math.cos(pitch) * radius,
            Math.sin(pitch) * radius + 1.2,
            Math.cos(yaw) * Math.cos(pitch) * radius
        );
        camera.lookAt(lookAt);
        renderer.render(scene, camera);
    };
    setProgress(reducedMotion ? 1 : 0);
    requestAnimationFrame(frame);
})();
