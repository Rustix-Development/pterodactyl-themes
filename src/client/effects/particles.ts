export type EffectKind = 'snow' | 'bats' | 'leaves' | 'confetti';
export type EffectAmount = 'subtle' | 'full';

export interface Size {
    width: number;
    height: number;
}

interface Flake {
    x: number;
    y: number;
    r: number;
    vy: number;
    sway: number;
    phase: number;
    alpha: number;
}

interface Bat {
    x: number;
    y: number;
    size: number;
    vx: number;
    flap: number;
    flapSpeed: number;
    bob: number;
    wait: number;
}

const SNOW = {
    subtle: { area: 26000, max: 60 },
    full: { area: 11000, max: 140 },
};

const BATS = { subtle: 3, full: 7 };

/** Leaves and confetti are bigger than snow, so fewer of them fill a screen. */
const PIECES = {
    leaves: { subtle: { area: 60000, max: 18 }, full: { area: 30000, max: 40 } },
    confetti: { subtle: { area: 40000, max: 30 }, full: { area: 16000, max: 90 } },
};

/** How many particles a viewport gets: scaled by its area and capped, so phones get fewer. */
export function particleCount(kind: EffectKind, amount: EffectAmount, { width, height }: Size): number {
    if (kind === 'bats') return width < 640 ? Math.ceil(BATS[amount] / 2) : BATS[amount];

    const { area, max } = kind === 'snow' ? SNOW[amount] : PIECES[kind][amount];
    return Math.max(6, Math.min(max, Math.round((width * height) / area)));
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

interface Piece {
    x: number;
    y: number;
    size: number;
    vy: number;
    sway: number;
    phase: number;
    angle: number;
    spin: number;
    color: number;
}

function piece(kind: 'leaves' | 'confetti', size: Size, top = false): Piece {
    const leaf = kind === 'leaves';
    const s = leaf ? between(9, 16) : between(5, 9);
    return {
        x: between(0, size.width),
        y: top ? between(-60, -10) : between(0, size.height),
        size: s,
        vy: leaf ? between(28, 55) : between(50, 95),
        sway: leaf ? between(20, 45) : between(6, 16),
        phase: between(0, Math.PI * 2),
        angle: between(0, Math.PI * 2),
        spin: between(-2.2, 2.2),
        color: Math.floor(Math.random() * 8),
    };
}

/** A leaf: two curves meeting at the tips, and a stem. */
function drawLeaf(ctx: CanvasRenderingContext2D, p: Piece) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(p.size, p.size);
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.quadraticCurveTo(0.75, -0.2, 0, 1);
    ctx.quadraticCurveTo(-0.75, -0.2, 0, -1);
    ctx.fill();
    ctx.fillRect(-0.04, 0.9, 0.08, 0.35);
    ctx.restore();
}

/** A strip of confetti, turning over as it falls (the width follows the turn). */
function drawConfetti(ctx: CanvasRenderingContext2D, p: Piece) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(Math.max(0.15, Math.abs(Math.cos(p.angle * 2))), 1);
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
}

function flake(size: Size, top = false): Flake {
    const r = between(1, 3.2);
    return {
        x: between(0, size.width),
        y: top ? between(-40, -4) : between(0, size.height),
        r,
        // Bigger flakes are nearer, so they fall faster.
        vy: 18 + r * 14,
        sway: between(6, 18),
        phase: between(0, Math.PI * 2),
        alpha: between(0.45, 0.9),
    };
}

function bat(size: Size, wait: number): Bat {
    const fromLeft = Math.random() < 0.5;
    const s = between(18, 30);
    return {
        x: fromLeft ? -s * 2 : size.width + s * 2,
        y: between(size.height * 0.08, size.height * 0.6),
        size: s,
        vx: (fromLeft ? 1 : -1) * between(45, 85),
        flap: between(0, Math.PI * 2),
        flapSpeed: between(9, 13),
        bob: between(0, Math.PI * 2),
        wait,
    };
}

type Point = [number, number];

/** One wing, right of the body, with its tip raised by `lift` (-0.4 to 1). Three scallops on the trailing edge. */
function wing(ctx: CanvasRenderingContext2D, lift: number) {
    const wristY = -0.3 - 0.5 * lift;
    const tipY = -0.05 - 0.65 * lift;
    const tip: Point = [1, tipY];
    const fingers: Point[] = [[0.76, tipY * 0.45 + 0.1], [0.5, wristY * 0.2 + 0.2], [0.1, 0.16]];

    ctx.beginPath();
    ctx.moveTo(0.08, -0.12);
    ctx.quadraticCurveTo(0.3, wristY - 0.08, 0.55, wristY);
    ctx.quadraticCurveTo(0.8, wristY + (tipY - wristY) * 0.3 - 0.06, tip[0], tip[1]);
    let from = tip;
    for (const to of fingers) {
        // Each scallop bows in towards the body.
        ctx.quadraticCurveTo((from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.1, to[0], to[1]);
        from = to;
    }
    ctx.closePath();
    ctx.fill();
}

function drawBat(ctx: CanvasRenderingContext2D, b: Bat, bobY: number) {
    const lift = 0.3 + 0.7 * Math.sin(b.flap);
    ctx.save();
    ctx.translate(b.x, b.y + bobY);
    ctx.scale(b.size, b.size);
    // Body, head and ears.
    ctx.beginPath();
    ctx.ellipse(0, 0.04, 0.12, 0.22, 0, 0, Math.PI * 2);
    ctx.moveTo(-0.1, -0.12);
    ctx.lineTo(-0.09, -0.32);
    ctx.lineTo(-0.03, -0.19);
    ctx.lineTo(0.03, -0.19);
    ctx.lineTo(0.09, -0.32);
    ctx.lineTo(0.1, -0.12);
    ctx.closePath();
    ctx.fill();
    // Filled one by one: a mirrored path in the same fill would cancel out where it overlaps the body.
    wing(ctx, lift);
    ctx.scale(-1, 1);
    wing(ctx, lift);
    ctx.restore();
}

/** The particles of one effect: `step` moves them on by `dt` seconds and draws them. */
export function createScene(kind: EffectKind, amount: EffectAmount, size: Size) {
    let flakes: Flake[] = [];
    let bats: Bat[] = [];
    let pieces: Piece[] = [];
    let time = 0;

    function resize(next: Size) {
        size = next;
        const count = particleCount(kind, amount, size);
        if (kind === 'snow') {
            flakes = flakes.slice(0, count);
            while (flakes.length < count) flakes.push(flake(size));
        } else if (kind === 'leaves' || kind === 'confetti') {
            pieces = pieces.slice(0, count);
            while (pieces.length < count) pieces.push(piece(kind, size));
        } else {
            bats = bats.slice(0, count);
            // Bats come in one by one rather than as a flock.
            while (bats.length < count) bats.push(bat(size, bats.length * between(1.5, 3)));
        }
    }

    function step(ctx: CanvasRenderingContext2D, dt: number, colors: string[]) {
        time += dt;
        ctx.clearRect(0, 0, size.width, size.height);
        const color = colors[0] ?? '#ffffff';
        ctx.fillStyle = color;

        if (kind === 'leaves' || kind === 'confetti') {
            ctx.globalAlpha = kind === 'leaves' ? 0.85 : 0.9;
            for (const p of pieces) {
                p.y += p.vy * dt;
                p.angle += p.spin * dt;
                const x = p.x + Math.sin(time * (kind === 'leaves' ? 0.9 : 2) + p.phase) * p.sway;
                if (p.y - p.size * 2 > size.height) Object.assign(p, piece(kind, size, true));
                ctx.fillStyle = colors[p.color % colors.length] ?? color;
                (kind === 'leaves' ? drawLeaf : drawConfetti)(ctx, { ...p, x });
            }
            ctx.globalAlpha = 1;
            return;
        }

        if (kind === 'snow') {
            for (const f of flakes) {
                f.y += f.vy * dt;
                const x = f.x + Math.sin(time * 0.6 + f.phase) * f.sway;
                if (f.y - f.r > size.height) Object.assign(f, flake(size, true));
                ctx.globalAlpha = f.alpha;
                ctx.beginPath();
                ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            return;
        }

        ctx.globalAlpha = 0.9;
        for (let i = 0; i < bats.length; i++) {
            const b = bats[i];
            if (b.wait > 0) {
                b.wait -= dt;
                continue;
            }
            b.x += b.vx * dt;
            b.flap += b.flapSpeed * dt;
            b.bob += dt * 1.6;
            const gone = b.vx > 0 ? b.x - b.size * 2 > size.width : b.x + b.size * 2 < 0;
            if (gone) {
                bats[i] = bat(size, between(3, 9));
                continue;
            }
            drawBat(ctx, b, Math.sin(b.bob) * 14);
        }
        ctx.globalAlpha = 1;
    }

    resize(size);

    return {
        resize,
        step,
        get count() {
            return kind === 'snow' ? flakes.length : kind === 'bats' ? bats.length : pieces.length;
        },
    };
}
